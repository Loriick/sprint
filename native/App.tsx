import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useStore } from './src/store';
import HomeScreen from './screens/HomeScreen';
import { colors } from './src/theme';

export type RootStackParamList = {
  Home: undefined;
  Camera: undefined;
  Result: undefined;
  History: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bg,
  },
};

export default function App() {
  const loadPersistedSettings = useStore((s) => s.loadPersistedSettings);

  useEffect(() => {
    loadPersistedSettings();
  }, [loadPersistedSettings]);

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        {/* Camera, Result, History, Settings screens to be implemented */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
