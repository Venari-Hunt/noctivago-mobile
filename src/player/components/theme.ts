import { StyleSheet } from 'react-native';

export const colors = {
  page: '#000',
  card: '#0d0d0d',
  raised: '#1a1a1a',
  accent: '#ffc933',
  text: '#fff',
  dim: '#bbb',
  faint: '#666',
  danger: '#ff6b6b',
};

export const shared = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page, padding: 24, paddingTop: 64, gap: 16 },
  title: { color: colors.accent, fontSize: 22, fontWeight: '700' },
  small: { color: colors.faint, fontSize: 12 },
  help: { color: colors.dim, fontSize: 15 },
  button: { backgroundColor: colors.accent, borderRadius: 12, padding: 18, alignItems: 'center' },
  buttonText: { color: '#000', fontSize: 20, fontWeight: '700' },
  error: { color: colors.danger, fontSize: 15 },
});
