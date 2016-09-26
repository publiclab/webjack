typedef uint8_t crc;
#define POLYNOMIAL 0x07  /* CRC8_CCITT -- this polynomial needs to match choice on javascript end */
#define WIDTH  (8 * sizeof(crc))
#define TOPBIT (1 << (WIDTH - 1))


#include <SoftModem.h>

// which analog pin to connect
#define THERMISTORPIN A0         
// resistance at 25 degrees C
#define THERMISTORNOMINAL 10000      
// temp. for nominal resistance (almost always 25 C)
#define TEMPERATURENOMINAL 25   
// how many samples to take and average, more takes longer
// but is more 'smooth'
#define NUMSAMPLES 5
// The beta coefficient of the thermistor (usually 3000-4000)
#define BCOEFFICIENT 3950
// the value of the 'other' resistor
#define SERIESRESISTOR 10000  

crc  crcTable[256];

int samples[NUMSAMPLES];


SoftModem modem = SoftModem();

void crcInit(void)
{
    crc  remainder;

    for (int dividend = 0; dividend < 256; ++dividend)
    {
        remainder = dividend << (WIDTH - 8);

        
        for (uint8_t bit = 8; bit > 0; --bit)
        {  
            if (remainder & TOPBIT)
            {
                remainder = (remainder << 1) ^ POLYNOMIAL;
            }
            else
            {
                remainder = (remainder << 1);
            }
        }

        crcTable[dividend] = remainder;
    }

}


crc crcFast(uint8_t const message[], int nBytes)
{
    uint8_t data;
    crc remainder = 0;


    for (int byte = 0; byte < nBytes; ++byte)
    {
        data = message[byte] ^ (remainder >> (WIDTH - 8));
        remainder = crcTable[data] ^ (remainder << 8);
    }

   
    return (remainder);

}  



void setup() {
  Serial.begin(9600);
//  Serial.println("Booting");
  delay(100);
  modem.begin();

  crcInit();
  
}

void loop() {


uint8_t i;
  float average;
 
  // take N samples in a row, with a slight delay
  for (i=0; i< NUMSAMPLES; i++) {
   samples[i] = analogRead(THERMISTORPIN);
   delay(10);
  }
 
  // average all the samples out
  average = 0;
  for (i=0; i< NUMSAMPLES; i++) {
     average += samples[i];
  }
  average /= NUMSAMPLES;
 
  //Serial.print("Average analog reading "); 
  //Serial.println(average);
 
  // convert the value to resistance
  average = 1023 / average - 1;
  average = SERIESRESISTOR / average;
 // Serial.print("Thermistor resistance "); 
 // Serial.println(average);
 
  float steinhart;
  steinhart = average / THERMISTORNOMINAL;     // (R/Ro)
  steinhart = log(steinhart);                  // ln(R/Ro)
  steinhart /= BCOEFFICIENT;                   // 1/B * ln(R/Ro)
  steinhart += 1.0 / (TEMPERATURENOMINAL + 273.15); // + (1/To)
  steinhart = 1.0 / steinhart;                 // Invert
  steinhart -= 273.15;                         // convert to C
 
 // Serial.print("Temperature "); 
 // Serial.print(steinhart);
 // Serial.println(" *C");

 
String str=String(steinhart,2);
int str_len = str.length() + 1; // Length (with one extra character for the null terminator)
unsigned char char_array[str_len]; // Prepare the character array (the buffer) 
str.toCharArray(char_array, str_len); // Copy it over 

crc crc8 = crcFast(char_array,strlen(char_array));

String crc8_str=String(crc8);

String out = str+'%'+crc8_str;

Serial.println(out);

modem.print(out);

 delay(100); // seems about as short a delay as we can do and still work right
 
}
