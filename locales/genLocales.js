const fs = require("fs");
const esprima = require('esprima');
const walk = require("../Analyser").walk;

let outputFile = "./zh-CN.json";
let inputFile = "../Analyser.js";
let code = fs.readFileSync(inputFile, "utf8");
let oldConfig = require(outputFile);

let newConfig = oldConfig;

walk(esprima.parse(code), null, {
    CallExpression: (node, parent) => {
        let callee = node.callee;
        if (callee.type === "Identifier" && callee.name === "__") {
            let text = node.arguments[0].value;
            newConfig[text] = oldConfig[text] || text;
        }
    }
});

fs.writeFileSync(outputFile, JSON.stringify(newConfig, null, 2));
