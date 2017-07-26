
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

console.log('>>>>>', output);
/*
>>>>> { 'moduleA/b/c/d':
   { depends: [ 'components/compA', 'components/compB', 'utils/utilC' ],
     requires: [ 'components/compA', 'components/compB' ] } }
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

console.log('>>>>>', output);
/*
>>>>> { 'moduleA/b/c/d':
   { depends: [ 'moduleA/b/c/e/compC' ],
     requires: [ 'moduleA/b/c/e/compC' ] } }
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

console.log('>>>>>', output);
/*
>>>>> { 'moduleA/b/c/d':
   { depends: [ 'components/compA' ],
     requires: [ 'components/compA' ] },
  'moduleB/ccc': { depends: [ 'moduleB/eee' ], requires: [ 'moduleB/eee' ] } }
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

console.log('>>>>>', output);
/*
>>>>> { 'moduleA/b/c/d':
   { depends: [ 'components/compA', 'components/compB', 'components/compC' ],
     requires: [ 'components/compA', 'components/compB' ] } }
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

console.log('>>>>>', output);
/*
ERROR 出现嵌套define语法
ERROR 出现无模块的require语法
>>>>> { 'moduleA/b/c/d':
   { depends: [ 'components/compA' ],
     requires: [ 'components/compA' ] } }
*/


/*===== CASE 6 ====*/
/*
output = jet.analyse({
    code: fs.readFileSync('xx/xxx.js', 'utf-8'),
    type: 'js',
    modulePath: 'moduleA/b/c/d',
    amdWrapper: false
});
*/

console.log('>>>>>', output);
/*

*/