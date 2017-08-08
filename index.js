
const esprima = require('esprima');
const hooks = require('./hooks');
const walker = require('./walk');


class Jet {

    constructor () {

    }

    analyseOne (params) {
        let sourceCode = params.code || '';
        let codeType = params.type || 'js';
        let modulePath = params.modulePath || '';

        if (!sourceCode) return false;

        if (params.amdWrapper) {
            sourceCode = 
`define(function (require, exports, module) {
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

    analyse (params) {
        if (params instanceof Array) {
            let self = this;
            let result = params.map(item => {
                return self.analyseOne(item);
            });

            return result;
        } else {
            return this.analyseOne(params);
        }
    }
};

module.exports = new Jet();
