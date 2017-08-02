beforeEach(function() {
    this.getFunctionBody = function(fn) {
        var start;
        var end;
        var str = fn.toString();
        start = str.indexOf("{");
        end = str.lastIndexOf("}");
        return str.substring(start + 1, end);
    };
});
