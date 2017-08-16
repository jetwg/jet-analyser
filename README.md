# jet-analyser AMD 依赖关系静态分析工具

## 使用

### 分析单个文件

``` javascript
const jet = require('jet-analyser');

/**
 * 分析单个文件
 *
 * @param {Object}  config 配置
 * @param {String}  config.code 代码内容
 * @param {Boolean} config.amdWrapper 是否添加 AMD 包装
 * @param {String}  config.baseId 文件的参考id，用于计算相对id
 * @param {String}  config.fileName 文件名，用于 sourceMap
 * @param {String}  config.sourceMapRoot sourceMap 根路径，可以是URL
 * @param {Boolean} config.beautify 是否格式化代码
 *
 * @return {Object.<output:String, defines:Object, depends:Array, requires:Array, map:String>} 单个文件配置
 */
jet.analyse({
    code:"...",                // 【必选】源代码
    amdWrapper:false|true,     // 【可选】是否添加 AMD 包装，默认 false
    baseId: "a/b/c/d",         // 【必选】该模块的绝对路径，用于计算相对路径
    fileName: "a/b/c/d.js",    // 【可选】sourceMap 的源文件名
    sourceMapRoot: "http://foo.com/bar,", // 【可选】sourceMap 根路径，可以是URL
    beautify: true             // 【可选】是否格式化代码
});
```

### 分析多个文件

```javascript
/**
 * 遍历目录
 *
 * @param {Object}  config 配置参数
 * @param {String}  config.srcDir 源目录
 * @param {String}  config.distDir 目的目录
 * @param {String}  config.baseId 该源目录对应的绝对id
 * @param {String}  config.encoding 代码编码
 * @param {Boolean} config.useHash 是否使用 Hash 文件名
 * @param {Object}  config.analyserConfig Analyser 配置
 * @param {Object}  config.walkOption walk 配置
 *
 * @return {Array.<src:String, dist:String, map:String, defines:Object, depends:Array, requires:Array>} 该目录下所有文件配置
 */
jet.walk({
    srcDir:"foo/bar",          // 【必选】源码路径
    distDir:"bar/foo",         // 【必选】目标路径
    baseId: "a/b/c/d",         // 【必选】参考绝对路径，用于计算该目录下的相对路径
    encoding: "utf8",          // 【可选】代码编码，默认 "utf8"
    useHash: false|true,       // 【可选】是否使用 hash 文件名，默认 false
    analyserConfig:{},         // 【可选】analyse 配置，参考 jet.analyse
    walkOption:{}              // 【可选】walk 配置
});
```

