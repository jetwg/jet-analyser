"use strict";

const child_process = require('child_process');
const Analyser = require('./Analyser');

let analyser = null;

/**
 * 分析单个文件
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
 * @param {string}  config.srcDir 源目录
 * @param {string}  config.distDir 目的目录
 * @param {string}  config.baseId 该源目录对应的绝对id
 * @param {string}  config.sourceMapRoot 该源目录对应的 sourceMap 根路径
 * @param {string}  config.encoding 代码编码
 * @param {object}  config.analyserConfig Analyser 配置
 * @param {object}  config.walkOption walk 配置
 * @return {Object} 配置
 */
function walk(config) {
    let argv = process.argv;
    let result = child_process.spawnSync(argv[0], [__dirname + "/walk.js"], {
        input: JSON.stringify(config),
        stdio: [
            'pipe', 'pipe', process.stderr
        ]
    });
    let stdout = result.stdout;
    return JSON.parse(stdout.toString("utf8"));
}

module.exports = {
    analyse: analyse,
    walk: walk,
    LOG_LEVEL: Analyser.LOG_LEVEL
};
