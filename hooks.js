
const REQUIRE_FN_NAMES = {
    'define': 1,
    'require': 1
};

// require 函数别名
let requireAlias = null;

function makeResult () {
    return {
        define: false,
        nostate: false,
        async: false,
        depends: [],
        requires: []
    };
}

function makeDepends (argument, nextArg, result, callee) {
    let type = argument.type;
    let value = argument.value;
    let elements = argument.elements;

    if (result.define) {
        // define 声明依赖
        if (type === 'ArrayExpression') {
            elements.forEach((arg, index) => {
                if (arg.type === 'Literal') {
                    if (arg.value === 'require') {
                        // 检测require命名替换
                        if (nextArg.type === 'FunctionExpression' && nextArg.params[index]) {
                            requireAlias = nextArg.params[index].name;
                        }
                    }
                    else if (arg.value === 'module' || arg.value === 'exports') {
                        // 内部模块不做处理
                    }
                    else {
                        if (nextArg.params[index] && nextArg.params[index].name === 'require') {
                            // 错误语法检测
                        }
                        result.depends.push(arg.value);
                    }
                }
            });
        }
        // define 语法未声明依赖
        else {
            result.nostate = true;    // 标识无声明

            // 识别未声明模块且在回调中对require进行了命名替换
            if (type === 'FunctionExpression' && argument.params[0]) {
                requireAlias = argument.params[0].name;
            }
        }  
    }
    else {
        // 字符串表达式，即CMD引用模块
        if (type === 'Literal') {
            result.depends.push(value);
        }
        // 数组串表达式，即AMD引用模块
        else if (type === 'ArrayExpression') {
            result.async = true;    // 标识异步

            elements.forEach((arg, index) => {
                if (arg.type === 'Literal') {
                    result.requires.push(arg.value);
                }
            });
        }
    }
}

module.exports = {
    CallExpression: (node) => {
        let callee = node.callee;
        let args = node.arguments;

        if (REQUIRE_FN_NAMES.hasOwnProperty(callee.name) || callee.name === requireAlias) {
            let args0 = args[0];
            let argType = args0.type;
            let argValue = args0.value;
            let result = makeResult();

            // 分析define调用
            if (callee.name === 'define') {
                // 重置require替换名
                requireAlias = null;

                if (argType === 'Literal') {
                    // 字符串语法则表示已声明define
                    result.define = argValue;
                    // 分析第二个输入参数
                    makeDepends(args[1], args[2], result, callee);
                }
                else {
                    // 未声明define则使用默认define
                    result.define = '__current__';
                    // 分析第一个输入参数
                    makeDepends(args[0], args[1], result, callee);
                }
            }
            // 分析 require 调用
            else if (callee.name === 'require' || callee.name === requireAlias) {
                makeDepends(args[0], null, result, callee);
            }

            return result;
    
        }
    }
}
