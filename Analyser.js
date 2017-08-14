"use strict";
const parse = require("acorn").parse;
const escodegen = require('escodegen');
const estemplate = require('estemplate');
const estraverse = require('estraverse');
const colors = require('colors/safe');
const i18n = require("i18n");
const __ = i18n.__;
const Syntax = estraverse.Syntax;
const VisitorKeys = estraverse.VisitorKeys;

i18n.configure({
    locales: ['zh-CN'],
    directory: __dirname + '/locales',
    defaultLocale: "zh-CN"
});

const BUILDIN_MODULE = {
    require: 1,
    exports: 1,
    module: 1,
};

const amdTemplate = estemplate.compile(
    "define(function (require, exports, module) {%= body %});", {
        attachComment: true
    });

function wrapAmd(program) {
    return amdTemplate({
        body: program.body
    });
}

const native_hasOwn = Object.prototype.hasOwnProperty;

function hasOwn(obj, key) {
    return obj !== null && obj !== undefined &&
        obj !== true && obj !== false &&
        native_hasOwn.call(obj, key);
}



function assert(condition, message) {
    message = message || "";
    if (condition !== true) {
        throw new Error(message);
    }
}

function isString(str) {
    return (typeof str) === "string";
}

function isAbsoluteId(id) {
    return isString(id) && id.length > 0 && id.indexOf(".") !== 0;
}


function walk(node, parent, hook, ctx) {
    let type;
    let key;
    let value;
    let hookName;
    let ret;

    if (!node) return;

    type = node.type;

    hookName = type;
    if (hasOwn(hook, hookName)) {
        ret = hook[hookName](node, parent, ctx);
        if (ret !== undefined) {
            if (ret.type === WALK_SKIP) {
                return node;
            } else if (ret.type === WALK_REMOVE) {
                return null;
            } else if (ret.type === WALK_REPLACE) {
                return ret.payload;
            } else {
                // TODO 不管？
            }
        }
    }

    if (hasOwn(VisitorKeys, type)) {
        VisitorKeys[type].forEach((key) => {
            value = node[key];
            hookName = type + "." + key;

            if (hasOwn(hook, hookName)) {
                ret = hook[hookName](value, parent, ctx);

                if (ret !== undefined) {
                    if (ret.type === WALK_SKIP) {
                        node[key] = value;
                        return;
                    } else if (ret.type === WALK_REMOVE) {
                        node[key] = null;
                        return;
                    } else if (ret.type === WALK_REPLACE) {
                        node[key] = ret.payload;
                        return;
                    } else {
                        // TODO 不管？
                    }
                }
            }

            if (Array.isArray(value)) {
                value = value.map((item) => {
                    return walk(item, {
                        parent: parent,
                        node: node
                    }, hook, ctx);
                });
            } else {
                node[key] = walk(value, {
                    parent: parent,
                    node: node
                }, hook, ctx);
            }

        });
    } else {
        // TODO Unknow type??
    }

    return node;
}

const WALK_SKIP = {};
const WALK_REMOVE = {};
const WALK_REPLACE = {};

walk.skip = () => {
    return {
        type: WALK_SKIP
    };
};

walk.remove = () => {
    return {
        type: WALK_REMOVE
    };
};

walk.replace = (payload) => {
    return {
        type: WALK_REPLACE,
        payload: payload
    };
};

/**
 * 相对id转换成绝对id
 *
 * @inner
 * @param {string} id 要转换的相对id
 * @param {string} baseId 当前所在环境id
 * @return {string} 绝对id
 */
function relative2absolute(id, baseId) {
    if (id.indexOf('.') !== 0) {
        return id;
    }

    var segs = baseId.split('/').slice(0, -1).concat(id.split('/'));
    var res = [];
    for (var i = 0; i < segs.length; i++) {
        var seg = segs[i];

        switch (seg) {
            case '.':
                break;
            case '..':
                if (res.length && res[res.length - 1] !== '..') {
                    res.pop();
                } else { // allow above root
                    res.push(seg);
                }
                break;
            default:
                seg && res.push(seg);
        }
    }

    return res.join('/');
}

function genLiteral(value) {
    // TODO RegExp
    return {
        type: Syntax.Literal,
        value: value,
        raw: JSON.stringify(value)
    };
}

function genLiteralArray(elements) {
    elements = elements.map((item) => {
        return genLiteral(item);
    });
    return {
        type: Syntax.ArrayExpression,
        elements: elements
    };
}

const LOG_LEVELS = ["debug", "info", "notice", "warning", "error"];

const LOG_LEVEL = LOG_LEVELS.reduce((map, name, index) => {
    map[name.toUpperCase()] = index;
    return map;
}, {});

colors.setTheme({
    "debug": "blue",
    "info": "green",
    "notice": "cyan",
    "warning": "yellow",
    "error": "red"
});

const HOOKS = {};

HOOKS[Syntax.CallExpression] = (node, parent, thisObj) => {
    let callee = node.callee;
    if (callee.type === Syntax.Identifier) {
        return thisObj.processCall(callee.name, node, parent);
    }
};

// 处理函数作用域
HOOKS[Syntax.ArrowFunctionExpression] =
    HOOKS[Syntax.FunctionDeclaration] =
    HOOKS[Syntax.FunctionExpression] =
    (node, parent, thisObj) => {
        return thisObj.processFunction(node, parent);
    };

// 处理变量定义
// TODO 还有变量提升 -_- ...
// TODO 要不要处理 with let 等等？-_-!!
HOOKS[Syntax.VariableDeclarator] =
    (node, parent, thisObj) => {
        return thisObj.processVariable(node, parent);
    };


class Analyser {
    static get LOG_LEVEL() {
        return LOG_LEVEL;
    }

    static get walk() {
        return walk;
    }

    constructor() {
        this.log = this.genLogger();
    }

    reset() {
        this.baseId = null;
        this.code = null;
        this.codeLines = null;
        this.fileName = null;
        this.defines = {};
        this.depends = [];
        this.requires = [];
        this.defineStack = [];
        this.currentDefine = {
            depends: this.depends,
            requires: this.requires
        };

        this.scopeStack = [];
        this.currentScope = {};

        this.logs = [];

        this.declareGlobalValues();
    }

    genLogger() {
        let logger = {};
        LOG_LEVELS.forEach((name, level) => {
            logger[name] = (msg, node) => {
                let log = {
                    level: level,
                    message: String(msg)
                };
                if (node && node.range) {
                    log.range = node.range;
                }
                if (node && node.loc) {
                    log.loc = node.loc.start;
                }
                this.logs.push(log);
            };
        });
        return logger;
    }

    printLog(level, stream) {
        if (level === undefined) {
            level = LOG_LEVEL.INFO;
        }
        this.logs.forEach((log) => {
            if (log.level >= level) {
                this.doPrintLog(log, stream);
            }
        });
    }

    doPrintLog(log, stream) {
        let fileName;
        let line;
        let column;
        let message;

        stream = stream || process.stderr;

        if (this.fileName) {
            fileName = this.fileName;
        } else if (this.baseId) {
            fileName = __("Module %s", this.baseId);
        } else {
            fileName = __("Unknow source");
        }

        if (log.loc) {
            line = log.loc.line;
            column = log.loc.column;
        } else {
            line = null;
            column = null;
        }

        switch (log.level) {
            case LOG_LEVEL.DEBUG:
                message = colors.debug(log.message);
                break;
            case LOG_LEVEL.INFO:
                message = colors.info(log.message);
                break;
            case LOG_LEVEL.NOTICE:
                message = colors.notice(log.message);
                break;
            case LOG_LEVEL.WARNING:
                message = colors.warning(log.message);
                break;
            case LOG_LEVEL.ERROR:
                message = colors.error(log.message);
                break;
            default:
                message = log.message;
        }

        stream.write(fileName + ":" + (line ? line + ":" + column + ": " : " ") + message + "\n");

        if (log.loc) {
            this.showLocation(log.loc, stream);
        }
    }

    showLocation(loc, stream) {
        const MAX_LINE = 80;
        const MIN_LINE = 10;
        let column = loc.column;
        let line = this.getSourceLine(loc.line);
        let start = 0;
        let end = MAX_LINE;
        let arrow = column;
        let output = [];
        //line.length;
        if (column > MAX_LINE) {
            start = column - MIN_LINE;
            end = start + MAX_LINE;
            arrow = MIN_LINE;
        }
        if (start > 0) {
            output.push(colors.green("..."));
            arrow += 3;
        }
        output.push(line.substring(start, end));
        if (end < line.length) {
            output.push(colors.green("..."));
        }
        output.push("\n", Array(arrow + 1).join(" "));
        output.push(colors.green("^"), "\n");

        stream.write(output.join(""));

    }

    getSourceLine(line) {
        if (this.codeLines === null) {
            this.codeLines = this.code.split("\n");
        }
        line = line | 0;
        return this.codeLines[Math.max(line - 1, 0)];
    }

    pushScope() {
        this.log.debug("push scope.");
        this.scopeStack.push(this.currentScope);
        this.currentScope = {};
    }

    popScope() {
        this.log.debug("pop scope:[" + Object.keys(this.currentScope).join(",") + "].");
        this.currentScope = this.scopeStack.pop();
    }

    declareValue(name, value) {
        this.log.debug("declare value:" + name + ".");
        this.currentScope[name] = value;
    }

    getValue(name) {
        let index;
        if (hasOwn(this.currentScope, name)) {
            return this.currentScope[name];
        }
        index = this.scopeStack.length;
        while (index--) {
            let scope = this.scopeStack[index];
            if (hasOwn(scope, name)) {
                return scope[name];
            }
        }
        return undefined;
    }

    genGlobalDefine() {
        return (node, parent) => {
            let args = node.arguments;
            let id = null;
            let dependencies = null;
            let factory = null;

            let modId = null;
            let modDeps = null;
            let modDepsAbsolute = null;
            let modParams = null;
            let module = null;

            let log = this.log;

            log.debug("process define", node);
            if (parent && parent.parent && parent.parent.node.type !== Syntax.Program) {
                log.warning(__("Define may not be called."), node);
            }

            switch (args.length) {
                case 0:
                    log.warning(__("The parameter of define cannot be empty."), node);
                    break;
                case 1:
                    // define(factory)
                    factory = args[0];
                    break;
                case 2:
                    // define(dependencies, factory)
                    // define(id, factory)
                    if (args[0].type === Syntax.ArrayExpression) {
                        dependencies = args[0];
                    } else {
                        id = args[0];
                    }
                    factory = args[1];
                    break;
                case 3:
                default:
                    // define(id, dependencies, factory)
                    id = args[0];
                    dependencies = args[1];
                    factory = args[2];
                    break;
            }

            // 校验并提取模块id
            if (id !== null) {
                if (id.type !== Syntax.Literal || !isString(id.value)) {
                    log.error(__("Id must be an literal string."), id);
                    return walk.skip();
                }
                if (!isAbsoluteId(id.value)) {
                    log.error(__("Id must be absolute."), id);
                    return walk.skip();
                }
                modId = id.value;
            } else {
                assert(this.baseId !== null, __("Base ID is undefined."));
                modId = this.baseId;
            }

            // 校验factory
            if (factory.type !== Syntax.FunctionExpression) {
                log.warning(__("Factory must be an function expression."), factory);
                return walk.skip();
            }

            modParams = factory.params;

            // 校验并提取模块依赖关系
            if (dependencies !== null) {
                // 依赖必须是数组表达式
                if (dependencies.type !== Syntax.ArrayExpression) {
                    log.warning(__("Dependencies must be an array expression."), dependencies);
                    return walk.skip();
                }

                let hasInvaLidId = false;
                modDeps = dependencies.elements.map((item) => {
                    if (item.type !== Syntax.Literal ||
                        !isString(item.value)
                    ) {
                        log.warning(__("Dependencie id must be an literal string."), item);
                        return null;
                    }
                    return item.value;
                });
                if (hasInvaLidId) {
                    return walk.skip();
                }
            } else {
                // 没有声明依赖时，factory 的参数个数不能大于 3 个
                if (modParams.length > 3) {
                    log.warning(__("When there is no declaration of dependency, the number of arguments for factory cannot be greater than 3."),
                        factory);
                    return walk.skip();
                }
                modDeps = ["require", "exports", "module"].slice(0, modParams.length);
            }

            // 初始化模块依赖数据结构
            module = {
                depends: [],
                requires: [],
            };
            this.defineStack.push(this.currentDefine);
            this.defines[modId] = this.currentDefine = module;

            // 准备分析 factory 内容
            this.pushScope();
            // 处理 factory 参数
            // 1.定义局部 require
            // 2.屏蔽外层同名变量
            modParams.forEach((param, index) => {
                // 参数名
                let paramName = param.name;
                // 依赖ID
                let depId = null;

                if (index < modDeps.length) {
                    depId = modDeps[index];
                }

                if (depId === 'require') {
                    // 如果依赖为 "require" 则声明局部 require 处理函数
                    this.declareValue(paramName, this.genLocalRequire(modId));
                } else {
                    // 否则，则将局部变量置为 undefined
                    // 以屏蔽外层同名变量
                    this.declareValue(paramName);
                }
            });

            // 开始分析函数体
            factory.body = walk(factory.body, {
                parent: parent,
                node: factory
            }, HOOKS, this);

            // 弹出变量作用域
            this.popScope();
            // 弹出 define
            this.currentDefine = this.defineStack.pop();

            if (id === null) {
                id = genLiteral(modId);
            }

            // 生成依赖表
            // 1. 如果没有定义，则将依赖关系填充完整
            // 2. 如果依赖之前定义过，则只是检查
            if (dependencies === null) {
                dependencies = genLiteralArray(modDeps.concat(module.depends));
            } else {
                // 如果分析出来的依赖模块未在声明的的依赖模块中则需要报错
                // 分析前，需要先将依赖 ID 转为绝对 ID
                modDepsAbsolute = modDeps.map((id) => {
                    return relative2absolute(id, modId);
                });
                let missModules = module.depends.filter((id) => {
                    return modDepsAbsolute.indexOf(id) < 0;
                });
                if (missModules.length > 0) {
                    log.warning(__("The dependent modules [%s] are not declared.", missModules.join(", ")),
                        dependencies);
                }

                // 将声明的依赖添加到模块的加载依赖中
                module.depends = modDepsAbsolute.filter((id) => {
                    return !BUILDIN_MODULE[id];
                });
            }

            node.arguments = [id, dependencies, factory];

            return walk.replace(node);
        };
    }

    genGlobalRequire() {
        return this.genLocalRequire(null);
    }

    genLocalRequire(baseId) {
        return (node, parent) => {
            let log = this.log;
            let args = node.arguments;
            let requireId = args[0];
            log.debug("process require", node);
            if (args.length === 0) {
                log.warning(__("The parameter of require cannot be empty."), node);
                return walk.skip();
            }

            if (!this.currentDefine) {
                log.error(__("Require must in a define factory."), node);
                return walk.skip();
            }

            let topLevelId = null;
            switch (requireId.type) {
                case Syntax.Literal:
                    if (baseId === null) {
                        // baseId为null时，为 global require
                        topLevelId = requireId.value;
                        if (!isAbsoluteId(topLevelId)) {
                            log.warning(__("Relative id is not allowed in global require."), requireId);
                            topLevelId = null;
                        }
                    } else {
                        topLevelId = relative2absolute(requireId.value, baseId);
                    }
                    if (topLevelId !== null) {
                        this.currentDefine.depends.push(topLevelId);
                    }
                    break;
                case Syntax.ArrayExpression:
                    requireId.elements.forEach((id) => {
                        topLevelId = null;
                        if (id.type === Syntax.Literal) {
                            if (baseId === null) {
                                // baseId为null时，为 global require
                                topLevelId = id.value;
                                if (!isAbsoluteId(topLevelId)) {
                                    log.warning(__("Relative id is not allowed in global require."), id);
                                    topLevelId = null;
                                }
                            } else {
                                topLevelId = relative2absolute(id.value, baseId);
                            }
                        } else {
                            log.warning(__("ID should be an literal string."), id);
                        }
                        if (topLevelId !== null) {
                            this.currentDefine.requires.push(topLevelId);
                        }
                    });
                    break;
                default:
                    log.warning(__("ID should be an literal string or array expression."), requireId);
            }
        };
    }

    declareGlobalValues() {
        this.declareValue("define", this.genGlobalDefine());
        this.declareValue("require", this.genGlobalRequire());
    }

    processCall(name, node, parent) {
        let callee = this.getValue(name);
        if (callee !== undefined) {
            return callee(node, parent);
        }
    }

    processFunction(node, parent) {
        let params = node.params;
        switch (node.type) {
            case Syntax.FunctionDeclaration:
                if (node.id !== null) {
                    this.declareValue(node.id.name);
                }
                this.pushScope();
                this.declareValue("arguments");
                break;
            case Syntax.FunctionExpression:
                this.pushScope();
                if (node.id !== null) {
                    this.declareValue(node.id.name);
                }
                this.pushScope();
                this.declareValue("arguments");
                break;
            case Syntax.ArrowFunctionExpression:
                this.pushScope();
                break;
        }

        if (params && params.length) {
            params.forEach((param) => {
                this.declareValue(param.name);
            });
        }

        // 开始分析函数体
        node.body = walk(node.body, {
            parent: parent,
            node: node
        }, HOOKS, this);

        switch (node.type) {
            case Syntax.FunctionDeclaration:
                this.popScope();
                break;
            case Syntax.FunctionExpression:
                this.popScope();
                this.popScope();
                break;
            case Syntax.ArrowFunctionExpression:
                this.popScope();
                break;
        }
        return walk.skip();
    }

    processVariable(node, parent) {
        assert(node.id.type === Syntax.Identifier, __("Variable id must be Identifier."));
        this.declareValue(node.id.name);
    }

    analyse(config) {
        this.reset();

        let code = config.code || "";
        let amdWrapper = !!config.amdWrapper;
        let baseId = config.baseId || null;
        let fileName = config.fileName;
        let sourceMapRoot = config.sourceMapRoot || null;
        // let useHash = !!config.useHash;
        let optimize = !!config.optimize;
        let ast;

        if (baseId !== null) {
            assert(isAbsoluteId(baseId), __("Base id must be absolute."));
        }
        this.baseId = baseId;
        this.code = code;
        this.fileName = fileName;

        try {
            ast = parse(code, {
                // attachComment: true,
                locations: true,
                range: true,
                loc: true,
                tolerant: true
            });
        } catch (e) {
            // 这里模拟一个node,
            // 以便定位错误位置
            this.log.error(e.message, {
                loc: {
                    start: e.loc
                }
            });
            throw e;
        }

        if (amdWrapper) {
            ast = wrapAmd(ast);
        }

        ast = walk(ast, null, HOOKS, this);

        let codegenConf = {
            sourceMap: true,
            sourceMapWithCode: true,
            format: {
                compact: optimize
            }
        };

        if (fileName) {
            codegenConf.sourceMap = fileName;
        } else if (baseId) {
            codegenConf.sourceMap = baseId;
        }

        if (sourceMapRoot) {
            codegenConf.sourceMapRoot = sourceMapRoot;
        }

        let output = escodegen.generate(ast, codegenConf);
        // let outputSource = source ? source : baseId;

        // if (useHash) {
        //     let hash = md5(output.code);

        //     if (/\.js$/.test(outputSource)) {
        //         outputSource = outputSource.replace(/\.js$/, `_${hash}.js`);
        //     } else {
        //         outputSource = outputSource + '_' + hash;
        //     }
        // }
        /*
        console.log("==", this.baseId, "===========================");
        console.log(code);
        console.log("---------------------------------------------");
        console.log(output.code);
        console.log("---------------------------------------------");
        console.log(output.map.toString());
        console.log("---------------------------------------------");
        console.log(this.defines);
        console.log(this.logs);
        console.log("=============================================");
        //*/
        // this.printLog(LOG_LEVEL.DEBUG);
        return {
            // state:"success" | "fail",
            output: output.code,
            defines: this.defines,
            depends: this.depends,
            requires: this.requires,
            map: output.map.toString(),
            // source: outputSource,
            logs: this.logs
        };
    }
}


//exports = module.exports = new Analyser();
module.exports = Analyser;
