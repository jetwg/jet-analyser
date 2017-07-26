"use strict";

const path = require('path');

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


class Walker {

    constructor () {

    }

    config (params) {
        this.modulePath = params.modulePath;
        this.hooks = params.hooks;
        this.result = {};
        this.defines = {};

        return this;
    }

    getAbsolutePath (current, filePath) {
        if (/^(\.\/|\.\.\/)/.test(filePath)) {
            filePath = path.join(current, filePath);
            filePath = filePath.split(path.sep).join('/');
        }

        return filePath;
    }

    mergeDepends (result) {
        let self = this;
        let currResult;

        if (result.define === '__current__') {
            this.current = this.modulePath;
            this.result[this.modulePath] = {
                depends: [],
                requires: []
            }
        }
        else if (result.define) {
            this.current = result.define;
            this.result[result.define] = {
                depends: [],
                requires: []
            }
        }

        currResult = this.result[this.current];

        result.depends.length && result.depends.forEach(dep => {
            dep = self.getAbsolutePath(this.current, dep);
            if (currResult.depends.indexOf(dep) === -1) {
                currResult.depends.push(dep);
            }
        });

        result.requires.length && result.requires.forEach(req => {
            req = self.getAbsolutePath(this.current, req);
            if (currResult.requires.indexOf(req) === -1) {
                currResult.requires.push(req);
            }
        });
    }

    checkDefines (nodeId, defineId) {
        // 处理define函数
        if (defineId) {
            for (let id in this.defines) {
                if (nodeId.length > id.length && nodeId.substring(0, id.length) === id) {
                    // define需要避免冲突外层define模块
                    console.error('ERROR', '出现嵌套define语法');
                    return false;
                }
            }
            // 保存符合规则的define模块
            this.defines[nodeId] = defineId;

            return true;
        }
        // 处理require及其他函数
        else {
            for (let id in this.defines) {
                if (nodeId.length > id.length && nodeId.substring(0, id.length) === id) {
                    // require依赖外层define模块
                    return true;
                }
            }
            console.error('ERROR', '出现无模块的require语法');
            return false;
        }
    }

    makeDepends (node, nodeId) {
        let hooks = this.hooks;
        let type = node.type;
        let result;

        if (hooks && hooks.hasOwnProperty(type)) {
            result = hooks[type](node);

            if (result) {
                // 分析语法外层define模块
                if (!this.checkDefines(nodeId, result.define)) {
                    return false;
                }
                // 合入依赖分析的结果
                this.mergeDepends(result);
            }
        }

        return true;
    }

    walk (node, nodeId) {
        let self = this;
        let type;
        let success;
        
        if (!node) return null;
        if (!nodeId) {
            nodeId = '0';
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

        return this.result;
    }
}


module.exports = new Walker();