"use strict";
var running = false;
var penddingList = [];

function call(fn, args) {
    if (!args) {
        return fn();
    }
    switch (args.length) {
        case 0:
            return fn();
        case 1:
            return fn(args[0]);
        case 2:
            return fn(args[0], args[1]);
        case 3:
            return fn(args[0], args[1], args[2]);
        default:
            return fn.apply(this, args);
    }
}

function nextLoop(fn, args) {
    var index;
    var count;
    var item;
    if (running) {
        penddingList.push([fn, args]);
        return;
    }
    running = true;
    /**
     * 这里是调用外部函数，
     * 所以有递归调用到 nextLoop
     * 此时因为 running 为 true
     * 所以会放入延迟执行的列表等待执行
     */
    call(fn, args);

    /**
     * 循环检查是否有延迟执行的任务
     * 如果有，则执行
     */
    while (penddingList.length) {
        /**
         * 这里一定要记录一下长度，
         * 因为有可能执行过程中还会往延迟列表中添加
         */
        count = penddingList.length;
        for (index = 0; index < count; index++) {
            item = penddingList[index];
            call(item[0], item[1]);
        }

        /**
         * 这里删除已经执行过的任务
         */
        penddingList.splice(0, count);
    }
    running = false;
}

Object.defineProperty(nextLoop, "running", {
    get() {
        return running;
    }
});

module.exports = nextLoop;
