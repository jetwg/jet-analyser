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

class ModuleExpressionNode {
    
    constructor (nodeId, config) {
        this.nodeId = nodeId;
        this.type = 'require';

        if (config.define) {
            this.type = 'define';
            this.moduleId = config.define;
        }

        this.nostate = config.nostate;
        this.async = config.async;
        this.depends = config.depends;
        this.requires = config.requires;
    }
}


class Walker {

    constructor () {

    }

    config (params) {
        this.modulePath = params.modulePath;
        this.hooks = params.hooks;
        this.result = {
            state: 'success',
            output: '',
            defines: {},
            logs: []
        };
        this.defines = {};

        return this;
    }

    getAbsolutePath (current, filePath) {
        // if (/^(\.\/|\.\.\/)/.test(filePath)) {
        //     filePath = path.join(current, filePath);
        //     filePath = filePath.split(path.sep).join('/');
        // }

        return relative2absolute(filePath, current);
    }

    mergeDepends (result) {
        let self = this;
        let currResult;
        let resDefines = this.result.defines;

        if (result.define === '__current__') {
            this.current = this.modulePath;
            resDefines[this.modulePath] = {
                depends: [],
                requires: []
            }
        }
        else if (result.define) {
            this.current = result.define;
            resDefines[result.define] = {
                depends: [],
                requires: []
            }
        }

        currResult = resDefines[this.current];

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

    checkDefines (meNode) {
        let nodeId = meNode.nodeId;
        let defNode;

        // 处理define函数
        if (meNode.type === 'define') {
            for (let id in this.defines) {
                if (nodeId.length > id.length && nodeId.substring(0, id.length) === id) {
                    // define需要避免冲突外层define模块
                    // 
                    this.result.logs.push({
                        type: 'error',
                        message: '出现嵌套define语法'
                    });
                    return false;
                }
            }
            // 保存符合规则的define模块
            this.defines[nodeId] = meNode;

            return true;
        }
        // 处理require及其他函数
        else if (meNode.type === 'require') {
            for (let id in this.defines) {
                defNode = this.defines[id];

                if (nodeId.length > id.length && nodeId.substring(0, id.length) === id) {
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

    makeDepends (node, nodeId) {
        let hooks = this.hooks;
        let type = node.type;
        let result;
        let meNode;

        if (hooks && hooks.hasOwnProperty(type)) {
            result = hooks[type](node);

            if (result) {
                meNode = new ModuleExpressionNode(nodeId, result);
                // 分析语法外层define模块
                if (!this.checkDefines(meNode)) {
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