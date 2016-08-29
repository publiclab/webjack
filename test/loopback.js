'use strict';

var test = require('tape');
var sinon = require('sinon');

var webjack = require('../dist/webjack');

var opts = {
  sampleRate : 44100,
  baud : 1225,
  freqLow : 2450,
  freqHigh : 4900,
  debug : false,
  raw : true
};

function Float32Concat(first, second){
  var firstLength = first.length;
  var result = new Float32Array(firstLength + second.length);

  result.set(first);
  result.set(second, firstLength);

  return result;
}

test('encode → decode : all chars', function(t) {
  var callback = sinon.spy();
  opts.onReceive = callback;
  var encoder = new webjack.Encoder(opts);
  var decoder = new webjack.Decoder(opts);
  var samples, noise, noisy, length;

  length = ((49*2)+20+10+20)*36;  // 2x preamble + bits + silence before and after
  noise = new Float32Array(length);

  // lets make some noise
  for (var n = 0; n < noise.length; n++)
    noise[n] = (Math.random()*2 -1)/10;

  // iterate over 2^8 possible bytes
  for (var i = 0; i < 256; i++){
    samples = Float32Concat(encoder.modulate([i,i]), encoder.modulate([i]));

    noisy = new Float32Array(noise.length);
    var start = 10*36;
    for (var s = 0; s < samples.length; s++ )
      noisy[start + s] = samples[s] + noise[s];
    
    if (opts.debug) console.log('byte to decode: ' + i.toString(2));
    decoder.decode(noisy);
  }
  // console.log(callback.printf('%C'));

  var contents_correct = true;
  var call1, call2;
  for (var i = 0, c = 0; c < 256*2; i++, c+=2){
    call1 = callback.getCall(c).args[0];
    call2 = callback.getCall(c+1).args[0];

    contents_correct = contents_correct && (call1[0] == i && call1[1] == i) && (call2[0] == i);
    if (!contents_correct){
      console.log(call1);
      console.log(call2);
    }
  }


  t.equal(callback.callCount, 256*2, "num of detected transmissions");
  t.equal(contents_correct, true, "decoded contents correctly");
  t.end();
});
