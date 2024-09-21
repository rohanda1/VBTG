
#include "ConfigLHDevice.h"
#include <Wire.h> 
#include "Haptic_Driver.h"
#include "Arduino.h"
#include <ArduinoBLE.h>
#include <SparkFunBQ27441.h>
#define IIM42351_ADDRESS 0x68 
Haptic_Driver hapDrive;
uint8_t boxValue[2]; // Initialize the boxValue array with a default value
uint8_t amplitudeValue[20];  // Buffer to hold the received value
uint8_t amplitude = 0; // Global variable to store the amplitude value
const unsigned int BATTERY_CAPACITY = 850; // e.g. 800mAh battery



/*
BLEService customService("4fafc201-1fb5-459e-8fcc-c5c9c331914b"); //Service UUID Device LH

BLECharacteristic amplitudeCharacteristic("6d68efe5-04b6-4a85-abc4-c2670b7bf7fd", //amplitude UUID
                                       BLERead | BLEWrite | BLENotify, 20);
BLECharacteristic boxCharacteristic("f27b53ad-c63d-49a0-8c0f-9f297e6cc520", //Button UUID
                                    BLERead | BLEWrite | BLENotify, 20);
BLECharacteristic batteryCharacteristic("a8d41af6-cada-44fb-ba9a-d43c7d7a9dbe", //Battery UUID
                                    BLERead | BLEWrite | BLENotify, 20);
BLECharacteristic restartCharacteristic("197ca73c-4f56-4021-bb56-0885cb13f23a", //Restart UUID
                                    BLERead | BLEWrite | BLENotify, 20);    
*/

int event = 0;
int bus = 0;
int totalCycles = 3;             // Total number of cycles to complete before pausing
int currentCycle = 0;            // Current cycle count
unsigned long previousMillis = 0;
const long vibrateDuration = 130; // Duration for vibration in milliseconds
const long stopDuration = 30;     // Duration to stop vibration in milliseconds
const long pauseDuration = 1500;  // Duration of pause between cycles in milliseconds

enum State { SELECT_BUS, VIBRATE, STOP_VIBRATE, PAUSE, FINISHED };
State currentState = SELECT_BUS;  // Initial state
unsigned long stateStartTime = 0; // Time when the current state started
int exclusion[4] = {0, 0, 0, 0};  // Array to store selected buses
int bus_count = 0;                // Counter for selected buses

bool shouldRestart = false;

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

// Function to map the amplitude from 0-100 to 0-127
uint8_t mapAmplitude(int amplitude) {
    return (amplitude * 127) / 100;
}

void restartSession(){
   if (!BLE.begin()) {
  Serial.println("starting BLE failed!");
  while (1);
  }
  // Set device name
  BLE.setLocalName(LOCAL_NAME);
//  Serial.println("Local name set to Nano33BLEExample.");
  BLE.setAdvertisedService(customService);
  // Add characteristics to the service
  customService.addCharacteristic(amplitudeCharacteristic);
  customService.addCharacteristic(boxCharacteristic);
  customService.addCharacteristic(batteryCharacteristic); 
  customService.addCharacteristic(restartCharacteristic); 

  BLE.addService(customService);

  // Set initial characteristic values
  boxCharacteristic.writeValue("0");

  // Start advertising
  BLE.advertise();

  Serial.println("Waiting for a client connection to notify...");
}

void setup() {
  Wire.begin();
  Serial.begin(115200);
  while (!Serial); // Wait for the serial monitor to open
  if (!lipo.begin()) // begin() will return true if communication is successful
  {
  // If communication fails, print an error message and loop forever.
    Serial.println("Error: Unable to communicate with BQ27441.");
    Serial.println("  Check wiring and try again.");
    Serial.println("  (Battery must be plugged into Battery Babysitter!)");
    while (1);
  }
  Serial.println("Connected to BQ27441!");
  Serial.println("Starting setup...");
  delay(2);
  for (int i = 3; i < 7; i++) {
    TCA9544A(i);
    TwoWire &wirePort = Wire;
    hapDrive._i2cPort = &wirePort;
    hapDrive._writeRegister(CHIP_REV_REG, 0xBA, 0xBA, 1);
    hapDrive._writeRegister(TOP_INT_CFG8, 0x00, 0x7F, 0); //prevents overshoot during actuator braking
    hapDrive._writeRegister(TOP_CFG1, 0xFD, 0x01, 1); //default settings rapid stop enabled
//  hapDrive._writeRegister(TOP_CFG1, 0xFD,0x00,1); //rapid stop disabled
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
//  BLE.setLocalName("Nano33BLEExample");
//  Serial.println("Local name set to Nano33BLEExample.");
  BLE.setAdvertisedService(customService);
  // Add characteristics to the service
  customService.addCharacteristic(amplitudeCharacteristic);
  customService.addCharacteristic(boxCharacteristic);
  customService.addCharacteristic(batteryCharacteristic); 
  customService.addCharacteristic(restartCharacteristic); 

  BLE.addService(customService);

  // Set initial characteristic values
  boxCharacteristic.writeValue("0");

  // Start advertising
  BLE.advertise();

  Serial.println("Waiting for a client connection to notify...");
}

void selectBus() {
  int randbus = random(3, 7);
  bool isDuplicate = false;

  // Check if bus is a duplicate
  for (int i = 0; i < bus_count; i++) {
    if (randbus == exclusion[i]) {
      isDuplicate = true;
      break;
    }
  }

  if (!isDuplicate) {
    // New bus selected, start vibrating
    TCA9544A(randbus);
    exclusion[bus_count] = randbus; // Store the selected bus
    bus_count++;
    event = hapDrive.getIrqEvent();       //If uploading often the Haptic Driver IC will throw a fault
    hapDrive.clearIrq(event);             //Clearing error 
    hapDrive.setVibrate(127);       // Start vibration
    stateStartTime = millis();      // Record the time when vibration started
    Serial.print("Bus ");
    Serial.print(randbus);
    Serial.println(" vibrating...");
    currentState = VIBRATE;         // Transition to VIBRATE state
  } else {
    Serial.print("Duplicate bus ");
    Serial.print(randbus);
    Serial.println(" selected, choosing another.");
  }
}

void loop() {
  Serial.println("Looping...");
  // Keep checking BLE central connection
  BLE.poll();
//  cycle_count*3.32/7200;
      if (restartCharacteristic.written()) {
      uint8_t command = *restartCharacteristic.value();  // Dereferencing the pointer to get the actual value
      if (command == '1') {
        Serial.println("Restart command received. Restarting session...");
        command ='0';
        restartSession();
    }
  }

  Serial.println();
  unsigned int soc = lipo.soc();  // Read state-of-charge (%)
  byte batteryBytes[sizeof(soc)];
  memcpy(batteryBytes, &soc, sizeof(soc));

  // Write the byte array to the battery characteristic
  batteryCharacteristic.writeValue(batteryBytes, sizeof(batteryBytes));
  // batteryCharacteristic.writeValue(static_cast<uint8_t>(1), static_cast<size_t>(1));

  Serial.print("Battery Level: ");
  Serial.println(soc);
  int length = amplitudeCharacteristic.readValue(amplitudeValue, sizeof(amplitudeValue));  // Read the BLE characteristic value

  if (length > 0) {
    amplitudeValue[length] = '\0';  // Null-terminate the received data
    char amplitudeString[length + 1];  // Create a char array to hold the string
    memcpy(amplitudeString, amplitudeValue, length);  // Copy the received bytes to the string
    amplitudeString[length] = '\0';  // Null-terminate the string

    Serial.print("Received amplitude string: ");
    Serial.println(amplitudeString);  // Print the received string

    amplitude = (uint8_t)atoi(amplitudeString);  // Convert the string to an integer
    Serial.print("Converted amplitude value: ");
    Serial.println(amplitude);  // Print the converted integer value
  }
  

  // Read the current value of the box characteristic
  boxCharacteristic.readValue(boxValue, 1); // Read the value of the box characteristic into the boxValue array
  Serial.print("boxValue[0]: ");
  Serial.println(boxValue[0]);
  // Check if the button is pressed by comparing the first element of boxValue to 1
  bool isButtonPressed = (boxValue[0] == '1');
  Serial.print("isButtonPressed: ");
  Serial.println(isButtonPressed);

  if (isButtonPressed) {
    Serial.println("Pause command received. Pausing the loop...");
    while (isButtonPressed) {
      BLE.poll();
      boxCharacteristic.readValue(boxValue, 1);
      hapDrive.clearIrq(event);        // Clearing error 
      hapDrive.setVibrate(0);
      Serial.print("Reading characteristic value: ");
      Serial.println(boxValue[0]);
      if (boxValue[0] == '0') {
        Serial.println("Resume command received. Resuming the loop...");
        break; // Exit the loop when the button is released
      }
      delay(1000);  // Add a small delay to avoid busy-waiting
      Serial.println("Still paused...");
      if (!BLE.advertise()) {
        Serial.println("Restarting advertising while paused...");
        BLE.advertise();  // Restart advertising if it has stopped
      }

    }
  }
  if (currentState == FINISHED) {
    return;
  }

  switch (currentState) {
    case SELECT_BUS:
      if (bus_count >= 4) {
        bus_count = 0;
        currentCycle++;
        Serial.print("Completed cycle ");
        Serial.println(currentCycle);
        if (currentCycle >= totalCycles) {
          currentState = PAUSE;
          stateStartTime = millis();
          Serial.println("Pausing...");
        } else {
          currentState = SELECT_BUS;
        }
        return;
      }
      selectBus();
      break;

    case VIBRATE:
      if (millis() - stateStartTime >= vibrateDuration) {
        hapDrive.setVibrate(0); // Stop vibration
        Serial.println("Vibration stopped");
        stateStartTime = millis();
        currentState = STOP_VIBRATE;
      }
      break;

    case STOP_VIBRATE:
      if (millis() - stateStartTime >= stopDuration) {
        Serial.println("Ready to select new bus");
        currentState = SELECT_BUS;
      }
      break;

    case PAUSE:
      if (millis() - stateStartTime >= pauseDuration) {
        currentCycle = 0;           // Reset the cycle count
        stateStartTime = millis();  // Reset the pause timer
        currentState = SELECT_BUS;  // Restart the process
        Serial.println("Resuming cycles...");
      }
      break;

    default:
      currentState = SELECT_BUS;
      break;
  }

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