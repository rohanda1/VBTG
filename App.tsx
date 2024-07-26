import 'expo-dev-client';
import React, {useState} from 'react';
import {
  TouchableOpacity,
  Button,
  PermissionsAndroid,
  View,
  Text,
} from 'react-native';

import base64 from 'react-native-base64';
import CheckBox from '@react-native-community/checkbox';
import {BleManager, Device} from 'react-native-ble-plx';
import { styles } from './Styles/styles';
//import {styles} from 'Styles/styles';
import {LogBox} from 'react-native';
import * as Permissions from 'expo-permissions';

LogBox.ignoreLogs(['new NativeEventEmitter']); // Ignore log notification by message
LogBox.ignoreAllLogs(); // Ignore all log notifications

const BLTManager = new BleManager();

const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const MESSAGE_UUID = '6d68efe5-04b6-4a85-abc4-c2670b7bf7fd';
const BUTTON_UUID = 'f27b53ad-c63d-49a0-8c0f-9f297e6cc520';


export default function App() {
  // Is a device connected?
  const [isConnected, setIsConnected] = useState(false);

  // What device is connected?
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);

  const [ButtonPressed, setButtonPressed] = useState(false);

  // Scans available BLT Devices and then call connectDevice
  async function scanDevices() {
    const { status } = await Permissions.askAsync(Permissions.LOCATION);

    if (status !== 'granted') {
      console.log('Permission to access location denied');
      return;
    }

    console.log('Scanning for devices');

    BLTManager.startDeviceScan(null, null, (error, scannedDevice) => {
      if (error) {
        console.warn(error);
        return;
      }

      if (scannedDevice && scannedDevice.name === 'Nano33BLEExample') {
        BLTManager.stopDeviceScan();
        connectDevice(scannedDevice);
      }
    });

    // Stop scanning devices after 5 seconds
    setTimeout(() => {
      BLTManager.stopDeviceScan();
    }, 5000);
  }

  // Handle the device disconnection
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

  // Connect the device and start monitoring characteristics
  async function connectDevice(device: Device) {
    console.log('connecting to Device:', device.name);

    device
      .connect()
      .then(device => {
        setConnectedDevice(device);
        setIsConnected(true);
        return device.discoverAllServicesAndCharacteristics();
      })
      .then(device => {
        // Set what to do when DC is detected
        BLTManager.onDeviceDisconnected(device.id, (error, device) => {
          console.log('Device DC');
          setIsConnected(false);
        });

        // Read initial values
        device.monitorCharacteristicForService(
          SERVICE_UUID,
          BUTTON_UUID,
          (error, characteristic) => {
            if (characteristic?.value != null) {
              setButtonPressed(base64.decode(characteristic.value) === '1');
              console.log('Button press update received:', base64.decode(characteristic.value));
            }
          },
          'buttonTransaction',
        );

        console.log('Connection established');
      })
      .catch(error => {
        console.error('Connection error:', error);
      });
  }

  return (
    <View>
      <View style={{ paddingBottom: 200 }}></View>

      {/* Title */}
      <View style={styles.rowView}>
        <Text style={styles.titleText}>BLE Example</Text>
      </View>

      <View style={{ paddingBottom: 20 }}></View>

      {/* Connect Button */}
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

      {/* Button Press Status */}
      <View style={styles.rowView}>
        <Text style={styles.baseText}>{ButtonPressed ? 'Button Pressed' : 'Button Not Pressed'}</Text>
      </View>
    </View>
  );
}