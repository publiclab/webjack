'use strict';

var fs = require('fs');
var test = require('tape');


var AudioContext = {
  sampleRate: 44100,
  createMediaStreamSource: function(){ return { connect: function(){}}},
  createScriptProcessor: function(){ return { connect: function(){}, addEventListener: function(){}}}
};

var navigator = { 
  mediaDevices : { 
    getUserMedia : function(){ 
      return { then : function(){}}
    }
  }
};


var webjack = require('../dist/webjack');


function read (file) {
  return fs.readFileSync('./test/fixtures/' + file, 'utf8').trim();
}

function write (file, data) { /* jshint ignore:line */
  return fs.writeFileSync('./test/fixtures/' + file, data + '\n', 'utf8');
}

test.skip('webjack has tests', function (t) {
  // read('something.html')
  t.equal(true, true);
  t.end();
});

test('webjack module is exported', function (t) {
  var conn = new webjack.Connection({audioCtx: AudioContext, navigator : navigator});
  t.equal(typeof conn === 'object', true);
  t.end();
});

test('webjack constructor sets options via profiles, exposes via public .options api', function (t) {
  var conn = new webjack.Connection(webjack.profiles.Browser);
  t.equal(typeof conn === 'object', true);
  t.equal(conn.options.baud, webjack.profiles.Browser.baud);
  t.equal(conn.options.freqLow, webjack.profiles.Browser.freqLow);
  t.equal(conn.options.freqHigh, webjack.profiles.Browser.freqHigh);
  t.equal(conn.options.echoCancellation, webjack.profiles.Browser.echoCancellation);
  t.equal(conn.options.softmodem, webjack.profiles.Browser.softmodem);
  t.end();
});
