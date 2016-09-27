#Background

The Arduino calculates a single-byte 'checksum' for each message to be sent to WebJack, and appends it to the message. The browser receives the message and checksum, calculates the checksum independently, and rejects the message if the two checksums don't match.
