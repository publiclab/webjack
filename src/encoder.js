WebJack.Encoder = Class.extend({

  init: function(args) {

    var encoder = this;

    var sampleRate = 44100;
    var targetSampleRate = args.sampleRate;
    
    var baud;
    var freqLow;
    var freqHigh;

    var samplesPerBit;
    var preambleLength;
    var pushbitLength;

    var bitBufferLow;
    var bitBufferHigh;

    var rawStream;
    var softmodem;

    encoder.setProfile = function(profile){

      baud = profile.baud;
      freqLow = profile.freqLow;
      freqHigh = profile.freqHigh;

      samplesPerBit = Math.ceil(sampleRate/baud);
      preambleLength = Math.ceil(sampleRate*40/1000/samplesPerBit);
      pushbitLength =  profile.softmodem ? 1 : 2;

      bitBufferLow = new Float32Array(samplesPerBit);
      bitBufferHigh = new Float32Array(samplesPerBit);

      rawStream = typeof profile.raw === 'undefined' ? false : profile.raw;      
      softmodem = profile.softmodem;

      (function generateBitBuffers(){
        var phaseIncLow = 2 * Math.PI * freqLow / sampleRate;
        var phaseIncHigh = 2 * Math.PI * freqHigh / sampleRate;
        
        for (var i=0; i < samplesPerBit; i++) {
          bitBufferLow.set( [Math.cos(phaseIncLow*i)], i);
          bitBufferHigh.set( [Math.cos(phaseIncHigh*i)], i);
        }
      })();
      console.log("new encoder profile: ",  profile);
    }
    encoder.setProfile(args);

    function toUTF8(str) {
      var utf8 = [];
      for (var i = 0; i < str.length; i++) {
        var c = str.charCodeAt(i);
        if (c <= 0x7f)
          utf8.push(c);
        else if (c <= 0x7ff) {
          utf8.push(0xc0 | (c >>> 6));
          utf8.push(0x80 | (c & 0x3f));
        } else if (c <= 0xffff) {
          utf8.push(0xe0 | (c >>> 12));
          utf8.push(0x80 | ((c >>> 6) & 0x3f));
          utf8.push(0x80 | (c & 0x3f));
        } else {
          var j = 4;
          while (c >>> (6*j))
            j++;
          utf8.push(((0xff00 >>> j) & 0xff) | (c >>> (6*--j)));
          while (j--) 
            utf8[idx++] = 0x80 | ((c >>> (6*j)) & 0x3f);
        }
      }
      return utf8;
    }

    encoder.modulate = function(data){
      var uint8 = rawStream ? data : toUTF8(data);
      var bufferLength = (preambleLength + 10*(uint8.length) + pushbitLength)*samplesPerBit;
      var samples = new Float32Array(bufferLength);

      var i = 0;
      function pushBits(bit, n){
        for (var k = 0; k < n; k++){
          samples.set(bit ? bitBufferHigh : bitBufferLow, i);
          i += samplesPerBit;
        }
      }

      pushBits(1, preambleLength);
      for (var x = 0; x < uint8.length; x++) {
        var c = (uint8[x] << 1) | 0x200;
        for (var b = 0; b < 10; b++, c >>= 1)
          pushBits( c&1, 1);
      }
      pushBits(1, 1);
      if (!softmodem)
        pushBits(0, 1);

      if (args.debug) console.log("gen. audio length: " +samples.length);
      var resampler = new WebJack.Resampler({inRate: sampleRate, outRate: targetSampleRate, inputBuffer: samples});
      resampler.resample(samples.length);
      var resampled = resampler.outputBuffer();
      // console.log(samples);
      if (args.debug) console.log("resampled audio length: " + resampled.length);
      // console.log(resampled);

      return resampled;
    }
  }
});