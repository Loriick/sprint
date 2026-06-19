import React from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme';

const { width, height } = Dimensions.get('window');

export default function AuroraBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[colors.bg, '#1A0533', colors.bg]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(139,92,246,0.4)', 'transparent']}
        style={styles.blob}
      />
      <LinearGradient
        colors={['rgba(236,72,153,0.2)', 'transparent']}
        style={styles.blobSecondary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: (width * 0.7) / 2,
  },
  blobSecondary: {
    position: 'absolute',
    top: height * 0.3,
    left: -60,
    width: width * 0.5,
    height: width * 0.5,
    borderRadius: (width * 0.5) / 2,
  },
});
