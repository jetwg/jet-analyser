describe("一个文件定义多个模块", function() {
    var jet = require("../index");
    const esprima = require('esprima');
    const escodegen = require('escodegen');

    it("多个具名模块", function() {

        var result = jet.analyse({
            code: this.getFunctionBody(function() {
                define('c/d', function(require) {
                    // 未声明依赖，需要分析模块内部同步 require，作为 depends
                    var a = require("g/h");
                    var b = require("./i");
                    // 分析内部的异步 require, 作为 requires
                    var c = require(["j/k", "./l"]);
                });

                define('e/f', function(require) {
                    // 未声明依赖，需要分析模块内部同步 require，作为 depends
                    var a = require("m/n");
                    var b = require("./o");
                    // 分析内部的异步 require, 作为 requires
                    var c = require(["p/q", "./r"]);

                });
            }),
            type: "js",
            baseId: "a/b",
            amdWrapper: false
        });

        expect(escodegen.generate(esprima.parse(result.output))).toEqual(escodegen.generate(esprima.parse(this.getFunctionBody(function() {
            define('c/d', ["require", "g/h", "c/i"], function(require) {
                // 未声明依赖，需要分析模块内部同步 require，作为 depends
                var a = require("g/h");
                var b = require("./i");
                // 分析内部的异步 require, 作为 requires
                var c = require(["j/k", "./l"]);
            });

            define('e/f', ["require", "m/n", "e/o"], function(require) {
                // 未声明依赖，需要分析模块内部同步 require，作为 depends
                var a = require("m/n");
                var b = require("./o");
                // 分析内部的异步 require, 作为 requires
                var c = require(["p/q", "./r"]);

            });
        }))));

        expect(result.defines).toEqual({
            "c/d": {
                depends: ["g/h", "c/i"],
                requires: ["j/k", "c/l"],
            },
            'e/f': {
                depends: ['m/n', 'e/o'],
                requires: ['p/q', 'e/r'],
            }
        });

    });

    it("单个匿名模块", function() {

        var result = jet.analyse({
            code: this.getFunctionBody(function() {
                define('c/d', function(require) {
                    // 未声明依赖，需要分析模块内部同步 require，作为 depends
                    var a = require("g/h");
                    var b = require("./i");
                    // 分析内部的异步 require, 作为 requires
                    var c = require(["j/k", "./l"]);
                });

                define(function(require) {
                    // 未声明依赖，需要分析模块内部同步 require，作为 depends
                    var a = require("m/n");
                    var b = require("./o");
                    // 分析内部的异步 require, 作为 requires
                    var c = require(["p/q", "./r"]);

                });
            }),
            type: "js",
            baseId: "a/b",
            amdWrapper: false
        });

        expect(escodegen.generate(esprima.parse(result.output))).toEqual(escodegen.generate(esprima.parse(this.getFunctionBody(function() {
            define('c/d', ["require", "g/h", "c/i"], function(require) {
                // 未声明依赖，需要分析模块内部同步 require，作为 depends
                var a = require("g/h");
                var b = require("./i");
                // 分析内部的异步 require, 作为 requires
                var c = require(["j/k", "./l"]);
            });

            define("a/b", ["require", "m/n", "a/o"], function(require) {
                // 未声明依赖，需要分析模块内部同步 require，作为 depends
                var a = require("m/n");
                var b = require("./o");
                // 分析内部的异步 require, 作为 requires
                var c = require(["p/q", "./r"]);

            });
        }))));

        expect(result.defines).toEqual({
            "c/d": {
                depends: ["g/h", "c/i"],
                requires: ["j/k", "c/l"],
            },
            'a/b': {
                depends: ['m/n', 'a/o'],
                requires: ['p/q', 'a/r'],
            }
        });

    });

    it("多个匿名模块");
});
