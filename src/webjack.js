'use strict';

WebJack.Connection = Class.extend({

  init: function(args) {

    var connection = this;


    function ifUndef(arg, Default){
      return typeof arg === 'undefined' ? Default : arg;
    }

    var args = ifUndef(args, WebJack.Profiles.SoftModem);
    var AudioContext = window.AudioContext || window.webkitAudioContext;
    var audioCtx = ifUndef(args.audioCtx, new AudioContext());

    var opts = connection.options = {
      sampleRate       : audioCtx.sampleRate,
      baud             : ifUndef(args.baud, 1225),
      freqLow          : ifUndef(args.freqLow, 4900),
      freqHigh         : ifUndef(args.freqHigh, 7350),
      debug            : ifUndef(args.debug, false),
      softmodem        : ifUndef(args.softmodem, true),
      raw              : ifUndef(args.raw, false),
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
      dataBuffer.getChannelData(0).set(samples);


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

    // Set the connection profile
    connection.setProfile = function(profile) {
      encoder.setProfile(profile);
      if (typeof decoder === 'object')
        decoder.setProfile(profile);
    }

  } 

});
