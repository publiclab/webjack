# CRC8

<img src=pics/demo.png>

Adds a [Cyclic redundancy check](https://en.wikipedia.org/wiki/Cyclic_redundancy_check) -- a common error detection code -- to WebJack, in order to identify (and reject) messages that have been corrupted by noise. The Arduino calculates a single-byte 'checksum' for each message to be sent to WebJack, and appends it to the message. The browser receives the message and checksum, calculates the checksum independently, and rejects the message if the two checksums don't match.

Using it requires installing the <a href="">crc8 library</a> 'sketchbook/libraries' folder of your Arduino IDE.  (This library can also be found under 'examples/crc8/microcontroller' in this repository.)

Based on mode80's crc8js [javascript CRC8 generator](https://github.com/mode80/crc8js), and the BARR Group's [tutorial for generating CRC8 in C++](http://www.barrgroup.com/Embedded-Systems/How-To/CRC-Calculation-C-Code).

