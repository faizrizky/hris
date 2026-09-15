// Diambil dari mockup Design Canvas (accent default #2490EF).
// Nanti gampang di-swap kalau HR Admin ganti warna aksen dari settings.

export const colors = {
  accent: '#2490EF',
  bg: '#F4F7FB',
  card: '#FFFFFF',
  cardBorder: 'rgba(15,23,32,0.05)',
  ink: '#0F1720',
  muted: '#64748B',
  hair: 'rgba(15,23,32,0.06)',

  ok: { bg: '#DCFCE7', ink: '#16A34A' }, // hadir / disetujui
  warn: { bg: '#FEF3C7', ink: '#B45309' }, // telat / pending
  info: { bg: '#DCEBFC', ink: '#1B6FC9' }, // izin
  bad: { bg: '#FEE2E2', ink: '#DC2626' }, // ditolak
};

export type SemanticTone = 'ok' | 'warn' | 'info' | 'bad';
