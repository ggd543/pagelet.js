# pagelet.js

> scrat seo模式的pagelet框架

## Downloads
- [pagelet.js](https://raw.githubusercontent.com/scrat-team/pagelet.js/master/dist/pagelet.js)
- [pagelet.min.js](https://raw.githubusercontent.com/scrat-team/pagelet.js/master/dist/pagelet.min.js)


## API

### pagelet.autoload();

> 调用这个函数，阻止页面的a标签的跳转，变成自动pagelet加载

### pagelet.load(url, pagelets, callback [, progress]);

> 加载一个pagelet

* url ``String`` 要加载的页面地址
* pagelets ``String|Array`` 要加载的pagelet的id，可以是id数组，也可以是用``,``分隔的字符串
* callback ``Function`` 完成pagelet资源加载后的回调函数
* progress ``Function|null`` ajax加载过程中的progress函数

示例：

```js
pagelet.load('/news?p=123', ['list', 'hot'], function(err, data, done){
  if(err){
    // 如果有err，这里处理
  } else {
    // 这里写业务逻辑处理html插入，其中：
    // data.html，是一个k-v对象，k是pageletId，v是html片段
    // data.data，是页面用{% datalet name="xxx" value="xxx" %} 收集的数据
    // 完成html插入之后，必须调用一下done函数，框架会插入pagelet收集上来的script标签中的内容并执行
    done();
  }
});
```

## pagelet.on(EventType, handler)

> 监听 pagelet 发出来的消息

内置的事件类型 `EventType` 有:
- *"beforeload":* 在 pagelet 发起请求前触发，处理方法：handler(pagelets, xhr)
- *"loadend":* 在 pagelet 请求完成后触发，处理方法：handler(pagelets, error, result)

## pagelet.off(EventType [, handler])

> 解绑由 pagelet.on 监听的事件
