WebJack.Decoder = Class.extend({

	init: function(args) {

		var decoder = this;

		var DEBUG = false;
		var onReceive = args.onReceive;
		var csvContent = '';

		var sampleRate = args.sampleRate;
		var baud = args.baud;
		var freqLow = 2450;
		var freqHigh = 4900; //7350;  > 7000 is to large, will be attenuated

		var samplesPerBit = Math.ceil(sampleRate/baud);
		var preambleLength = Math.ceil(sampleRate*40/1000/samplesPerBit);
		// var pushbitLength =  Math.ceil(sampleRate*5/1000/samplesPerBit);

		var state = {
			current : 0,
			PREAMBLE : 1,
			START : 2,
			DATA : 3,
			STOP : 4,

			bitCounter : 0,  // counts up to 8 bits
			byteBuffer : 0,  // where the 8 bits get assembled
			wordBuffer : '', // concat received chars

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
			for(var i = 0; i < samplesPerBit; i++){
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


		function demod(samples){
			var symbols = [];
			var cLow, cHigh;

			normalize(samples);

			// correlation
			for(var i = 0, s = 0; i < samples.length; i++, s++){
				cLowReal[s] = samples[i] * cosinusLow[s];
				cLowImag[s] = samples[i] * sinusLow[s];
				cHighReal[s] = samples[i] * cosinusHigh[s];
				cHighImag[s] = samples[i] * sinusHigh[s];

				cLow = Math.sqrt( Math.pow( sum(cLowReal), 2) + Math.pow( sum(cLowImag), 2) );
				cHigh = Math.sqrt( Math.pow( sum(cHighReal), 2) + Math.pow( sum(cHighImag), 2) );
				samples[i] = cHigh - cLow;

				if (s == samplesPerBit)
					s = 0;
			}
			// smoothing
			for(var i = 4; i < samples.length - 4; i++){
				samples[i] = (samples[i-4] + samples[i-3] + samples[i-2] 
					+ samples[i-1] + samples[i] + samples[i+1] 
					+ samples[i+2] + samples[i+3] + samples[i+4] )/9;
				if (DEBUG) csvContent += samples[i] + '\n';
			}
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
				state.byteBuffer >>= 1;
				if (bit)
					state.byteBuffer += 128;
				if (state.bitCounter == 8) {
					state.wordBuffer += String.fromCharCode(state.byteBuffer);
					state.byteBuffer = 0;
				}
			}
		}

		decoder.decode = function(samples){
			// var a = performance.now();

			var bitlengths = demod(samples);

			var nextState = state.PREAMBLE;

			for(var i = 0; i < bitlengths.length ; i++) {
				var symbols = bitlengths[i];
				switch (state.current){

					case state.PREAMBLE:
						// if (symbols >= 11 && symbols <= 49)
						if (symbols >= preambleLength -3  && symbols <= preambleLength + 3) {
							nextState = state.START;
							state.lastBitState = 0;
							state.byteBuffer = 0;
			          		state.wordBuffer = '';
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
				        state.lastBitState = bit;

				        if (bits_total > 11) {
			          		nextState = state.PREAMBLE;
				        } else if (bits_total == 11){ // all bits high, stop bit, push bit, preamble
				        	addBitNTimes(1, symbols - 3);
			          		nextState = state.START;
			          		onReceive(state.wordBuffer);
			          		state.wordBuffer = '';
				        } else if (bits_total == 10) { // all bits high, stop bit, push bit, no new preamble
				        	addBitNTimes(1, symbols - 2);
			          		nextState = state.PREAMBLE;
			          		onReceive(state.wordBuffer);
				        } else if (bits_total == 9) { // all bits high, stop bit, no push bit
				            addBitNTimes(1, symbols - 1);
				            nextState = state.START;
				        } else if (bits_total == 8) {
				            addBitNTimes(bit, symbols);
				            nextState = state.STOP;
				        } else {
				            addBitNTimes(bit, symbols);
				        } 

				        if (symbols == 0) // 0 always indicates a misinterpreted symbol
				        	nextState = state.PREAMBLE;
				        break;

					case state.STOP:
						if (DEBUG) console.log('STOP');
						if (symbols == 1) {
							nextState = state.START;
						} else if (symbols == 3) {
							nextState = state.START;
							onReceive(state.wordBuffer);
							state.wordBuffer = '';
						} else if (symbols >= 2) {	
							nextState = state.PREAMBLE;
							onReceive(state.wordBuffer);
						} else
							nextState = state.PREAMBLE;

						break;

					default:
						nextState = state.PREAMBLE;
						state.bitCounter = 0;
						state.byteBuffer = 0;
				}
				state.current = nextState;
				// if ((nextState == state.START) && DEBUG) {
				// 	// console.log(csvContent);
				// 	downloadDemodulatedData();
				// }
			}
			if (DEBUG) csvContent = '';
			// console.log('audio event decode time: ' + Math.round(performance.now()-a) + " ms");

			if (state.t >= 441000 && DEBUG) { // download demodulated signal after ~10 sec
				downloadDemodulatedData();
				DEBUG = false;
			} 
		}

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