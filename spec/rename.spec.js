describe("require 重命名测试", function() {
    var jet = require("../index");

    it("匿名无依赖模块分析", function() {

        var result = jet.analyse({
            code: this.getFunctionBody(function() {
                define(function(__renamed_require__) {
                    // 未声明依赖，需要分析模块内部同步 require，作为 depends
                    var a = __renamed_require__("c/d");
                    var b = __renamed_require__("./e");
                    var c = require("f/g");
                    // TODO 用了全局 require 来加载相对路径，需要报错
                    var d = require("./h");
                    // 分析内部的异步 require, 作为 requires
                    __renamed_require__(["i/j", "./k"]);
                    // TODO 用了全局 require 来加载相对路径，需要报错
                    require(["l/m", "./n"]);
                });
            }),
            type: "js",
            modulePath: "a/b",
            amdWrapper: false
        });

        expect(result.defines).toEqual({
            "a/b": {
                depends: ["c/d", "a/e", "f/g"],
                requires: ["i/j", "a/k", "l/m"],
            }
        });

    });

    it("匿名有依赖模块分析", function() {

        var result = jet.analyse({
            code: this.getFunctionBody(function() {
                define(["require", "c/d", "e/f"], function(__renamed_require__) {
                    // 已经声明依赖的，不再分析模块内部同步 require
                    // TODO 或者分析出来，判断是否在依赖中已经声明，如果未声明则报警
                    var a = __renamed_require__("g/h");
                    var b = __renamed_require__("./e");
                    // 分析内部的异步 require
                    var c = __renamed_require__(["i/j", "k/l"]);
                });
            }),
            type: "js",
            modulePath: "a/b",
            amdWrapper: false
        });

        expect(result.defines).toEqual({
            "a/b": {
                depends: ["c/d", "e/f"],
                requires: ["i/j", "k/l"],
            }
        });

    });

    it("具名无依赖模块分析", function() {

        var result = jet.analyse({
            code: this.getFunctionBody(function() {
                define("a/b", function(__renamed_require__) {
                    // 未声明依赖，需要分析模块内部同步 require，作为 depends
                    var a = __renamed_require__("c/d");
                    var b = __renamed_require__("./e");
                    // 不管是否声明依赖，都需要分析内部的异步 require
                    var b = __renamed_require__(["./f", "h/i"]);
                });
            }),
            type: "js",
            // 如果 modulePath 与具名 define 不一致，以 define 为准
            modulePath: "x/y",
            amdWrapper: false
        });

        expect(result.defines).toEqual({
            "a/b": {
                depends: ["c/d", "a/e"],
                requires: ["a/f", "h/i"],
            }
        });

    });

    it("具名有依赖模块分析", function() {

        var result = jet.analyse({
            code: this.getFunctionBody(function() {
                define("a/b", ["require", "c/d", "e/f"], function(__renamed_require__) {
                    // 已经声明依赖的，不再分析模块内部同步 require
                    var a = __renamed_require__("g/h");
                    // 不管是否声明依赖，都需要分析内部的异步 require
                    var b = __renamed_require__(["i/j"]);
                });
            }),
            type: "js",
            // 如果 modulePath 与具名 define 不一致，以 define 为准
            modulePath: "x/y",
            amdWrapper: false
        });

        expect(result.defines).toEqual({
            "a/b": {
                depends: ["c/d", "e/f"],
                requires: ["i/j"],
            }
        });

    });
});
