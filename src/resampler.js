// JavaScript Audio Resampler by Grant Galitz
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