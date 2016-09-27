#include <SoftModem.h>
#include "CRC8.h"


SoftModem modem = SoftModem();

CRC8 crc8;
uint8_t checksum;
#define separating_char '%'

void setup() {
  // put your setup code here, to run once:
  Serial.begin(9600);


  modem.begin();
  crc8.begin();

}

void loop() {



  // original message to send to WebJack
  String str = "Hello world!";

  // generate the checksum
  int str_len = str.length() + 1; // calculate length of message (with one extra character for the null terminator)
  unsigned char char_array[str_len]; // prepare a character array (the buffer)
  str.toCharArray(char_array, str_len); // copy it over
  checksum = crc8.get_crc8(char_array, str_len);

  //combine message and checksum with separating character
  String checksum_str = String(checksum);
  String output = str + separating_char + checksum_str;

  Serial.println(output);

  modem.print(output);

  delay(1000);
}
