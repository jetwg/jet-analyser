
let generator = {

    genIdentifier: name => {
        return {
            'type': 'Identifier',
            'name': name
        };
    },

    genLiteral: value => {
        // TODO RegExp
        return {
            'type': 'Literal',
            'value': value,
            'raw': JSON.stringify(value)
        };
    },

    genArray: elements => {
        return {
            'type': 'ArrayExpression',
            'elements': elements
        };
    },

    genLiteralArray: strings => {
        let elements = strings.map(str => {
            return generator.genLiteral(str);
        });

        return {
            'type': 'ArrayExpression',
            'elements': elements
        };
    }
}

module.exports = generator;