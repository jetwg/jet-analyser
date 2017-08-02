
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
/*
output = jet.analyse({
    code: fs.readFileSync('xx/xxx.js', 'utf-8'),
    type: 'js',
    modulePath: 'moduleA/b/c/d',
    amdWrapper: false
});

console.log('>>>>>', JSON.stringify(output, null, 4));
*/
/*

*/