import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useStore } from '../src/store';
import { t } from '../src/i18n';
import { colors, fonts, spacing, radius } from '../src/theme';

// ---------------------------------------------------------------------------
// Navigation types
// ---------------------------------------------------------------------------
type RootStackParamList = {
  Home: undefined;
  Camera: undefined;
  Result: { ms: number; distance: number };
};

type Props = NativeStackScreenProps<RootStackParamList, 'Camera'>;

// ---------------------------------------------------------------------------
// Local phase type (separate from global store phase to avoid side effects)
// ---------------------------------------------------------------------------
type LocalPhase = 'idle' | 'countdown' | 'running' | 'done';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatElapsed(ms: number): string {
  return (ms / 1000).toFixed(2);
}

/** Simple string diff: sample N characters evenly and count mismatches. */
function b64Diff(a: string, b: string): number {
  if (!a || !b) return 0;
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  const step = Math.max(1, Math.floor(len / 500));
  let diff = 0;
  let samples = 0;
  for (let i = 0; i < len; i += step) {
    if (a[i] !== b[i]) diff++;
    samples++;
  }
  return samples > 0 ? (diff / samples) * 100 : 0;
}

// Sensitivity mapping: store value (1–100) → b64 diff threshold
// Lower store sensitivity = lower threshold (more sensitive / triggers easier)
// Higher store sensitivity = higher threshold (less sensitive)
function sensitivityToThreshold(s: number): number {
  // store sensitivity range: 10–80, threshold range: 0.5–8
  return 0.5 + ((s - 10) / 70) * 7.5;
}

// ---------------------------------------------------------------------------
// CameraScreen
// ---------------------------------------------------------------------------
export default function CameraScreen({ navigation }: Props) {
  const countdownDuration = useStore((s) => s.countdownDuration);
  const sensitivity = useStore((s) => s.sensitivity);
  const distance = useStore((s) => s.distance);
  const haptics = useStore((s) => s.haptics);
  const sound = useStore((s) => s.sound);

  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<LocalPhase>('idle');
  const [countdownNum, setCountdownNum] = useState<number | null>(null);
  const [isGo, setIsGo] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [triggered, setTriggered] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const phaseRef = useRef<LocalPhase>('idle');
  const prevSnapshotRef = useRef<string | null>(null);
  const startTimeRef = useRef<number>(0);
  const detectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const maxTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consecutiveHitsRef = useRef(0);

  // Keep phaseRef in sync
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // ---------------------------------------------------------------------------
  // Permission request on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, []);

  function clearAllTimers() {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (maxTimeoutRef.current) {
      clearTimeout(maxTimeoutRef.current);
      maxTimeoutRef.current = null;
    }
    countdownTimeoutsRef.current.forEach(clearTimeout);
    countdownTimeoutsRef.current = [];
  }

  // ---------------------------------------------------------------------------
  // Audio beep via expo-av (sine-wave approximation using a short sound)
  // We use Haptics as the primary feedback since generating tones requires
  // bundled audio assets. Sound flag guards haptics too for simplicity.
  // ---------------------------------------------------------------------------
  async function playBeep(type: 'low' | 'go' | 'stop') {
    if (haptics) {
      try {
        if (type === 'go' || type === 'stop') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      } catch {
        // silently ignore haptics errors
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Countdown
  // ---------------------------------------------------------------------------
  const startCountdown = useCallback(() => {
    setPhase('countdown');
    phaseRef.current = 'countdown';
    setTriggered(false);
    prevSnapshotRef.current = null;

    const steps: Array<{ num: number | null; go: boolean; duration: number }> = [];
    for (let i = countdownDuration; i >= 1; i--) {
      steps.push({ num: i, go: false, duration: 1000 });
    }
    steps.push({ num: null, go: true, duration: 800 });

    let delay = 0;
    steps.forEach((step, idx) => {
      const t1 = setTimeout(() => {
        if (phaseRef.current !== 'countdown') return;
        setCountdownNum(step.num);
        setIsGo(step.go);
        playBeep(step.go ? 'go' : 'low');
      }, delay);
      countdownTimeoutsRef.current.push(t1);
      delay += step.duration;
    });

    // After all steps: hide countdown, start run
    const t2 = setTimeout(() => {
      if (phaseRef.current !== 'countdown') return;
      setCountdownNum(null);
      setIsGo(false);
      startRun();
    }, delay);
    countdownTimeoutsRef.current.push(t2);
  }, [countdownDuration, haptics]);

  // ---------------------------------------------------------------------------
  // Run
  // ---------------------------------------------------------------------------
  const startRun = useCallback(() => {
    setPhase('running');
    phaseRef.current = 'running';
    startTimeRef.current = Date.now();
    setElapsed(0);
    consecutiveHitsRef.current = 0;

    // Timer display update at ~60fps
    timerIntervalRef.current = setInterval(() => {
      if (phaseRef.current !== 'running') return;
      setElapsed(Date.now() - startTimeRef.current);
    }, 16);

    // Motion detection at 10fps
    detectionIntervalRef.current = setInterval(async () => {
      if (phaseRef.current !== 'running') return;
      if (!cameraRef.current) return;

      // Capture timestamp before takePictureAsync to compensate processing delay
      const frameTime = Date.now();

      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.01,
          base64: true,
          skipProcessing: true,
        });

        const b64 = photo?.base64 ?? null;
        if (!b64) return;

        const prev = prevSnapshotRef.current;
        prevSnapshotRef.current = b64;

        if (!prev) return;

        const diff = b64Diff(prev, b64);
        const threshold = sensitivityToThreshold(sensitivity);

        if (diff > threshold) {
          consecutiveHitsRef.current++;
          // Require 2 consecutive frames above threshold to avoid false positives
          if (consecutiveHitsRef.current >= 2) {
            triggerFinish(frameTime);
          }
        } else {
          consecutiveHitsRef.current = 0;
        }
      } catch {
        // camera not ready yet — skip this frame
      }
    }, 100);

    // Max timeout: auto-cancel after 60s
    maxTimeoutRef.current = setTimeout(() => {
      if (phaseRef.current !== 'running') return;
      phaseRef.current = 'done';
      clearAllTimers();
      navigation.goBack();
    }, 60_000);
  }, [sensitivity, navigation]);

  // ---------------------------------------------------------------------------
  // Finish
  // ---------------------------------------------------------------------------
  const triggerFinish = useCallback((frameTime?: number) => {
    if (phaseRef.current !== 'running') return;

    // Use frameTime (captured before takePictureAsync) for accuracy
    const finalMs = (frameTime ?? Date.now()) - startTimeRef.current;

    setPhase('done');
    phaseRef.current = 'done';
    setElapsed(finalMs);
    setTriggered(true);

    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    playBeep('stop');

    setTimeout(() => {
      navigation.navigate('Result', { ms: finalMs, distance });
    }, 800);
  }, [distance, navigation, haptics]);

  // ---------------------------------------------------------------------------
  // Cancel
  // ---------------------------------------------------------------------------
  const handleCancel = useCallback(() => {
    phaseRef.current = 'done'; // stop any active loops
    clearAllTimers();
    navigation.goBack();
  }, [navigation]);

  // ---------------------------------------------------------------------------
  // Camera ready → start countdown
  // ---------------------------------------------------------------------------
  const handleCameraReady = useCallback(() => {
    if (phaseRef.current === 'idle') {
      // Small delay to let camera stabilise
      const t = setTimeout(() => {
        if (phaseRef.current === 'idle') {
          startCountdown();
        }
      }, 500);
      countdownTimeoutsRef.current.push(t);
    }
  }, [startCountdown]);

  // ---------------------------------------------------------------------------
  // Permission states
  // ---------------------------------------------------------------------------
  if (!permission) {
    // Still loading permission status
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.centered}>
          <Text style={styles.errorText}>Checking camera permission…</Text>
        </SafeAreaView>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.centered}>
          <Text style={styles.errorText}>{t('cam_error')}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={requestPermission}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.retryBtn, styles.cancelBtnAlt]} onPress={handleCancel}>
            <Text style={styles.retryBtnText}>{t('cam_cancel')}</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const showCountdownOverlay = phase === 'countdown';
  const showRunning = phase === 'running' || phase === 'done';

  return (
    <View style={styles.root}>
      {/* Camera */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        onCameraReady={handleCameraReady}
      />

      {/* ── Top bar ── */}
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>{t('cam_cancel')}</Text>
          </TouchableOpacity>
          <View style={styles.distancePill}>
            <Text style={styles.distancePillText}>
              {t('cam_distance_label')} {distance} m
            </Text>
          </View>
        </View>

        {/* ── Detection zone indicator ── */}
        <View style={styles.zoneContainer} pointerEvents="none">
          <View style={[styles.zoneLine, triggered && styles.zoneLineTriggered]} />
          <Text style={[styles.zoneLabel, triggered && styles.zoneLabelTriggered]}>
            {t('cam_finish_line')}
          </Text>
        </View>

        {/* ── Bottom instruction / timer ── */}
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

      {/* ── Countdown overlay ── */}
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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },

  // Top bar
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
  cancelText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  distancePill: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  distancePillText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // Detection zone
  zoneContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  zoneLine: {
    width: 2,
    height: 140,
    backgroundColor: '#00E5FF',
    borderRadius: 2,
    opacity: 0.9,
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 10,
  },
  zoneLineTriggered: {
    backgroundColor: '#00E676',
    shadowColor: '#00E676',
  },
  zoneLabel: {
    color: '#00E5FF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: spacing.sm,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  zoneLabelTriggered: {
    color: '#00E676',
  },

  // Bottom area
  bottomArea: {
    alignItems: 'center',
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  instruction: {
    color: colors.text,
    fontSize: 14,
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
  timerValueDone: {
    color: '#00E676',
    textShadowColor: '#00E676',
  },
  timerUnit: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 10,
    marginLeft: 4,
  },

  // Countdown overlay
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
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginTop: spacing.md,
  },

  // Permission error
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.bg,
  },
  errorText: {
    color: colors.text,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  cancelBtnAlt: {
    backgroundColor: colors.surfaceHigh,
  },
  retryBtnText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
});
