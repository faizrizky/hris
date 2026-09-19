// Diambil dari source asli mockup Design Canvas (bukan cuma preview visual —
// nilai di bawah ini persis sama dengan CSS variable di mockup, tema "Lembut").

export const colors = {
  accent: '#2490EF', // --pri
  accent2: '#1B6FC9', // titik kedua gradient (dipakai bareng accent, contoh: linear-gradient(135deg, accent, accent2))
  accentLight: '#7FBCF7', // aksen terang, dipakai di teks highlight atas dasar gelap
  bg: '#F4F7FB', // --page-bg
  card: '#FFFFFF', // --card-bg
  cardBorder: 'rgba(15,23,32,0.05)', // --card-bd
  fieldBorder: 'rgba(15,23,32,0.12)', // --field-bd, border TextInput/kotak form
  ink: '#0F1720', // --ink, juga dipakai sebagai warna background gelap (hero login, header Beranda)
  muted: '#64748B', // --muted
  mutedLabel: '#94A3B8', // abu-abu lebih terang, buat label uppercase kecil (mis. "EMAIL", "PASSWORD")
  hair: 'rgba(15,23,32,0.06)',

  glowTop: 'rgba(36,144,239,0.55)', // radial glow kanan-atas di layar gelap (login, dst)
  glowBottom: 'rgba(27,111,201,0.45)', // radial glow kiri-bawah

  ok: { bg: '#DCFCE7', ink: '#16A34A' }, // hadir / disetujui
  warn: { bg: '#FEF3C7', ink: '#B45309' }, // telat / pending
  info: { bg: '#DCEBFC', ink: '#1B6FC9' }, // izin
  bad: { bg: '#FEE2E2', ink: '#DC2626' }, // ditolak
};

export type SemanticTone = 'ok' | 'warn' | 'info' | 'bad';
