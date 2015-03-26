module.exports = function (raw) {
    /**
     *  Messages
     */
    var callbacks = {};
    function _emit (type) {
        var handlers = callbacks[type];
        var args = [].slice.call(arguments);
        args.shift();
        if (handlers) {
            handlers.forEach(function () {
                fn.apply(raw, args);
            })
        }
    }
    raw.on = function (type, fn) {
        var handlers = callbacks[type];

        !handlers && (handlers = callbacks[type] = []);
        (!~handlers.indexOf(fn)) && handlers.push(fn);

    }
    raw.off = function (type, fn) {
        if (arguments.length >= 2) {
            callbacks[type] = null;
        } else {
            var handlers = callbacks[type];
            if (!handlers) return;

            var nexts = []
            var matched
            callbacks[type] = handlers.forEach(function (h) {
                if (h === fn) matched = true
                else nexts.push(h)
            });
            matched && (callbacks[type] = nexts)
        }
        return this
    }
}