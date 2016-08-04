'use strict';

var test = require('tape');
var sinon = require('sinon');

var webjack = require('../dist/webjack');

var opts = {
	sampleRate : 44100,
	baud : 1225,
	freqLow : 2450,
	freqHigh : 4900,
	firmata : true
};

test.skip('encode → decode : all chars', function(t) {
	var callback = sinon.spy();
	opts.onReceive = callback;
	var encoder = new webjack.Encoder(opts);
	var decoder = new webjack.Decoder(opts);
	var samples, noisy, length, args;

	length = (49+11+ 60)*36;  // preamble + bits + silence before and after
	noisy = new Float32Array(length);

	// console.log(noisy);

	args = [];
	for (var i=120; i < 140; i++){
		for (var n=0; n < length; n++)
			noisy[n] = (Math.random()*2 -1)/16;
		if (i >= 127)
			opts.debug = true;
		samples = encoder.modulate([i,i]);
		args.push([i,i]);
		var start = 30*36;
		for (var s=0; s < samples.length; s++ )
			noisy[start + s] += samples[s];
		
		console.log('byte to decode: ' + i.toString(2));
		decoder.decode(noisy);
	}
	console.log(callback.printf('%C'));
	t.equal(callback.callCount, 256, "num of detected transmissions");
	t.equal(callback.calledWith(args), true, "decoded content correctly");
	t.end();
});
