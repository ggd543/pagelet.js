;(function(global){
  var pagelet = global.pagelet = {};
  var loaded = {};
  var isOldWebKit = +navigator.userAgent.replace(/.*AppleWebKit\/(\d+)\..*/, '$1') < 536;
  var head = document.head || document.getElementsByTagName('head')[0];
  var TIMEOUT = 60 * 1000;
  var combo = false;
  var DEFAULT_COMBO_PATTERN = '/co??%s';
  var comboPattern = DEFAULT_COMBO_PATTERN;
  var supportPushState =
    global.history && global.history.pushState && global.history.replaceState &&
      // pushState isn't reliable on iOS until 5.
    !navigator.userAgent.match(/((iPod|iPhone|iPad).+\bOS\s+[1-4]\D|WebApps\/.+CFNetwork)/);

  global.addEventListener('popstate', function(e){
    state = e.state;
    if(state){
      location.href = state.url;
    }
  }, false);

  function noop(){}

  function load(url, type, callback){
    var isScript = type === 'js';
    var isCss = type === 'css';
    var node = document.createElement(isScript ? 'script' : 'link');
    var supportOnload = 'onload' in node;
    var tid = setTimeout(function(){
      clearTimeout(tid);
      clearInterval(intId);
      callback('timeout');
    }, TIMEOUT);
    var intId;
    if(isScript){
      node.type = 'text/javascript';
      node.async = 'async';
      node.src = url;
    } else {
      if(isCss){
        node.type = 'text/css';
        node.rel = 'stylesheet';
      }
      node.href = url;
    }
    node.onload = node.onreadystatechange = function(){
      if(node && (!node.readyState || /loaded|complete/.test(node.readyState))){
        clearTimeout(tid);
        node.onload = node.onreadystatechange = noop;
        if(isScript && head && node.parentNode) head.removeChild(node);
        callback();
        node = null;
      }
    };
    node.onerror = function(e){
      clearTimeout(tid);
      clearInterval(intId);
      e = (e||{}).error || new Error('load resource timeout');
      e.message = 'Error loading [' + url + ']: ' + e.message;
      callback(e);
    };
    head.appendChild(node);
    if(isCss){
      if(isOldWebKit || !supportOnload){
        intId = setInterval(function(){
          if(node.sheet){
            clearTimeout(id);
            clearInterval(intId);
            callback();
          }
        }, 20);
      }
    }
  }

  function is(obj, type){
    return Object.prototype.toString.call(obj) === '[Object ' + type + ']';
  }

  pagelet.init = function(cb, cbp, used){
    combo = !!cb;
    comboPattern = cbp || DEFAULT_COMBO_PATTERN;
    if(used && used.length){
      used.forEach(function(uri){
        loaded[uri] = true;
      });
    }
  };

  function addResource(result, collect, type){
    if(collect && collect.length){
      collect = collect.filter(function(uri){
        var has = loaded[uri] === true;
        loaded[uri] = true;
        return !has;
      });
      if(collect.length){
        if(combo){
          var uri = collect.join(',');
          result.push({
            uri: comboPattern.replace('%s', uri),
            type: type
          });
        } else {
          collect.forEach(function(uri){
            result.push({
              uri: uri,
              type: type
            });
          });
        }
      }
    }
  }

  function exec(code){
    var node = document.createElement('script');
    node.appendChild(document.createTextNode(code));
    head.appendChild(node);
  }

  var xhr, state;

  pagelet.go = function(url, pagelets, processHtml, progress){
    if(supportPushState && pagelets){
      processHtml = processHtml || noop;
      progress = progress || noop;
      if(is(pagelets, 'String')){
        pagelets = pagelets.split(/\s*,\s*/);
      }
      pagelets = pagelets.join(',');
      var quickling = url + (url.indexOf('?') === -1 ? '?' : '&') + 'pagelets=' + encodeURIComponent(pagelets);
      if(!state){
        state = {
          url: global.location.href,
          title: document.title
        };
        global.history.replaceState(state, document.title);
      }
      if ( xhr && xhr.readyState < 4) {
        xhr.onreadystatechange = noop;
        xhr.abort();
      }
      xhr = new global.XMLHttpRequest();
      xhr.onprogress = progress;
      xhr.onreadystatechange = function(){
        if(xhr.readyState == 4){
          xhr.onreadystatechange = noop;
          var result, error = false;
          if((xhr.status >= 200 && xhr.status < 300) || xhr.status == 304){
            result = xhr.responseText;
            try {
              result = JSON.parse(result);
            } catch (e) {
              error = e;
            }
            if(error){
              processHtml(error);
            } else {
              var title = result.title || document.title;
              state = {
                url: url,
                title: title
              };
              global.history.replaceState(state, title, url);
              // Clear out any focused controls before inserting new page contents.
              try {
                document.activeElement.blur()
              } catch (e) { }
              document.title = title;
              var res = [];
              addResource(res, result.js, 'js');
              addResource(res, result.css, 'css');
              var done = function(){
                if(result.script && result.script.length){
                  var left = '!function(){';
                  var right = '}();\n';
                  var code = left + result.script.join(right + left) + right;
                  exec(code);
                }
                //TODO input[autofocus], textarea[autofocus]
                done = noop;
              };
              if(res && res.length){
                var len = res.length;
                res.forEach(function(r){
                  load(r.uri, r.type, function(err){
                    len--;
                    if(len === 0){
                      if(processHtml(null, result.html, done) !== false) done();
                    }
                    if(err) throw err;
                  });
                });
              } else {
                if(processHtml(null, result.html, done) !== false) done();
              }
            }
          } else {
            processHtml(xhr.statusText || (xhr.status ? 'error' : 'abort'));
          }
        }
      };
      xhr.open('GET', quickling, true);
      xhr.send();
      if (xhr.readyState > 0) {
        global.history.pushState(null, "", url);
      }
    } else {
      location.href = url;
    }
  };
  
  function filter(item){ return !!item; }

  document.documentElement.addEventListener('click', function(e){
    var target = e.target;
    if(target.tagName.toLowerCase() === 'a'){
      var pagelets = target.getAttribute('data-pagelets');
      var parents = target.getAttribute('data-parents');
      var href = target.getAttribute('href');
      pagelets = (pagelets || '').split(/\s*,\s*/).filter(filter);
      parents = (parents || '').split(/\s*,\s*/).filter(filter);
      if(href && parents.length === pagelets.length && pagelets.length > 0){
        e.preventDefault();
        e.stopPropagation();
        var map = {};
        pagelets.forEach(function(pagelet, index){
          map[pagelet] = parents[index];
        });
        pagelet.go(href, pagelets, function(err, html){
          if(err){
            throw new Error(err);
          } else {
            for(var key in html){
              if(html.hasOwnProperty(key) && map.hasOwnProperty(key)){
                var parent = map[key];
                var dom = document.getElementById(parent);
                if(dom){
                  dom.innerHTML = html[key];
                  dom = null;
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

})(window);