'use strict';

var fs = require('fs');
var test = require('blue-tape');
var sinon = require('sinon');
var WavDecoder = require("wav-decoder");

var webjack = require('../dist/webjack');

const readFile = (filepath) => {
  return new Promise((resolve, reject) => {
    fs.readFile(filepath, (err, buffer) => {
      if (err) {
        return reject(err);
      }
      return resolve(buffer);
    });
  });
};


function testNTransmissions(t, file, numOfTransmissions){
	var sampleRate = 44100;
	var callback = sinon.spy();
	var decoder = new webjack.Decoder({sampleRate: sampleRate, baud: 1225, onReceive: callback});

	return readFile("test/fixtures/" + file).then( buffer => (WavDecoder.decode(buffer)) )
		.then(function(audioData) {
			var fileSampleRate = audioData.sampleRate;
			var samples = audioData.channelData[0];  // Float32Array
			decoder.decode(samples);
			t.equal(fileSampleRate, sampleRate, 'sample rates fit');
			t.equal(callback.callCount, numOfTransmissions, "num of detected transmissions");
			t.equal(callback.alwaysCalledWithExactly("SoftModem"), true, "decoded content correctly");
	});
}

test('decoder decodes single transmission', function (t) {
	return testNTransmissions(t, "SoftModem.wav", 1);
});

test.skip('decoder decodes repeated transmissions (with spaces inbetween)', function (t) {
	testNTransmissions(t, "10xSoftModem_spaces.wav", 10);
});

test.skip('decoder decodes repeated transmission (without spaces)', function (t) {
	testNTransmissions(t, "10xSoftModem.wav", 10);
});

test.skip('decoder handles broken transmissions correctly', function (t) {
	testNTransmissions(t, "broken_one.wav", 6);
});
