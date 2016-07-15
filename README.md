WebJack
====

[![Build Status](https://travis-ci.org/publiclab/webjack.svg?branch=master)](https://travis-ci.org/publiclab/webjack)

WebJack is a JavaScript library that uses [SoftModem](https://github.com/arms22/SoftModem), an Arduino library, to create two-way communication between a browser window and an Arduino. No need to install drivers. Just plug in an audio cable and read/send data from the browser.

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
var connection = new WebJack.Connection();

connection.listen(function(data) {
	console.log('received: ' + data);
});

connection.send('some data');
```




## Building

webjack.js is built using a Grunt task from the source files in `/src/`, and the compiled file is saved to `/dist/webjack.js`. To build, run `grunt build`. To watch files for changes, and build whenever they occur, run `grunt`. 


## Testing

Assuming `tape` is installed globally:
```
npm test
```