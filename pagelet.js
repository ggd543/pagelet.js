'use strict';

var global = window;
var loaded = {};
var UA = navigator.userAgent
var docm = document
var hist = global.history
var isOldWebKit = +UA.replace(/.*AppleWebKit\/(\d+)\..*/, '$1') < 536;
var head = docm.head || docm.getElementsByTagName('head')[0];

var TIMEOUT = 60 * 1000; // pagelet请求的默认超时时间
var combo = false; // 是否采用combo
var DEFAULT_COMBO_PATTERN = '/co??%s';
var comboPattern = DEFAULT_COMBO_PATTERN;


// 是否支持Html5的PushState
var supportPushState =
    hist && hist.pushState && hist.replaceState &&
    // pushState isn't reliable on iOS until 5.
    !UA.match(/((iPod|iPhone|iPad).+\bOS\s+[1-4]\D|WebApps\/.+CFNetwork)/);

function load(url, type, callback) {
    var isScript = type === 'js';
    var isCss = type === 'css';
    var node = docm.createElement(isScript ? 'script' : 'link');
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
    node.onload = node.onreadystatechange = function() {
        if (node && (!node.readyState || /loaded|complete/.test(node.readyState))) {
            clearTimeout(tid);
            node.onload = node.onreadystatechange = noop;
            if (isScript && head && node.parentNode) head.removeChild(node);
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
    _appendChild(head, node);
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
}

/**
 *  pagelet module methods define
 */
var pagelet = {};
pagelet.init = function(cb, cbp, used) {
    combo = !!cb;
    comboPattern = cbp || DEFAULT_COMBO_PATTERN;
    if (used && used.length) {
        used.forEach(function(uri) {
            loaded[uri] = true;
        });
    }
};

var xhr, state;

pagelet.load = function(url, pagelets, callback, progress) {
    if (pagelets && pagelets.length) {
        callback = callback || noop;
        progress = progress || noop;
        if (is(pagelets, 'String')) {
            pagelets = pagelets.split(/\s*,\s*/);
        }
        pagelets = pagelets.join(',');
        var quickling = url + (url.indexOf('?') === -1 ? '?' : '&') + 'pagelets=' + encodeURIComponent(pagelets);
        if (xhr && xhr.readyState < 4) {
            xhr.onreadystatechange = noop;
            xhr.abort();
        }
        xhr = new global.XMLHttpRequest();
        xhr.onprogress = progress;
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4) {
                xhr.onreadystatechange = noop;
                var result, error = null;
                if ((xhr.status >= 200 && xhr.status < 300) || xhr.status == 304) {
                    result = xhr.responseText;
                    try {
                        result = JSON.parse(result);
                    } catch (e) {
                        error = e;
                    }
                    if (error) {
                        callback(error);
                    } else {
                        docm.title = result.title || docm.title;
                        var res = [];
                        addResource(res, result.js, 'js');
                        addResource(res, result.css, 'css');
                        var done = function() {
                            if (result.script && result.script.length) {
                                var left = '!function(){';
                                var right = '}();\n';
                                var code = left + result.script.join(right + left) + right;
                                exec(code);
                            }
                            //TODO input[autofocus], textarea[autofocus]
                            done = noop;
                        };
                        if (res && res.length) {
                            var len = res.length;
                            res.forEach(function(r) {
                                load(r.uri, r.type, function(err) {
                                    len--;
                                    if (len === 0) {
                                        callback(error, result, done);
                                    }
                                    error = err;
                                });
                            });
                        } else {
                            callback(error, result, done);
                        }
                    }
                } else {
                    callback(xhr.statusText || (xhr.status ? 'error' : 'abort'));
                }
            }
        };
        xhr.open('GET', quickling, true);
        xhr.send();
    } else {
        location.href = url;
    }
};

pagelet.go = function(url, pagelets, processHtml, progress) {
    if (supportPushState && pagelets) {
        if (!state) {
            state = {
                url: global.location.href,
                title: docm.title
            };
            hist.replaceState(state, docm.title);
        }
        pagelet.load(url, pagelets, function(err, data, done) {
            var title = data.title || docm.title;
            state = {
                url: url,
                title: title
            };
            hist.replaceState(state, title, url);
            // Clear out any focused controls before inserting new page contents.
            try {
                docm.activeElement.blur()
            } catch (e) {}
            if (processHtml(null, data.html) !== false) done();
        }, progress);
        if (xhr.readyState > 0) {
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
    docm.docmElement.addEventListener('click', function(e) {
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

            pagelets = (pagelets || '').split(/\s*,\s*/).filter(filter);
            parents = (parents || '').split(/\s*,\s*/).filter(filter);

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
                            if (html.hasOwnProperty(key) && map.hasOwnProperty(key)) {
                                var parent = map[key];
                                var dom = docm.getElementById(parent);
                                if (dom) {
                                    dom.innerHTML = html[key];
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

/**
 *  Util functions
 */
function noop() {}
function filter(item) {
    return !!item;
}
function _attr(el, attName) {
    return el.getAttribute(attName)
}
function _appendChild(node, child) {
    return node.appendChild(child);
}
function addResource(result, collect, type) {
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
function is(obj, type) {
    return Object.prototype.toString.call(obj) === '[Object ' + type + ']';
}
function exec(code) {
    var node = docm.createElement('script');
    _appendChild(node, docm.createTextNode(code));
    _appendChild(head, node);
}

module.exports = pagelet;