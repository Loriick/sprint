import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCameraPermission, useFrameProcessor } from 'react-native-vision-camera';
import { useSharedValue, runOnJS } from 'react-native-worklets-core';
import { resize } from 'vision-camera-resize-plugin';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useStore } from '../src/store';
import { t } from '../src/i18n';
import { colors, fonts, spacing, radius } from '../src/theme';

type RootStackParamList = {
  Home: undefined;
  Camera: undefined;
  Result: { ms: number; distance: number };
};

type Props = NativeStackScreenProps<RootStackParamList, 'Camera'>;
type LocalPhase = 'idle' | 'countdown' | 'running' | 'done';

// ---------------------------------------------------------------------------
// Pixel diff — identique à la PWA (comparaison pixel brut)
// ---------------------------------------------------------------------------
const FRAME_W = 48;
const FRAME_H = 48;
const FRAME_LEN = FRAME_W * FRAME_H * 3; // RGB

function pixelDiff(a: Uint8Array, b: Uint8Array): number {
  let total = 0;
  for (let i = 0; i < FRAME_LEN; i++) {
    total += Math.abs(a[i] - b[i]);
  }
  // Retourne la différence moyenne par canal (0-255)
  return total / FRAME_LEN;
}

// Sensibilité store (10-80) → seuil pixel diff (5-30)
// Plus la sensibilité est basse → seuil bas → déclenche facilement
function sensitivityToThreshold(s: number): number {
  return 5 + ((s - 10) / 70) * 25;
}

function formatElapsed(ms: number): string {
  return (ms / 1000).toFixed(2);
}

// ---------------------------------------------------------------------------
// CameraScreen
// ---------------------------------------------------------------------------
export default function CameraScreen({ navigation }: Props) {
  const countdownDuration = useStore((s) => s.countdownDuration);
  const sensitivity = useStore((s) => s.sensitivity);
  const distance = useStore((s) => s.distance);
  const haptics = useStore((s) => s.haptics);

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');

  const [phase, setPhase] = useState<LocalPhase>('idle');
  const [countdownNum, setCountdownNum] = useState<number | null>(null);
  const [isGo, setIsGo] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [triggered, setTriggered] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const phaseRef = useRef<LocalPhase>('idle');
  const startTimeRef = useRef<number>(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const maxTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Shared values pour le frame processor (worklet thread)
  const prevFrame = useSharedValue<Uint8Array | null>(null);
  const isRunning = useSharedValue(false);
  const warmupCount = useSharedValue(0);
  const consecutiveHits = useSharedValue(0);
  const thresholdValue = useSharedValue(sensitivityToThreshold(sensitivity));

  useEffect(() => {
    phaseRef.current = phase;
    isRunning.value = phase === 'running';
    if (phase !== 'running') {
      warmupCount.value = 0;
      consecutiveHits.value = 0;
      prevFrame.value = null;
    }
  }, [phase]);

  useEffect(() => {
    thresholdValue.value = sensitivityToThreshold(sensitivity);
  }, [sensitivity]);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, []);

  function clearAllTimers() {
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
    if (maxTimeoutRef.current) { clearTimeout(maxTimeoutRef.current); maxTimeoutRef.current = null; }
    countdownTimeoutsRef.current.forEach(clearTimeout);
    countdownTimeoutsRef.current = [];
  }

  useEffect(() => () => clearAllTimers(), []);

  async function playBeep(type: 'low' | 'go' | 'stop') {
    if (!haptics) return;
    try {
      if (type === 'go' || type === 'stop') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch { /* ignore */ }
  }

  // ---------------------------------------------------------------------------
  // Appelé depuis le worklet quand le mouvement est détecté
  // ---------------------------------------------------------------------------
  const onMotionDetected = useCallback((frameTime: number) => {
    if (phaseRef.current !== 'running') return;
    const finalMs = frameTime - startTimeRef.current;

    phaseRef.current = 'done';
    setPhase('done');
    setElapsed(finalMs);
    setTriggered(true);

    clearAllTimers();
    playBeep('stop');

    setTimeout(() => {
      navigation.navigate('Result', { ms: finalMs, distance });
    }, 800);
  }, [distance, navigation]);

  // ---------------------------------------------------------------------------
  // Frame processor — tourne sur le thread caméra, accès pixels bruts
  // ---------------------------------------------------------------------------
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    if (!isRunning.value) return;

    const now = Date.now();

    const resized = resize(frame, {
      scale: { width: FRAME_W, height: FRAME_H },
      pixelFormat: 'rgb',
      dataType: 'uint8',
    });

    const current = new Uint8Array(resized.buffer);

    // Warmup : 10 frames (~330ms) pour stabiliser l'exposition
    warmupCount.value += 1;
    if (warmupCount.value <= 10) {
      prevFrame.value = current;
      return;
    }

    const prev = prevFrame.value;
    prevFrame.value = current;
    if (!prev) return;

    // Pixel diff réel (comme canvas getImageData dans la PWA)
    let total = 0;
    for (let i = 0; i < FRAME_LEN; i++) {
      total += Math.abs(current[i] - prev[i]);
    }
    const avgDiff = total / FRAME_LEN;

    if (avgDiff > thresholdValue.value) {
      consecutiveHits.value += 1;
      if (consecutiveHits.value >= 2) {
        runOnJS(onMotionDetected)(now);
      }
    } else {
      consecutiveHits.value = 0;
    }
  }, [isRunning, prevFrame, warmupCount, consecutiveHits, thresholdValue, onMotionDetected]);

  // ---------------------------------------------------------------------------
  // Countdown
  // ---------------------------------------------------------------------------
  const startCountdown = useCallback(() => {
    setPhase('countdown');
    phaseRef.current = 'countdown';
    setTriggered(false);

    const steps: Array<{ num: number | null; go: boolean; duration: number }> = [];
    for (let i = countdownDuration; i >= 1; i--) {
      steps.push({ num: i, go: false, duration: 1000 });
    }
    steps.push({ num: null, go: true, duration: 800 });

    let delay = 0;
    steps.forEach((step) => {
      const t1 = setTimeout(() => {
        if (phaseRef.current !== 'countdown') return;
        setCountdownNum(step.num);
        setIsGo(step.go);
        playBeep(step.go ? 'go' : 'low');
      }, delay);
      countdownTimeoutsRef.current.push(t1);
      delay += step.duration;
    });

    const t2 = setTimeout(() => {
      if (phaseRef.current !== 'countdown') return;
      setCountdownNum(null);
      setIsGo(false);
      startRun();
    }, delay);
    countdownTimeoutsRef.current.push(t2);
  }, [countdownDuration, haptics]);

  const startRun = useCallback(() => {
    setPhase('running');
    phaseRef.current = 'running';
    startTimeRef.current = Date.now();
    setElapsed(0);

    timerIntervalRef.current = setInterval(() => {
      if (phaseRef.current !== 'running') return;
      setElapsed(Date.now() - startTimeRef.current);
    }, 16);

    maxTimeoutRef.current = setTimeout(() => {
      if (phaseRef.current !== 'running') return;
      phaseRef.current = 'done';
      clearAllTimers();
      navigation.goBack();
    }, 60_000);
  }, [navigation]);

  const handleCancel = useCallback(() => {
    phaseRef.current = 'done';
    clearAllTimers();
    navigation.goBack();
  }, [navigation]);

  const handleCameraReady = useCallback(() => {
    setIsReady(true);
    if (phaseRef.current === 'idle') {
      const t = setTimeout(() => {
        if (phaseRef.current === 'idle') startCountdown();
      }, 500);
      countdownTimeoutsRef.current.push(t);
    }
  }, [startCountdown]);

  // ---------------------------------------------------------------------------
  // Permission / device
  // ---------------------------------------------------------------------------
  if (!hasPermission) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.centered}>
          <Text style={styles.errorText}>{t('cam_error')}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={requestPermission}>
            <Text style={styles.retryBtnText}>Autoriser</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.retryBtn, styles.cancelBtnAlt]} onPress={handleCancel}>
            <Text style={styles.retryBtnText}>{t('cam_cancel')}</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.centered}>
          <Text style={styles.errorText}>Caméra indisponible</Text>
          <TouchableOpacity style={[styles.retryBtn, styles.cancelBtnAlt]} onPress={handleCancel}>
            <Text style={styles.retryBtnText}>{t('cam_cancel')}</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  const showCountdownOverlay = phase === 'countdown';
  const showRunning = phase === 'running' || phase === 'done';

  return (
    <View style={styles.root}>
      <Camera
        device={device}
        isActive={true}
        style={StyleSheet.absoluteFill}
        frameProcessor={frameProcessor}
        onInitialized={handleCameraReady}
      />

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>{t('cam_cancel')}</Text>
          </TouchableOpacity>
          <View style={styles.distancePill}>
            <Text style={styles.distancePillText}>{distance} m</Text>
          </View>
        </View>

        {/* Zone indicator */}
        <View style={styles.zoneContainer} pointerEvents="none">
          <View style={[styles.zoneLine, triggered && styles.zoneLineTriggered]} />
          <Text style={[styles.zoneLabel, triggered && styles.zoneLabelTriggered]}>
            {t('cam_finish_line')}
          </Text>
        </View>

        {/* Timer */}
        <View style={styles.bottomArea}>
          {showRunning ? (
            <View style={styles.timerContainer}>
              <Text style={[styles.timerValue, triggered && styles.timerValueDone]}>
                {formatElapsed(elapsed)}
              </Text>
              <Text style={styles.timerUnit}>s</Text>
            </View>
          ) : phase === 'idle' ? (
            <Text style={styles.instruction}>{t('cam_instruction')}</Text>
          ) : null}
        </View>
      </SafeAreaView>

      {/* Countdown overlay */}
      {showCountdownOverlay && (
        <View style={styles.countdownOverlay} pointerEvents="none">
          {isGo ? (
            <>
              <Text style={[styles.countdownNumber, styles.countdownGo]}>GO!</Text>
              <Text style={styles.countdownLabel}>{t('cam_go_label')}</Text>
            </>
          ) : countdownNum !== null ? (
            <>
              <Text style={styles.countdownNumber}>{countdownNum}</Text>
              <Text style={styles.countdownLabel}>{t('cam_get_ready')}</Text>
            </>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1, justifyContent: 'space-between' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  cancelBtn: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  cancelText: { color: colors.text, fontSize: 14, fontFamily: fonts.semiBold },
  distancePill: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  distancePillText: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.bold },

  zoneContainer: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  zoneLine: {
    width: 2,
    height: 140,
    backgroundColor: '#00E5FF',
    borderRadius: 2,
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 10,
  },
  zoneLineTriggered: { backgroundColor: '#00E676', shadowColor: '#00E676' },
  zoneLabel: {
    color: '#00E5FF',
    fontSize: 10,
    fontFamily: fonts.bold,
    letterSpacing: 2,
    marginTop: spacing.sm,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  zoneLabelTriggered: { color: '#00E676' },

  bottomArea: { alignItems: 'center', paddingBottom: spacing.xl, paddingHorizontal: spacing.lg },
  instruction: {
    color: colors.text,
    fontSize: 14,
    fontFamily: fonts.regular,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(3,3,8,0.7)',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.25)',
  },
  timerValue: {
    color: '#FFFFFF',
    fontSize: 64,
    fontFamily: fonts.black,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
    textShadowColor: '#00E5FF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  timerValueDone: { color: '#00E676', textShadowColor: '#00E676' },
  timerUnit: { color: 'rgba(255,255,255,0.5)', fontSize: 24, fontFamily: fonts.semiBold, marginBottom: 10, marginLeft: 4 },

  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3,3,8,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownNumber: {
    color: '#FFFFFF',
    fontSize: 144,
    fontFamily: fonts.black,
    letterSpacing: -4,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  countdownGo: {
    color: '#00E5FF',
    textShadowColor: '#00E5FF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 36,
  },
  countdownLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontFamily: fonts.bold,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginTop: spacing.md,
  },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, backgroundColor: colors.bg },
  errorText: { color: colors.text, fontSize: 16, fontFamily: fonts.regular, textAlign: 'center', marginBottom: spacing.lg },
  retryBtn: { backgroundColor: colors.accent, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md, marginBottom: spacing.md },
  cancelBtnAlt: { backgroundColor: colors.surfaceHigh },
  retryBtnText: { color: colors.onAccent, fontSize: 15, fontFamily: fonts.bold },
});
