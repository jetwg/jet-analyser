'use strict';

const crypto = require('crypto');
const Analyser = require('./Analyser');

let analyser = new Analyser();

function sendIdleMessage() {
    process.send({
        type: 'idle'
    });
}

function hash(data, type) {
    if (typeof type !== 'string') {
        type = 'sha256';
    }

    let hash = crypto.createHash(type);
    hash.update(data);
    return hash.digest('base64');
}

process.on('message', (msg) => {
    switch (msg.type) {
        case 'analyse':
            let data = msg.data;
            let config;
            let result;
            if (!data) {
                if (process.connected) {
                    sendIdleMessage();
                }

                return;
            }

            config = data.config;
            console.error("analyse \"" + config.relativePath + "\"");
            try {
                result = analyser.analyse(data.analyserConfig);
                if (!!config.useHash) {
                    config.hash = hash(result.output, config.useHash);
                }

            } catch (e) {
                sendIdleMessage();
                analyser.printLog();
                console.error(e.stack);
                return;
            }
            sendIdleMessage();
            analyser.printLog();
            delete result.logs;
            process.send({
                type: 'result',
                data: {
                    config: config,
                    analyseResult: result
                }
            });
            break;
        case 'end':
            process.send({
                type: 'end'
            });
            // setTimeout(() => {
            //     if (process.connected) {
            //         process.disconnect();
            //     }
            //     process.exit(0);
            // }, 1000);
            break;
        default:
    }
});

sendIdleMessage();
