'use strict';

const child_process = require('child_process');
const Analyser = require('./Analyser');
const workerFarm = require('worker-farm');
const walkMod = require('walk');
const path = require('path');
const workers = workerFarm({
    maxRetries: 0
}, require.resolve('./child'))

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
    let result;
    if (analyser === null) {
        analyser = new Analyser();
    }

    result = analyser.analyse(config);
    analyser.printLog();
    return result;
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

function defaultFilter(inputPath) {
    return path.extname(inputPath) === '.js'; // endWith(fileName, '.js');
}

function normalizeRelativePath(path) {
    let segs = path.split('/');
    segs = segs.filter(seg => seg.length > 0 && seg !== '.');
    return segs.join('/');
}

function path2id(filepath) {
    let segs = filepath.split('/');
    let lastSeg;
    if (segs.length) {
        lastSeg = segs.pop();
        if (path.extname(lastSeg) === '.js') {
            lastSeg = lastSeg.substring(0, lastSeg.length - 3);
        }

        segs.push(lastSeg);
    }

    return segs.join('/');
}


function run(config, cb) {
    let totalNum = 0;
    let finishedNum = 0;
    let noMoreInput = false;
    let results = [];

    let {srcDir, files} = config;
    console.log('srcDir', config);
    function runOne(inputPath, inputContent, next) {

        if (defaultFilter(inputPath) !== true) {
            next();
            return;
        }

        if (inputPath.indexOf(srcDir) !== 0) {
            // TODO 报错
            next();
            return;
        }

        let relativePath = normalizeRelativePath(inputPath.substring(srcDir.length));
        let id = path2id(normalizeRelativePath(config.baseId + '/' + relativePath));
        console.log('id', id);
        let opt = {
            inputPath,
            inputContent,
            useHash: '',
            baseId: id,
            amdWrapper: false,
            beautify: true // 是否格式化代码
        };

        totalNum++;
        workers(opt, function (err, result) {
            finishedNum++;

            if (err) {
                workerFarm.end(workers);
                console.error(err);
                cb(err);
                // process.exitCode(201);
                return;
            }
            results.push(result);
            if (noMoreInput) {
                if (finishedNum === totalNum) {
                    workerFarm.end(workers);
                    cb(null, results);
                }
            }
        });
        next();
    }

    if (files) {
        files.forEach(function (item) {
            runOne(item.path, item.content, function () {});
        });
        console.log('no more input');
        noMoreInput = true;
    }
    else {
        let walker = walkMod.walk(srcDir, config.walkOption || {});
        walker.on('file', (root, fileStats, next) => {
            let fileName = root + '/' + fileStats.name;
            runOne(fileName, null, next);
        });

        walker.on('end', () => {
            console.log('no more input');
            noMoreInput = true;
        });
    }

    // let argv = process.argv;
    // let result = child_process.spawnSync(argv[0], [__dirname + '/walk.js'], {
    //     input: JSON.stringify(config),
    //     stdio: [
    //         'pipe', 'pipe', process.stderr
    //     ]
    // });
    // let stdout = result.stdout;
    // return JSON.parse(stdout.toString('utf8'));
}

module.exports = {
    analyse: analyse,
    walk: walk,
    run: run,
    LOG_LEVEL: Analyser.LOG_LEVEL
};
