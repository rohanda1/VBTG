#include <Wire.h>
#include "Haptic_Driver.h"

#define IIM42351_ADDRESS 0x68

Haptic_Driver hapDrive;

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

void TCA9544A(int bus) {
  Wire.beginTransmission(0x70);  // TCA9544A address
  Wire.write(0x4 | bus);
  Wire.endTransmission();
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
    hapDrive.setVibrate(127);       // Start vibration
    stateStartTime = millis();      // Record the time when vibration started
    currentState = VIBRATE;         // Transition to VIBRATE state
  }
}

void initializeIIM42351() {
  Wire.beginTransmission(IIM42351_ADDRESS);
  Wire.write(80); // Start from register address ACCEL_CONFIG0
  Wire.write((0b0011 << 0) | (0b001 << 5)); // Set accel_odr to 0011 (bits 3, 2, 1, 0)- 8000hz and accel_fs_sel to 001 (bits 7, 6, 5)- 8g
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

void setup() {
  Wire.begin();
  Serial.begin(115200);
  delay(2);

  // Initialize haptic drivers on all buses
  for (int i = 3; i < 7; i++) {
    TCA9544A(i);
    TwoWire &wirePort = Wire;
    hapDrive._i2cPort = &wirePort;
    hapDrive._writeRegister(CHIP_REV_REG, 0xBA, 0xBA, 1);
    if (!hapDrive.defaultMotor()) {
      Serial.println("Could not set default settings.");
    } else {
      Serial.println("Ready.");
    }

    initializeIIM42351();
    setDefaultSENSOR_CONFIG0();
    hapDrive.setOperationMode(DRO_MODE);
    hapDrive.setActuatorNOMVolt(1.5);   // Nominal Voltage (VRMS) of Actuator 1.5
    hapDrive.setActuatorABSVolt(3);     // Max Voltage of actuator 3
    hapDrive.setActuatorIMAX(200);      // Max Current of actuator
    hapDrive.setActuatorLRAfreq(170);
    delay(20);
  }
}

void loop() {
  switch (currentState) {
    case SELECT_BUS:
      if (bus_count >= 4) {
        bus_count = 0;
        currentCycle++;
        if (currentCycle >= totalCycles) {
          currentState = PAUSE;
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
        stateStartTime = millis();
        currentState = STOP_VIBRATE;
      }
      break;

    case STOP_VIBRATE:
      if (millis() - stateStartTime >= stopDuration) {
        currentState = SELECT_BUS;
      }
      break;

    case PAUSE:
      if (millis() - stateStartTime >= pauseDuration) {
        currentCycle = 0;           // Reset the cycle count
        stateStartTime = millis();  // Reset the pause timer
        currentState = SELECT_BUS;  // Restart the process
      }
      break;

    case FINISHED:
      // Sequence finished, nothing to do
      return;

    default:
      currentState = SELECT_BUS;
      break;
  }
}


