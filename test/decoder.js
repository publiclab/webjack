'use strict';

var fs = require('fs');
var test = require('tape');
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
	var callback = sinon.spy();
	var decoder = new webjack.Decoder({sampleRate: 44100, baud: 1225, onResult: callback});

	readFile("./test/fixtures/" + file).then((buffer) => {
	  return WavDecoder.decode(buffer);
	}).then(function(audioData) {
		sampleRate = audioData.sampleRate;
		samples = audioData.channelData[0];  // Float32Array
		decoder.decode(samples, callback);
	});

	t.equal(callback.callCount, numOfTransmissions, "num of detected transmissions");
	t.equal(callback.alwaysCalledWithExactly("SoftModem"), true, "decoded content correctly");
	t.end();
}

test('decoder decodes single transmission', function (t) {
	testNTransmissions(t, "SoftModem.wav", 1);
});

test('decoder decodes repeated transmissions (with spaces inbetween)', function (t) {
	testNTransmissions(t, "10xSoftModem_spaces.wav", 10);
});

test('decoder decodes repeated transmission (without spaces)', function (t) {
	testNTransmissions(t, "10xSoftModem.wav", 10);
});

test('decoder handles broken transmissions correctly', function (t) {
	testNTransmissions(t, "broken_one.wav", 6);
});
