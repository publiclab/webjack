WebJack
====

[![Build Status](https://travis-ci.org/publiclab/webjack.svg?branch=master)](https://travis-ci.org/publiclab/webjack)

WebJack is a JavaScript library that uses [SoftModem](https://github.com/arms22/SoftModem), an Arduino library, to create two-way communication between a browser window and an Arduino. No need to install drivers. Just plug in an audio cable and read/send data from the browser.

Try it out in this live demo: https://publiclab.github.io/webjack/examples/

## Installation
```
npm install --save webjack
```
or
```
bower install -S webjack 
```
If not already done, install the SoftModem Arduino library:
[https://github.com/arms22/SoftModem](https://github.com/arms22/SoftModem)


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
There are three profiles:

- SoftModem: default, for use with the SoftModem Arduino library
- SoftModemLowFrequencies: try this if you have a long cable to reduce crosstalk (that leads to feedback)
- Browser: inteded for browser-to-browser transmissions over the air


For the _SoftModemLowFrequencies_ profile, you need to add this definitions to the head of you sketch:
```cpp
#define SOFT_MODEM_LOW_FREQ    (2450)
#define SOFT_MODEM_HIGH_FREQ   (4900)
```



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
