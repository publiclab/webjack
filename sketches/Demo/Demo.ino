#include <SoftModem.h>
#include <ArduinoJson.h>

SoftModem modem = SoftModem();
double temp;

void setup() {
  Serial.begin(115200);
  Serial.println("Booting");
  
  temp = 0;
  delay(100);
  modem.begin();
}

void loop() {
  temp = getTemp();

  StaticJsonBuffer<150> jsonBuffer;
  JsonObject& root = jsonBuffer.createObject();
  root["temperature"] = temp;
  int len = root.measureLength();
  char buffer[len+1];
  root.printTo(buffer, len+1);
  modem.print(buffer);

  delay(1000);
}


// from http://playground.arduino.cc/Main/InternalTemperatureSensor
double getTemp(void)
{
  unsigned int wADC;
  double t;

  // The internal temperature has to be used
  // with the internal reference of 1.1V.
  // Channel 8 can not be selected with
  // the analogRead function yet.

  // Set the internal reference and mux.
  ADMUX = (_BV(REFS1) | _BV(REFS0) | _BV(MUX3));
  ADCSRA |= _BV(ADEN);  // enable the ADC

  delay(20);            // wait for voltages to become stable.

  ADCSRA |= _BV(ADSC);  // Start the ADC

  // Detect end-of-conversion
  while (bit_is_set(ADCSRA,ADSC));

  // Reading register "ADCW" takes care of how to read ADCL and ADCH.
  wADC = ADCW;

  // The offset of 324.31 could be wrong. It is just an indication.
  t = (wADC - 324.31 ) / 1.22;

  // The returned temperature is in degrees Celsius.
  return (t);
}
