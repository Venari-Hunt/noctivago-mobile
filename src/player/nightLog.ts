import * as Battery from 'expo-battery';
import { File, Paths } from 'expo-file-system';
import { appendCapped, type NightEntry } from './domain/nightLog';

// Saves night log entries (domain/nightLog.ts) to app storage, and prints the
// saved log to Android's log so adb can read it back from a release build.

const file = () => new File(Paths.document, 'night-log.jsonl');

type Fields = Omit<NightEntry, 'wallMs' | 'battery' | 'charging' | 'jsHeapMb'>;

export async function recordNight(fields: Fields) {
  try {
    const [level, state] = await Promise.all([Battery.getBatteryLevelAsync(), Battery.getBatteryStateAsync()]);
    const entry: NightEntry = {
      ...fields,
      wallMs: Date.now(),
      battery: level >= 0 ? level : null,
      charging: state === Battery.BatteryState.UNKNOWN ? null : state !== Battery.BatteryState.UNPLUGGED,
      jsHeapMb: jsHeapMb(),
    };
    const f = file();
    f.writeSync(appendCapped(f.exists ? f.textSync() : '', JSON.stringify(entry)));
  } catch (e) {
    console.warn('[nightlog] could not save', e);
  }
}

/** Prints every saved line as `[nightlog] {...}`, for `adb logcat`. */
export function printNightLog() {
  try {
    const f = file();
    if (!f.exists) return;
    const lines = f.textSync().split('\n').filter((l) => l !== '');
    lines.forEach((l) => console.log(`[nightlog] ${l}`));
    console.log(`[nightlog] end ${lines.length}`);
  } catch (e) {
    console.warn('[nightlog] could not read', e);
  }
}

function jsHeapMb(): number | null {
  const stats = (globalThis as { HermesInternal?: { getInstrumentedStats?: () => Record<string, number> } })
    .HermesInternal?.getInstrumentedStats?.();
  const bytes = stats?.js_heapSize;
  return typeof bytes === 'number' ? Math.round(bytes / 1e5) / 10 : null;
}
