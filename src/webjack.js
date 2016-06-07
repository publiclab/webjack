'use strict';

WebJack.Connection = Class.extend({

  init: function(args) {

    var connection = this;
    var rxCallback;
		var audioCtx = new AudioContext();
		var encoder, decoder;

		function onAudioProcess(event) {
		  var buffer = event.inputBuffer;
		  var samplesIn = buffer.getChannelData(0);
		  console.log("-- audioprocess data (" + samplesIn.length + " samples) --");

		  if (!decoder){
		  	decoder = new SoftModemDecoder(connection.args, rxCallback);
		  }
		  decoder.demod(samplesIn);
		}

		function successCallback(stream) {
		  var audioTracks = stream.getAudioTracks();
		  console.log('Using audio device: ' + audioTracks[0].label);
		  console.log("-- samplerate (" + audioCtx.sampleRate + ") --");
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
    	rxCallback = function(bytes){
    			data(bytes);
    	};
    }


    // Sends data to device
    connection.send = function(data) {

      connection.history.sent.push(data);

    }


    // Listens for data packets and runs 
    // passed function listener() on results
    connection.listen = function(listener) {

      // connection.history.received.push(data);
      // listener(data);

    }    


    // Returns valid JSON object if possible, 
    // or <false> if not.
    connection.validateJSON = function(data) {

    }


  } 

});