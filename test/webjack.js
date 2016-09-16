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
  var profile = webjack.Profiles.Browser;
  profile.audioCtx = AudioContext;  // mocking audiocontext for node
  profile.navigator = navigator;    // same for navigator
  var conn = new webjack.Connection(profile);
  t.equal(typeof conn === 'object', true);
  t.equal(conn.options.baud, webjack.Profiles.Browser.baud);
  t.equal(conn.options.freqLow, webjack.Profiles.Browser.freqLow);
  t.equal(conn.options.freqHigh, webjack.Profiles.Browser.freqHigh);
  t.equal(conn.options.echoCancellation, webjack.Profiles.Browser.echoCancellation);
  t.equal(conn.options.softmodem, webjack.Profiles.Browser.softmodem);
  t.end();
});
