import React, { useState } from 'react';
import { Button, View, Text } from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';
import base64 from 'react-native-base64';

const BLTManager = new BleManager();
const TARGET_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const TARGET_BUTTON_UUID = 'f27b53ad-c63d-49a0-8c0f-9f297e6cc520';

export default function App() {
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [buttonPressed, setButtonPressed] = useState(false);

  async function scanAndConnect() {
    console.log('Starting scan for devices');
    BLTManager.startDeviceScan(null, null, (error, scannedDevice) => {
      if (error) {
        console.error('Device scan error:', error);
        return;
      }

      if (scannedDevice?.name && scannedDevice.serviceUUIDs?.includes(TARGET_SERVICE_UUID)) {
        console.log('Target device found:', scannedDevice.name);
        BLTManager.stopDeviceScan();
        connectDevice(scannedDevice);
      }
    });

    setTimeout(() => {
      console.log('Stopping scan after timeout');
      BLTManager.stopDeviceScan();
    }, 5000);
  }

  async function connectDevice(device: Device) {
    console.log('Connecting to Device:', device.name);
    try {
      await device.connect();
      setConnectedDevice(device);
      setIsConnected(true);
      console.log('Device connected:', device.name);

      await device.discoverAllServicesAndCharacteristics();
      console.log('Services and characteristics discovered');

      BLTManager.onDeviceDisconnected(device.id, () => {
        console.log('Device disconnected');
        setIsConnected(false);
        setConnectedDevice(null);
      });

    } catch (error) {
      console.error('Connection error:', error);
    }
  }

  async function sendCommand(command: 'pause' | 'resume') {
    if (!connectedDevice || !isConnected) {
      console.warn('No connected device or device is not connected');
      return;
    }
  
    const commandValue = command === 'pause' ? '1' : '0';
  
    try {
      console.log(`Sending ${command} command`);
      await connectedDevice.writeCharacteristicWithResponseForService(
        TARGET_SERVICE_UUID,
        TARGET_BUTTON_UUID,
        base64.encode(commandValue)
      );
      console.log(`${command} command sent successfully`);
      if (command === 'pause') {
        setButtonPressed(true);
      } else {
        setButtonPressed(false);
      }
    } catch (error) {
      console.error(`Failed to send ${command} command:`, error);
    }
  }

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 20, marginBottom: 20 }}>BLE Debugging App</Text>

      <Button title="Scan and Connect" onPress={scanAndConnect} disabled={isConnected} />
      <View style={{ marginVertical: 10 }} />

      <Button title="Pause" onPress={() => sendCommand('pause')} disabled={!isConnected || buttonPressed} />
      <View style={{ marginVertical: 10 }} />

      <Button title="Resume" onPress={() => sendCommand('resume')} disabled={!isConnected || !buttonPressed} />
    </View>
  );
}
