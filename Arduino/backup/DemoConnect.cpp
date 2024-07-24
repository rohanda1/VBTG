/*
 * Finger boards work when plugged into external SCL/SDA line from another arduino
 * Finger boards work when SCL/SDA is directly inputted into I2C mux output
 * Test board works when I2C Mux input pull up resistors are bypassed   
 * Address of DA7280- 0x4A
 */

#include <Wire.h> 
#include "Haptic_Driver.h"
#include "Arduino.h"
#include <ArduinoBLE.h>

// BLE SECTION
BLEService customService("4fafc201-1fb5-459e-8fcc-c5c9c331914b");

BLECharacteristic messageCharacteristic("6d68efe5-04b6-4a85-abc4-c2670b7bf7fd", 
                                       BLERead | BLEWrite | BLENotify, 20);
BLECharacteristic boxCharacteristic("f27b53ad-c63d-49a0-8c0f-9f297e6cc520", 
                                    BLERead | BLEWrite | BLENotify, 20);


void setup() {
  Wire.begin();
  Serial.begin(115200);
  while (!Serial); // Wait for the serial monitor to open
  Serial.println("Starting setup...");

  if (!BLE.begin()) {
    Serial.println("starting BLE failed!");
    while (1);
  } else {
    Serial.println("BLE initialized successfully.");
  }

  // Set device name
  BLE.setLocalName("Nano33BLEExample");
  Serial.println("Local name set to Nano33BLEExample.");

  BLE.setAdvertisedService(customService);
  Serial.println("Advertised service set.");

  // Add characteristics to the service
  customService.addCharacteristic(messageCharacteristic);
  Serial.println("Message characteristic added.");

  customService.addCharacteristic(boxCharacteristic);
  Serial.println("Box characteristic added.");

  // Add service
  BLE.addService(customService);
  Serial.println("Custom service added.");

  // Set initial characteristic values
  messageCharacteristic.writeValue("Message one");
  Serial.println("Message characteristic initial value set.");

  boxCharacteristic.writeValue("0");
  Serial.println("Box characteristic initial value set.");

  // Start advertising
  BLE.advertise();
  Serial.println("BLE advertising started.");

  Serial.println("Waiting for a client connection to notify...");
}

void loop() {
  // Keep checking BLE central connection
  BLE.poll();
  // Read the current value of the box characteristic
  
  uint8_t boxValue[2]={0};
  boxCharacteristic.readValue(boxValue, 1);
  bool isButtonPressed = (boxValue[0] == '1');

  if (isButtonPressed) {
    Serial.println("Button is pressed. Pausing the loop...");
    while (isButtonPressed) {
      // Keep checking if the button is released
      boxCharacteristic.readValue(boxValue, 1);
      isButtonPressed = (boxValue[0] == '1');
      delay(100);  // Add a small delay to avoid busy-waiting
    }
    Serial.println("Button is released. Resuming the loop...");
  }
  
  // Print a message every second to confirm the loop is running
  static unsigned long lastMillis = 0;
  if (millis() - lastMillis > 1000) {
  Serial.println("Loop is running...");
  lastMillis = millis();
}
}


