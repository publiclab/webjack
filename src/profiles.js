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