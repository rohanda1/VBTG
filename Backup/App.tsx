import 'expo-dev-client';  // Ensures the custom development client is used
import React, { useState } from 'react';
import {
  TouchableOpacity,
  Button,
  View,
  Text,
} from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';
import * as Location from 'expo-location';
import { styles } from './Styles/styles';
import { registerRootComponent } from 'expo';

const BLTManager = new BleManager();

const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const BUTTON_UUID = 'f27b53ad-c63d-49a0-8c0f-9f297e6cc520';

if (__DEV__) {
  console.log('Running in development mode');
} else {
  console.log('Running in production mode');
}

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [ButtonPressed, setButtonPressed] = useState(false);

  async function scanDevices() {
    const { status } = await Location.requestForegroundPermissionsAsync(); //see if location services are enabled
    console.log('Permissions status:', status);

    if (status !== 'granted') {
      console.log('Permission to access location denied');
      return;
    }

    console.log('Scanning for devices');

    BLTManager.startDeviceScan([SERVICE_UUID], null, (error, scannedDevice) => { //scan devices based on required service_UUID
      if (error) {
        console.warn('Device scan error:', error);
        return;
      }

      if (scannedDevice?.name && scannedDevice.serviceUUIDs?.includes(SERVICE_UUID)) { //connect to correct service UUID
        console.log('Target device found:', scannedDevice.name);
        BLTManager.stopDeviceScan();
        connectDevice(scannedDevice);
      } else if (scannedDevice) {
        console.log('Found device:', scannedDevice.name || 'Unnamed Device'); //log incorrect scanned devices found
        console.log('Service UUIDs:', scannedDevice.serviceUUIDs);
      }
    });

    // Stop scanning devices after 10 seconds
    setTimeout(() => {
      console.log('Stopping device scan due to timeout');
      BLTManager.stopDeviceScan();
    }, 10000); // 10 seconds timeout
  }

  async function connectDevice(device: Device) {
    console.log('Connecting to Device:', device.name);
    console.log('Connecting to DeviceID:', device.serviceUUIDs);
    device
      .connect()
      .then(device => {
        setConnectedDevice(device);
        setIsConnected(true);
        return device.discoverAllServicesAndCharacteristics();
      })
      .then(device => {
        console.log('Connection established');

        BLTManager.onDeviceDisconnected(device.id, (error, device) => {
          console.log('Device disconnected');
          setIsConnected(false);
        });

        device.monitorCharacteristicForService(
          SERVICE_UUID,
          BUTTON_UUID,
          (error, characteristic) => {
            if (characteristic?.value != null) {
              setButtonPressed(base64.decode(characteristic.value) === '1');
              console.log('Button press update received:', base64.decode(characteristic.value));
            }
          },
          'buttonTransaction'
        );
      })
      .catch(error => {
        console.error('Connection error:', error);
      });
  }

  async function disconnectDevice() {
    console.log('Disconnecting start');

    if (connectedDevice !== null) {
      try {
        await connectedDevice.cancelConnection();
        console.log('Device disconnected');
        setIsConnected(false);
        setConnectedDevice(null);
      } catch (error) {
        console.error('Error disconnecting:', error);
      }
    }
  }

  return (
    <View>
      <View style={{ paddingBottom: 200 }}></View>

      <View style={styles.rowView}>
        <Text style={styles.titleText}>BLE Example</Text>
      </View>

      <View style={{ paddingBottom: 20 }}></View>

      <View style={styles.rowView}>
        <TouchableOpacity style={{ width: 120 }}>
          {!isConnected ? (
            <Button title="Connect" onPress={scanDevices} disabled={false} />
          ) : (
            <Button title="Disconnect" onPress={disconnectDevice} disabled={false} />
          )}
        </TouchableOpacity>
      </View>

      <View style={{ paddingBottom: 20 }}></View>

      <View style={styles.rowView}>
        <Text style={styles.baseText}>{ButtonPressed ? 'Button Pressed' : 'Button Not Pressed'}</Text>
      </View>
    </View>
  );
}

// Register the root component
registerRootComponent(App);

export default App;
