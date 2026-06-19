import React from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function AuroraBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Base dark */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#030308' }]} />

      {/* Cyan orb — top right */}
      <LinearGradient
        colors={['rgba(0,229,255,0.22)', 'transparent']}
        style={styles.orbCyan}
      />

      {/* Purple orb — top left */}
      <LinearGradient
        colors={['rgba(98,0,255,0.25)', 'transparent']}
        style={styles.orbPurple}
      />

      {/* Pink orb — bottom center */}
      <LinearGradient
        colors={['rgba(255,64,129,0.18)', 'transparent']}
        style={styles.orbPink}
      />
    </View>
  );
}

const ORB = width * 0.85;

const styles = StyleSheet.create({
  orbCyan: {
    position: 'absolute',
    top: -ORB * 0.3,
    right: -ORB * 0.25,
    width: ORB,
    height: ORB,
    borderRadius: ORB / 2,
  },
  orbPurple: {
    position: 'absolute',
    top: -ORB * 0.1,
    left: -ORB * 0.3,
    width: ORB * 0.9,
    height: ORB * 0.9,
    borderRadius: (ORB * 0.9) / 2,
  },
  orbPink: {
    position: 'absolute',
    bottom: height * 0.05,
    left: width * 0.1,
    width: ORB * 0.75,
    height: ORB * 0.75,
    borderRadius: (ORB * 0.75) / 2,
  },
});
