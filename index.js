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
 * @param {Object} config 配置参数
 * @param {string} config.src 源目录
 * @param {string} config.dist 目的目录
 * @param {string} config.baseId 该源目录对应的绝对id
 * @param {function} config.filter 文件过滤器
 * @param {object} config.walkOption walk 配置
 *
 * @return {Object} 配置
 */
function walk(config) {
    let argv = process.argv;
    let nodeCmd = config.nodeCmd || argv[0];
    let result = child_process.spawnSync(nodeCmd, ["./walk.js"], {
        input: JSON.stringify(config),
        encoding: "utf8"
    });
    let stdout = result.stdout;
    return JSON.parse(result.stdout);
}

module.exports = {
    analyse: analyse,
    walk: walk,
    LOG_LEVEL: Analyser.LOG_LEVEL
};
