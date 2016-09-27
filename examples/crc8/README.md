# Background

Adds [Cyclic redundancy check](https://en.wikipedia.org/wiki/Cyclic_redundancy_check) functionality -- a common error detection code -- to WebJack, in order to identify (and reject) messages that have been corrupted by noise.

# How it works

The Arduino calculates a single-byte 'checksum' for each message to be sent to WebJack, and appends it to the message. 

The browser receives the message and checksum, calculates the checksum independently, and rejects the message if the two checksums don't match.

# Using it

- Install the 'crc8' library from 'microcontroller/library' in the 'sketchbook/libraries' folder of your Arduino IDE.
- Navigate to 'index.html' in the 'browser' library.


