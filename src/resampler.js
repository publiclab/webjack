
// TODO: not finished refactoring yet

WebJack.Resampler = Class.extend({

    init: function(args) {

        var resampler = this;

        var fromSampleRate = +args.inRate;
        var toSampleRate = +args.outRate;
        var inputBuffer = args.inputBuffer;
        var outputBuffer;

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
                this.resample = bypassResampler;        //Resampler just returns what was passed through.
                ratioWeight = 1;
                outputBuffer = inputBuffer;
            }
            else {
                initializeBuffers();
                ratioWeight = fromSampleRate / toSampleRate;
                if (fromSampleRate < toSampleRate) {
                    this.resample = linearInterpolationFunction;
                    lastWeight = 1;
                }
    		}
    	}
    	else {
    		throw(new Error("Invalid settings specified for the resampler."));
    	}
        
        function linearInterpolationFunction(bufferLength) {
        	var outputOffset = 0;
            if (bufferLength > 0) {
                var buffer = inputBuffer;
                var weight = lastWeight;
                var firstWeight = 0;
                var secondWeight = 0;
                var sourceOffset = 0;
                var outputOffset = 0;
                // var outputBuffer = this.outputBuffer;

                weight -= 1;
                for (bufferLength -= 1, sourceOffset = Math.floor(weight); sourceOffset < bufferLength;) {
                    secondWeight = weight % 1;
                    firstWeight = 1 - secondWeight; 
                    outputBuffer[outputOffset++] = (buffer[sourceOffset] * firstWeight)
                     + (buffer[sourceOffset + 1] * secondWeight); 
                    weight += ratioWeight;
                    sourceOffset = Math.floor(weight);
                } 
                lastOutput[0] = buffer[sourceOffset++]; 
                lastWeight = weight % 1;
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
    }
});