import 'expo-dev-client';  // Ensures the custom development client is used
import React, { useState, useEffect, useCallback } from 'react';
import {
  TouchableOpacity,
  Button,
  View,
  Text,
} from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';
import Slider from '@react-native-community/slider';
import * as Location from 'expo-location';
import { styles } from './Styles/styles';
import { registerRootComponent } from 'expo';
import base64 from 'react-native-base64';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { throttle } from 'lodash';  // Import lodash throttle
import * as Progress from 'react-native-progress';  // Import the progress bar library

const BLTManager = new BleManager();

const TARGET_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const TARGET_BUTTON_UUID = 'f27b53ad-c63d-49a0-8c0f-9f297e6cc520';
const TARGET_AMPLITUDE_UUID = '6d68efe5-04b6-4a85-abc4-c2670b7bf7fd';
const TARGET_BATTERY_UUID = 'a8d41af6-cada-44fb-ba9a-d43c7d7a9dbe';
const TARGET_RESTART_UUID = '197ca73c-4f56-4021-bb56-0885cb13f23a';
const TARGET_SESSION_LENGTH_UUID = '';  // Define this as needed

if (__DEV__) {
  console.log('Running in development mode');
} else {
  console.log('Running in production mode');
}

function ControlScreen({ isConnected, isReady, sendPauseCommand, sendResumeCommand, ButtonPressed, setAmplitude, batteryLevel }) {
  const [amplitude, setAmplitudeValue] = useState(50); // Initialize with a default amplitude value
  const [progress, setProgress] = useState(0); // State for progress
  const sessionDuration = 120 * 60 * 1000; // 2 hours in milliseconds

  useEffect(() => {
    if (!ButtonPressed && isConnected) {
      const startTime = Date.now();

      const interval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const progressPercentage = Math.min(elapsedTime / sessionDuration, 1);
        setProgress(progressPercentage);

        if (progressPercentage >= 1) {
          clearInterval(interval);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [ButtonPressed, isConnected]);

  const throttledSetAmplitude = useCallback(
    throttle((value) => {
      if (isConnected && isReady) {
        setAmplitude(value);
      }
    }, 500), // Throttle to 500ms intervals
    [isConnected, isReady]
  );

  const handleSliderChange = (value: number) => {
    setAmplitudeValue(value);
    throttledSetAmplitude(value);
  };

  return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <View style={{ justifyContent: 'center', alignItems: 'center', marginVertical: 20 }}>
        <Text>Amplitude: {amplitude}</Text>
        <Slider
          style={{ width: 200, height: 40 }}
          minimumValue={0}
          maximumValue={100}
          step={1}
          value={amplitude}
          onValueChange={handleSliderChange}
        />
      </View>

      <View style={{ justifyContent: 'center', alignItems: 'center', marginVertical: 20 }}>
        {!ButtonPressed ? (
          <TouchableOpacity style={{ width: 120 }}>
            <Button title="Pause" onPress={sendPauseCommand} disabled={!isConnected || !isReady} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={{ width: 120 }}>
            <Button title="Resume" onPress={sendResumeCommand} disabled={!isConnected || !isReady} />
          </TouchableOpacity>
        )}
      </View>

      <View style={{ justifyContent: 'center', alignItems: 'center', marginVertical: 20 }}>
        <Text style={styles.baseText}>{ButtonPressed ? 'Paused' : 'Running'}</Text>
      </View>

      <View style={{ justifyContent: 'center', alignItems: 'center', marginVertical: 20 }}>
        <Text>Battery Level: {batteryLevel}%</Text>
      </View>

      <View style={{ justifyContent: 'center', alignItems: 'center', marginVertical: 20 }}>
        <Text>Session Progress</Text>
        <Progress.Bar progress={progress} width={200} />
      </View>
    </View>
  );
}

function ConnectionScreen({ scanDevices, disconnectDevice, isConnected, sendRestartCommand, connectedDevice, ButtonPressed }) {
  return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <View style={{ justifyContent: 'center', alignItems: 'center', marginVertical: 20 }}>
        <Button title="Connect" onPress={scanDevices} disabled={isConnected} />
      </View>

      <View style={{ justifyContent: 'center', alignItems: 'center', marginVertical: 20 }}>
        <Button title="Disconnect" onPress={() => disconnectDevice(connectedDevice, ButtonPressed)} disabled={!isConnected} />
      </View>

      <View style={{ justifyContent: 'center', alignItems: 'center', marginVertical: 20 }}>
        <Button title="Restart Session" onPress={sendRestartCommand} disabled={!isConnected} />
      </View>

      <View style={{ justifyContent: 'center', alignItems: 'center', marginVertical: 20 }}>
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
  const [isReady, setIsReady] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null); // State for battery level

  useEffect(() => {
    if (connectedDevice && isReady) {
      monitorBatteryLevel();
    }
  }, [connectedDevice, isReady]);

  async function monitorBatteryLevel() {
    if (connectedDevice) {
      connectedDevice.monitorCharacteristicForService(
        TARGET_SERVICE_UUID,
        TARGET_BATTERY_UUID,
        (error, characteristic) => {
          if (error) {
            console.error('Battery level monitoring error:', error);
            return;
          }
          if (characteristic?.value) {
            const batteryArray = base64.decode(characteristic.value);
            const battery = new Uint8Array(batteryArray)[0]; // Assuming the value is a single byte
            setBatteryLevel(battery);
            console.log('Battery level:', battery);
          }
        },
        'batteryTransaction'
      );
    }
  }

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
      console.log('Services and characteristics discovered');

      // After discovering services and characteristics, mark the device as ready
      setIsReady(true);

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
    device.onDisconnected(async (error, device) => {
      if (error) {
        console.error('Device disconnected with error:', error.message);
      } else {
        console.log('Device disconnected');
      }

      setIsConnected(false);
      setConnectedDevice(null);
      setIsReady(false); // Mark the device as not ready

      // Optionally attempt to reconnect immediately
      const reconnected = await reconnectDevice();
      if (reconnected) {
        console.log('Reconnected after disconnection');
      } else {
        console.error('Failed to reconnect after disconnection');
      }
    });
  }

  async function setAmplitude(amplitude: number) {
    if (connectedDevice && isReady) {
      try {
        console.log('Sending amplitude command with value:', amplitude);
        const amplitudeString = amplitude.toString();
        console.log('Encoded Amplitude:', base64.encode(amplitudeString));
        await connectedDevice.writeCharacteristicWithResponseForService(
          TARGET_SERVICE_UUID,
          TARGET_AMPLITUDE_UUID,
          base64.encode(amplitudeString)
        );
        console.log('Amplitude command sent successfully');
      } catch (error) {
        console.error('Failed to send amplitude command:', error);
      }
    } else {
      console.warn('Cannot set amplitude: Device not connected or not ready');
    }
  }

  async function sendPauseCommand() {
    if (connectedDevice && isReady) {
      console.log('Sending pause command');

      try {
        await connectedDevice.writeCharacteristicWithResponseForService(
          TARGET_SERVICE_UUID,
          TARGET_BUTTON_UUID,
          base64.encode('1') // Send '1' to indicate pause
        );
        setButtonPressed(true);
      } catch (error) {
        console.error('Failed to send pause command:', error);
      }
    }
  }

  async function sendResumeCommand() {
    if (connectedDevice && isReady) {
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
      console.warn('No connected device found or device is not ready');
    }
  }

  async function sendRestartCommand() {
    if (connectedDevice && isReady) {
      console.log('Sending restart session command');

      try {
        await connectedDevice.writeCharacteristicWithResponseForService(
          TARGET_SERVICE_UUID,
          TARGET_RESTART_UUID,
          base64.encode('1') // Send '1' to indicate restart session
        );
        console.log('Restart session command sent successfully');
      } catch (error) {
        console.error('Failed to send restart session command:', error);
      }
    } else {
      console.warn('Cannot restart session: Device not connected or not ready');
    }
  }

  async function disconnectDevice(isResumed: boolean) {
    console.log('Disconnecting start');

    if (connectedDevice !== null) {
      try {
        if (isResumed) {
          console.log('Device is in resumed state, sending pause command before disconnecting');
          await connectedDevice.writeCharacteristicWithResponseForService(
            TARGET_SERVICE_UUID,
            TARGET_BUTTON_UUID,
            base64.encode('1') // Send '1' to indicate pause
          );
          setButtonPressed(true); // Update UI to reflect paused state
        }
        await connectedDevice.cancelConnection();
        console.log('Device disconnected successfully');

        setIsConnected(false);
        setConnectedDevice(null);
        setIsReady(false); // Mark the device as not ready
      } catch (error) {
        if (error.errorCode === 201) {
          console.warn('Device was already disconnected or disconnected by the system.');
        } else {
          console.error('Unexpected disconnection error:', error);
        }
      }
    }
  }

  async function reconnectDevice() {
    if (connectedDevice && !connectedDevice.isConnected()) {
      try {
        console.log('Reconnecting to device...');
        await connectedDevice.connect();
        console.log('Reconnection successful');
        await connectedDevice.discoverAllServicesAndCharacteristics();
        setIsReady(true); // Mark the device as ready after reconnection
      } catch (error) {
        console.error('Failed to reconnect:', error);
        return false; // Indicate that reconnection failed
      }
    }
    return true; // Indicate that the device is connected (or reconnection was successful)
  }

  return (
    <NavigationContainer>
      <Tab.Navigator>
        <Tab.Screen name="VBTG Control">
          {() => (
            <ControlScreen
              isConnected={isConnected}
              isReady={isReady}
              sendPauseCommand={sendPauseCommand}
              sendResumeCommand={sendResumeCommand}
              ButtonPressed={ButtonPressed}
              setAmplitude={setAmplitude}
              batteryLevel={batteryLevel}
            />
          )}
        </Tab.Screen>
        <Tab.Screen name="BLE Connection">
          {() => (
            <ConnectionScreen
              scanDevices={scanDevices}
              disconnectDevice={disconnectDevice}
              isConnected={isConnected}
              sendRestartCommand={sendRestartCommand}
              connectedDevice={connectedDevice}
              ButtonPressed={ButtonPressed}
            />
          )}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}

// Register the root component
registerRootComponent(App);

export default App;
