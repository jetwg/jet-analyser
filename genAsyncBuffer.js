"use strict";
const nextLoop = require('./nextLoop');
module.exports = function(producer, bufferSize) {
    /**
     * 缓存大小
     */
    bufferSize = bufferSize || 10;
    /**
     * 数据缓存
     */
    let buffer = [];
    /**
     * 等待列表
     */
    let waitList = [];

    /**
     * 数据源是否已经结束
     */
    let endded = false;
    /**
     * 是否预期还有更多数据
     * 在调用 end 后，也许还有被 nextLoop 缓存的 put 操作，所以需要多一个变量判断
     */
    let hasMore = true;
    /**
     * 数据是否已经都处理完成
     */
    let finished = false;
    /**
     * 数据处理完成回调
     */
    let onFinish = null;

    /**
     * 消费数据
     */
    function consume() {
        let bufLen = buffer.length;
        let waitLen = waitList.length;
        //  console.error("data:", bufLen, " task:", waitLen);
        let count = Math.min(bufLen, waitLen);
        let index;
        if (count > 0) {
            for (index = 0; index < count; index++) {
                // FIXME 这里需要 nextLoop 么
                waitList[index](buffer[index]);
            }
            waitList.splice(0, count);
            buffer.splice(0, count);
        }

        if (!hasMore) {
            tryFinish();
        } else {
            if (bufLen < bufferSize) {
                nextLoop(produce);
            }
        }
    }

    /**
     * 调用生产函数获取数据
     */
    function produce() {
        if (!endded) {
            producer();
        }
    }

    /**
     * 判断数据是否已经处理完成
     */
    function tryFinish() {
        let index;
        let count;
        if (!finished) {
            if (buffer.length === 0) {
                finished = true;
                count = waitList.length;
                for (index = 0; index < count; index++) {
                    // FIXME 这里需要 nextLoop 么
                    waitList[index](buffer[index]);
                }
                onFinish && onFinish();
            }
        }
    }

    /**
     * 添加缓存数据
     */
    function doPut(item) {
        buffer.unshift(item);
        consume();
    }

    /**
     * 异步获取数据
     */
    function doGet(callback) {
        waitList.unshift(callback);
        consume();
    }

    /**
     * 标记数据结束
     */
    function doEnd(callback) {
        hasMore = false;
        onFinish = callback;
        tryFinish();
    }

    return {
        put: (item) => {
            if (!endded) {
                nextLoop(doPut, [item]);
            }
        },
        get: (callback) => {
            if (!finished) {
                nextLoop(doGet, [callback]);
            } else {
                nextLoop(callback, [null]);
            }
        },
        end: (callback) => {
            if (!endded) {
                endded = true;
                nextLoop(doEnd, [callback]);
            }
        }
    };
}
