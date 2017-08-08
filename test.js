
const fs = require('fs');
const jet = require('./index');

let output;
let index = 0;

function print (name, output) {
    fs.writeFile('./exports/' + index + '.js', 'Before\n' + output.input + '\n\nAfter\n' + output.output);
    fs.writeFile('./exports/' + index++ + '.js.map', JSON.stringify(output, null, 4));
}

/*===== CASE 1 ====*/
output = jet.analyse({
    code: `
define(function () {

    var compA = require('components/compA');
    var compB = require('components/compB');

    require(['utils/utilC'], function () {

        utilC(compA, compB);
    });
});
    `,
    type: 'js',
    modulePath: 'moduleA/b/c/d',
    amdWrapper: false
});

print('>>>>>', output);
/*
>>>>> {
    "state": "success",
    "output": "",
    "defines": {
        "moduleA/b/c/d": {
            "depends": [
                "components/compA",
                "components/compB"
            ],
            "requires": [
                "utils/utilC"
            ]
        }
    },
    "logs": []
}
*/

/*===== CASE 2 ====*/
output = jet.analyse({
    code: `
var compC = require('../e/compC');
    `,
    type: 'js',
    modulePath: 'moduleA/b/c/d',
    amdWrapper: true
});

print('>>>>>', output);
/*
>>>>> {
    "state": "success",
    "output": "",
    "defines": {
        "moduleA/b/c/d": {
            "depends": [
                "moduleA/b/c/e/compC"
            ],
            "requires": []
        }
    },
    "logs": []
}
*/

/*===== CASE 3 ====*/
output = jet.analyse({
    code: `
define(function () {
    var compA = require('components/compA');
});

define('moduleB/ccc', ['moduleB/eee'], function () {

});
    `,
    type: 'js',
    modulePath: 'moduleA/b/c/d',
    amdWrapper: false
});

print('>>>>>', output);
/*
>>>>> {
    "state": "success",
    "output": "",
    "defines": {
        "moduleA/b/c/d": {
            "depends": [
                "components/compA"
            ],
            "requires": []
        },
        "moduleB/ccc": {
            "depends": [
                "moduleB/eee"
            ],
            "requires": []
        }
    },
    "logs": []
}
*/

/*===== CASE 4 ====*/
output = jet.analyse({
    code: `
define(['module', 'exports', 'require', 'components/compA'], function (module, exports, _) {
    var compB = _('components/compB');

    require(['module', 'components/compC'], function () {

    });
});
    `,
    type: 'js',
    modulePath: 'moduleA/b/c/d',
    amdWrapper: false
});

print('>>>>>', output);
/*
>>>>> {
    "state": "success",
    "output": "",
    "defines": {
        "moduleA/b/c/d": {
            "depends": [
                "components/compA",
                "components/compB"
            ],
            "requires": [
                "components/compC"
            ]
        }
    },
    "logs": []
}
*/

/*===== CASE 5 ====*/
output = jet.analyse({
    code: `
define(function () {
    var compA = require('components/compA');

    define('moduleB/ccc', ['components/compC'], function () {
        var compD = require('components/compD');
    });
});

var compB = require('components/compB');
    `,
    type: 'js',
    modulePath: 'moduleA/b/c/d',
    amdWrapper: false
});

print('>>>>>', output);
/*
>>>>> {
    "state": "success",
    "output": "",
    "defines": {
        "moduleA/b/c/d": {
            "depends": [
                "components/compA"
            ],
            "requires": []
        }
    },
    "logs": [
        {
            "type": "error",
            "message": "出现嵌套define语法"
        },
        {
            "type": "error",
            "message": "出现无模块的require语法"
        }
    ]
}
*/


/*===== CASE 6 ====*/

output = jet.analyse({
    code: `
define(function(__renamed_require__) {
    // 未声明依赖，需要分析模块内部同步 require，作为 depends
    var a = __renamed_require__("c/d");
    var b = __renamed_require__("./e");
    var c = require("f/g");
    // TODO 用了全局 require 来加载相对路径，需要报错
    var d = require("./h");
    // 分析内部的异步 require, 作为 requires
    __renamed_require__(["i/j", "./k"]);
    // TODO 用了全局 require 来加载相对路径，需要报错
    require(["l/m", "./n"]);
});
    `,
    type: 'js',
    modulePath: 'a/c',
    amdWrapper: false
});

print('>>>>>', output);
/*

*/