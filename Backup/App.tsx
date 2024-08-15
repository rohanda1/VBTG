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

const BLTManager = new BleManager();

const TARGET_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const TARGET_BUTTON_UUID = 'f27b53ad-c63d-49a0-8c0f-9f297e6cc520';

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

    // Stop scanning devices after 10 seconds
    
    setTimeout(() => {
      console.log('Stopping device scan');
      BLTManager.stopDeviceScan();
    }, 2000); // 2 seconds timeout
    
  }

  async function connectDevice(device: Device) {
    console.log('Connecting to Device:', device.name);
    console.log('Connecting to DeviceID', device.serviceUUIDs);
  
    try {
      await device.connect();
      console.log('Proceeding to connect device');
      setConnectedDevice(device);
      setIsConnected(true);
  
  // Add a brief delay to ensure the services are fully initialized
 //     console.log('Waiting briefly to allow services to initialize...');
 //     await new Promise(resolve => setTimeout(resolve, 1000)); // 1-second delay
  
      await device.discoverAllServicesAndCharacteristics();
      console.log('Connection established');
      setupDisconnectionHandler(device);
      // Check if the connected device has the desired service
      const services = await device.services();
      const hasTargetService = services.some(service => service.uuid === TARGET_SERVICE_UUID);
  
      if (hasTargetService) {
        console.log('Target service UUID found on device:', device.name);
  
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
      } else {
        console.warn('Connected device does not have the target service UUID');
        disconnectDevice(); // Optionally disconnect if service UUID doesn't match
      }
    } catch (error) {
      console.error('Connection error:', error);
    }
  }
  

  async function sendPauseCommand() {
    if (connectedDevice) {
      console.log('Sending pause command');
      console.log('Connected Device ID pre pause:', connectedDevice.id);

      await connectedDevice.writeCharacteristicWithResponseForService(
        TARGET_SERVICE_UUID,
        TARGET_BUTTON_UUID,
        base64.encode('1') // Send '1' to indicate pause
      );
      setButtonPressed(true);
      console.log('Connected Device ID post pause:', connectedDevice.id);
    }
  }

  async function reconnectDevice() {
    if (connectedDevice && !connectedDevice.isConnected()) {
      try {
        console.log('Reconnecting to device...');
        await connectedDevice.connect();
        console.log('Reconnection successful');
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2-second delay
        await connectedDevice.discoverAllServicesAndCharacteristics();
      } catch (error) {
        console.error('Failed to reconnect:', error);
        return false; // Indicate that reconnection failed
      }
    }
    return true; // Indicate that the device is connected (or reconnection was successful)
  }
/*  
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
*/
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
        console.log('Connected Device ID:', connectedDevice.id);
        const result = await connectedDevice.writeCharacteristicWithResponseForService(
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
/*  
  async function sendResumeCommand() {
    if (connectedDevice) {
      if (!connectedDevice.isConnected()) {
        console.warn('Device is not connected. Attempting to reconnect...');
        const isConnected = await reconnectDevice();
        if (!isConnected) {
          console.error('Cannot send resume command: failed to reconnect');
          return;
        }
      }
  
      try {
        console.log('Sending resume command');
        const result = await connectedDevice.writeCharacteristicWithResponseForService(
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
*/
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
    <View>
      <View style={{ paddingBottom: 200 }}></View>

      <View style={styles.rowView}>
        <Text style={styles.titleText}>VBTG CONTROL</Text>
      </View>

      <View style={{ paddingBottom: 20 }}></View>

      <View style={styles.rowView}>
        {!ButtonPressed ? (
          <TouchableOpacity style={{ width: 120 }}>
            {!isConnected ? (
              <Button title="Connect" onPress={scanDevices} disabled={false} />
            ) : (
              <Button title="Pause" onPress={sendPauseCommand} disabled={false} />
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={{ width: 120 }}>
            <Button title="Resume" onPress={sendResumeCommand} disabled={false} />
          </TouchableOpacity>
        )}
      </View>

      <View style={{ paddingBottom: 20 }}></View>

      <View style={styles.rowView}>
        <Text style={styles.baseText}>{ButtonPressed ? 'Paused' : 'Running'}</Text>
      </View>

      {isConnected && (
        <View style={styles.rowView}>
          <Button title="Disconnect" onPress={disconnectDevice} disabled={false} />
        </View>
      )}
    </View>
  );
}

// Register the root component
registerRootComponent(App);

export default App;