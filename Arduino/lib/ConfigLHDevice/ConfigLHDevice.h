#ifndef CONFIG_LH_DEVICE_H
#define CONFIG_LH_DEVICE_H

#include <ArduinoBLE.h>  // Ensure BLE types are recognized
const char* LOCAL_NAME = "LH GlOVE";  // Make local name a constant
BLEService customService("4fafc201-1fb5-459e-8fcc-c5c9c331914b"); //custom service LH 
BLECharacteristic amplitudeCharacteristic("6d68efe5-04b6-4a85-abc4-c2670b7bf7fd", BLERead | BLEWrite, 20);
BLECharacteristic boxCharacteristic("f27b53ad-c63d-49a0-8c0f-9f297e6cc520", BLERead | BLEWrite, 1);
BLECharacteristic batteryCharacteristic("a8d41af6-cada-44fb-ba9a-d43c7d7a9dbe", BLERead | BLENotify, 1);
BLECharacteristic restartCharacteristic("197ca73c-4f56-4021-bb56-0885cb13f23a", BLEWrite, 1);

#endif // CONFIG_LH_DEVICE_H
