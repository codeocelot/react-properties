var gulp = require('gulp'),
  connect = require('gulp-connect'),
	sass = require('gulp-sass');

var paths = {
  app: './',
  src: ['./*.html', './partials/**/*.html', '.style/css/*.css', './js/*.js'],
	style:['./style/sass/*.sass'],
};

gulp.task('connect', function() {
  connect.server({
    root: paths.app,
    livereload: true,
    port: 2772
  });
});

gulp.task('sass',function(){
	console.log('in sass gulp');
	gulp.src('./style/sass/**/*.sass')
		.pipe(sass().on('error',sass.logError))
		.pipe(gulp.dest('./style/css/'));
})

gulp.task('html', function() {
  gulp.src(paths.src)
    .pipe(connect.reload());
});

gulp.task('watch', function() {
	gulp.watch([paths.style],['sass']);
  gulp.watch([paths.src], ['html']);
});

gulp.task('default', ['connect', 'watch']);
