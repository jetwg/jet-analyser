describe("require 改名测试", function() {
    var jet = require("../index");

    it("匿名无依赖模块", function() {

        var result = jet.analyse({
            code: this.getFunctionBody(function() {
                define(function(__renamed_require__) {
                    // 未声明依赖，需要分析模块内部同步 require，作为 depends
                    var a = __renamed_require__("c/d");
                    var b = __renamed_require__("./e");
                    // 分析内部的异步 require, 作为 requires
                    var c = __renamed_require__(["i/j", "./f"]);
                });
            }),
            type: "js",
            modulePath: "a/b",
            amdWrapper: false
        });

        expect(result.defines).toEqual({
            "a/b": {
                depends: ["c/d", "a/e"],
                requires: ["i/j", "a/f"],
            }
        });

    });

    it("匿名有依赖模块分析", function() {

        var result = jet.analyse({
            code: this.getFunctionBody(function() {
                define(["c/d", "require"], function(require, __renamed_require__) {
                    // 未声明依赖，需要分析模块内部同步 require，作为 depends
                    var a = __renamed_require__("c/d");
                    var b = __renamed_require__("./e");
                    // 分析内部的异步 require, 作为 requires
                    var c = __renamed_require__(["i/j", "./f"]);
                });
            }),
            type: "js",
            modulePath: "a/b",
            amdWrapper: false
        });

        expect(result.defines).toEqual({
            "a/b": {
                depends: ["c/d"],
                requires: ["i/j", "a/f"],
            }
        });

    });
});
