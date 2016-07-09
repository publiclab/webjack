WebJack
====

[![Build Status](https://travis-ci.org/publiclab/webjack.svg?branch=master)](https://travis-ci.org/publiclab/webjack)

WebJack is a JavaScript library that uses an audio modem to communicate with an Arduino µC via headphone jack. No need to install drivers. Just plug in an audio cable and read/send data from the browser.

## Installation

## Usage

## Building

webjack.js is built using a Grunt task from the source files in `/src/`, and the compiled file is saved to `/dist/webjack.js`. To build, run `grunt build`. To watch files for changes, and build whenever they occur, run `grunt`. 


## Testing

Assuming `tape` is installed globally:
```
npm test
```