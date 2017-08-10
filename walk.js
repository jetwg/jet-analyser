"use strict";

const path = require('path');
const escodegen = require('escodegen');
const generator = require('./generator');

let AST_PROPS = {
    "Identifier": [],
    "Literal": [],
    "Program": ["body"],
    "ExpressionStatement": ["expression"],
    "BlockStatement": ["body"],
    "EmptyStatement": [],
    "DebuggerStatement": [],
    "WithStatement": ["object", "body"],
    "ReturnStatement": ["argument"],
    "LabeledStatement": ["label", "body"],
    "BreakStatement": ["label"],
    "ContinueStatement": ["label"],
    "IfStatement": ["test", "consequent", "alternate"],
    "SwitchStatement": ["discriminant", "cases"],
    "SwitchCase": ["test", "consequent"],
    "ThrowStatement": ["argument"],
    "TryStatement": ["block", "handler", "finalizer"],
    "CatchClause": ["param", "body"],
    "WhileStatement": ["test", "body"],
    "DoWhileStatement": ["body", "test"],
    "ForStatement": ["init", "test", "update", "body"],
    "ForInStatement": ["left", "right", "body"],
    "FunctionDeclaration": ["id", "params", "body"],
    "VariableDeclaration": ["declarations"],
    "VariableDeclarator": ["id", "init"],
    "ThisExpression": [],
    "ArrayExpression": ["elements"],
    "ObjectExpression": ["properties"],
    "Property": ["key", "value"],
    "FunctionExpression": ["id", "params", "body"],
    "UnaryExpression": ["argument"],
    "UpdateExpression": ["argument"],
    "BinaryExpression": ["left", "right"],
    "AssignmentExpression": ["left", "right"],
    "LogicalExpression": ["left", "right"],
    "MemberExpression": ["object", "property"],
    "ConditionalExpression": ["test", "consequent", "alternate"],
    "CallExpression": ["callee", "arguments"],
    "NewExpression": ["callee", "arguments"],
    "SequenceExpression": ["expressions"],
    // 以下为 ES6 新增的
    "ArrowFunctionExpression": ["id", "params", "body"],
    "TemplateLiteral": ['quasis', 'expressions'],
    'TemplateElement':[],
};

/**
 * 相对id转换成绝对id
 *
 * @inner
 * @param {string} id 要转换的相对id
 * @param {string} baseId 当前所在环境id
 * @return {string} 绝对id
 */
function relative2absolute (id, baseId) {
    if (id.indexOf('.') !== 0) {
        return id;
    }

    let segs = baseId.split('/').slice(0, -1).concat(id.split('/'));
    let res = [];
    for (let i = 0; i < segs.length; i++) {
        let seg = segs[i];

        switch (seg) {
            case '.':
                break;
            case '..':
                if (res.length && res[res.length - 1] !== '..') {
                    res.pop();
                }
                else { // allow above root
                    res.push(seg);
                }
                break;
            default:
                seg && res.push(seg);
        }
    }

    return res.join('/');
}

/**
 * 
 * ModuleExpressionNode 模块表达式节点（define，require）
 * 
 */

class ModuleExpressionNode {
    
    constructor (node, nodeId, config) {
        this.node = node;
        this.nodeId = nodeId;
        this.type = 'require';

        if (config.define) {
            this.type = 'define';
            this.moduleId = config.define;  // 模块id
        }

        this.nostate = config.nostate;      // 未声明define模块标识
        this.async = config.async;          // 异步require模块标识
        this.depends = config.depends;      // 同步依赖
        this.requires = config.requires;    // 异步依赖
    }
}

/**
 * 
 * Walker 基于ast node的解析执行器
 * 
 */

class Walker {

    constructor () {

    }

    config (params) {
        this.baseId = params.baseId;
        this.hooks = params.hooks;
        this.result = {
            state: 'success',
            output: '',
            defines: {},
            logs: []
        };
        this.allDefines = {};

        return this;
    }

    getAbsolutePath (current, filePath) {

        return relative2absolute(filePath, current);
    }

    arrayPush(array, element) {
        if (array.indexOf(element) === -1) {
            array.push(element);
        }
    }

    mergeDepends (meNode) {
        let self = this;
        let resDefines = this.result.defines;
        let allDefines = this.allDefines;
        let currResult;
        let currDefine;

        if (meNode.moduleId) {
            if (meNode.moduleId === '__current__') {
                meNode.moduleId = this.baseId;
            }

            this.current = meNode.moduleId;
            resDefines[this.current] = {
                depends: [],
                requires: []
            }
        }

        currResult = resDefines[this.current];
        currDefine = allDefines[this.current];

        meNode.depends.length && meNode.depends.forEach(dep => {
            dep = self.getAbsolutePath(self.current, dep);
            self.arrayPush(currDefine.depends, dep);
            self.arrayPush(currResult.depends, dep);
        });

        meNode.requires.length && meNode.requires.forEach(req => {
            req = self.getAbsolutePath(self.current, req);
            self.arrayPush(currDefine.requires, req);
            self.arrayPush(currResult.requires, req);
        });
    }

    checkDefines (meNode) {
        let nodeId = meNode.nodeId;
        let defNode;
        let defNodeId;

        // 处理define函数
        if (meNode.type === 'define') {
            for (let id in this.allDefines) {
                defNode = this.allDefines[id];
                defNodeId = defNode.nodeId;

                if (nodeId.length > defNodeId.length && nodeId.substring(0, defNodeId.length) === defNodeId) {
                    // define需要避免冲突外层define模块

                    this.result.logs.push({
                        type: 'error',
                        message: '出现嵌套define语法'
                    });
                    return false;
                }
            }
            // 保存符合规则的define模块
            this.allDefines[meNode.moduleId === '__current__' ? this.baseId : meNode.moduleId] = meNode;

            return true;
        }
        // 处理require及其他函数
        else if (meNode.type === 'require') {

            for (let id in this.allDefines) {
                defNode = this.allDefines[id];
                defNodeId = defNode.nodeId;

                if (nodeId.length > defNodeId.length && nodeId.substring(0, defNodeId.length) === defNodeId) {
                    // require依赖外层define模块
                    // 如果出现同步require，外层define模块有声明依赖，且未声明当前模板，则报错
                    if (!meNode.async && !defNode.nostate && defNode.depends.indexOf(meNode.depends[0]) === -1) {
                        this.result.logs.push({
                            type: 'error',
                            message: '出现未声明模块的require语法'
                        });
                        return false;
                    }

                    return true;
                }
            }
            this.result.logs.push({
                type: 'error',
                message: '出现无模块的require语法'
            });
            return false;
        }
    }

    exportDefineNode (meNode) {
        // 判断是否有模块定义
        if (meNode.moduleId) {
            let define = this.allDefines[meNode.moduleId];
            let args = meNode.node.arguments;
            let arg0 = args[0];
            let arg1 = args[1];
            let arg2 = args[2];

            let argModuleId = generator.genLiteral(meNode.moduleId);
            let argDepends = arg0.type === 'ArrayExpression' ? arg0 : (arg1 && arg1.type === 'ArrayExpression' ? arg1 : null);
            let argCallback = arg0.type === 'FunctionExpression' ? arg0 : (arg1 && arg1.type === 'FunctionExpression' ? arg1 : arg2);

            // 没有声明依赖
            if (!argDepends) {
                let array = ['require', 'exports', 'module'];

                argDepends = generator.genLiteralArray(array);

                if (!argCallback.params.length) {
                    // argCallback.params.push(generator.genIdentifier('require'));
                }

                // 添加内部模块依赖
                if (define) {
                    define.depends.forEach(dep => {
                        let hasDep = false;

                        argDepends.elements.forEach(ele => {
                            if (ele.value === dep) {
                                hasDep = true;
                            }
                        })

                        if (!hasDep) {
                            argDepends.elements.push(generator.genLiteral(dep));
                        }
                    });
                }
            }

            meNode.node.arguments = [
                argModuleId,
                argDepends,
                argCallback
            ];
        }
    }

    makeDepends (node, nodeId) {
        let hooks = this.hooks;
        let type = node.type;
        let result;
        let meNode;

        if (hooks && hooks.hasOwnProperty(type)) {
            result = hooks[type](node);

            if (result) {
                if (result.error) {
                    this.result.logs.push({
                        type: 'error',
                        message: result.error
                    });
                }

                meNode = new ModuleExpressionNode(node, nodeId, result);
                // 分析语法外层define模块
                if (!this.checkDefines(meNode)) {
                    return false;
                }
                // 合入依赖分析的结果
                this.mergeDepends(meNode);
            }
        }

        return true;
    }

    walk (node, nodeId) {
        let self = this;
        let type;
        let success;
        let isRoot = !nodeId;
        
        if (!node) return null;
        if (!nodeId) {
            nodeId = '0';
        }

        if (isRoot) {
            // this.result.input = escodegen.generate(node);
        }

        type = node.type;
        // 处理当前节点，获取执行结果
        success = this.makeDepends(node, nodeId);
        
        // 符合规则则遍历子节点
        if (success && AST_PROPS.hasOwnProperty(type)) {
            let keys = AST_PROPS[type];

            keys.forEach((key, index) => {
                if (Array.isArray(node[key])) {
                    node[key].forEach(function(childNode, childIndex) {
                        self.walk(childNode, nodeId + '_' + index + '_' + childIndex);
                    });
                } else {
                    this.walk(node[key], nodeId + '_' + index);
                }
            });
        } else {
            // throw new Error("Unknow type \"" + type + "\"");
        }

        if (isRoot) {
            // 匿名模块节点导出
            for (let i in this.allDefines) {
                this.exportDefineNode(this.allDefines[i]);
            }
            
            this.result.output = escodegen.generate(node);
        }

        return this.result;
    }
}


module.exports = new Walker();