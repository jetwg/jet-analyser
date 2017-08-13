"use strict";

const fs = require("fs");
const path = require('path');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const walk = require("walk");
const mkdirp = require('mkdirp');
const Analyser = require('./Analyser');
const nextLoop = require('./nextLoop');

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
    let segs = path.split("/");

    segs = segs.filter((seg) => {
        return seg.length > 0 && seg !== ".";
    });

    return segs.join("/");
}

function path2id(path) {
    let segs = path.split("/");
    let lastSeg;
    if (segs.length) {
        lastSeg = segs.pop();
        if (endWith(lastSeg, ".js")) {
            lastSeg = lastSeg.substring(0, lastSeg.length - 3);
        }
        segs.push(lastSeg);
    }
    return segs.join("/");
}

function defaultFilter(root, fileStats) {
    let fileName = fileStats.name;
    return fileName.substring(fileName.length - 3) === ".js";
}

function genFifo() {
    const BUFFER_SIZE = numCPUs;
    let buffer = [];
    let waitList = [];

    let getNext = null;
    let onFinish = null;
    let endded = false;
    let finished = false;

    function produce() {
        if (!endded) {
            nextLoop(getNext);
        }
    }

    function consume() {
        let bufLen = buffer.length;
        let waitLen = waitList.length;
        let count = Math.min(bufLen, waitLen);
        let index;
        // console.log("data:", bufLen, " task:", waitLen);
        for (index = 0; index < count; index++) {
            nextLoop(waitList.pop(), [buffer.pop()]);
        }

        bufLen = bufLen - count;

        if (endded) {
            if (bufLen === 0) {
                finish();
            }
        } else {
            if (bufLen < BUFFER_SIZE) {
                produce();
            }
        }
    }

    function finish() {
        if (!finished) {
            if (!buffer.length) {
                finished = true;
                nextLoop(onFinish);
            }
        }
    }

    function doPut(item, next) {
        buffer.unshift(item);
        getNext = next;
        consume();
    }

    function doGet(callback) {
        waitList.unshift(callback);
        consume();
    }

    function end(callback) {
        if (!endded) {
            endded = true;
            onFinish = callback;
            nextLoop(finish);
        }
    }

    return {
        put: (item, next) => {
            nextLoop(doPut, [item, next]);
        },
        get: (callback) => {
            nextLoop(doGet, [callback]);
        },
        end: end
    };
}

function doWalk(options, workers) {
    let srcDir = options.src;
    let distDir = options.dist;
    let baseId = options.baseId || "";
    let amdWrapper = !!options.amdWrapper;
    let optimize = !!options.optimize;

    let walker = walk.walk(srcDir, options.walkOption || {});
    let filter = defaultFilter; // TODO 怎么能通过调用的时候传进来呢?

    let fifo = genFifo();

    let srcDirLen = srcDir.length;

    walker.on("file", (root, fileStats, next) => {
        let fileName;
        let relativePath;
        let sourceFile;
        let distFile;
        let id;
        if (filter(root, fileStats) !== true) {
            next();
            return;
        }

        fileName = root + "/" + fileStats.name;

        if (fileName.indexOf(srcDir) !== 0) {
            // TODO 报错
            next();
            return;
        }

        relativePath = normalizeRelativePath(fileName.substring(srcDirLen));
        sourceFile = srcDir + "/" + relativePath;
        distFile = distDir + "/" + relativePath;
        id = path2id(normalizeRelativePath(baseId + "/" + relativePath));

        fifo.put({
            inputFile: sourceFile,
            outputFile: distFile,
            baseId: id,
            source: fileName,
            amdWrapper: amdWrapper,
            optimize: optimize
        }, next);
    });

    walker.on('end', () => {
        fifo.end(onFifoEnd);
    });

    let config = [];
    cluster.on("message", (worker, msg) => {
        switch (msg.type) {
            case "idle":
                fifo.get((conf) => {
                    worker.send({
                        type: "analyse",
                        config: conf
                    });
                });
                break;
            case "result":
                config.push(msg.config);
                break;
            case "end":
                onWorkerEnd(worker);
                break;
            default:
        }
    });

    cluster.on('exit', (worker, code, signal) => {
        if (code !== 0) {
            console.error('worker %d died (%s). restarting...',
                worker.process.pid, signal || code);
            let index = workers.indexOf(worker);
            worker = cluster.fork();
            workers.splice(index, 1, worker);
        }
    });

    function onFifoEnd() {
        workers.forEach((worker) => {
            worker.send({
                type: "end"
            });
        });
    }

    let workerCount = workers.length;
    let enddedWorkers = 0;
    let onFinish = null;

    function onWorkerEnd(worker) {
        worker.exitedAfterDisconnect = true;
        worker.disconnect();
        enddedWorkers++;
        if (enddedWorkers >= workerCount) {
            onFinish && onFinish(config);
        }
    }

    return new Promise((resolve, reject) => {
        onFinish = resolve;
    });
}

function getOptionFromStdin() {
    process.stderr.write("reading config form stdin...\n");
    return new Promise((resolve, reject) => {
        let input = [];

        process.stdin.on("data", (trunk) => {
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

function masterMain(workers) {
    getOptionFromStdin()
        .then((option) => {
            return doWalk(option, workers);
        })
        .then((config) => {
            process.stdout.write(JSON.stringify(config));
        });
}

function workerMain() {
    let analyser = new Analyser();
    let sendIdleMessage = () => {
        process.send({
            type: "idle"
        });
    };

    let analyse = (config) => {
        let inputFile = config.inputFile;
        let outputFile = config.outputFile;

        // process.stderr.write("analysing \"" + inputFile + "\"...\n");
        let code = fs.readFileSync(inputFile, "utf8");
        config.code = code;

        let result = analyser.analyse(config);
        analyser.printLog();
        mkdirp.sync(path.dirname(outputFile));
        fs.writeFileSync(outputFile, result.output);
        process.send({
            type: "result",
            config: {
                inputFile: inputFile,
                outputFile: outputFile,
                defines: result.defines,
                depends: result.depends,
                requires: result.requires
                    // logs: result.logs
            }
        });
    };

    process.on("message", (msg) => {
        switch (msg.type) {
            case "analyse":
                analyse(msg.config);
                sendIdleMessage();
                break;
            case "end":
                process.send({
                    type: "end"
                });
                break;
            default:
        }
    });

    sendIdleMessage();
}

function main() {
    if (cluster.isMaster) {
        // Fork workers.
        let workers = [];
        for (let i = 0; i < numCPUs; i++) {
            workers.push(cluster.fork());
        }
        masterMain(workers);
    } else {
        workerMain();
    }
}

main();
