describe("CMD Wrapper 测试", function() {
    var jet = require("..");
    const esprima = require('esprima');
    const escodegen = require('escodegen');

    it("分析CMD模块", function() {

        var result = jet.analyse({
            code: this.getFunctionBody(function() {
                // 未声明依赖，需要分析模块内部同步 require，作为 depends
                var a = require("c/d");
                var b = require("./e");
                // 分析内部的异步 require, 作为 requires
                var c = require(["i/j", "./f"]);
            }),
            type: "js",
            baseId: "a/b",
            amdWrapper: true,
        });

        expect(escodegen.generate(esprima.parse(result.output))).toEqual(escodegen.generate(esprima.parse(this.getFunctionBody(function() {
            define("a/b", ["require", "exports", "module", "c/d", "a/e"], function(require, exports, module) {
                // 未声明依赖，需要分析模块内部同步 require，作为 depends
                var a = require("c/d");
                var b = require("./e");
                // 分析内部的异步 require, 作为 requires
                var c = require(["i/j", "./f"]);
            });
        }))));

        expect(result.defines).toEqual({
            "a/b": {
                depends: ["c/d", "a/e"],
                requires: ["i/j", "a/f"],
            }
        });

    });

});
