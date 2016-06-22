'use strict';

var fs = require('fs');
var test = require('tape');
var webjack = require('../dist/webjack');

function read (file) {
  return fs.readFileSync('./test/fixtures/' + file, 'utf8').trim();
}

function write (file, data) { /* jshint ignore:line */
  return fs.writeFileSync('./test/fixtures/' + file, data + '\n', 'utf8');
}

test('webjack has tests', function (t) {
  // read('something.html')
  t.equal(true, true);
  t.end();
});