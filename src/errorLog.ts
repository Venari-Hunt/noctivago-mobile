import { File, Paths } from 'expo-file-system';
import { appendCapped } from './player/domain/nightLog';

// Errors the app shows or crashes on, kept in app storage and printed to
// Android's log (`adb logcat | grep errorlog`), because a release build hides
// its own console output from adb. Printed again at every start, like the
// night log, so an error from before is still readable.

const file = () => new File(Paths.document, 'error-log.txt');
const MAX_LINES = 200;

/** Records one error with where it happened. Never throws. */
export function logError(where: string, e: unknown) {
  try {
    const text = e instanceof Error ? `${e.message}${e.stack ? ` | ${e.stack.split('\n').slice(0, 3).join(' < ')}` : ''}` : String(e);
    const line = `${new Date().toISOString()} ${where}: ${text}`;
    console.log(`[errorlog] ${line}`);
    const f = file();
    f.writeSync(appendCapped(f.exists ? f.textSync() : '', line, MAX_LINES));
  } catch {
    // Logging must never be the thing that fails.
  }
}

/** The saved log as text (newest last), or a note when there is none. */
export function readErrorLog(): string {
  try {
    const f = file();
    const text = f.exists ? f.textSync().trim() : '';
    return text || 'No errors logged.';
  } catch {
    return 'Could not read the error log.';
  }
}

/** Prints every saved line as `[errorlog] ...`, for `adb logcat`. */
export function printErrorLog() {
  try {
    const f = file();
    if (!f.exists) return;
    const lines = f.textSync().split('\n').filter((l) => l !== '');
    lines.forEach((l) => console.log(`[errorlog] ${l}`));
    console.log(`[errorlog] end ${lines.length}`);
  } catch {
    // Nothing to print.
  }
}

/** Logs JavaScript errors nothing caught, then lets React Native handle them as before. */
export function logUncaughtErrors() {
  const utils = (globalThis as { ErrorUtils?: { getGlobalHandler(): (e: unknown, fatal?: boolean) => void; setGlobalHandler(h: (e: unknown, fatal?: boolean) => void): void } }).ErrorUtils;
  if (!utils) return;
  const previous = utils.getGlobalHandler();
  utils.setGlobalHandler((e, fatal) => {
    logError(fatal ? 'crash' : 'uncaught', e);
    previous(e, fatal);
  });
}
