;(function (global) {
'use strict';
/**
 *  Universal Consts for all modules
 */

var READY_STATE_CHANGE = 'onreadystatechange'
var READY_STATE = 'readyState'
var TIMEOUT = 60 * 1000; // pagelet请求的默认超时时间
var DEFAULT_COMBO_PATTERN = '/co??%s';
/**
 *  Util functions
 */
function noop() {}
function _exec(code) {
    var node = $docm.createElement('script');
    _appendChild(node, $docm.createTextNode(code));
    _appendChild($head, node);
}
function _filter(item) {
    return !!item;
}
function _appendChild(node, child) {
    return node.appendChild(child);
}
function _hasOwn (obj, prop) {
    return obj.hasOwnProperty(prop)
}
function _attr(el, attName) {
    return el.getAttribute(attName)
}
function _is(obj, type) {
    return Object.prototype.toString.call(obj).toLowerCase() === '[object ' + type + ']';
}
/**
 *  Ajax request loader
 */
var isOldWebKit = +navigator.userAgent.replace(/.*AppleWebKit\/(\d+)\..*/, '$1') < 536;
var $head = document.head || document.getElementsByTagName('head')[0];

var xhr;
function loader (url, type, callback) {

    var isScript = type === 'js';
    var isCss = type === 'css';
    var node = document.createElement(isScript ? 'script' : 'link');
    var supportOnload = 'onload' in node;
    var tid = setTimeout(function() {
        clearTimeout(tid);
        clearInterval(intId);
        callback('timeout');
    }, TIMEOUT);
    var intId;

    if (isScript) {
        node.type = 'text/javascript';
        node.async = 'async';
        node.src = url;
    } else {
        if (isCss) {
            node.type = 'text/css';
            node.rel = 'stylesheet';
        }
        node.href = url;
    }
    node.onload = node[READY_STATE_CHANGE] = function() {
        if (node && (!node[READY_STATE] || /loaded|complete/.test(node[READY_STATE]))) {
            clearTimeout(tid);
            node.onload = node[READY_STATE_CHANGE] = noop;
            if (isScript && $head && node.parentNode) $head.removeChild(node);
            callback();
            node = null;
        }
    };
    node.onerror = function(e) {
        clearTimeout(tid);
        clearInterval(intId);
        e = (e || {}).error || new Error('load resource timeout');
        e.message = 'Error loading [' + url + ']: ' + e.message;
        callback(e);
    };

    _appendChild($head, node);

    if (isCss) {
        if (isOldWebKit || !supportOnload) {
            intId = setInterval(function() {
                if (node.sheet) {
                    clearTimeout(id);
                    clearInterval(intId);
                    callback();
                }
            }, 20);
        }
    }
};

loader.xhr = function () {
    return xhr
}
loader.request = function (quickling, options, callback, progress) {
    var before = options.before || noop
    /**
     *  only on request in processing
     */
    if (xhr && xhr[READY_STATE] < 4) {
        xhr[READY_STATE_CHANGE] = noop;
        xhr.abort();
    }
    xhr = new global.XMLHttpRequest();
    xhr.onprogress = progress;
    xhr[READY_STATE_CHANGE] = function() {
        if (xhr[READY_STATE] == 4) {
            xhr[READY_STATE_CHANGE] = noop;
            var result, error = null;
            if ((xhr.status >= 200 && xhr.status < 300) || xhr.status == 304) {
                result = xhr.responseText;
                try {
                    result = JSON.parse(result);
                } catch (e) {
                    error = e;
                }
                error ? callback(error) : callback(null, result);
            } else {
                error = xhr.statusText || (xhr.status ? 'error' : 'abort')
                callback(error);
            }
        }
    };

    before(xhr);
    xhr.open('GET', quickling, true);
    xhr.send();
};
/**
 *  Attach message function to pagelet instance
 */

function messagify (raw) {
    /**
     *  Messages
     */
    var callbacks = {};
    raw.emit = function (type) {
        var handlers = callbacks[type];
        var args = [].slice.call(arguments);
        args.shift();
        if (handlers) {
            handlers.forEach(function (fn) {
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
/**
 *  Pagelet main module
 */

var $document = document
var hist = global.history
var comboPattern = DEFAULT_COMBO_PATTERN;
var combo = false; // 是否采用combo
var loaded = {};
// 是否支持Html5的PushState
var supportPushState =
    hist && hist.pushState && hist.replaceState &&
    // pushState isn't reliable on iOS until 5.
    !navigator.userAgent.match(/((iPod|iPhone|iPad).+\bOS\s+[1-4]\D|WebApps\/.+CFNetwork)/);

var pagelet = global.pagelet = {};
/**
 *  Attature message function to pagelet instance
 */
messagify(pagelet);

pagelet.init = function(cb, cbp, used) {
    combo = !!cb;
    comboPattern = cbp || DEFAULT_COMBO_PATTERN;
    if (used && used.length) {
        used.forEach(function(uri) {
            loaded[uri] = true;
        });
    }
};

pagelet.load = function(url, pagelets, callback, progress) {
    if (pagelets && pagelets.length) {
        callback = callback || noop;
        progress = progress || noop;
        if (_is(pagelets, 'string')) {
            pagelets = pagelets.split(/\s*,\s*/);
        }
        var quickling = url + (url.indexOf('?') === -1 ? '?' : '&') + 'pagelets=' + encodeURIComponent(pagelets.join(','));

        loader.request(quickling, {
            before: function (xhr) {
                pagelet.emit('beforeload', pagelets, xhr)
            }
        }, function (err, result) {
            pagelet.emit('loadend', pagelets, err, result)

            if (err) return callback(err);

            $document.title = result.title || $document.title;
            var res = [];
            _addResource(res, result.js, 'js');
            _addResource(res, result.css, 'css');
            var done = function() {
                if (result.script && result.script.length) {
                    var left = '!function(){';
                    var right = '}();\n';
                    var code = left + result.script.join(right + left) + right;
                    _exec(code);
                }
                //TODO input[autofocus], textarea[autofocus]
                done = noop;
            };

            var error = err
            if (res && res.length) {
                var len = res.length;
                res.forEach(function(r) {
                    loader(r.uri, r.type, function(e) {
                        len--;
                        if (len === 0) {
                            callback(error, result, done);
                        }
                        error = e;
                    });
                });
            } else {
                callback(error, result, done);
            }
        }, progress)
    } else {
        location.href = url;
    }
};


var state; // state is a cached var for last popstate

pagelet.go = function(url, pagelets, processHtml, progress) {
    if (supportPushState && pagelets) {
        if (!state) {
            state = {
                url: global.location.href,
                title: $document.title
            };
            hist.replaceState(state, $document.title);
        }
        pagelet.load(url, pagelets, function(err, data, done) {
            var title = data.title || $document.title;
            state = {
                url: url,
                title: title
            };
            hist.replaceState(state, title, url);
            // Clear out any focused controls before inserting new page contents.
            try {
                $document.activeElement.blur()
            } catch (e) {}
            if (processHtml(null, data.html) !== false) done();
        }, progress);

        var xhr = loader.xhr()
        if (xhr && xhr.readyState > 0) {
            hist.pushState(null, "", url);
        }
    } else {
        location.href = url;
    }
};

pagelet.autoload = function() {
    global.addEventListener('popstate', function(e) {
        state = e.state;
        if (state) {
            location.href = state.url;
        }
    }, false);

    $document.documentElement.addEventListener('click', function(e) {
        var target = e.target;
        if (target.tagName.toLowerCase() === 'a') {
            // Middle click, cmd click, and ctrl click should open
            // links in a new tab as normal.
            if (e.which > 1 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            // Ignore cross origin links
            if (location.protocol !== target.protocol || location.hostname !== target.hostname) return;

            var pagelets = _attr(target, 'data-pagelets');
            var parents = _attr(target, 'data-parents');
            var autocache = _attr(target, 'data-autocache');
            var href = _attr(target, 'href');

            pagelets = (pagelets || '').split(/\s*,\s*/).filter(_filter);
            parents = (parents || '').split(/\s*,\s*/).filter(_filter);

            if (href && parents.length === pagelets.length && pagelets.length > 0) {
                e.preventDefault();
                e.stopPropagation();

                if (autocache === 'cached') {
                    // 不触发pagelet请求
                    return false;
                }
                if (autocache === 'false') {
                    // 让pagelet请求带上时间戳，避免命中浏览器缓存
                    href += (href.indexOf('?') >= 0 ? '&' : '?') + '_ts=' + Date.now();
                }

                var map = {};
                pagelets.forEach(function(pagelet, index) {
                    map[pagelet] = parents[index];
                });
                pagelet.go(href, pagelets, function(err, html) {
                    if (err) {
                        throw new Error(err);
                    } else {
                        for (var key in html) {
                            if (_hasOwn(html, key) && _hasOwn(map, key)) {
                                var parent = map[key];
                                var dom = $document.getElementById(parent);
                                if (dom) {
                                    dom = null;
                                    if (autocache === 'true') {
                                        // 下次点击不会触发pagelet请求
                                        target.setAttribute('data-autocache', 'cached');
                                    }
                                } else {
                                    throw new Error('undefined parent dom [' + parent + ']');
                                }
                            }
                        }
                    }
                });
            }
        }
    }, false);
};

function _addResource(result, collect, type) {
    if (collect && collect.length) {
        collect = collect.filter(function(uri) {
            var has = loaded[uri] === true;
            loaded[uri] = true;
            return !has;
        });
        if (collect.length) {
            if (combo) {
                var uri = collect.join(',');
                result.push({
                    uri: comboPattern.replace('%s', uri),
                    type: type
                });
            } else {
                collect.forEach(function(uri) {
                    result.push({
                        uri: uri,
                        type: type
                    });
                });
            }
        }
    }
}

})(window);