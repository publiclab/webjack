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


function testNTransmissions(t, file, numOfTransmissions, content){
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
			if (content != undefined)
				t.equal(callback.alwaysCalledWithExactly(content), true, "decoded content correctly");
			console.log(callback.printf('%C'));
	});
}

test('decoder decodes (multiple) SoftModem signals, with spaces inbetween', function (t) {
	return testNTransmissions(t, "15xWebJack_with_spaces.wav", 15, 'WebJack');
});

test('decoder decodes signals without spaces inbetween', function (t) {
	return testNTransmissions(t, "10xWebJack.wav", 10, 'WebJack');
});

test('decodes decodes recording from Nexus5', function (t) {
	return testNTransmissions(t, "15xWebJack_Nexus5.wav", 1, 'WebJack');
});

test('decodes decodes recording from Razr i', function (t) {
	return testNTransmissions(t, "15xWebJack_razri.wav", 1, 'WebJack');
});

test('decodes decodes much words, such sentence', function (t) {
	return testNTransmissions(t, "much_words.wav", 1, 'This is a particularly long sentence for a WebJack transmission.');
});

test.skip('decoder handles broken transmissions correctly', function (t) {
	return testNTransmissions(t, "broken_one.wav", 0, null);
});
