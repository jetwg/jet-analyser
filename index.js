'use strict';

const child_process = require('child_process');
const Analyser = require('./Analyser');

let analyser = null;

/**
 * 分析单个文件
 *
 * @param {Object}  config 配置
 * @param {String}  config.code 代码内容
 * @param {Boolean} config.amdWrapper 是否添加 AMD 包装
 * @param {String}  config.baseId 文件的参考id，用于计算相对id
 * @param {String}  config.fileName 文件名，用于 sourceMap
 * @param {String}  config.sourceMapRoot sourceMap 跟路径，可以是URL
 * @param {Boolean} config.beautify 是否格式化代码
 *
 * @return {Object.<output:String, defines:Object, depends:Array, requires:Array, map:String>} 单个文件配置
 */
function analyse(config) {
    if (analyser === null) {
        analyser = new Analyser();
    }

    return analyser.analyse(config);
}

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
function walk(config) {
    let argv = process.argv;
    let result = child_process.spawnSync(argv[0], [__dirname + '/walk.js'], {
        input: JSON.stringify(config),
        stdio: [
            'pipe', 'pipe', process.stderr
        ]
    });
    let stdout = result.stdout;
    return JSON.parse(stdout.toString('utf8'));
}

module.exports = {
    analyse: analyse,
    walk: walk,
    LOG_LEVEL: Analyser.LOG_LEVEL
};
