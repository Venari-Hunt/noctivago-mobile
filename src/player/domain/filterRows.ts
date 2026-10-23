// The filter sliders a Sound Group and a single sound both show: labels,
// how a value reads, and the step. Pure, so `npm test` can load it.
import type { FilterField } from './groupEdit.ts';

export const hz = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v % 1000 ? 1 : 0)} kHz` : `${v} Hz`);
export const FILTER_ROWS: { field: FilterField; label: string; text: (v: number) => string; step?: number }[] = [
  { field: 'highpassHz', label: 'High-pass (cuts lows)', text: (v) => (v > 0 ? hz(v) : 'Off') },
  { field: 'lowpassHz', label: 'Low-pass (cuts highs)', text: (v) => (v < 20000 ? hz(v) : 'Off') },
  { field: 'echoDelayMs', label: 'Echo delay', text: (v) => (v > 0 ? `${v} ms` : 'Off'), step: 10 },
  { field: 'echoDecay', label: 'Echo decay', text: (v) => (v > 0 ? v.toFixed(2) : 'Off'), step: 0.01 },
];
export const isHz = (f: FilterField): f is 'highpassHz' | 'lowpassHz' => f === 'highpassHz' || f === 'lowpassHz';
export const gainText = (v: number) => (v === 0 ? '0 dB (as is)' : `${v > 0 ? '+' : ''}${v} dB`);
