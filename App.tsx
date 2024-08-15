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
import base64 from 'react-native-base64';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

const BLTManager = new BleManager();

const TARGET_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const TARGET_BUTTON_UUID = 'f27b53ad-c63d-49a0-8c0f-9f297e6cc520';

if (__DEV__) {
  console.log('Running in development mode');
} else {
  console.log('Running in production mode');
}

function ControlScreen({ isConnected, sendPauseCommand, sendResumeCommand, ButtonPressed }) {
  return (
    <View style={styles.container}>
      <View style={styles.rowView}>
        <Text style={styles.titleText}>VBTG CONTROL</Text>
      </View>

      <View style={styles.rowView}>
        {!ButtonPressed ? (
          <TouchableOpacity style={{ width: 120 }}>
            <Button title="Pause" onPress={sendPauseCommand} disabled={!isConnected} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={{ width: 120 }}>
            <Button title="Resume" onPress={sendResumeCommand} disabled={!isConnected} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.rowView}>
        <Text style={styles.baseText}>{ButtonPressed ? 'Paused' : 'Running'}</Text>
      </View>
    </View>
  );
}

function ConnectionScreen({ scanDevices, disconnectDevice, isConnected }) {
  return (
    <View style={styles.container}>
      <View style={styles.rowView}>
        <Button title="Connect" onPress={scanDevices} disabled={isConnected} />
      </View>

      <View style={styles.rowView}>
        <Button title="Disconnect" onPress={disconnectDevice} disabled={!isConnected} />
      </View>

      <View style={styles.rowView}>
        <Text style={styles.baseText}>{isConnected ? 'Connected' : 'Disconnected'}</Text>
      </View>
    </View>
  );
}

const Tab = createBottomTabNavigator();

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [ButtonPressed, setButtonPressed] = useState(false);

  async function scanDevices() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    console.log('Permissions status:', status);

    if (status !== 'granted') {
      console.log('Permission to access location denied');
      return;
    }

    console.log('Scanning for devices');

    BLTManager.startDeviceScan([TARGET_SERVICE_UUID], null, (error, scannedDevice) => {
      if (error) {
        console.warn('Device scan error:', error);
        return;
      }

      if (scannedDevice?.name && scannedDevice.serviceUUIDs?.includes(TARGET_SERVICE_UUID)) {
        console.log('Target device found:', scannedDevice.name);
        BLTManager.stopDeviceScan();
        connectDevice(scannedDevice);
      } else if (scannedDevice) {
        console.log('Found device:', scannedDevice.name || 'Unnamed Device');
        console.log('Service UUIDs:', scannedDevice.serviceUUIDs);
      }
    });

    setTimeout(() => {
      console.log('Stopping device scan');
      BLTManager.stopDeviceScan();
    }, 10000); // 10 seconds timeout
  }

  async function connectDevice(device: Device) {
    console.log('Connecting to Device:', device.name);

    try {
      await device.connect();
      console.log('Connected to device');
      setConnectedDevice(device);
      setIsConnected(true);

      // Discover all services and characteristics
      await device.discoverAllServicesAndCharacteristics();

      // Set up characteristic monitoring
      device.monitorCharacteristicForService(
        TARGET_SERVICE_UUID,
        TARGET_BUTTON_UUID,
        (error, characteristic) => {
          if (characteristic?.value != null) {
            setButtonPressed(base64.decode(characteristic.value) === '1');
            console.log('Button press update received:', base64.decode(characteristic.value));
          }
        },
        'buttonTransaction'
      );

      setupDisconnectionHandler(device);
    } catch (error) {
      console.error('Connection error:', error);
    }
  }

  function setupDisconnectionHandler(device: Device) {
    device.onDisconnected((error, device) => {
      if (error) {
        console.error('Device disconnected with error:', error.message);
      } else {
        console.log('Device disconnected');
      }

      setIsConnected(false);
      setConnectedDevice(null);

      // Optionally attempt to reconnect immediately
      reconnectDevice().then(isConnected => {
        if (isConnected) {
          console.log('Reconnected after disconnection');
        } else {
          console.error('Failed to reconnect after disconnection');
        }
      });
    });
  }

  async function sendPauseCommand() {
    if (connectedDevice) {
      console.log('Sending pause command');
      console.log('Connected Device ID pre pause:', connectedDevice.id);

      try {
        await connectedDevice.writeCharacteristicWithResponseForService(
          TARGET_SERVICE_UUID,
          TARGET_BUTTON_UUID,
          base64.encode('1') // Send '1' to indicate pause
        );
        setButtonPressed(true);
        console.log('Connected Device ID post pause:', connectedDevice.id);
      } catch (error) {
        console.error('Failed to send pause command:', error);
      }
    }
  }

  async function sendResumeCommand() {
    if (connectedDevice) {
      if (!connectedDevice.isConnected()) {
        console.warn('Device is not connected. Attempting to reconnect...');
        const isConnected = await reconnectDevice();
        if (!isConnected) {
          console.error('Cannot send resume command: device is not connected');
          return;
        }
      }

      try {
        console.log('Sending resume command');
        await connectedDevice.writeCharacteristicWithResponseForService(
          TARGET_SERVICE_UUID,
          TARGET_BUTTON_UUID,
          base64.encode('0') // Send '0' to indicate resume
        );
        console.log('Resume command sent successfully');
        setButtonPressed(false);
      } catch (error) {
        console.error('Failed to send resume command:', error);
      }
    } else {
      console.warn('No connected device found');
    }
  }

  async function reconnectDevice() {
    if (connectedDevice && !connectedDevice.isConnected()) {
      try {
        console.log('Reconnecting to device...');
        await connectedDevice.connect();
        console.log('Reconnection successful');
        await connectedDevice.discoverAllServicesAndCharacteristics();
      } catch (error) {
        console.error('Failed to reconnect:', error);
        return false; // Indicate that reconnection failed
      }
    }
    return true; // Indicate that the device is connected (or reconnection was successful)
  }

  async function disconnectDevice() {
    console.log('Disconnecting start');

    if (connectedDevice !== null) {
      try {
        await connectedDevice.cancelConnection();
        console.log('Device disconnected successfully');
        setIsConnected(false);
        setConnectedDevice(null);
      } catch (error) {
        if (error.errorCode === 201) {
          console.warn('Device was already disconnected or disconnected by the system.');
        } else {
          console.error('Unexpected disconnection error:', error);
        }
      }
    }
  }

  return (
    <NavigationContainer>
      <Tab.Navigator>
        <Tab.Screen name="Control">
          {() => (
            <ControlScreen
              isConnected={isConnected}
              sendPauseCommand={sendPauseCommand}
              sendResumeCommand={sendResumeCommand}
              ButtonPressed={ButtonPressed}
            />
          )}
        </Tab.Screen>
        <Tab.Screen name="Connection">
          {() => (
            <ConnectionScreen
              scanDevices={scanDevices}
              disconnectDevice={disconnectDevice}
              isConnected={isConnected}
            />
          )}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}

// Register the root component
registerRootComponent(App);
