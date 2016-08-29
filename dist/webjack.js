var WebJack = {};

(function(exports){

  if (typeof module === 'undefined')
    exports = WebJack;
  else 
    module.exports = WebJack;

})(typeof exports === 'undefined'? this['WebJack']={}: exports);

/* From http://ejohn.org/blog/simple-javascript-inheritance/ */

/* Simple JavaScript Inheritance
 * By John Resig http://ejohn.org/
 * MIT Licensed.
 */
// Inspired by base2 and Prototype
(function(){
  var initializing = false, fnTest = /xyz/.test(function(){xyz;}) ? /\b_super\b/ : /.*/;
 
  // The base Class implementation (does nothing)
  this.Class = function(){};
 
  // Create a new Class that inherits from this class
  Class.extend = function(prop) {
    var _super = this.prototype;
   
    // Instantiate a base class (but only create the instance,
    // don't run the init constructor)
    initializing = true;
    var prototype = new this();
    initializing = false;
   
    // Copy the properties over onto the new prototype
    for (var name in prop) {
      // Check if we're overwriting an existing function
      prototype[name] = typeof prop[name] == "function" &&
        typeof _super[name] == "function" && fnTest.test(prop[name]) ?
        (function(name, fn){
          return function() {
            var tmp = this._super;
           
            // Add a new ._super() method that is the same method
            // but on the super-class
            this._super = _super[name];
           
            // The method only need to be bound temporarily, so we
            // remove it when we're done executing
            var ret = fn.apply(this, arguments);        
            this._super = tmp;
           
            return ret;
          };
        })(name, prop[name]) :
        prop[name];
    }
   
    // The dummy class constructor
    function Class() {
      // All construction is actually done in the init method
      if ( !initializing && this.init )
        this.init.apply(this, arguments);
    }
   
    // Populate our constructed prototype object
    Class.prototype = prototype;
   
    // Enforce the constructor to be what we expect
    Class.prototype.constructor = Class;
 
    // And make this class extendable
    Class.extend = arguments.callee;
   
    return Class;
  };
})();

WebJack.Decoder = Class.extend({

	init: function(args) {

		var decoder = this;

		var onReceive = args.onReceive;
		var csvContent = '';
		var DEBUG = args.debug;


		var baud = args.baud;
		var freqLow = args.freqLow;
		var freqHigh = args.freqHigh;
		var sampleRate = args.sampleRate;

		var samplesPerBit = Math.ceil(sampleRate/baud);
		var preambleLength = Math.ceil(sampleRate*40/1000/samplesPerBit);

		var state = {
			current : 0,
			PREAMBLE : 1,
			START : 2,
			DATA : 3,
			STOP : 4,

			bitCounter : 0,  // counts up to 8 bits
			byteBuffer : 0,  // where the 8 bits get assembled
			wordBuffer : [], // concat received chars

			lastTransition : 0,
			lastBitState : 0,
			t : 0, // sample counter, no reset currently -> will overflow
			c : 0  // counter for the circular correlation arrays
		};

		var cLowReal = new Float32Array(samplesPerBit/2);
		var cLowImag = new Float32Array(samplesPerBit/2);
		var cHighReal = new Float32Array(samplesPerBit/2);
		var cHighImag = new Float32Array(samplesPerBit/2);

		var sinusLow = new Float32Array(samplesPerBit/2);
		var sinusHigh = new Float32Array(samplesPerBit/2);
		var cosinusLow = new Float32Array(samplesPerBit/2);
		var cosinusHigh = new Float32Array(samplesPerBit/2);

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
		var emit = args.raw ? onReceive : emitString;

		decoder.decode = function(samples){
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
				// if ((nextState == state.START) && DEBUG) {
				// 	// console.log(csvContent);
				// 	downloadDemodulatedData();
				// }
			}
			if (DEBUG) csvContent = '';
			// console.log('audio event decode time: ' + Math.round(performance.now()-a) + " ms");

			// if (state.t >= 441000 && DEBUG) { // download demodulated signal after ~10 sec
			// 	downloadDemodulatedData();
			// 	DEBUG = false;
			// } 
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
WebJack.Encoder = Class.extend({

	init: function(args) {

		var encoder = this;

		var sampleRate = 44100;
		var targetSampleRate = args.sampleRate;
		// console.log("target sample rate: " + targetSampleRate);
		var baud = args.baud;
		var freqLow = args.freqLow;
		var freqHigh = args.freqHigh;

		var samplesPerBit = Math.ceil(sampleRate/baud);
		var samplesPeriodLow = Math.ceil(sampleRate/freqLow)
		var samplesPeriodHigh = Math.ceil(sampleRate/freqHigh)
		// var periodsLowBit = Math.floor(samplesPerBit/samplesPeriodLow);
		// var periodsHighBit = Math.floor(samplesPerBit/samplesPeriodHigh);
		// console.log("spb: "+ samplesPerBit);
		// console.log("periods low: "+ periodsLowBit);
		// console.log("periods high: "+ samplesPeriodHigh);

		var preambleLength = Math.ceil(sampleRate*40/1000/samplesPerBit);
		var pushbitLength =  args.softmodem ? 1 : 2;

		var bitBufferLow = new Float32Array(samplesPerBit);
		var bitBufferHigh = new Float32Array(samplesPerBit);

		(function generateBitBuffers(){
			var phaseIncLow = 2 * Math.PI * freqLow / sampleRate;
			var phaseIncHigh = 2 * Math.PI * freqHigh / sampleRate;
			
			for (var i=0; i < samplesPerBit; i++) {
				bitBufferLow.set( [Math.cos(phaseIncLow*i)], i);
				bitBufferHigh.set( [Math.cos(phaseIncHigh*i)], i);
			}
		})();

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
					while (c >>> (6*j)) j++;
					utf8.push(((0xff00 >>> j) & 0xff) | (c >>> (6*--j)));
					while (j--) 
						utf8[idx++] = 0x80 | ((c >>> (6*j)) & 0x3f);
				}
			}
			return utf8;
		}

		encoder.modulate = function(data){
			var uint8 = args.raw ? data : toUTF8(data);
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
			if (!args.softmodem)
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
WebJack.Profiles = {
	// default SoftModem frequencies, no echo cancellation to avoid attenuation
	SoftModem : { 
		baud : 1225,
		freqLow : 4900,
		freqHigh : 7350,
		echoCancellation : false,
		softmodem : true
	},
	// lower frequencies and echo cancellation: try this to reduce crosstalk for long cables
	SoftModemLowFrequencies : { 
		baud : 1225,
		freqLow : 2450,
		freqHigh : 4900,
		echoCancellation : true,
		softmodem : true
	},
	// browser-to-browser, over-the-air transmission profile
	Browser : { 
		baud : 1225,
		freqLow : 19600,
		freqHigh : 20825,
		echoCancellation : false,
		softmodem : false
	}
}
//JavaScript Audio Resampler by Grant Galitz
// from https://github.com/taisel/XAudioJS/blob/master/resampler.js
// simplified for single channel usage

WebJack.Resampler = Class.extend({

    init: function(args) {

        var resampler = this;

        var fromSampleRate = +args.inRate;
        var toSampleRate = +args.outRate;
        var inputBuffer = args.inputBuffer;
        var outputBuffer;
        var ratioWeight, lastWeight, lastOutput, tailExists;
        var resampleFunction;

        if (typeof inputBuffer != "object") {
            throw(new Error("inputBuffer is not an object."));
        }
        if (!(inputBuffer instanceof Array) 
            && !(inputBuffer instanceof Float32Array) 
            && !(inputBuffer instanceof Float64Array)) {
            throw(new Error("inputBuffer is not an array or a float32 or a float64 array."));
        }
        
        if (fromSampleRate > 0 && toSampleRate > 0) {
            if (fromSampleRate == toSampleRate) {
                resampleFunction = bypassResampler;        //Resampler just returns what was passed through.
                ratioWeight = 1;
                outputBuffer = inputBuffer;
            }
            else {
                initializeBuffers();
                ratioWeight = fromSampleRate / toSampleRate;
                if (fromSampleRate < toSampleRate) {
                    resampleFunction = linearInterpolationFunction;
                    lastWeight = 1;
                }
                else {
                    resampleFunction = compileMultiTapFunction;
                    tailExists = false;
                    lastWeight = 0;
                }
            }
        }
        else {
            throw(new Error("Invalid settings specified for the resampler."));
        }
        
        function linearInterpolationFunction(bufferLength) {
            var outputOffset = 0;
            if (bufferLength > 0) {
                var weight = lastWeight;
                var firstWeight = 0;
                var secondWeight = 0;
                var sourceOffset = 0;
                var outputOffset = 0;

                weight -= 1;
                for (bufferLength -= 1, sourceOffset = Math.floor(weight); sourceOffset < bufferLength;) {
                    secondWeight = weight % 1;
                    firstWeight = 1 - secondWeight; 
                    outputBuffer[outputOffset++] = (inputBuffer[sourceOffset] * firstWeight)
                     + (inputBuffer[sourceOffset + 1] * secondWeight); 
                    weight += ratioWeight;
                    sourceOffset = Math.floor(weight);
                } 
                lastOutput[0] = inputBuffer[sourceOffset++]; 
                lastWeight = weight % 1;
            }
            return outputOffset;
        }

        function compileMultiTapFunction() {
            var outputOffset = 0;
            if (bufferLength > 0) {
                var weight = 0; 
                var output0 = 0; 
                var actualPosition = 0;
                var amountToNext = 0;
                var alreadyProcessedTail = !tailExists;
                tailExists = false;
                var currentPosition = 0;
                do {
                    if (alreadyProcessedTail) {
                        weight = ratioWeight;
                            output0 = 0;
                    }
                    else {
                        weight = lastWeight;
                        output0 = lastOutput[0];
                        alreadyProcessedTail = true;
                    }
                    while (weight > 0 && actualPosition < bufferLength) {
                        amountToNext = 1 + actualPosition - currentPosition;
                        if (weight >= amountToNext) {
                            output0 += inputBuffer[actualPosition++] * amountToNext;
                            currentPosition = actualPosition;
                            weight -= amountToNext;
                        }
                        else {
                            output0 += inputBuffer[actualPosition] * weight;
                            currentPosition += weight;
                            weight = 0;
                            break;
                        }
                    }
                    if (weight <= 0) {
                        outputBuffer[outputOffset++] = output0 / ratioWeight;
                    }
                    else {
                        lastWeight = weight;
                        lastOutput[0] = output0;
                        tailExists = true;
                        break;
                    }
                } while (actualPosition < bufferLength);
            }
            return outputOffset;
        }

        function bypassResampler(upTo) {
            return upTo;
        }
        
        function initializeBuffers() {
            var outputBufferSize = Math.ceil(inputBuffer.length * toSampleRate / fromSampleRate / 1.000000476837158203125) + 1;
        	try {
        		outputBuffer = new Float32Array(outputBufferSize);
        		lastOutput = new Float32Array(1);
        	}
        	catch (error) {
        		outputBuffer = [];
        		lastOutput = [];
        	}
        }

        resampler.resample = function(bufferLength){
            return resampleFunction(bufferLength);
        }

        resampler.outputBuffer = function(){
            return outputBuffer;
        }
    }
});
'use strict';

WebJack.Connection = Class.extend({

  init: function(args) {

    var connection = this;


    function ifUndef(arg, Default){
    	return typeof arg === 'undefined' ? Default : arg;
    }

    var args = ifUndef(args, WebJack.Profiles.SoftModem);
	var audioCtx = typeof args.audioCtx === 'undefined' ? new AudioContext() : args.audioCtx;

	var opts = connection.options = {
		sampleRate 		 : audioCtx.sampleRate,
		baud 			 : ifUndef(args.baud, 1225),
		freqLow 		 : ifUndef(args.freqLow, 4900),
		freqHigh 		 : ifUndef(args.freqHigh, 7350),
		debug 			 : ifUndef(args.debug, false),
		softmodem 		 : ifUndef(args.softmodem, true),
		raw				 : ifUndef(args.raw, false),
		echoCancellation : ifUndef(args.echoCancellation, false)
	};

	var encoder = new WebJack.Encoder(opts);
	var decoder;
    var rxCallback;

	function onAudioProcess(event) {
	  var buffer = event.inputBuffer;
	  var samplesIn = buffer.getChannelData(0);
	  console.log("-- audioprocess data (" + samplesIn.length + " samples) --");

	  if (!decoder){
	  	opts.onReceive = rxCallback;
	  	decoder = new WebJack.Decoder(opts);
	  }
	  decoder.decode(samplesIn);
	}

	function successCallback(stream) {
	  var audioTracks = stream.getAudioTracks();
	  console.log('Using audio device: ' + audioTracks[0].label);
	  console.log("-- samplerate (" + opts.sampleRate + ") --");
	  if (!stream.active) {
	    console.log('Stream not active');
	  }
	  audioSource = audioCtx.createMediaStreamSource(stream);
	  decoderNode = audioCtx.createScriptProcessor(8192, 1, 1); // buffersize, input channels, output channels
	  audioSource.connect(decoderNode);
	  decoderNode.addEventListener("audioprocess", onAudioProcess);
	  decoderNode.connect(audioCtx.destination); // Chrome does not fire events without destination 
	}

	function errorCallback(error) {
	  console.log('navigator.getUserMedia error: ', error);
	}

	navigator = args.navigator || navigator;
	navigator.mediaDevices.getUserMedia(
		{
		  audio: {
		      optional: [{ echoCancellation: opts.echoCancellation }]
		  },
		  video: false
		}
	).then(
	  successCallback,
	  errorCallback
	);


    // an object containing two histories -- 
    // sent commands and received commands
    connection.history = {

      // oldest first:
      sent: [],

      // oldest first:
      received: []

    }

    var queue = [];
    var locked = false;

    // Sends data to device
    connection.send = function(data) {
    	
    	function playAudioBuffer(buffer) {
			var bufferNode = audioCtx.createBufferSource();
			bufferNode.buffer = buffer;
			bufferNode.connect(audioCtx.destination);
			locked = true;
			bufferNode.start(0);
			bufferNode.onended = function() {
				locked = false;
				if (queue.length)
					playAudioBuffer(queue.shift());
			}
		}


    	var samples = encoder.modulate(data);
    	var dataBuffer = audioCtx.createBuffer(1, samples.length, opts.sampleRate);
    	dataBuffer.copyToChannel(samples, 0);

    	if (locked)
    		queue.push(dataBuffer);
    	else
    		playAudioBuffer(dataBuffer);

		connection.history.sent.push(data);
    }


    // Listens for data packets and runs 
    // passed function listener() on results
    connection.listen = function(listener) {
    	rxCallback = function(data){
			listener(data);
    		connection.history.received.push(data);
    	};
    }    


    // Returns valid JSON object if possible, 
    // or <false> if not.
    connection.validateJSON = function(data) {
    	var object; 
    	try {
	        object = JSON.parse(data);
	    } catch (e) {
	        return false;
	    }
	    return object;
    }

  } 

});
