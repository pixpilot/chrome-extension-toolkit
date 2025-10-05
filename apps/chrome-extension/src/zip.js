import gulp from 'gulp';
import zip from 'gulp-zip';

const manifest = require('../build/manifest.json');

gulp
  .src('build/**', { encoding: false })
  .pipe(zip(`${manifest.name.replaceAll(' ', '-')}-${manifest.version}.zip`))
  .pipe(gulp.dest('package'));
