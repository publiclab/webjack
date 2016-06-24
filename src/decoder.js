WebJack.Decoder = Class.extend({

	init: function(args) {

		var decoder = this;

		var DEBUG = false;
		var onReceive = args.onReceive;

		var sampleRate = args.sampleRate;
		var baud = args.baud;
		var freqLow = 4900;
		var freqHigh = 7350;

		var samplesPerBit = Math.ceil(sampleRate/baud);
		var preambleLength = Math.ceil(sampleRate*40/1000/samplesPerBit);
		var pushbitLength =  Math.ceil(sampleRate*5/1000/samplesPerBit);
		var minPreamble = 11 * samplesPerBit; //8 data bits + stop bit + push bit should not be detected as preamble -> min preamble = 11 bit length 

		var state = {
			current : 0,
			PREAMBLE : 1,
			START : 2,
			DATA : 3,
			STOP : 4,

			bitBuffer : 0,
			byteBuffer : "",
			bitCounter : 0,
			flagCounter : 0,
			lastTransition : 0,
			lastBitState : 0,
			t : 0 // sample counter, no reset currently -> will overflow
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
			var symbols = [];
			var cLow, cHigh;

			normalize(samples);

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
			for(var i=1; i < samples.length; i++){
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
				throw 'bitBuffer too small';
			for (var b=0; b < n; b++){
				state.bitCounter++;
				state.bitBuffer >>= 1;
				if (bit)
					state.bitBuffer += 128;
				if (state.bitCounter == 8) {
					state.byteBuffer += String.fromCharCode(state.bitBuffer);
					state.bitBuffer = 0;
					state.bitCounter = 0;
				}
			}
		}

		decoder.decode = function(samples){
			// var a = performance.now();

			var bitlengths = demod(samples);

			var nextState = state.PREAMBLE;

			for(var i=0; i < bitlengths.length ; i++) {
				var symbols = bitlengths[i];
				switch (state.current){

					case state.PREAMBLE:
						if (symbols >= 11 && symbols <= 49)
							nextState = state.START;
						break;

					case state.START:
						if (DEBUG) console.log('START');
						if (symbols == 1)
							nextState = state.DATA;
						else if (symbols > 1 && symbols <= 9){
							nextState = symbols == 9 ? state.STOP : state.DATA;
							addBitNTimes(0, symbols -1);
						} 
						else {
							nextState = state.PREAMBLE;
							state.bitBuffer = 0;
						}
						break;

					case state.DATA:
						if (DEBUG) console.log('DATA');
						var bits_total = symbols + state.bitCounter;
				        var bit = state.lastBitState ^ 1;
				        state.lastBitState = bit;


				        if (bits_total > 10) {
			          		nextState = state.PREAMBLE;
				        } else if (bits_total == 10) { // all bits high, stop bit, push bit
				        	addBitNTimes(1, 8);
			          		nextState = state.PREAMBLE;
			          		onReceive(state.byteBuffer);
			          		state.byteBuffer = '';
				        } else if (bits_total == 9) { // all bits high, stop bit, no push bit
				            addBitNTimes(1, 8);
				            nextState = state.START;
				        } else if (bits_total == 8) {
				            addBitNTimes(bit, symbols);
				            nextState = state.STOP;
				        } else {
				            addBitNTimes(bit, symbols);
				        } 
				        break;

					case state.STOP:
						if (DEBUG) console.log('STOP');
						if (symbols == 1) {
							nextState = state.START;
						} else if (symbols >= 2) {	
							nextState = state.PREAMBLE;
							onReceive(state.byteBuffer);
							state.byteBuffer = '';
						} else
							nextState = state.PREAMBLE;

						break;

					default:
						nextState = state.PREAMBLE;
						state.bitCounter = 0;
						state.bitBuffer = 0;
				}
			state.current = nextState;
			}

			// console.log('audio event decode time: ' + Math.round(performance.now()-a) + " ms");
		}
	}
});