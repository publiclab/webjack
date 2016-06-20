WebJack.Encoder = Class.extend({

	init: function(args) {

		var encoder = this;

		var targetSampleRate = args.sampleRate;
		var sampleRate = 44100;
		console.log("target samplerate: "+ targetSampleRate);
		var baud = args.baud;
		var freqLow = 4900;
		var freqHigh = 7350;

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
			var resampler = new Resampler(sampleRate, targetSampleRate, 1, samples);
			var resampled = resampler.resampler(samples.length);
			// console.log(resampler.outputBuffer);
			console.log("resampled audio length: " + resampler.outputBuffer.length);
			// console.log(samples);

			return resampler.outputBuffer;
		}
	}
});

// TODO move the following code into separate file

//JavaScript Audio Resampler
//Copyright (C) 2011-2015 Grant Galitz
//Released to Public Domain
function Resampler(fromSampleRate, toSampleRate, channels, inputBuffer) {
    //Input Sample Rate:
    this.fromSampleRate = +fromSampleRate;
    //Output Sample Rate:
    this.toSampleRate = +toSampleRate;
    //Number of channels:
    this.channels = channels | 0;
    //Type checking the input buffer:
    if (typeof inputBuffer != "object") {
        throw(new Error("inputBuffer is not an object."));
    }
    if (!(inputBuffer instanceof Array) && !(inputBuffer instanceof Float32Array) && !(inputBuffer instanceof Float64Array)) {
        throw(new Error("inputBuffer is not an array or a float32 or a float64 array."));
    }
    this.inputBuffer = inputBuffer;
    //Initialize the resampler:
    this.initialize();
}
Resampler.prototype.initialize = function () {
	//Perform some checks:
	if (this.fromSampleRate > 0 && this.toSampleRate > 0 && this.channels > 0) {
		if (this.fromSampleRate == this.toSampleRate) {
			//Setup a resampler bypass:
			this.resampler = this.bypassResampler;		//Resampler just returns what was passed through.
            this.ratioWeight = 1;
            this.outputBuffer = this.inputBuffer;
		}
		else {
            this.ratioWeight = this.fromSampleRate / this.toSampleRate;
			if (this.fromSampleRate < this.toSampleRate) {
				/*
					Use generic linear interpolation if upsampling,
					as linear interpolation produces a gradient that we want
					and works fine with two input sample points per output in this case.
				*/
				this.resampler = this.linearInterpolationFunction;
				this.lastWeight = 1;
			}
			else {
				/*
					Custom resampler I wrote that doesn't skip samples
					like standard linear interpolation in high downsampling.
					This is more accurate than linear interpolation on downsampling.
				*/
				this.compileMultiTapFunction();
				this.tailExists = false;
				this.lastWeight = 0;
			}
			this.initializeBuffers();
		}
	}
	else {
		throw(new Error("Invalid settings specified for the resampler."));
	}
}
Resampler.prototype.linearInterpolationFunction = function (bufferLength) {
	var outputOffset = 0;
    if (bufferLength > 0) {
        var buffer = this.inputBuffer;
        var weight = this.lastWeight;
        var firstWeight = 0;
        var secondWeight = 0;
        var sourceOffset = 0;
        var outputOffset = 0;
        var outputBuffer = this.outputBuffer;
        // for (; weight < 1; weight += this.ratioWeight) {
        //     secondWeight = weight % 1;
        //     firstWeight = 1 - secondWeight;
        //     outputBuffer[outputOffset++] = (this.lastOutput[0] * firstWeight) 
        //     + (buffer[0] * secondWeight); 
        // }
        weight -= 1;
        for (bufferLength -= 1, sourceOffset = Math.floor(weight); sourceOffset < bufferLength;) {
            secondWeight = weight % 1;
            firstWeight = 1 - secondWeight; 
            outputBuffer[outputOffset++] = (buffer[sourceOffset] * firstWeight)
             + (buffer[sourceOffset + 1] * secondWeight); 
            weight += this.ratioWeight;
            sourceOffset = Math.floor(weight);
        } 
        this.lastOutput[0] = buffer[sourceOffset++]; 
        this.lastWeight = weight % 1;
    }
    return outputOffset;
}
Resampler.prototype.compileMultiTapFunction = function () {
	var toCompile = "var outputOffset = 0;\
    if (bufferLength > 0) {\
        var buffer = this.inputBuffer;\
        var weight = 0;";
        for (var channel = 0; channel < this.channels; ++channel) {
            toCompile += "var output" + channel + " = 0;"
        }
        toCompile += "var actualPosition = 0;\
        var amountToNext = 0;\
        var alreadyProcessedTail = !this.tailExists;\
        this.tailExists = false;\
        var outputBuffer = this.outputBuffer;\
        var currentPosition = 0;\
        do {\
            if (alreadyProcessedTail) {\
                weight = " + this.ratioWeight + ";";
                for (channel = 0; channel < this.channels; ++channel) {
                    toCompile += "output" + channel + " = 0;"
                }
            toCompile += "}\
            else {\
                weight = this.lastWeight;";
                for (channel = 0; channel < this.channels; ++channel) {
                    toCompile += "output" + channel + " = this.lastOutput[" + channel + "];"
                }
                toCompile += "alreadyProcessedTail = true;\
            }\
            while (weight > 0 && actualPosition < bufferLength) {\
                amountToNext = 1 + actualPosition - currentPosition;\
                if (weight >= amountToNext) {";
                    for (channel = 0; channel < this.channels; ++channel) {
                        toCompile += "output" + channel + " += buffer[actualPosition++] * amountToNext;"
                    }
                    toCompile += "currentPosition = actualPosition;\
                    weight -= amountToNext;\
                }\
                else {";
                    for (channel = 0; channel < this.channels; ++channel) {
                        toCompile += "output" + channel + " += buffer[actualPosition" + ((channel > 0) ? (" + " + channel) : "") + "] * weight;"
                    }
                    toCompile += "currentPosition += weight;\
                    weight = 0;\
                    break;\
                }\
            }\
            if (weight <= 0) {";
                for (channel = 0; channel < this.channels; ++channel) {
                    toCompile += "outputBuffer[outputOffset++] = output" + channel + " / " + this.ratioWeight + ";"
                }
            toCompile += "}\
            else {\
                this.lastWeight = weight;";
                for (channel = 0; channel < this.channels; ++channel) {
                    toCompile += "this.lastOutput[" + channel + "] = output" + channel + ";"
                }
                toCompile += "this.tailExists = true;\
                break;\
            }\
        } while (actualPosition < bufferLength);\
    }\
    return outputOffset;";
	this.resampler = Function("bufferLength", toCompile);
}
Resampler.prototype.bypassResampler = function (upTo) {
    return upTo;
}
Resampler.prototype.initializeBuffers = function () {
	//Initialize the internal buffer:
    var outputBufferSize = (Math.ceil(this.inputBuffer.length * this.toSampleRate / this.fromSampleRate / this.channels * 1.000000476837158203125) * this.channels) + this.channels;
	try {
		this.outputBuffer = new Float32Array(outputBufferSize);
		this.lastOutput = new Float32Array(this.channels);
	}
	catch (error) {
		this.outputBuffer = [];
		this.lastOutput = [];
	}
}
