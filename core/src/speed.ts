import type { Units } from './types.ts';

const METERS_PER_YARD = 0.9144;

export function yardsToMeters(yards: number): number {
  return yards * METERS_PER_YARD;
}

export function speedKmh(distYards: number, timeMs: number): number {
  return (yardsToMeters(distYards) / (timeMs / 1000)) * 3.6;
}

export function speedMph(distYards: number, timeMs: number): number {
  return (yardsToMeters(distYards) / (timeMs / 1000)) * 2.23694;
}

export function speedForUnits(distYards: number, timeMs: number, units: Units): number {
  return units === 'imperial' ? speedMph(distYards, timeMs) : speedKmh(distYards, timeMs);
}

export function speedUnitLabel(units: Units): string {
  return units === 'imperial' ? 'mph' : 'km/h';
}

export function formatTime(timeMs: number): string {
  return (timeMs / 1000).toFixed(2) + 's';
}
