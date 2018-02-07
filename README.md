WebJack
====

[![Build Status](https://travis-ci.org/publiclab/webjack.svg?branch=master)](https://travis-ci.org/publiclab/webjack)

[WebJack](https://github.com/publiclab/webjack) is a JavaScript library that uses [SoftModem](https://github.com/arms22/SoftModem), an Arduino library, to create two-way communication between a browser window and an Arduino. No need to install drivers. Just plug in an audio cable and read/send data from the browser.

Try it out in this live demo: [https://publiclab.github.io/webjack/examples/](https://publiclab.github.io/webjack/examples/)

WebJack was built by @rmeister with input from @jywarren as part of [Public Lab](https://publiclab.org)'s 2016 [Google Summer of Code program](http://summerofcode.withgoogle.com).

**Ask questions and find more tutorials** at [https://publiclab.org/webjack](https://publiclab.org/webjack).

****

Also see [webjack-firmata](https://github.com/publiclab/webjack-firmata), which builds on `webjack` to provide a browser-based hardware interface for [firmata.js](https://github.com/firmata/firmata.js).


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

The Arduino can be connected to a laptop or smartphone with the correct cable, but different laptops and smartphones require different cables. See [Hardware](#hardware), below. 

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

## Plotting

If you are receiving sensor data, you can plot a graph of incoming values [in the plotter example](https://publiclab.github.io/webjack/examples/plotter/).
Test it out even without a sensor, by playing audio from [this YouTube video of WebJack-transmitted sensor data](https://www.youtube.com/watch?v=GtJW1Dlt3cg) out loud into the microphone while viewing the above demo. 

![plotted data](https://i.publiclab.org/system/images/photos/000/018/056/medium/Screenshot_2016-09-16_at_11.43.26_AM.png)

****

## Hardware

### Arduino wiring

Follow this diagram (and the cable pinouts guide below) to connect an audio cable to your Arduino in the right way for your smartphone or laptop:

![arduino-diagram.png](https://i.publiclab.org/system/images/photos/000/018/092/large/arduino-diagram.png)

### Cable pinouts

Most smartphones have a 4-pin combined microphone/stereo headphone port which takes a 3.5mm plug, but there are unfortunately different standards for which plug positions (from tip to sleeve) correspond to which wires, and there's no guarantee that the wires are colored helpfully. The best way to test a cable you're using is to use a multimeter, or to light up an LED using different pin/wire combinations to see what wire corresponds to what pin. 

| Pin # | Position | OMTP AV connector | AHJ AV connector |
|-------|----------|-------------------|------------------|
| 1 | sleeve | Ground | Microphone |
| 2 | ring | Microphone | Ground |
| 3 | ring | Right audio | Right audio |
| 4 | tip | Left audio | Left audio |
|   | **Devices:** | Samsung,older Sony Ericsson and Nokia | HTC, recent Sony and Nokia, Apple |

3.5mm to RCA AV cables (to red/white/yellow "TV-style" plugs) vary: [see this listing for various pinouts](http://pinoutsguide.com/Home/av_jack_pinout.shtml), and note that the wires inside your cable may be labelled with the convention of `red:right`, `white:left`, and `yellow:video`. The ground wires may be wrapped **around** each of those three wires, which provides shielding from interference.


****

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


## Developers

Help improve Public Lab software!

* Join the 'plots-dev@googlegroups.com' discussion list to get involved
* Find lots of info on contributing at [http://publiclab.org/developers](http://publiclab.org/developers)
* Review specific contributor guidelines at [http://publiclab.org/contributing-to-public-lab-software](http://publiclab.org/contributing-to-public-lab-software)
