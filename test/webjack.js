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

test('webjack has tests', function (t) {
  // read('something.html')
  t.equal(true, true);
  t.end();
});

test('webjack module is exported', function (t) {
	var conn = new webjack.Connection({baud: 1225, audioCtx: AudioContext, navigator : navigator});
  t.equal(typeof conn === 'object', true);
  t.end();
});