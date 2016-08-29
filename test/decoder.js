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

var opts = {
	sampleRate : 44100,
	baud : 1225,
	freqLow : 2450,
	freqHigh : 4900
};

function testNTransmissions(t, file, numOfTransmissions, content){
	var callback = sinon.spy();
	opts.onReceive = callback;
	var decoder = new webjack.Decoder(opts);

	return readFile("test/fixtures/" + file).then( buffer => (WavDecoder.decode(buffer)) )
		.then(function(audioData) {
			var fileSampleRate = audioData.sampleRate;
			var samples = audioData.channelData[0];  // Float32Array

			var chunksize = 8192;
			for(var start=0; start < samples.length; start+=chunksize){
				var end = start + chunksize;
				var chunk = end < samples.length ? samples.slice(start,end) : samples.slice(start);
				decoder.decode(chunk);
				// console.log("NEXT CHUNK");
			}
			
			t.equal(fileSampleRate, opts.sampleRate, 'sample rates fit');
			t.equal(callback.callCount, numOfTransmissions, "num of detected transmissions");
			if (typeof content !== 'undefined')
				t.equal(callback.alwaysCalledWithExactly(content), true, "decoded content correctly");
			// console.log(callback.printf('%C'));
	});
}

test('decodes (multiple) SoftModem signals, with spaces inbetween', function (t) {
	return testNTransmissions(t, "10xWebJack_with_spaces.wav", 10, 'WebJack');
});

test('decodes signals without spaces inbetween', function (t) {
	return testNTransmissions(t, "10xWebJack.wav", 10, 'WebJack');
});

test.skip('decodes recording from Nexus5', function (t) {
	return testNTransmissions(t, "10xWebJack_Nexus5.wav", 10, 'WebJack');
});

test('decodes recording from Razr i', function (t) {
	return testNTransmissions(t, "10xWebJack_razri.wav", 10, 'WebJack');
});

test('decodes much words, such sentence', function (t) {
	return testNTransmissions(t, "much_words.wav", 1, 'This is a particularly long sentence for a WebJack transmission.');
});

test('handles broken transmissions correctly', function (t) {
	return testNTransmissions(t, "broken_one.wav", 0, undefined);
});
