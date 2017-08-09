describe("require 被重写测试", function() {
    var jet = require("../index");

    it("匿名无依赖模块分析", function() {

        var result = jet.analyse({
            code: this.getFunctionBody(function() {
                // TODO 发现 require 被重写，尝试报警
                define(function(__renamed_require__, require) {
                    // 未声明依赖，需要分析模块内部同步 require，作为 depends
                    var a = __renamed_require__("c/d");
                    var b = __renamed_require__("./e");
                    var c = require("f/g");
                    var d = require("./h");
                    // 分析内部的异步 require, 作为 requires
                    var e = __renamed_require__(["i/j", "./k"]);
                    var f = require(["l/m", "./n"]);
                });
            }),
            type: "js",
            baseId: "a/b",
            amdWrapper: false
        });

        (new Function("define", result.output))((id, deps, factory) => {
            expect(id).toEqual("a/b");
            expect(deps).toEqual(["require", "exports", "c/d", "a/e"]);
            expect(factory.length).toEqual(2);
        });

        expect(result.defines).toEqual({
            "a/b": {
                depends: ["c/d", "a/e"],
                requires: ["i/j", "a/k"],
            }
        });

    });

    it("匿名有依赖模块分析", function() {

        var result = jet.analyse({
            code: this.getFunctionBody(function() {
                // TODO 发现 require 被重写，尝试报警?
                define(["require", "c/d", "e/f"], function(__renamed_require__, require) {
                    // 已经声明依赖的，不再分析模块内部同步 require
                    // TODO 或者分析出来，判断是否在依赖中已经声明，如果未声明则报警
                    var a = __renamed_require__("g/h");
                    var b = __renamed_require__("./i");
                    var c = require("j/k");
                    var d = require("./l");
                    // 分析内部的异步 require
                    var e = __renamed_require__(["m/n", "./o"]);
                    var f = require(["p/q", "./r"]);
                });
            }),
            type: "js",
            baseId: "a/b",
            amdWrapper: false
        });

        (new Function("define", result.output))((id, deps, factory) => {
            expect(id).toEqual("a/b");
            expect(deps).toEqual(["require", "c/d", "e/f"]);
            expect(factory.length).toEqual(2);
        });

        expect(result.defines).toEqual({
            "a/b": {
                depends: ["c/d", "e/f"],
                requires: ["m/n", "a/o"],
            }
        });

    });

    it("具名无依赖模块分析", function() {

        var result = jet.analyse({
            code: this.getFunctionBody(function() {
                define("a/b", function(__renamed_require__, require) {
                    // 未声明依赖，需要分析模块内部同步 require，作为 depends
                    var a = __renamed_require__("c/d");
                    var b = __renamed_require__("./e");
                    var c = require("f/g");
                    var d = require("./h");
                    // 不管是否声明依赖，都需要分析内部的异步 require
                    var e = __renamed_require__(["i/j", "./k"]);
                    var f = require(["l/m", "./n"]);
                });
            }),
            type: "js",
            // 如果 baseId 与具名 define 不一致，以 define 为准
            baseId: "x/y",
            amdWrapper: false
        });

        (new Function("define", result.output))((id, deps, factory) => {
            expect(id).toEqual("a/b");
            expect(deps).toEqual(["require", "exports", "c/d", "a/e"]);
            expect(factory.length).toEqual(2);
        });

        expect(result.defines).toEqual({
            "a/b": {
                depends: ["c/d", "a/e"],
                requires: ["i/j", "a/k"],
            }
        });

    });

    it("具名有依赖模块分析", function() {

        var result = jet.analyse({
            code: this.getFunctionBody(function() {
                define("a/b", ["require", "c/d", "e/f"], function(__renamed_require__, require) {
                    // 已经声明依赖的，不再分析模块内部同步 require
                    var a = __renamed_require__("g/h");
                    var b = require("i/j");
                    // 不管是否声明依赖，都需要分析内部的异步 require
                    __renamed_require__(["k/l"]);
                    require(["m/n"]);
                });
            }),
            type: "js",
            // 如果 baseId 与具名 define 不一致，以 define 为准
            baseId: "x/y",
            amdWrapper: false
        });

        (new Function("define", result.output))((id, deps, factory) => {
            expect(id).toEqual("a/b");
            expect(deps).toEqual(["require", "c/d", "e/f"]);
            expect(factory.length).toEqual(2);
        });

        expect(result.defines).toEqual({
            "a/b": {
                depends: ["c/d", "e/f"],
                requires: ["k/l"],
            }
        });

    });
});
