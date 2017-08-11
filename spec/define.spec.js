describe("依赖分析测试", function() {
    var jet = require("..");

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
            baseId: "a/b",
            amdWrapper: false
        });

        (new Function("define", result.output))((id, deps, factory) => {
            expect(id).toEqual("a/b");
            expect(deps).toEqual(["require", "c/d", "a/e"]);
            expect(factory.length).toEqual(1);
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
                define(["require", "./d", "e/f"], function(require) {
                    // 已经声明依赖的，不再分析模块内部同步 require
                    // TODO 或者分析出来，判断是否在依赖中已经声明，如果未声明则报警
                    var a = require("g/h");
                    var b = require("./e");
                    // 分析内部的异步 require
                    var c = require(["i/j", "k/l"]);
                });
            }),
            type: "js",
            baseId: "a/b",
            amdWrapper: false
        });

        (new Function("define", result.output))((id, deps, factory) => {
            expect(id).toEqual("a/b");
            expect(deps).toEqual(["require", "./d", "e/f"]);
            expect(factory.length).toEqual(1);
        });

        expect(result.defines).toEqual({
            "a/b": {
                depends: ["a/d", "e/f"],
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
            // 如果 baseId 与具名 define 不一致，以 define 为准
            baseId: "x/y",
            amdWrapper: false
        });

        (new Function("define", result.output))((id, deps, factory) => {
            expect(id).toEqual("a/b");
            expect(deps).toEqual(["require", "c/d", "a/e"]);
            expect(factory.length).toEqual(1);
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
                define("a/b", ["require", "./d", "e/f"], function(require) {
                    // 已经声明依赖的，不再分析模块内部同步 require
                    var a = require("g/h");
                    // 不管是否声明依赖，都需要分析内部的异步 require
                    var b = require(["i/j"]);
                });
            }),
            type: "js",
            // 如果 baseId 与具名 define 不一致，以 define 为准
            baseId: "x/y",
            amdWrapper: false
        });

        (new Function("define", result.output))((id, deps, factory) => {
            expect(id).toEqual("a/b");
            expect(deps).toEqual(["require", "./d", "e/f"]);
            expect(factory.length).toEqual(1);
        });

        expect(result.defines).toEqual({
            "a/b": {
                depends: ["a/d", "e/f"],
                requires: ["i/j"],
            }
        });

    });
    it("define 依赖为相对路径", function() {
        var result = jet.analyse({
            code: this.getFunctionBody(function() {
                define(["./c"], function() {});
            }),
            baseId: "a/b",
            amdWrapper: false
        });

        (new Function("define", result.output))((id, deps, factory) => {
            expect(id).toEqual("a/b");
            expect(deps).toEqual(['./c']);
            expect(factory.length).toEqual(0);
        });

        expect(result.defines).toEqual({
            "a/b": {
                depends: ["a/c"],
                requires: [],
            }
        });

    });
});
