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
WebJack.Encoder = Class.extend({

	init: function(args) {

		var encoder = this;

		var targetSampleRate = args.sampleRate;
		var sampleRate = 44100;
		// console.log("target sample rate: " + targetSampleRate);
		var baud = args.baud;
		var freqLow = 2450;
		var freqHigh = 4900; //7350;

		var samplesPerBit = Math.ceil(sampleRate/baud);
		var samplesPeriodLow = Math.ceil(sampleRate/freqLow)
		var samplesPeriodHigh = Math.ceil(sampleRate/freqHigh)
		// var periodsLowBit = Math.floor(samplesPerBit/samplesPeriodLow);
		// var periodsHighBit = Math.floor(samplesPerBit/samplesPeriodHigh);
		// console.log("spb: "+ samplesPerBit);
		// console.log("periods low: "+ periodsLowBit);
		// console.log("periods high: "+ samplesPeriodHigh);

		var preambleLength = Math.ceil(sampleRate*40/1000/samplesPerBit);
		var pushbitLength =  Math.ceil(sampleRate*5/1000/samplesPerBit);

		var bitBufferLow = new Float32Array(samplesPerBit);
		var bitBufferHigh = new Float32Array(samplesPerBit);

		(function generateBitBuffers(){
			var phaseIncLow = 2 * Math.PI * freqLow / sampleRate;
			var phaseIncHigh = 2 * Math.PI * freqHigh / sampleRate;
			
			for (var i=0; i < samplesPerBit; i++) {
				bitBufferLow.set( [Math.sin(phaseIncLow*i)], i);
				bitBufferHigh.set( [Math.sin(phaseIncHigh*i)], i);
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
			var utf8 = toUTF8(data)
			var bufferLength = (preambleLength + 10*utf8.length + pushbitLength)*samplesPerBit;
			var samples = new Float32Array(bufferLength);

			var i = 0;
			function pushBits(bit, n){
				for (var k = 0; k < n; k++){
					samples.set(bit ? bitBufferHigh : bitBufferLow, i);
					i += samplesPerBit;
				}
			}

			pushBits(1, preambleLength);
			for (var x in utf8) {
				var c = (utf8[x] << 1) | 0x200;
				for (var b = 0; b < 10; b++, c >>= 1)
					pushBits( c&1, 1);
			}
			pushBits(1, pushbitLength);

			console.log("gen. audio length: " +samples.length);
			var resampler = new WebJack.Resampler({inRate: sampleRate, outRate: targetSampleRate, inputBuffer: samples});
			resampler.resample(samples.length);
			var resampled = resampler.outputBuffer();
			// console.log(samples);
			console.log("resampled audio length: " + resampled.length);
			// console.log(resampled);

			return resampled;
		}
	}
});
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

function SoftModemDecoder(baud, sampleRate, rxCallback){
	this.baud = baud;
	this.sampleRate = sampleRate;
	this.rxCallback = rxCallback;
}

SoftModemDecoder.prototype = {
	baud : 1225,
	sampleRate : 0,
	rxCallback : null,



	demod : function(samples){
		
	}
}
'use strict';

WebJack.Connection = Class.extend({

  init: function(args) {

    var connection = this;

	var audioCtx = args.audioCtx || new AudioContext();
	var sampleRate = audioCtx.sampleRate;
	var baud = args.baud;

	var encoder = new WebJack.Encoder({baud: baud, sampleRate: sampleRate});
	var decoder;
    var rxCallback;

	function onAudioProcess(event) {
	  var buffer = event.inputBuffer;
	  var samplesIn = buffer.getChannelData(0);
	  console.log("-- audioprocess data (" + samplesIn.length + " samples) --");

	  if (!decoder){
	  	decoder = new WebJack.Decoder({ baud: args.baud, sampleRate: sampleRate, onReceive: rxCallback});
	  }
	  decoder.decode(samplesIn);
	}

	function successCallback(stream) {
	  var audioTracks = stream.getAudioTracks();
	  console.log('Using audio device: ' + audioTracks[0].label);
	  console.log("-- samplerate (" + sampleRate + ") --");
	  stream.onended = function() {
	    console.log('Stream ended');
	  };
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
		  audio: true,
		  video: false
		}
	).then(
	  successCallback,
	  errorCallback
	);


    connection.args = args; // connection.args.baud_rate, etc


    // an object containing two histories -- 
    // sent commands and received commands
    connection.history = {

      // oldest first:
      sent: [],

      // oldest first:
      received: []

    }


    // Sends request for a standard data packet
    connection.get = function(data) {
    	
    }

    // Sends data to device
    connection.send = function(data) {

    	function playAudioBuffer(buffer) {
			var bufferNode = audioCtx.createBufferSource();
			bufferNode.buffer = buffer;
			bufferNode.connect(audioCtx.destination);
			bufferNode.start(0);
		}

    	var samples = encoder.modulate(data);
    	var dataBuffer = audioCtx.createBuffer(1, samples.length, sampleRate);
    	dataBuffer.copyToChannel(samples, 0);

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

    }


  } 

});