import 'expo-dev-client'; // Ensures the custom development client is used
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
import { throttle } from 'lodash'; // Import lodash throttle
import * as Progress from 'react-native-progress'; // Import the progress bar library

const BLTManager = new BleManager();

const TARGET_SERVICE_UUID_LH = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const TARGET_BUTTON_UUID_LH = 'f27b53ad-c63d-49a0-8c0f-9f297e6cc520';
const TARGET_AMPLITUDE_UUID_LH = '6d68efe5-04b6-4a85-abc4-c2670b7bf7fd';
const TARGET_BATTERY_UUID_LH = 'a8d41af6-cada-44fb-ba9a-d43c7d7a9dbe';
const TARGET_RESTART_UUID_LH = '197ca73c-4f56-4021-bb56-0885cb13f23a';

const TARGET_SERVICE_UUID_RH = 'f8f50907-0483-48e0-b3d5-838da04e71a6';
const TARGET_BUTTON_UUID_RH = '4d689fa6-af9c-4a4f-a0ca-97859622a50d';
const TARGET_AMPLITUDE_UUID_RH = 'ca50748e-5b91-4c50-8073-8c6572eaa97c';
const TARGET_BATTERY_UUID_RH = '58526da4-6c23-4428-8c21-620e012002ad';
const TARGET_RESTART_UUID_RH = '6db2e539-ba05-498a-a108-8f149e54493b';
const TARGET_SESSION_LENGTH_UUID = ''; // Define this as needed

if (__DEV__) {
  console.log('Running in development mode');
} else {
  console.log('Running in production mode');
}

function ControlScreen({
  isConnected,
  isReady,
  sendPauseCommand,
  sendResumeCommand,
  ButtonPressed,
  setAmplitude,
  batteryLevelLH,
  batteryLevelRH,
}) {
  const [amplitude, setAmplitudeValue] = useState(50); // Initialize with a default amplitude value
  const [progress, setProgress] = useState(0); // State for progress
  const sessionDuration = 120 * 60 * 1000; // 2 hours in milliseconds
  const [startTime, setStartTime] = useState<number | null>(null); // State for session start time

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (!ButtonPressed && isConnected) {
      if (!startTime) {
        setStartTime(Date.now()); // Start the session timer when the device is resumed
      }

      interval = setInterval(() => {
        if (startTime) {
          const elapsedTime = Date.now() - startTime;
          const progressPercentage = Math.min(elapsedTime / sessionDuration, 1);
          setProgress(progressPercentage);

          if (progressPercentage >= 1) {
            clearInterval(interval!);
          }
        }
      }, 1000);
    } else if (ButtonPressed) {
      if (interval) clearInterval(interval); // Stop the progress when paused
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [ButtonPressed, isConnected, startTime]);

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
        <Text>Battery Level LH: {batteryLevelLH}%</Text>
        <Text>Battery Level RH: {batteryLevelRH}%</Text>
      </View>

      <View style={{ justifyContent: 'center', alignItems: 'center', marginVertical: 20 }}>
        <Text>Session Progress</Text>
        <Progress.Bar progress={progress} width={200} />
      </View>
    </View>
  );
}

function ConnectionScreen({
  scanDevices,
  disconnectDevice,
  isConnected,
  isReady,
  sendRestartCommand,
  connectionState,
}) {
  return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <View style={{ justifyContent: 'center', alignItems: 'center', marginVertical: 20 }}>
        <Button
          title={connectionState}
          onPress={scanDevices}
          disabled={isConnected || connectionState === 'Connecting...'}
        />
      </View>

      <View style={{ justifyContent: 'center', alignItems: 'center', marginVertical: 20 }}>
        <Button title="Disconnect" onPress={disconnectDevice} disabled={!isConnected || !isReady} />
      </View>

      <View style={{ justifyContent: 'center', alignItems: 'center', marginVertical: 20 }}>
        <Button title="Restart Session" onPress={sendRestartCommand} disabled={!isConnected || !isReady} />
      </View>

      <View style={{ justifyContent: 'center', alignItems: 'center', marginVertical: 20 }}>
        <Text style={styles.baseText}>{isConnected ? 'Connected' : 'Disconnected'}</Text>
      </View>
    </View>
  );
}

const Tab = createBottomTabNavigator();

export default function App() {
  const [isConnectedLH, setIsConnectedLH] = useState(false);
  const [connectedDeviceLH, setConnectedDeviceLH] = useState<Device | null>(null);
  const [isConnectedRH, setIsConnectedRH] = useState(false);
  const [connectedDeviceRH, setConnectedDeviceRH] = useState<Device | null>(null);
  const [ButtonPressed, setButtonPressed] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [batteryLevelLH, setBatteryLevelLH] = useState<number | null>(null);
  const [batteryLevelRH, setBatteryLevelRH] = useState<number | null>(null);
  const [connectionState, setConnectionState] = useState('Connect');

  useEffect(() => {
    if (connectedDeviceLH && isReady) {
      monitorBatteryLevel('LH');
    }
    if (connectedDeviceRH && isReady) {
      monitorBatteryLevel('RH');
    }
  }, [connectedDeviceLH, connectedDeviceRH, isReady]);

  async function monitorBatteryLevel(device: 'LH' | 'RH') {
    const targetDevice = device === 'LH' ? connectedDeviceLH : connectedDeviceRH;
    const targetBatteryUUID = device === 'LH' ? TARGET_BATTERY_UUID_LH : TARGET_BATTERY_UUID_RH;

    if (targetDevice) {
      targetDevice.monitorCharacteristicForService(
        device === 'LH' ? TARGET_SERVICE_UUID_LH : TARGET_SERVICE_UUID_RH,
        device === 'LH' ? TARGET_BATTERY_UUID_LH : TARGET_BATTERY_UUID_RH,

        (error, characteristic) => {
          if (error) {
            console.error('Battery level monitoring error:', error);
            return;
          }
          if (characteristic?.value) {
            const batteryArray = base64.decode(characteristic.value);
            const battery = new Uint8Array(batteryArray)[0]; // Assuming the value is a single byte
            if (device === 'LH') {
              setBatteryLevelLH(battery);
            } else {
              setBatteryLevelRH(battery);
            }
            console.log(`Battery level ${device}:`, battery);
          }
        },
        `batteryTransaction${device}`
      );
    }
  }

  async function scanDevices() {
    setConnectionState('Connecting...');
    const { status } = await Location.requestForegroundPermissionsAsync();
    console.log('Permissions status:', status);

    if (status !== 'granted') {
      console.log('Permission to access location denied');
      setConnectionState('Connect'); // Reset to 'Connect' if permission is denied
      return;
    }

    console.log('Scanning for devices');

    // Initialize the connection promises for both devices
    const connectPromises = [];

    BLTManager.startDeviceScan([TARGET_SERVICE_UUID_LH, TARGET_SERVICE_UUID_RH], null, async (error, scannedDevice) => {
      if (error) {
        console.warn('Device scan error:', error);
        setConnectionState('Connect'); // Revert back to "Connect" if there's an error
        return;
      }

      if (scannedDevice.serviceUUIDs?.includes(TARGET_SERVICE_UUID_LH)) {
        console.log(`Target LH device found:`, scannedDevice.name);
        connectPromises.push(connectDevice(scannedDevice, 'LH'));
      } else if (scannedDevice.serviceUUIDs?.includes(TARGET_SERVICE_UUID_RH)) {
        console.log(`Target RH device found:`, scannedDevice.name);
        connectPromises.push(connectDevice(scannedDevice, 'RH'));
      } else if (scannedDevice) {
        console.log(`Found device:`, scannedDevice.name || 'Unnamed Device');
        console.log('Service UUIDs:', scannedDevice.serviceUUIDs);
      }
    });

    setTimeout(async () => {
      console.log('Stopping device scan');
      BLTManager.stopDeviceScan();

      // Wait for all connection attempts to complete
      await Promise.all(connectPromises);

      if (isConnectedLH && isConnectedRH) {
        setConnectionState('Connected');
      } else {
        setConnectionState('Connect');
        console.warn('Not all devices were successfully connected.');
      }
    }, 10000); // 10 seconds timeout
  }

  async function connectDevice(device: Device, deviceType: 'LH' | 'RH') {
    console.log(`Connecting to ${deviceType} Device:`, device.name);

    try {
      await device.connect();
      console.log(`Connected to ${deviceType} device`);

      if (deviceType === 'LH') {
        setConnectedDeviceLH(device);
        setIsConnectedLH(true);
      } else {
        setConnectedDeviceRH(device);
        setIsConnectedRH(true);
      }

      // Discover all services and characteristics
      await device.discoverAllServicesAndCharacteristics();
      console.log('Services and characteristics discovered');
      
      // After discovering services and characteristics, mark the device as ready
      setIsReady(true);

      // Set up characteristic monitoring
      device.monitorCharacteristicForService(
        deviceType === 'LH' ? TARGET_SERVICE_UUID_LH : TARGET_SERVICE_UUID_RH,
        deviceType === 'LH' ? TARGET_BUTTON_UUID_LH : TARGET_BUTTON_UUID_RH,
        (error, characteristic) => {
          if (characteristic?.value != null) {
            setButtonPressed(base64.decode(characteristic.value) === '1');
            console.log(`Button press update received for ${deviceType}:`, base64.decode(characteristic.value));
          }
        },
        `buttonTransaction${deviceType}`
      );

      setupDisconnectionHandler(device, deviceType);
    } catch (error) {
      console.error(`Connection error for ${deviceType}:`, error);
    }
  }

  function setupDisconnectionHandler(device: Device, deviceType: 'LH' | 'RH') {
    device.onDisconnected(async (error, device) => {
      if (error) {
        console.error(`${deviceType} Device disconnected with error:`, error.message);
      } else {
        console.log(`${deviceType} Device disconnected`);
      }

      if (deviceType === 'LH') {
        setIsConnectedLH(false);
        setConnectedDeviceLH(null);
      } else {
        setIsConnectedRH(false);
        setConnectedDeviceRH(null);
      }
      setConnectionState('Connect');
      setIsReady(false); // Mark the device as not ready

      // Optionally attempt to reconnect immediately
      const reconnected = await reconnectDevice(deviceType);
      if (reconnected) {
        console.log(`Reconnected ${deviceType} after disconnection`);
        setConnectionState('Connected');
      } else {
        console.error(`Failed to reconnect ${deviceType} after disconnection`);
      }
    });
  }

  async function setAmplitude(amplitude: number) {
    if ((connectedDeviceLH && connectedDeviceRH) && isReady) {
      try {
        console.log('Sending amplitude command with value:', amplitude);
        const amplitudeString = amplitude.toString();
        console.log('Encoded Amplitude:', base64.encode(amplitudeString));

        await connectedDeviceLH.writeCharacteristicWithResponseForService(
          TARGET_SERVICE_UUID_LH,
          TARGET_AMPLITUDE_UUID_LH,
          base64.encode(amplitudeString)
        );

        await connectedDeviceRH.writeCharacteristicWithResponseForService(
          TARGET_SERVICE_UUID_RH,
          TARGET_AMPLITUDE_UUID_RH,
          base64.encode(amplitudeString)
        );

        console.log('Amplitude command sent successfully to both devices');
      } catch (error) {
        console.error('Failed to send amplitude command:', error);
      }
    } else {
      console.warn('Cannot set amplitude: One or both devices are not connected or not ready');
    }
  }

  async function sendPauseCommand() {
    if ((connectedDeviceLH && connectedDeviceRH) && isReady) {
      console.log('Sending pause command');

      try {
        await connectedDeviceLH.writeCharacteristicWithResponseForService(
          TARGET_SERVICE_UUID_LH,
          TARGET_BUTTON_UUID_LH,
          base64.encode('1'), // Send '1' to indicate pause
          console.log('Pause commnand sent to LH')
        );

        await connectedDeviceRH.writeCharacteristicWithResponseForService(
          TARGET_SERVICE_UUID_RH,
          TARGET_BUTTON_UUID_RH,
          base64.encode('1'), // Send '1' to indicate pause
          console.log('Pause commnand sent to RH')
        );

        setButtonPressed(true);
      } catch (error) {
        console.error('Failed to send pause command:', error);
      }
    }
  }

  async function sendResumeCommand() {
    if ((connectedDeviceLH && connectedDeviceRH) && isReady) {
      if (!connectedDeviceLH.isConnected() || !connectedDeviceRH.isConnected()) {
        console.warn('One or both devices are not connected. Attempting to reconnect...');
        const isConnectedLH = await reconnectDevice('LH');
        const isConnectedRH = await reconnectDevice('RH');
        if (!isConnectedLH || !isConnectedRH) {
          console.error('Cannot send resume command: One or both devices are not connected');
          return;
        }
      }

      try {
        console.log('Sending resume command');
        await connectedDeviceLH.writeCharacteristicWithResponseForService(
          TARGET_SERVICE_UUID_LH,
          TARGET_BUTTON_UUID_LH,
          base64.encode('0') // Send '0' to indicate resume
        );

        await connectedDeviceRH.writeCharacteristicWithResponseForService(
          TARGET_SERVICE_UUID_RH,
          TARGET_BUTTON_UUID_RH,
          base64.encode('0') // Send '0' to indicate resume
        );

        console.log('Resume command sent successfully to both devices');
        setButtonPressed(false);
      } catch (error) {
        console.error('Failed to send resume command:', error);
      }
    } else {
      console.warn('No connected devices found or devices are not ready');
    }
  }

  async function sendRestartCommand() {
    if ((connectedDeviceLH && connectedDeviceRH) && isReady) {
      console.log('Sending restart session command');

      try {
        await connectedDeviceLH.writeCharacteristicWithResponseForService(
          TARGET_SERVICE_UUID_LH,
          TARGET_RESTART_UUID_LH,
          base64.encode('1') // Send '1' to indicate restart session
        );

        await connectedDeviceRH.writeCharacteristicWithResponseForService(
          TARGET_SERVICE_UUID_RH,
          TARGET_RESTART_UUID_RH,
          base64.encode('1') // Send '1' to indicate restart session
        );

        console.log('Restart session command sent successfully to both devices');
      } catch (error) {
        console.error('Failed to send restart session command:', error);
      }
    } else {
      console.warn('Cannot restart session: One or both devices are not connected or not ready');
    }
  }

  async function disconnectDevice(isResumed: boolean) {
    console.log('Disconnecting start');

    if (connectedDeviceLH || connectedDeviceRH) {
      try {
        if (isResumed) {
          console.log('Devices are in resumed state, sending pause command before disconnecting');
          await connectedDeviceLH?.writeCharacteristicWithResponseForService(
            TARGET_SERVICE_UUID_LH,
            TARGET_BUTTON_UUID_LH,
            base64.encode('1') // Send '1' to indicate pause
          );

          await connectedDeviceRH?.writeCharacteristicWithResponseForService(
            TARGET_SERVICE_UUID_RH,
            TARGET_BUTTON_UUID_RH,
            base64.encode('1') // Send '1' to indicate pause
          );

          setButtonPressed(true); // Update UI to reflect paused state
        }
        await connectedDeviceLH?.cancelConnection();
        await connectedDeviceRH?.cancelConnection();
        console.log('Devices disconnected successfully');

        setIsConnectedLH(false);
        setConnectedDeviceLH(null);
        setIsConnectedRH(false);
        setConnectedDeviceRH(null);
        setIsReady(false); // Mark the devices as not ready
        setConnectionState('Connect');
      } catch (error) {
        if (error.errorCode === 201) {
          console.warn('Devices were already disconnected or disconnected by the system.');
        } else {
          console.error('Unexpected disconnection error:', error);
        }
      }
    }
  }

  async function reconnectDevice(deviceType: 'LH' | 'RH') {
    const targetDevice = deviceType === 'LH' ? connectedDeviceLH : connectedDeviceRH;
    if (targetDevice && !targetDevice.isConnected()) {
      try {
        console.log(`Reconnecting to ${deviceType} device...`);
        await targetDevice.connect();
        console.log(`Reconnection successful for ${deviceType}`);
        await targetDevice.discoverAllServicesAndCharacteristics();
        setIsReady(true); // Mark the devices as ready after reconnection
        setConnectionState('Connected');
      } catch (error) {
        console.error(`Failed to reconnect ${deviceType}:`, error);
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
              isConnected={isConnectedLH && isConnectedRH}
              isReady={isReady}
              sendPauseCommand={sendPauseCommand}
              sendResumeCommand={sendResumeCommand}
              ButtonPressed={ButtonPressed}
              setAmplitude={setAmplitude}
              batteryLevelLH={batteryLevelLH}
              batteryLevelRH={batteryLevelRH}
            />
          )}
        </Tab.Screen>
        <Tab.Screen name="BLE Connection">
          {() => (
            <ConnectionScreen
              scanDevices={scanDevices}
              disconnectDevice={disconnectDevice}
              isConnected={isConnectedLH && isConnectedRH}
              isReady={isReady}
              sendRestartCommand={sendRestartCommand}
              connectionState={connectionState} // Pass the connection state to the ConnectionScreen
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
