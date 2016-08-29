WebJack
====

[![Build Status](https://travis-ci.org/publiclab/webjack.svg?branch=master)](https://travis-ci.org/publiclab/webjack)

WebJack is a JavaScript library that uses [SoftModem](https://github.com/arms22/SoftModem), an Arduino library, to create two-way communication between a browser window and an Arduino. No need to install drivers. Just plug in an audio cable and read/send data from the browser.

Try it out in this live demo: https://publiclab.github.io/webjack/examples/

## Installation

1. If not already done, install the SoftModem Arduino library:
[https://github.com/arms22/SoftModem](https://github.com/arms22/SoftModem)
2. Choose an [example sketch](https://github.com/publiclab/webjack/tree/master/sketches) and upload it to your Arduino.
3. Now install WebJack with

```
npm install --save webjack
```
or
```
bower install -S webjack 
```

## Requirements
__Hardware__

An Arduino Uno or any other ATmega328p based board is required. Future support for other controllers is discussed [here](https://github.com/arms22/SoftModem/issues/5). In addition, it is **_strongly recommended_** to build the circuit (or buy the shield) found at [SoftModem](https://github.com/arms22/SoftModem#hardware).

__Software__

WebJack uses the [adapter.js](https://github.com/webrtc/adapter) shim for browser interoperability. You have to make sure adapter.js is loaded before webjack.js. Have a look at the demo site in the examples folder.

jQuery is only used for the demo site and _not_ required for WebJack.

## Usage
```js
var profile = WebJack.Profiles.SoftModem;
var connection = new WebJack.Connection(profile);

connection.listen(function(data) {
	console.log('received: ' + data);
});

connection.send('some data');
```

### Profiles
Depending on the profile, WebJack uses different frequencies for the FSK modulation.


|  Profile                  | Parameters                     | Use Case | Demo |
|---------------------------|--------------------------------|----------|------|
| _SoftModem_ (default)     | 1225 bit/s, 4900 and 7350 Hz   | Communication with the SoftModem Arduino library | [Demo](https://publiclab.github.io/webjack/examples/) | 
| _SoftModemLowFrequencies_ | 1225 bit/s, 2450 and 4900 Hz   | Reduced crosstalk for long cables | [Demo](https://publiclab.github.io/webjack/examples/?profile=SoftModemLowFrequencies) |
| _Browser_                 | 1225 bit/s, 19600 and 20825 Hz | Browser-to-browser transmissions over the air | [Demo](https://publiclab.github.io/webjack/examples/?profile=Browser) |

For the **_SoftModemLowFrequencies_** profile, echo cancellation is activated to reduce loopback produced by crosstalk between wires. Due to the echo cancellation some filters are applied that also reduce the upper frequency limit. Therefore you need to add this definitions to the head of your Arduino sketch, to configure SoftModem for lower frequencies:
```cpp
#define SOFT_MODEM_LOW_FREQ    (2450)
#define SOFT_MODEM_HIGH_FREQ   (4900)
```
__Note:__ _It is recommended to make the cable length as short as possible, before using the non-default profile._

The **_Browser_** profile is a planned feature and not working yet. Its purpose is communication between browser tabs on the same or a different device.


### Individual Profile Options
You can change profile attributes individually.

__profile.raw__

By default, WebJack tries to parse received data into strings. To get the raw data stream as array of bytes, set the `raw` attribute of the profile to `true`:

```js
var profile = WebJack.Profiles.SoftModem;
profile.raw = true;
var connection = new WebJack.Connection(profile);
``` 

__profile.baud__

The baud-/bitrate. Has to be a factor 44,1kHz and below 1225 bit/s. 

__profile.freqLow__

The frequency of the lower tone, marks a `0` and has to be a multiple of the baudrate.

__profile.freqHigh__

The frequency of the upper tone, marks a `1` and has to be a multiple of the baudrate.

__profile.echoCancellation__

Turn on or off echoCancellation. This enables or disables filtering (high-/lowpass) as well.

__profile.softmodem__

Set to `false` for transmissions between browser tabs to improve transmission reliability.


## Troubleshooting

If you have problems setting up the connection, you can file an [issue](https://github.com/publiclab/webjack/issues/new). Please include following information:

- Hardware: board, circuit/shield, smartphone
- Software: Arduino sketch, your webbrowser, used WebJack profiles
- A recording of the received signal. Please use this [AudioRecorder](https://webaudiodemos.appspot.com/AudioRecorder/index.html).
- Error messages that occurred

## Building

webjack.js is built using a Grunt task from the source files in `/src/`, and the compiled file is saved to `/dist/webjack.js`. To build, run `grunt build`. To watch files for changes, and build whenever they occur, run `grunt`. 


## Testing

Assuming `tape` is installed globally:
```
npm test
```


##Developers

Help improve Public Lab software!

* Join the 'plots-dev@googlegroups.com' discussion list to get involved
* Find lots of info on contributing at http://publiclab.org/wiki/developers
* Review specific contributor guidelines at http://publiclab.org/wiki/contributing-to-public-lab-software
