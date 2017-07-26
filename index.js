
const esprima = require('esprima');
const hooks = require('./hooks');
const walker = require('./walk');


class Jet {

    constructor () {

    }

    analyse (params) {
        let sourceCode = params.code || '';
        let codeType = params.type || 'js';
        let modulePath = params.modulePath || '';

        if (!sourceCode) return false;

        if (params.amdWrapper) {
            sourceCode = 
`define(function () {
    ${sourceCode}
});`;
        }

        let astTree = esprima.parse(sourceCode);
        let result = 
            walker.config({
                modulePath: modulePath,
                hooks: hooks
            })
            .walk(astTree);

        return result;
    }
};

module.exports = new Jet();
