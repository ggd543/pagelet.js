var gulp = require('gulp')
var webpack = require('gulp-webpack')
var uglify = require('gulp-uglifyjs')
var meta = require('./package.json')
var watch = require('gulp-watch')


gulp.task('watch', function () {
    watch(['lib/*.js', 'pagelet.js'], function () {
        gulp.start('default')
    })
});

gulp.task('default', function() {
    return gulp.src('pagelet.js')
        .pipe(webpack({
            output: {
                library: 'pagelet',
                libraryTarget: 'umd',
                filename: 'pagelet.js'
            }
        }))
        .pipe(gulp.dest('dist/'))
        .pipe(gulp.dest('test/'))
        .pipe(uglify('pagelet.min.js', {
            mangle: true,
            compress: true
        }))
        .pipe(gulp.dest('dist/'))
});
