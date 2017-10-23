'use strict';

const crypto = require('crypto');
const Analyser = require('./Analyser');
const fs = require('fs-extra');

let analyser = new Analyser();

function hash(data, type) {
    if (typeof type !== 'string') {
        type = 'sha256';
    }

    let hash = crypto.createHash(type);
    hash.update(data);
    return hash.digest('base64');
}
// conf = {
//     inputPath: '',
//     inputContent: code,
//
//     useHash: '',
//     baseId: baseId,
//     amdWrapper: false,
//     beautify: true  // 【可选】是否格式化代码
// };

function writeFile(filepath, cont) {
    return new Promise((resolve, reject) => {
        fs.ensureFile(filepath)
            .then(() => {
                fs.writeFile(filepath, cont, function (err) {
                    if (err) {
                        return reject(err);
                    }
                    resolve();
                });
            })
            .catch(err => {
                reject(err);
            });
    });
}

function getSourceCode(fileName, encoding = 'utf8') {
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

function getContent(config) {
    return new Promise((resolve, reject) => {
        if (config.inputPath) {
            if (config.inputContent) {
                resolve(config.inputContent);
            }
            else {
                getSourceCode(config.inputPath).then(function (inputContent) {
                    resolve(inputContent);
                }, function (err) {
                    reject(err);
                });
            }
        }
        else {
            reject('lack file content');
        }
    });
}

module.exports = function (config, callback) {
    getContent(config).then(function (inputContent) {
        console.log('child config', config);
        let result = analyser.analyse({
            code: inputContent,
            useHash: '',
            baseId: config.baseId,
            amdWrapper: config.amdWrapper,
            beautify: config.beautify // 可选】是否格式化代码
        });
        if (config.useHash) {
            result.hash = hash(result.output, config.useHash);
        }

        // 有outputPath，就把代码写入到文件系统
        if (config.output) {
            let outputConf = Object.assign({
                dir: '',
                hashPath: !!config.useHash,
                originPath: !config.useHash,
                map: true,
            }, config.output);
            if (outputConf) {
                writeFile(config.outputPath, result.output).then(function () {
                    return writeFile(config.outputPath, result.output);
                }).catch(function (err) {
                    callback(err);
                });
            }

            let mapPath = config.mapPath || config.outputPath + '.map';
            if () {

            }
            return;
        }
        callback(null, result);

    }).catch(function (err) {
        callback(err);
    });
};
// function sendIdleMessage() {
//     process.send({
//         type: 'idle'
//     });
// }
//
//
//
// process.on('message', (msg) => {
//     switch (msg.type) {
//         case 'analyse':
//             let data = msg.data;
//             let config;
//             let result;
//             if (!data) {
//                 if (process.connected) {
//                     sendIdleMessage();
//                 }
//
//                 return;
//             }
//
//             config = data.config;
//             console.error("analyse \"" + config.relativePath + "\"");
//             try {
//                 result = analyser.analyse(data.analyserConfig);
//                 if (!!config.useHash) {
//                     config.hash = hash(result.output, config.useHash);
//                 }
//
//             } catch (e) {
//                 sendIdleMessage();
//                 analyser.printLog();
//                 console.error(e.stack);
//                 return;
//             }
//             sendIdleMessage();
//             analyser.printLog();
//             delete result.logs;
//             process.send({
//                 type: 'result',
//                 data: {
//                     config: config,
//                     analyseResult: result
//                 }
//             });
//             break;
//         case 'end':
//             process.send({
//                 type: 'end'
//             });
//             // setTimeout(() => {
//             //     if (process.connected) {
//             //         process.disconnect();
//             //     }
//             //     process.exit(0);
//             // }, 1000);
//             break;
//         default:
//     }
// });
//
// sendIdleMessage();
