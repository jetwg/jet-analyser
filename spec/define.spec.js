describe("依赖分析测试", function() {
    var jet = require("../index");

    it("匿名无依赖模块分析", function() {

        var result = jet.analyse({
            code: this.getFunctionBody(function() {
                define(function(require) {
                    // 未声明依赖，需要分析模块内部同步 require，作为 depends
                    var a = require("c/d");
                    var b = require("./e");
                    // 分析内部的异步 require, 作为 requires
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
                define(["require", "c/d", "e/f"], function(require) {
                    // 已经声明依赖的，不再分析模块内部同步 require
                    // TODO 或者分析出来，判断是否在依赖中已经声明，如果未声明则报警
                    var a = require("g/h");
                    // TODO 由于依赖关系里面没有指名 require，所以需要报警
                    var b = require("./e");
                    // 分析内部的异步 require
                    var c = require(["i/j", "k/l"]);
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
                define("a/b", ["require", "c/d", "e/f"], function(require) {
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