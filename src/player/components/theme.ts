import { StyleSheet } from 'react-native';

// Dark gray surfaces, never pure black; a lighter surface sits higher
// (docs/design-practices.md C6). Text is at least 4.5:1 on every surface
// (faint 5.5:1 on raised), outlines and empty tracks at least 3:1 on page and cards.
export const colors = {
  page: '#121212',
  card: '#1e1e1e',
  raised: '#2c2c2c',
  accent: '#ffc933',
  text: '#fff',
  dim: '#c8c8c8',
  faint: '#a3a3a3',
  /** Outlines of controls: 3.9:1 on cards. */
  line: '#7a7a7a',
  /** The empty part of a level bar: 3.3:1 on cards. */
  track: '#6e6e6e',
  danger: '#ff6b6b',
};

export const shared = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page, padding: 24, paddingTop: 64, gap: 16 },
  title: { color: colors.accent, fontSize: 22, fontWeight: '700' },
  small: { color: colors.faint, fontSize: 12 },
  help: { color: colors.dim, fontSize: 15 },
  button: { backgroundColor: colors.accent, borderRadius: 12, padding: 18, alignItems: 'center' },
  buttonText: { color: '#000', fontSize: 20, fontWeight: '700' },
  /** The outlined button next to or under a main one. */
  secondary: { borderColor: colors.accent, borderWidth: 1, borderRadius: 12, padding: 14, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.accent, fontSize: 17, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 15 },
});
