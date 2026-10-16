#include "Arduino.h"
#include "softSerial.h"

#define RX_PIN GPIO1       // RO модуля RS485
#define TX_PIN GPIO2       // DI модуля RS485
#define DE_RE_PIN GPIO5    // DE і RE, з'єднані разом

// Якщо датчик мовчить, поставте 4800.
#define RS485_BAUD 9600

// У Heltec softSerial порядок аргументів: спочатку TX, потім RX.
softSerial RS485(TX_PIN, RX_PIN);

byte modbusRequest[] = {0x01, 0x03, 0x00, 0x00, 0x00, 0x02, 0xC4, 0x0B};
byte modbusResponse[9];

uint16_t modbusCrc(const byte *data, uint8_t length) {
  uint16_t crc = 0xFFFF;
  for (uint8_t i = 0; i < length; i++) {
    crc ^= data[i];
    for (uint8_t bit = 0; bit < 8; bit++) {
      if (crc & 0x0001) {
        crc = (crc >> 1) ^ 0xA001;
      } else {
        crc >>= 1;
      }
    }
  }
  return crc;
}

void setup() {
  Serial.begin(115200);
  RS485.begin(RS485_BAUD);

  pinMode(DE_RE_PIN, OUTPUT);
  digitalWrite(DE_RE_PIN, LOW);

  Serial.println("Система ініціалізована. Запуск зчитування мікроклімату SHT30...");
}

void loop() {
  digitalWrite(DE_RE_PIN, HIGH);
  delay(10);

  RS485.write(modbusRequest, sizeof(modbusRequest));
  delayMicroseconds(200);

  digitalWrite(DE_RE_PIN, LOW);
  delay(2);
  RS485.flush();

  int bytesReceived = 0;
  unsigned long startTime = millis();
  while (millis() - startTime < 500 && bytesReceived < 9) {
    if (RS485.available()) {
      modbusResponse[bytesReceived++] = RS485.read();
    }
  }

  bool ok = false;
  if (bytesReceived == 9 &&
      modbusResponse[0] == 0x01 &&
      modbusResponse[1] == 0x03 &&
      modbusResponse[2] == 0x04) {
    uint16_t crc = modbusCrc(modbusResponse, 7);
    uint16_t receivedCrc = (uint16_t)modbusResponse[7] | ((uint16_t)modbusResponse[8] << 8);
    ok = (crc == receivedCrc);
  }

  if (ok) {
    uint16_t rawHum = ((uint16_t)modbusResponse[3] << 8) | modbusResponse[4];
    int16_t rawTemp = (int16_t)(((uint16_t)modbusResponse[5] << 8) | modbusResponse[6]);
    float humidity = rawHum / 10.0;
    float temperature = rawTemp / 10.0;

    Serial.print("Температура: ");
    Serial.print(temperature);
    Serial.print(" °C | Вологість: ");
    Serial.print(humidity);
    Serial.println(" %");
  } else {
    Serial.print("Помилка. Отримано байт: ");
    Serial.println(bytesReceived);
  }

  delay(5000);
}
