## SoftModem decoder in Octave

This is an Octave function to decode signals produced by the SoftModem library. Usage:

	softmodem_read('recording.wav', braudrate, frequency_low, frequency_high, nevents);

Chose _nevents_ = 0 for normal mode. For stepwise decoding (to simulate webRTC audio events), chose a length of power of two between 256 and 16384. 