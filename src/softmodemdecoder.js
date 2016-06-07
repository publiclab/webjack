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