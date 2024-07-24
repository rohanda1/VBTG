import React, { useState } from 'react';
import { TouchableOpacity, Button, View, Text } from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';
import { LogBox } from 'react-native';
import * as Permissions from 'expo-permissions';

LogBox.ignoreAllLogs();

const BLTManager = new BleManager();
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const BUTTON_UUID = 'f27b53ad-c63d-49a0-8c0f-9f297e6cc520';

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [buttonPressed, setButtonPressed] = useState(false);

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

    setTimeout(() => {
      BLTManager.stopDeviceScan();
    }, 5000);
  }

  async function disconnectDevice() {
    if (connectedDevice) {
      try {
        await connectedDevice.cancelConnection();
        setIsConnected(false);
        setConnectedDevice(null);
      } catch (error) {
        console.error('Error disconnecting:', error);
      }
    }
  }

  async function connectDevice(device: Device) {
    device.connect()
      .then(device => {
        setConnectedDevice(device);
        setIsConnected(true);
        return device.discoverAllServicesAndCharacteristics();
      })
      .then(device => {
        BLTManager.onDeviceDisconnected(device.id, (error, device) => {
          setIsConnected(false);
        });

        device.monitorCharacteristicForService(
          SERVICE_UUID,
          BUTTON_UUID,
          (error, characteristic) => {
            if (characteristic?.value != null) {
              setButtonPressed(base64.decode(characteristic.value) === '1');
            }
          },
          'buttonTransaction'
        );
      })
      .catch(error => {
        console.error('Connection error:', error);
      });
  }

  return (
    <View>
      <View style={{ paddingBottom: 200 }}></View>
      <View style={{ paddingBottom: 20 }}></View>
      <View style={{ paddingBottom: 20 }}></View>
      <View style={{ paddingBottom: 20 }}></View>
      <View style={{ paddingBottom: 20 }}></View>

      <View style={{ paddingBottom: 20 }}>
        <TouchableOpacity style={{ width: 120 }}>
          {!isConnected ? (
            <Button title="Connect" onPress={scanDevices} disabled={false} />
          ) : (
            <Button title="Disconnect" onPress={disconnectDevice} disabled={false} />
          )}
        </TouchableOpacity>
      </View>

      <View style={{ paddingBottom: 20 }}></View>

      <View style={{ paddingBottom: 20 }}>
        <Text>{buttonPressed ? 'Button Pressed' : 'Button Not Pressed'}</Text>
      </View>
    </View>
  );
}
