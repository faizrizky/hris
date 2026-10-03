export const lightColors = {
  accent: "#2490EF",
  accent2: "#1B6FC9",
  accentLight: "#7FBCF7",

  bg: "#F4F7FB",
  card: "#FFFFFF",
  cardBorder: "rgba(15,23,32,0.05)",
  fieldBorder: "rgba(15,23,32,0.12)",
  panelBorder: "rgba(15,23,32,0.07)",
  hair: "rgba(15,23,32,0.06)",

  ink: "#0F1720",
  muted: "#64748B",
  mutedLabel: "#94A3B8",

  chip: "#F1F5F9",
  track: "#E2E8F0",
  unread: "#F2F8FF",

  // Permukaan gelap yang dipakai DI DALAM mode terang: header Beranda/Profil
  // dan kartu statistik PPh 21. Di mode gelap nilainya bergeser sedikit
  // supaya tidak menyatu rata dengan latar halaman.
  headerBg: "#0F1720",
  statBg: "#0F1720",

  glowTop: "rgba(36,144,239,0.55)",
  glowBottom: "rgba(27,111,201,0.45)",
  glowHeader: "rgba(36,144,239,0.4)",

  purple: { bg: "#EDE9FE", ink: "#7C3AED" },
  ok: { bg: "#DCFCE7", ink: "#16A34A" },
  warn: { bg: "#FEF3C7", ink: "#FBBF24" },
  info: { bg: "#DCEBFC", ink: "#1B6FC9" },
  bad: { bg: "#FEE2E2", ink: "#DC2626" },

  map: {
    line: "#E4EBF4",
    bg: "#F5F8FC",
    block: "#E9EFF7",
    blockBorder: "#DCE5F0",
  },

  viewfinder: {
    base: "#E8EEF6",
    stripe: "#DEE8F3",
    border: "rgba(36,144,239,0.5)",
  },

  onDark: {
    ink: "rgba(255,255,255,0.85)",
    muted: "rgba(255,255,255,0.6)",
    faint: "rgba(255,255,255,0.4)",
    surface: "rgba(255,255,255,0.1)",
    track: "rgba(255,255,255,0.14)",
    pill: "rgba(255,255,255,0.22)",
    hair: "rgba(255,255,255,0.07)",
  },
};

// Nilai diambil dari DARK_SURFACE + DARK_LIST di mockup.
export const darkColors: Palette = {
  accent: "#2490EF",
  accent2: "#1B6FC9",
  accentLight: "#7FBCF7",

  bg: "#0B1118",
  card: "#16202B",
  cardBorder: "rgba(255,255,255,0.09)",
  fieldBorder: "rgba(255,255,255,0.17)",
  panelBorder: "rgba(255,255,255,0.08)",
  hair: "rgba(255,255,255,0.08)",

  ink: "#F8FAFC",
  muted: "rgba(255,255,255,0.55)",
  mutedLabel: "rgba(255,255,255,0.4)",

  chip: "rgba(255,255,255,0.07)",
  track: "rgba(255,255,255,0.14)",
  unread: "#1B2B3D",

  headerBg: "#131D27",
  statBg: "#1D2936",

  glowTop: "rgba(36,144,239,0.55)",
  glowBottom: "rgba(27,111,201,0.45)",
  glowHeader: "rgba(36,144,239,0.4)",

  purple: { bg: "rgba(124,58,237,0.18)", ink: "#C4B5FD" },
  ok: { bg: "rgba(74,222,128,0.14)", ink: "#4ADE80" },
  warn: { bg: "rgba(251,191,36,0.14)", ink: "#FBBF24" },
  info: { bg: "rgba(36,144,239,0.16)", ink: "#7FBCF7" },
  bad: { bg: "rgba(248,113,113,0.14)", ink: "#F87171" },

  map: {
    line: "#1B2733",
    bg: "#16202B",
    block: "rgba(255,255,255,0.04)",
    blockBorder: "rgba(255,255,255,0.07)",
  },
  viewfinder: {
    base: "#1E2A36",
    stripe: "#222F3C",
    border: "rgba(127,188,247,0.45)",
  },

  onDark: {
    ink: "rgba(255,255,255,0.85)",
    muted: "rgba(255,255,255,0.6)",
    faint: "rgba(255,255,255,0.4)",
    surface: "rgba(255,255,255,0.1)",
    track: "rgba(255,255,255,0.14)",
    pill: "rgba(255,255,255,0.22)",
    hair: "rgba(255,255,255,0.07)",
  },
};

export type Palette = typeof lightColors;

export type SemanticTone = "ok" | "warn" | "info" | "bad";
