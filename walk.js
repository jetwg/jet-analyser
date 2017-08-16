'use strict';

const fs = require('fs');
const path = require('path');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const walk = require('walk');
const mkdirp = require('mkdirp');
const genAsyncBuffer = require('./genAsyncBuffer');

function endWith(str, end) {
    let endLen = end.length;
    let strLen = str.length;
    let i;
    if (strLen < endLen) {
        return false;
    }

    for (i = 1; i <= endLen; i++) {
        if (str.charCodeAt(strLen - i) !== end.charCodeAt(endLen - i)) {
            return false;
        }

    }
    return true;
}

function normalizeRelativePath(path) {
    let segs = path.split('/');

    segs = segs.filter((seg) => {
        return seg.length > 0 && seg !== '.';
    });

    return segs.join('/');
}

function path2id(path) {
    let segs = path.split('/');
    let lastSeg;
    if (segs.length) {
        lastSeg = segs.pop();
        if (endWith(lastSeg, '.js')) {
            lastSeg = lastSeg.substring(0, lastSeg.length - 3);
        }

        segs.push(lastSeg);
    }

    return segs.join('/');
}

function defaultFilter(root, fileStats) {
    let fileName = fileStats.name;
    return endWith(fileName, '.js');
}

function getSourceCode(fileName, encoding) {
    encoding = encoding || 'utf8';
    return new Promise((resolve, reject) => {
        fs.readFile(fileName, encoding, (err, data) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(data);
            }
        });
    });
}

function hashToPath(hash) {
    hash = hash
        .substring(0, 8)
        .replace(/\//g, '_')
        .replace(/\+/g, '_');

    return hash.match(/.{2}|./g).join('/');
}

function writeFile(file, data) {
    mkdirp(path.dirname(file), (err) => {
        if (err) {
            console.error(err);
            return;
        }

        fs.writeFile(file, data, (err) => {
            if (err) {
                console.error(err);
            }

        });
    });
}

function handleResult(data) {
    // srcDir: srcDir,
    // distDir: distDir,
    // relativePath: relativePath
    // data: {
    //     config: data.config,
    //     analyseResult: result
    // }
    let config = data.config;
    let analyseResult = data.analyseResult;

    let srcPath;
    let distPath;
    let mapPath;

    let distFile;
    let mapFile;

    srcPath = config.relativePath;
    distPath = srcPath;

    if (config.useHash) {
        distPath = hashToPath(config.hash) + '.js';
    }

    mapPath = distPath + '.map';

    distFile = config.distDir + '/' + distPath;
    mapFile = config.distDir + '/' + mapPath;

    writeFile(distFile, analyseResult.output);
    writeFile(mapFile, analyseResult.map);

    return {
        src: srcPath,
        dist: distPath,
        map: mapPath,
        state: analyseResult.state,
        defines: analyseResult.defines
    };
}

function doWalk(options, workers) {
    let srcDir = options.srcDir;
    let distDir = options.distDir;
    let baseId = options.baseId || '';
    let encoding = options.encoding;
    let useHash = options.useHash || false;
    let analyserConfig = options.analyserConfig || {};
    let filter = defaultFilter; // TODO 怎么能通过调用的时候传进来呢?

    let walker = walk.walk(srcDir, options.walkOption || {});
    let walkNext = null;

    // let fifo = genFifo();
    let fifo = genAsyncBuffer(() => {
        walkNext && walkNext();
    }, numCPUs);
    let srcDirLen = srcDir.length;
    walker.on('file', (root, fileStats, next) => {
        let fileName;
        let relativePath;
        let id;
        if (filter(root, fileStats) !== true) {
            next();
            return;
        }

        fileName = root + '/' + fileStats.name;

        if (fileName.indexOf(srcDir) !== 0) {
            // TODO 报错
            next();
            return;
        }

        relativePath = normalizeRelativePath(fileName.substring(srcDirLen));
        id = path2id(normalizeRelativePath(baseId + '/' + relativePath));

        getSourceCode(fileName, encoding)
            .then((code) => {
                let data = {
                    config: {
                        srcDir: srcDir,
                        distDir: distDir,
                        relativePath: relativePath,
                        useHash: useHash
                    },
                    analyserConfig: Object.assign({},
                        analyserConfig, {
                            code: code,
                            baseId: id,
                            fileName: relativePath
                        })
                };
                walkNext = next;
                fifo.put(data);
                // fifo.put(data, next);
            });
    });

    walker.on('end', () => {
        fifo.end(onFifoEnd);
    });

    let result = [];
    cluster.on('message', (worker, msg) => {
        switch (msg.type) {
            case 'idle':
                fifo.get((config) => {
                    worker.send({
                        type: 'analyse',
                        data: config
                    });
                });
                break;
            case 'result':
                result.push(handleResult(msg.data));
                break;
            case 'end':
                onWorkerEnd(worker);
                break;
            default:
        }
    });

    let fifoEndded = false;
    cluster.on('exit', (worker, code, signal) => {
        let index = workers.indexOf(worker);
        if (!fifoEndded) {
            console.error('worker %d died (%s). restarting...',
                worker.process.pid, signal || code);
            setupMaster();
            workers.splice(index, 1, cluster.fork());
        }
        else {
            workers.splice(index, 1);
        }
    });

    let expectEnds = 0;

    function onFifoEnd() {
        fifoEndded = true;
        expectEnds = workers.length;
        workers.forEach((worker) => {
            worker.send({
                type: 'end'
            });
        });
    }

    let enddedWorkers = 0;
    let onFinish = null;

    function onWorkerEnd(worker) {
        worker.exitedAfterDisconnect = true;
        worker.disconnect();
        enddedWorkers++;
        if (enddedWorkers >= expectEnds) {
            onFinish && onFinish(result);
        }
    }

    return new Promise((resolve, reject) => {
        onFinish = resolve;
    });
}

function getOptionFromStdin() {
    console.error('reading config form stdin...');
    return new Promise((resolve, reject) => {
        let input = [];

        process.stdin.on('data', (trunk) => {
            input.push(trunk);
        });

        process.stdin.on('end', () => {
            // TODO 错误判断
            let buf = Buffer.concat(input);
            let str = buf.toString('utf8');
            let json = JSON.parse(str);
            resolve(json);
        });
    });
}

function setupMaster() {
    cluster.setupMaster({
        exec: __dirname + '/worker.js',
        args: ['--color']
    });
}

function main() {
    let workers = [];
    getOptionFromStdin()
        .then((option) => {
            setupMaster();
            for (let i = 0; i < numCPUs; i++) {
                workers.push(cluster.fork());
            }
            return doWalk(option, workers);
        })
        .then((config) => {
            process.stdout.write(JSON.stringify(config));
        });
}

main();
