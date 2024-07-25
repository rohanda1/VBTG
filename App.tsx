import React from 'react';
import { View, Text, Button, Alert } from 'react-native';

export default function App() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Welcome to Expo</Text>
      <Button title="Press me" onPress={() => Alert.alert('Button pressed')} />
    </View>
  );
}
