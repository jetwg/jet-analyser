
const REQUIRE_FN_NAMES = {
    'define': 1,
    'require': 1
};

// require 函数别名
let requireAlias = null;

function makeDepends (argument, nextArg, result, callee) {
    let type = argument.type;
    let value = argument.value;
    let elements = argument.elements;

    if (type === 'Literal') {
        // 字符串表达式，即CMD引用模块
        result.depends.push(value);
        result.requires.push(value);
    }
    else if (type === 'ArrayExpression') {
        // 数组表达式，即AMD引用模块
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
                    result.depends.push(arg.value);
                    // define调用需要特殊处理
                    if (callee.name === 'define') {
                        result.requires.push(arg.value);
                    }
                }
            }
        });
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
            let result = {
                define: false,
                depends: [],
                requires: []
            };

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
