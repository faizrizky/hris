import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { useTheme } from "@/theme/ThemeContext";
import { useT } from "@/i18n";
import {
  autentikasi,
  bacaKunci,
  jenisBiometrik,
  kunciDitahan,
  simpanKunci,
  tahanKunci,
  type PengaturanKunci,
} from "@/services/biometrik";
import type { Palette } from "@/theme/colors";

interface KunciCtx {
  pengaturan: PengaturanKunci;
  ubah: (p: PengaturanKunci) => void;
  /** Dipanggil sebelum aksi yang membuka prompt sistem (mis. kamera/biometrik) supaya tidak dianggap ke latar belakang. */
  abaikanLatar: (ms?: number) => void;
}

const Ctx = createContext<KunciCtx | null>(null);

export function useKunci(): KunciCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useKunci dipakai di luar KunciProvider");
  return c;
}

// Kunci otomatis: aplikasi terkunci saat dibuka dari nol dan saat kembali dari latar belakang setelah melewati batas
// waktu, bila pengguna mengaktifkannya dan perangkat punya biometrik terdaftar.
export function KunciProvider({ children }: { children: React.ReactNode }) {
  const { employee, setEmployee, dipulihkan } = useSession();
  const [pengaturan, setPengaturan] = useState<PengaturanKunci>({
    aktif: false,
    timeoutMs: 60_000,
  });
  const [dimuat, setDimuat] = useState(false);
  const [kunciLatar, setKunciLatar] = useState(false); // dikunci karena kembali dari latar belakang
  const [sudahBuka, setSudahBuka] = useState(false);
  const latarSejak = useRef<number | null>(null);

  useEffect(() => {
    bacaKunci().then((p) => {
      setPengaturan(p);
      setDimuat(true);
    });
  }, []);

  const ubah = useCallback((p: PengaturanKunci) => {
    setPengaturan(p);
    simpanKunci(p);
  }, []);

  const abaikanLatar = useCallback((ms = 30_000) => {
    tahanKunci(ms);
  }, []);

  // Terkunci saat aplikasi dibuka dari nol dengan sesi tersimpan, dan saat kembali dari latar belakang melewati batas waktu.
  const terkunci =
    dimuat &&
    pengaturan.aktif &&
    !!employee &&
    (kunciLatar || (dipulihkan && !sudahBuka));

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "background") {
        if (!kunciDitahan()) latarSejak.current = Date.now();
        return;
      }
      if (s === "active") {
        const sejak = latarSejak.current;
        latarSejak.current = null;
        if (
          sejak !== null &&
          pengaturan.aktif &&
          employee &&
          Date.now() - sejak >= pengaturan.timeoutMs
        )
          setKunciLatar(true);
      }
    });
    return () => sub.remove();
  }, [pengaturan, employee]);

  const nilai = useMemo(
    () => ({ pengaturan, ubah, abaikanLatar }),
    [pengaturan, ubah, abaikanLatar],
  );

  return (
    <Ctx.Provider value={nilai}>
      {children}
      {terkunci && employee ? (
        <LayarKunci
          onBuka={() => {
            setKunciLatar(false);
            setSudahBuka(true);
          }}
          onKeluar={async () => {
            await hrisApi.logout().catch(() => {});
            setKunciLatar(false);
            setSudahBuka(true);
            setEmployee(null);
          }}
          abaikanLatar={abaikanLatar}
        />
      ) : null}
    </Ctx.Provider>
  );
}

function LayarKunci({
  onBuka,
  onKeluar,
  abaikanLatar,
}: {
  onBuka: () => void;
  onKeluar: () => void;
  abaikanLatar: (ms?: number) => void;
}) {
  const t = useT();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [jenis, setJenis] = useState<"wajah" | "sidikJari" | "umum">("umum");
  const [gagal, setGagal] = useState(false);
  const sedang = useRef(false);

  const buka = useCallback(async () => {
    if (sedang.current) return;
    sedang.current = true;
    setGagal(false);
    abaikanLatar(15_000); // prompt biometrik membuat aplikasi sesaat "tidak aktif"
    const ok = await autentikasi(t("kunci.prompt"), t("kunci.batal"));
    sedang.current = false;
    if (ok) onBuka();
    else setGagal(true);
  }, [abaikanLatar, onBuka, t]);

  useEffect(() => {
    jenisBiometrik().then(setJenis);
    const id = setTimeout(buka, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ikon = jenis === "wajah" ? "scan-outline" : "finger-print-outline";
  return (
    <View
      style={[
        styles.layar,
        { paddingTop: insets.top, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <View style={styles.tengah}>
        <View style={styles.lingkar}>
          <Ionicons name={ikon} size={44} color={c.accent} />
        </View>
        <Text style={styles.judul}>{t("kunci.judul")}</Text>
        <Text style={styles.sub}>
          {gagal ? t("kunci.gagal") : t("kunci.sub")}
        </Text>
        <Pressable style={styles.tombol} onPress={buka}>
          <Text style={styles.tombolText}>{t("kunci.buka")}</Text>
        </Pressable>
      </View>
      <Pressable onPress={onKeluar} hitSlop={10}>
        <Text style={styles.keluar}>{t("kunci.keluar")}</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    layar: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: c.bg,
      alignItems: "center",
      justifyContent: "space-between",
      zIndex: 1000,
      elevation: 1000,
    },
    tengah: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
    },
    lingkar: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: c.info.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    judul: { fontSize: 20, fontWeight: "800", color: c.ink, marginTop: 22 },
    sub: {
      fontSize: 13,
      lineHeight: 20,
      color: c.muted,
      textAlign: "center",
      marginTop: 8,
      maxWidth: 280,
    },
    tombol: {
      marginTop: 28,
      backgroundColor: c.accent,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 28,
    },
    tombolText: { color: "#fff", fontSize: 14, fontWeight: "700" },
    keluar: { fontSize: 13, fontWeight: "700", color: c.muted },
  });
