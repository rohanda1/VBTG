#ifndef CONFIG_RH_DEVICE_H
#define CONFIG_RH_DEVICE_H

#include <ArduinoBLE.h>  // Ensure BLE types are recognized

BLEService customService("f8f50907-0483-48e0-b3d5-838da04e71a6"); //custom service RH
BLECharacteristic amplitudeCharacteristic("ca50748e-5b91-4c50-8073-8c6572eaa97c", BLERead | BLEWrite, 20);
BLECharacteristic boxCharacteristic("4d689fa6-af9c-4a4f-a0ca-97859622a50d", BLERead | BLEWrite, 1);
BLECharacteristic batteryCharacteristic("58526da4-6c23-4428-8c21-620e012002ad", BLERead | BLENotify, 1);
BLECharacteristic restartCharacteristic("6db2e539-ba05-498a-a108-8f149e54493b", BLEWrite, 1);

#endif // CONFIG_LH_DEVICE_H
