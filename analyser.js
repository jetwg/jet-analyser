"use strict";
const esprima = require('esprima');
const escodegen = require('escodegen');
const estemplate = require('estemplate');
const crypto = require('crypto');
const estraverse = require('estraverse');
const colors = require('colors/safe');
const Syntax = estraverse.Syntax;
const VisitorKeys = estraverse.VisitorKeys;

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

function md5(data, len) {
    let md5sum = crypto.createHash('md5');
    let encoding = typeof data === 'string' ? 'utf8' : 'binary';

    md5sum.update(data, encoding);
    len = len || 8;

    return md5sum.digest('hex').substring(0, len);
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
// TODO 要不要处理 with let 等等？-_-!!
// TODO 还有变量提升 -_- ...
// TODO 还有 变量定义
HOOKS[Syntax.ArrowFunctionExpression] =
    HOOKS[Syntax.FunctionDeclaration] =
    HOOKS[Syntax.FunctionExpression] =
    (node, parent, thisObj) => {
        return thisObj.processFunction(node, parent);
    };


class Analyser {
    constructor() {
        this.log = this.genLogger();
    }

    reset() {
        this.baseId = null;
        this.code = null;
        this.codeLines = null;
        this.fileName = null;
        this.defines = {};
        this.defineStack = [];
        this.currentDefine = null;

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

    printLog(level) {
        if (level === undefined) {
            level = LOG_LEVEL.INFO;
        }
        this.logs.forEach((log) => {
            if (log.level >= level) {
                console.log(this.doPrintLog(log));
            }
        });
    }

    doPrintLog(log) {
        let output = [];
        let fileName;
        let lineNumber;
        let message;

        if (this.fileName) {
            fileName = this.fileName;
        } else if (this.baseId) {
            fileName = "Module " + this.baseId;
        } else {
            fileName = "Unknow source";
        }

        if (log.loc) {
            lineNumber = log.loc.line;
        } else {
            lineNumber = null;
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

        output.push(fileName, ":", lineNumber ? lineNumber + ": " : " ", message);

        if (log.loc) {
            output.push("\n", this.getLogLine(log.loc));
        }
        return output.join("");
    }

    getLogLine(loc) {
        const MAX_LINE = 80;
        const MIN_LINE = 10;
        let ret = [];
        let column = loc.column;
        let line = this.getSourceLine(loc.line);
        let start = 0;
        let end = MAX_LINE;
        let arrow = column;
        //line.length;
        if (column > MAX_LINE) {
            start = column - MIN_LINE;
            end = start + MAX_LINE;
            arrow = start + MIN_LINE;
        }
        if (start > 0) {
            ret.push(colors.green("..."));
            arrow += 3;
        }
        ret.push(line.substring(start, end));
        if (end < line.length) {
            ret.push(colors.green("..."));
        }
        ret.push("\n");
        while (arrow--) {
            ret.push(" ");
        }
        ret.push(colors.green("^"));
        return ret.join("");
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
                log.warning("Define may not be called.", node);
            }

            switch (args.length) {
                case 0:
                    log.warning("The parameter of define cannot be empty.", node);
                    return walk.skip();
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
                    log.warning("Id must be an literal string.", id);
                    return walk.skip();
                }
                if (!isAbsoluteId(id.value)) {
                    log.warning("Id must be absolute.", id);
                    return walk.skip();
                }
                modId = id.value;
            } else {
                assert(this.baseId !== null, "Base ID is undefined.");
                modId = this.baseId;
            }

            // 校验factory
            if (factory.type !== Syntax.FunctionExpression) {
                log.warning("Factory must be an function expression.", factory);
                return walk.skip();
            }

            modParams = factory.params;

            // 校验并提取模块依赖关系
            if (dependencies !== null) {
                // 依赖必须是数组表达式
                if (dependencies.type !== Syntax.ArrayExpression) {
                    log.warning("Dependencies must be an array expression.", dependencies);
                    return walk.skip();
                }

                let hasInvaLidId = false;
                modDeps = dependencies.elements.map((item) => {
                    if (item.type !== Syntax.Literal ||
                        !isString(item.value)
                    ) {
                        log.warning("Dependencie id must be an literal string.", item);
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
                    log.warning("When there is no declaration of dependency, the number of arguments for factory cannot be greater than 3.",
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
                    log.warning("The dependent modules " + missModules.join(",") + " are not declared.",
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
                log.warning("The parameter of require cannot be empty.", node);
                return walk.skip();
            }
            let topLevelId = null;
            switch (requireId.type) {
                case Syntax.Literal:
                    if (baseId === null) {
                        // baseId为null时，为 global require
                        topLevelId = requireId.value;
                        if (!isAbsoluteId(topLevelId)) {
                            log.warning("Relative id is not allowed in global require.", requireId);
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
                                    log.warning("Relative id is not allowed in global require.", id);
                                    topLevelId = null;
                                }
                            } else {
                                topLevelId = relative2absolute(id.value, baseId);
                            }
                        } else {
                            log.warning("ID should be an literal string.", id);
                        }
                        if (topLevelId !== null) {
                            this.currentDefine.requires.push(topLevelId);
                        }
                    });
                    break;
                default:
                    log.warning("ID should be an literal string or array expression.", requireId);
            }
        };
    }

    declareGlobalValues() {
        this.declareValue("define", this.genGlobalDefine());
        this.declareValue("require", this.genGlobalRequire());
    }

    processCall(name, node, parent) {
        let log = this.log;
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

    analyse(config) {
        this.reset();

        let code = config.code || "";
        let amdWrapper = !!config.amdWrapper;
        let baseId = config.baseId || null;
        let source = config.source;
        let useHash = !!config.useHash;
        let optimize = !!config.optimize;

        if (baseId !== null) {
            assert(isAbsoluteId(config.baseId), "Base id must be absolute.");
        }
        this.baseId = baseId;
        this.code = code;
        this.fileName = source;

        let ast = esprima.parse(code, {
            // attachComment: true,
            range: true,
            loc: true
        });

        if (amdWrapper) {
            let fs = require("fs");
            ast = wrapAmd(ast);
        }

        ast = walk(ast, null, HOOKS, this);

        let codegenConf = {
            sourceMap: true,
            // sourceContent: code,
            sourceMapWithCode: true,
            parse: esprima.parse,
            format: {
                compact: optimize
            }
        };

        if (source) {
            codegenConf.sourceMap = source;
        } else if (baseId) {
            codegenConf.sourceMap = baseId;
        }

        let output = escodegen.generate(ast, codegenConf);
        let outputSource = source ? source : baseId;

        if (useHash) {
            let hash = md5(output.code);

            if (/\.js$/.test(outputSource)) {
                outputSource = outputSource.replace(/\.js$/, `_${hash}.js`);
            } else {
                outputSource = outputSource + '_' + hash;
            }
        }
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
            map: output.map.toString(),
            source: outputSource,
            logs: this.logs
        };
    }
}

exports = module.exports = new Analyser();
exports.LOG_LEVEL = LOG_LEVEL;
