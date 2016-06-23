WebJack.Decoder = Class.extend({

	init: function(args) {

		var decoder = this;

		var DEBUG = true;
		var onReceive = args.onReceive;

		var sampleRate = args.sampleRate;
		var baud = args.baud;
		var freqLow = 4900;
		var freqHigh = 7350;

		var samplesPerBit = Math.ceil(sampleRate/baud);
		var preambleLength = Math.ceil(sampleRate*40/1000/samplesPerBit);
		var pushbitLength =  Math.ceil(sampleRate*5/1000/samplesPerBit);

		var state = {
			current : 0,
			PREAMBLE : 1,
			START : 2,
			DATA : 3,
			STOP : 4,

			bitBuffer : new Uint8Array(1),
			byteBuffer: "",
			bitCounter : 0,
			flagCounter: 0,

		}
		var cLowReal = new Float32Array(samplesPerBit);
		var cLowImag = new Float32Array(samplesPerBit);
		var cHighReal = new Float32Array(samplesPerBit);
		var cHighImag = new Float32Array(samplesPerBit);

		var sinusLow = new Float32Array(samplesPerBit);
		var sinusHigh = new Float32Array(samplesPerBit);
		var cosinusLow = new Float32Array(samplesPerBit);
		var cosinusHigh = new Float32Array(samplesPerBit);

		(function initCorrelationArrays(){
			var phaseIncLow = 2*Math.PI * (freqLow/sampleRate);
			var phaseIncHigh = 2*Math.PI * (freqHigh/sampleRate);
			for(var i=0; i < samplesPerBit; i++){
				sinusLow[i] = Math.sin(phaseIncLow * i);
				sinusHigh[i] = Math.sin(phaseIncHigh * i);
				cosinusLow[i] = Math.cos(phaseIncLow * i);
				cosinusHigh[i] = Math.cos(phaseIncHigh * i);
			}
		})();

		function getMaxOfArray(numArray) {
			return Math.max.apply(null, numArray);
		}

		function normalize(samples){
			var max = getMaxOfArray(samples);
			for (var i=0; i < samples.length; i++){
				samples[i] /= max;
			}
		}

		function sum(array){
			var s = 0;
			for(var i=0; i < array.length; i++){
				s += array[i];
			}
			return s;
		}

		function demod(samples){
			var cLow, cHigh;

			for(var i=0, s=0; i < samples.length; i++, s++){
				cLowReal[s] = samples[i] * cosinusLow[s];
				cLowImag[s] = samples[i] * sinusLow[s];
				cHighReal[s] = samples[i] * cosinusHigh[s];
				cHighImag[s] = samples[i] * sinusHigh[s];

				cLow = Math.sqrt( Math.pow( sum(cLowReal), 2) + Math.pow( sum(cLowImag), 2) );
				cHigh = Math.sqrt( Math.pow( sum(cHighReal), 2) + Math.pow( sum(cHighImag), 2) );
				samples[i] = cLow - cHigh;

				if (s == samplesPerBit)
					s = 0;
			}
		}


		decoder.decode = function(samples){
			// var a = performance.now();

			normalize(samples);
			demod(samples);
			normalize(samples);

			var nextState = state.PREAMBLE;
			var bitcount = state.bitCounter;
			var flagcount = state.flagCounter;
			var bitBuffer = state.bitBuffer;
			var byteBuffer = state.byteBuffer;
			var bit = 0;

			var c = 0;
			while (c < samples.length) {
				switch (state){

					case state.PREAMBLE:
						if (samples[c] > 0.5)
							flagcount++;
						else if (flagcount > preambleLength*0.8)
							flagcount = 0;
						else {	
							nextState = state.START;
							flagcount = 0;
							c += Math.floor(samplesPerBit/2) - 1;
						}
						break;

					case state.START:
						if (DEBUG) console.log(c + ' START');
						if (samples[c] > 0)
							nextState = state.PREAMBLE;
						else {
							nextState = state.DATA;
							bitBuffer[0] = 0;
							c += samplesPerBit - 1;
						}
						break;

					case state.DATA:
						if (DEBUG) console.log(c + ' DATA');
						bit = samples[c] > 0 ? 1 : 0;
						bitBuffer[0] = (bitBuffer[0] || bit >>> bitcount);
						if (bitcount < 7)
							bitcount++;
						else {
							bitcount = 0;
							nextState = state.STOP;
						}
						c += samplesPerBit - 1;
						break;

					case state.STOP:
						if (DEBUG) console.log(c + ' STOP');
						if (samples[c] > 0) {
							byteBuffer += String.fromCharCode(bitBuffer[0]);
							onReceive(byteBuffer);
							byteBuffer = "";
							nextState = state.START;
						}
						else{	
							nextState = state.PREAMBLE;
						}
						c += samplesPerBit - 1;
						break;

					default:
						nextState = state.PREAMBLE;
						flagcount = 0;
						bitcount = 0;
						bitBuffer[0] = 0;
				}
			c++;
			state.current = nextState;
			}

			// if (DEBUG) console.log('audio event decode time: ' + Math.round(performance.now()-a) + " ms");
		}
	}
});