#include <SoftModem.h>

SoftModem modem = SoftModem();

void setup() {
  Serial.begin(115200);
  Serial.println("Booting");
  delay(100);
  modem.begin();
}

void loop() {
  delay(1000);
  modem.print("WebJack");
}
