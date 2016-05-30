WebJack.Connection = Class.extend({

  init: function(args) {

    var connection = this;
		var audioCtx = new AudioContext();

		function onAudioProcess(event) {
		  var buffer = event.inputBuffer;
		  var samplesIn = buffer.getChannelData(0);
		  console.log("-- audioprocess data (" + samplesIn.length + " samples) --");
		  // TODO: decode
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


    connection.get = function(data) {

    }


    connection.send = function(data) {

    }

  } 

});