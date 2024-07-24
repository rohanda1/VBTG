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

#define IIM42351_ADDRESS 0x68 

Haptic_Driver hapDrive;

// BLE SECTION
BLEService customService("4fafc201-1fb5-459e-8fcc-c5c9c331914b");

BLECharacteristic messageCharacteristic("6d68efe5-04b6-4a85-abc4-c2670b7bf7fd", 
                                       BLERead | BLEWrite | BLENotify, 20);
BLECharacteristic boxCharacteristic("f27b53ad-c63d-49a0-8c0f-9f297e6cc520", 
                                    BLERead | BLEWrite | BLENotify, 20);
int event = 0;
int bus = 0;
int cycle_count = 1;
unsigned long previousMillis = 0;
const long interval = 130;

void TCA9544A(int bus) {
  Wire.beginTransmission(0x70);  // TCA9544A address
  Wire.write(0x4 | bus);
  Wire.endTransmission();
}

float readZAcceleration() {
  Wire.beginTransmission(IIM42351_ADDRESS);
  Wire.write(35); // Start from register address ACCEL_DATA_Z1
  Wire.endTransmission(false);
  
  Wire.requestFrom(IIM42351_ADDRESS, 2, true);
  int16_t zRawData = (Wire.read() << 8) | Wire.read();

  // Convert to g's (assuming a full-scale range of ±2g)
  float zAcceleration = static_cast<float>(zRawData) / 4096.0; // 4096 is the scale factor for ±2g range
  return zAcceleration;
}

void setup() {
  Wire.begin();
  Serial.begin(115200);
  while (!Serial); // Wait for the serial monitor to open
  Serial.println("Starting setup...");
  delay(2);
  for (int i = 3; i < 7; i++) {
    TCA9544A(i);
    TwoWire &wirePort = Wire;
    hapDrive._i2cPort = &wirePort;
    hapDrive._writeRegister(CHIP_REV_REG, 0xBA, 0xBA, 1);
  //  uint8_t temp = hapDrive._readRegister(CHIP_REV_REG); 
  //  Serial.println(temp);
    if (!hapDrive.defaultMotor()) {
      printf("Could not set default settings.");
    } else {
      printf("Ready.");
    }

  //  initializeIIM42351();
  //  setDefaultSENSOR_CONFIG0();
    hapDrive.setOperationMode(DRO_MODE);
    hapDrive.setActuatorNOMVolt(1.5);   // Nominal Voltage (VRMS) of Actuator 2.5
    hapDrive.setActuatorABSVolt(3);     // Max Voltage of actuator 3.536
    hapDrive.setActuatorIMAX(200);      // Max Current of actuator
    hapDrive.setActuatorLRAfreq(170);
    delay(20);
  }
  if (!BLE.begin()) {
  Serial.println("starting BLE failed!");
  while (1);
  }
  // Set device name
  BLE.setLocalName("Nano33BLEExample");
  BLE.setAdvertisedService(customService);

  // Add characteristics to the service
  customService.addCharacteristic(messageCharacteristic);
  customService.addCharacteristic(boxCharacteristic);

  // Add service
  BLE.addService(customService);

  // Set initial characteristic values
  messageCharacteristic.writeValue("Message one");
  boxCharacteristic.writeValue("0");

  // Start advertising
  BLE.advertise();

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
  int exclusion[4];
  int bus_count = 0;

  while (bus_count < 4) {
    int randbus = random(3, 7);
    bool isDuplicate = false;
    for (int i = 0; i < bus_count; i++) {
      if (randbus == exclusion[i]) {
        isDuplicate = true;
        break; // Exit the loop if a duplicate is found
      }
    }
    if (!isDuplicate) {
      TCA9544A(randbus);
      while (millis() - previousMillis < interval) {
        event = hapDrive.getIrqEvent();  // If uploading often the Haptic Driver IC will throw a fault
        hapDrive.clearIrq(event);        // Clearing error 
        hapDrive.setVibrate(127);
        float zAcceleration = readZAcceleration();
        /*
        Serial.print("Z Acceleration: "); 
        Serial.print(zAcceleration); 
        Serial.println(" g");
        Serial.print("Z Acceleration (16-bit binary): ");
        Serial.print(zAcceleration, BIN);
        Serial.println(" g");
        */
      }
      while (millis() - previousMillis > interval) {
        hapDrive.setVibrate(0);
        delay(30);
        previousMillis = millis(); // Save the last time LRA was triggered
      }
      exclusion[bus_count] = randbus;
      bus_count++;
    }
  }
  cycle_count++;
  if (cycle_count % 3 == 0) {
    delay(1500);
    previousMillis = millis(); // Reset previousMillis
  }
  //insert callout to pause loop if button is pressed in app.tsx code
}

void initializeIIM42351() {
  Wire.beginTransmission(IIM42351_ADDRESS);
  Wire.write(80); // Start from register address ACCEL_CONFIG0
  // Set accel_odr to 0011 (bits 3, 2, 1, 0)- 8000hz and accel_fs_sel to 001 (bits 7, 6, 5)- 8g
  Wire.write((0b0011 << 0) | (0b001 << 5));
  Wire.endTransmission();
}

void setDefaultSENSOR_CONFIG0() {
  Wire.beginTransmission(IIM42351_ADDRESS);
  Wire.write(0x03); // Start from register address SENSOR_CONFIG0
  Wire.write(0xB8); // Write default value
  Wire.endTransmission();
  Wire.beginTransmission(IIM42351_ADDRESS);
  Wire.write(78); // Start from register address PWR_MGMT0
  Wire.write(0x03); // Write accel to LN mode
  Wire.endTransmission();
}
