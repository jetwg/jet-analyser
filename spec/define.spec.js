describe("Jet 分析工具测试", function() {
    var jet = require("../index");

    it("匿名无依赖模块分析", function() {

        var result = jet.analyse({
            code: this.getFunctionBody(function() {
                define(function(require) {
                    // 未声明依赖，需要分析模块内部同步 require，作为 depends
                    var a = require("c/d");
                    var b = require("./e");
                    // 不管是否声明依赖，都需要分析内部的异步 require
                    var c = require(["i/j", "./f"]);
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
                define(["c/d", "e/f"], function(d) {
                    // 已经声明依赖的，不再分析模块内部同步 require
                    // FIXME 或者只是判断是否匹配，如果不匹配则报警
                    var a = require("c/d");
                    // FIXME 由于依赖里面没有指名 require，所以可能需要报警
                    var b = require("./e");
                    // 不管是否声明依赖，都需要分析内部的异步 require
                    var c = require(["g/h", "i/j"]);
                });
            }),
            type: "js",
            modulePath: "a/b",
            amdWrapper: false
        });

        expect(result.defines).toEqual({
            "a/b": {
                depends: ["c/d", "e/f"],
                requires: ["g/h", "i/j"],
            }
        });

    });

    it("具名无依赖模块分析", function() {

        var result = jet.analyse({
            code: this.getFunctionBody(function() {
                define("a/b", function(require) {
                    // 未声明依赖，需要分析模块内部同步 require，作为 depends
                    var a = require("c/d");
                    var b = require("./e");
                    // 不管是否声明依赖，都需要分析内部的异步 require
                    var b = require(["./f", "h/i"]);
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
                define("a/b", ["c/d", "e/f"], function() {
                    // 已经声明依赖的，不再分析模块内部同步 require
                    var a = require("g/h");
                    // 不管是否声明依赖，都需要分析内部的异步 require
                    var b = require(["i/j"]);
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
