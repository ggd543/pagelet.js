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