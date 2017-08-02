
const fs = require('fs');
const jet = require('./index');

let output;

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

console.log('>>>>>', JSON.stringify(output, null, 4));
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

console.log('>>>>>', JSON.stringify(output, null, 4));
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

console.log('>>>>>', JSON.stringify(output, null, 4));
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

console.log('>>>>>', JSON.stringify(output, null, 4));
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

console.log('>>>>>', JSON.stringify(output, null, 4));
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
define(["c/d", "e/f"], function(d) {
    // 已经声明依赖的，不再分析模块内部同步 require
    // FIXME 或者分析出来，判断是否在依赖中已经声明，如果未声明则报警
    var a = require("c/d");
    // TODO 由于依赖关系里面没有指名 require，所以需要报警
    var b = require("./e");
    // 分析内部的异步 require
    var c = require(["g/h", "i/j"]);
});
    `,
    type: 'js',
    modulePath: 'a/c',
    amdWrapper: false
});

console.log('>>>>>', JSON.stringify(output, null, 4));
/*

*/