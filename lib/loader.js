var isOldWebKit = +navigator.userAgent.replace(/.*AppleWebKit\/(\d+)\..*/, '$1') < 536;
var READY_STATE_CHANGE = 'onreadystatechange'
var READY_STATE = 'readyState'
var TIMEOUT = 60 * 1000; // pagelet请求的默认超时时间

var $docm = document
var $head = $docm.head || $docm.getElementsByTagName('head')[0];
var xhr;

function noop () {}

function loader (url, type, callback) {

    var isScript = type === 'js';
    var isCss = type === 'css';
    var node = $docm.createElement(isScript ? 'script' : 'link');
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

    $head.appendChild(node);

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
loader.request = function (quickling, callback, progress) {
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
                callback(xhr.statusText || (xhr.status ? 'error' : 'abort'));
            }
        }
    };
    xhr.open('GET', quickling, true);
    xhr.send();
};

module.exports = loader;