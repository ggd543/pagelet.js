'use strict';

var express = require('express')
var path = require('path')
var app = express()
var colors = require('colors')




/**
 *  static folder
 **/
app.use(express.static(path.join(__dirname, '.')))
app.get('/index', function (req, res, next) {
    res.send({
        title: 'index',
        html: {
            index: '<div>Load by pagelet</div>'
        },
        js: ['js/index.js'],
        css: ['css/index.css']
    })
})
/**
 *  server and port
 **/
var port = process.env.PORT || 1024
app.listen(port, function () {
    console.log('Server is listen on port', String(port).blue)
    
})