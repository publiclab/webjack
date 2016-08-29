WebJack.Decoder = Class.extend({

  init: function(args) {

    var decoder = this;

    var DEBUG = args.debug;
    var csvContent = '';
    
    var onReceive = args.onReceive;
    var raw;

    var sampleRate = args.sampleRate;

    var baud, freqLow, freqHigh;
    var samplesPerBit, preambleLength;

    var cLowReal, cLowImag, cHighReal, cHighImag;
    var sinusLow, sinusHigh, cosinusLow, cosinusHigh;

    var state = {
      current  : 0,
      PREAMBLE : 1,
      START    : 2,
      DATA     : 3,
      STOP     : 4,

      bitCounter : 0,  // counts up to 8 bits
      byteBuffer : 0,  // where the 8 bits get assembled
      wordBuffer : [], // concat received chars

      lastTransition : 0,
      lastBitState : 0,
      t : 0, // sample counter, no reset currently -> will overflow
      c : 0  // counter for the circular correlation arrays
    };

    decoder.setProfile = function(profile) {
      baud = profile.baud;
      freqLow = profile.freqLow;
      freqHigh = profile.freqHigh;

      samplesPerBit = Math.ceil(sampleRate/baud);
      preambleLength = Math.ceil(sampleRate*40/1000/samplesPerBit);


      cLowReal = new Float32Array(samplesPerBit/2);
      cLowImag = new Float32Array(samplesPerBit/2);
      cHighReal = new Float32Array(samplesPerBit/2);
      cHighImag = new Float32Array(samplesPerBit/2);

      sinusLow = new Float32Array(samplesPerBit/2);
      sinusHigh = new Float32Array(samplesPerBit/2);
      cosinusLow = new Float32Array(samplesPerBit/2);
      cosinusHigh = new Float32Array(samplesPerBit/2);

      (function initCorrelationArrays(){
        var phaseIncLow = 2*Math.PI * (freqLow/sampleRate);
        var phaseIncHigh = 2*Math.PI * (freqHigh/sampleRate);
        for(var i = 0; i < samplesPerBit/2; i++){
          sinusLow[i] = Math.sin(phaseIncLow * i);
          sinusHigh[i] = Math.sin(phaseIncHigh * i);
          cosinusLow[i] = Math.cos(phaseIncLow * i);
          cosinusHigh[i] = Math.cos(phaseIncHigh * i);
        }
      })();

      raw = typeof profile.raw === 'undefined' ? false : profile.raw;
    }
    decoder.setProfile(args);


    function normalize(samples){
      var max = Math.max.apply(null, samples);
      for (var i = 0; i < samples.length; i++){
        samples[i] /= max;
      }
    }

    function sum(array){
      var s = 0;
      for(var i = 0; i < array.length; i++){
        s += array[i];
      }
      return s;
    }

    function smoothing(samples, n){
      for(var i = n; i < samples.length - n; i++){
        for(var o = -n; o <= n; o++){
          samples[i] += samples[i+o];
        }
        samples[i] /= (n*2)+1;
        if (DEBUG) csvContent += samples[i] + '\n';
      }
    }

    function demod(smpls){
      var samples = smpls;
      var symbols = [];
      var cLow, cHigh;

      normalize(samples);

      // correlation
      var s = state.c;
      for(var i = 0; i < samples.length; i++){
        cLowReal[s] = samples[i] * cosinusLow[s];
        cLowImag[s] = samples[i] * sinusLow[s];
        cHighReal[s] = samples[i] * cosinusHigh[s];
        cHighImag[s] = samples[i] * sinusHigh[s];

        cLow = Math.sqrt( Math.pow( sum(cLowReal), 2) + Math.pow( sum(cLowImag), 2) );
        cHigh = Math.sqrt( Math.pow( sum(cHighReal), 2) + Math.pow( sum(cHighImag), 2) );
        samples[i] = cHigh - cLow;

        s++;
        if (s == samplesPerBit/2)
          s = 0;
      }
      state.c = s;

      smoothing(samples, 1);

      // discriminate bitlengths
      for(var i = 1; i < samples.length; i++){
        
        if ((samples[i] * samples[i-1] < 0) || (samples[i-1] == 0)){
          var bits = Math.round((state.t - state.lastTransition)/ samplesPerBit);
          state.lastTransition = state.t;
          symbols.push(bits);
        }
        state.t++;
      }
      state.t++;
      return symbols;
    }

    function addBitNTimes(bit, n) {
      if (state.bitCounter + n > 8)
        throw 'byteBuffer too small';
      for (var b = 0; b < n; b++){
        state.bitCounter++;
        state.byteBuffer >>>= 1;
        if (bit)
          state.byteBuffer |= 128;
        if (state.bitCounter == 8) {
          state.wordBuffer.push(state.byteBuffer);
          state.byteBuffer = 0;
        }
      }
    }

    function emitString(buffer) {
      var word = '';
      if (buffer.length) {
        buffer.forEach(function(octet) {
          word += String.fromCharCode(octet);
        });
        buffer.length = 0;
      }
      onReceive(word);
    }
    var emit = raw ? onReceive : emitString;

    decoder.decode = function(samples){
      // start of time measurement
      // var a = performance.now();

      var bitlengths = demod(samples);

      var nextState = state.PREAMBLE;

      for(var i = 0; i < bitlengths.length ; i++) {
        var symbols = bitlengths[i];
        // if (DEBUG) console.log(symbols);
        switch (state.current){

          case state.PREAMBLE:
            if (symbols >= 12 && symbols <= preambleLength + 20){
            // if (symbols >= preambleLength -3  && symbols <= preambleLength + 20) {
              nextState = state.START;
              state.lastBitState = 0;
              state.byteBuffer = 0;
              state.wordBuffer = [];
            }
            break;

          case state.START:
            if (DEBUG) console.log('START');
            state.bitCounter = 0;
            if (symbols == 1)
              nextState = state.DATA;
            else if (symbols > 1 && symbols <= 9){
              nextState = symbols == 9 ? state.STOP : state.DATA;
              addBitNTimes(0, symbols - 1);
            } 
            else 
              nextState = state.PREAMBLE;
            break;

          case state.DATA:
            if (DEBUG) console.log('DATA');
            var bits_total = symbols + state.bitCounter;
            var bit = state.lastBitState ^ 1;

            if (bits_total > 11) {
              nextState = state.PREAMBLE;
            } else if (bits_total == 11){ // all bits high, stop bit, push bit, preamble
              addBitNTimes(1, symbols - 3);
              nextState = state.START;
              if (DEBUG) console.log('>emit< ' + state.wordBuffer[0].toString(2));
              emit(state.wordBuffer);
              state.wordBuffer = [];
            } else if (bits_total == 10) { // all bits high, stop bit, push bit, no new preamble
              addBitNTimes(1, symbols - 2);
              nextState = state.PREAMBLE;
              if (DEBUG) console.log('|emit| ' + state.wordBuffer[0].toString(2));
              emit(state.wordBuffer);
            } else if (bits_total == 9) { // all bits high, stop bit, no push bit
              addBitNTimes(1, symbols - 1);
              nextState = state.START;
            } else if (bits_total == 8) {
              addBitNTimes(bit, symbols);
              nextState = state.STOP;
              state.lastBitState = bit;
            } else {
              addBitNTimes(bit, symbols);
              nextState = state.DATA;
              state.lastBitState = bit;
            }

            if (symbols == 0){ // 0 always indicates a misinterpreted symbol
              nextState = state.PREAMBLE;
              if (DEBUG) console.log('#demod error#');
            }
            break;

          case state.STOP:
            if (DEBUG) console.log(' STOP');
            if (symbols == 1) {
              nextState = state.START;
            } else if (symbols == 3) {
              nextState = state.START;
              if (DEBUG) console.log('>>emit<< ' + state.wordBuffer[0].toString(2));
              emit(state.wordBuffer);
              state.wordBuffer = [];
            } else if (symbols >= 2) {  
              nextState = state.PREAMBLE;
              if (DEBUG) console.log('||emit|| ' + state.wordBuffer[0].toString(2));
              emit(state.wordBuffer);
            } else
              nextState = state.PREAMBLE;

            break;

          default:
            nextState = state.PREAMBLE;
            state.bitCounter = 0;
            state.byteBuffer = 0;
        }
        state.current = nextState;
      }
      // end of time measurement
      // console.log('audio event decode time: ' + Math.round(performance.now()-a) + " ms");

      // if (state.t >= 441000 && DEBUG) { // download demodulated signal after ~10 sec
      //  downloadDemodulatedData();
      //  DEBUG = false;
      // } 
    }

    // for debugging: download demodulated signal as CSV file
    function downloadDemodulatedData(){
      var blob = new Blob([csvContent], {type: 'text/csv;charset=utf-8;'});
      var url = URL.createObjectURL(blob)
      var link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'data.csv');
      link.click();
    }
  }
});