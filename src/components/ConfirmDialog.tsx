import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Palette, SemanticTone } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { tt } from "@/i18n";

// Ukuran dan waktu diukur frame per frame dari video referensi.
const MARGIN = 14; // jarak kartu ke tepi layar
const RADIUS = 36; // sudut kartu
const PAD = 22; // jarak tombol ke tepi kartu
const BTN_H = 48;
const BTN_GAP = 14;
const GAP_BTN = 24; // jarak teks terakhir ke tombol
const BACKDROP = "rgba(15,23,32,0.3)";

export interface ConfirmOptions {
  title: string;
  message: string;
  tone?: SemanticTone;
  confirmText?: string;
  cancelText?: string | null; // null = hanya satu tombol
  // Tombol pemicu. Dialog akan "tumbuh" dari tombol ini seperti di video.
  // Tanpa from, dialog tumbuh dari tombol lebar di bawah layar.
  from?: React.RefObject<View | null>;
  fromColor?: string; // warna latar tombol pemicu
  fromTextColor?: string;
  fromLabel?: string; // teks tombol pemicu, memudar ke confirmText
  fromRadius?: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}

interface Req extends ConfirmOptions {
  origin: Rect | null;
  key: number;
}

const IKON: Record<SemanticTone, keyof typeof Ionicons.glyphMap> = {
  bad: "alert-circle-outline",
  warn: "warning-outline",
  info: "information-circle-outline",
  ok: "checkmark-circle-outline",
};

function ConfirmDialog({
  req,
  onDone,
}: {
  req: Req;
  onDone: (ok: boolean) => void;
}) {
  const {
    title,
    message,
    tone = "info",
    confirmText = tt("umum.lanjut"),
    cancelText = tt("umum.batal"),
  } = req;
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();

  const [p] = useState(() => new Animated.Value(0)); // 0 = tombol, 1 = kartu
  const [cancelA] = useState(() => new Animated.Value(0));
  const [contentH, setContentH] = useState<number | null>(null);
  const menutup = useRef(false);

  const warna = c[tone];
  const warnaUtama = tone === "bad" ? c.bad.ink : c.accent;
  const duaTombol = cancelText !== null;

  // Posisi akhir, semuanya dalam koordinat layar.
  const cardW = W - MARGIN * 2;
  const cardH = (contentH ?? 0) + GAP_BTN + BTN_H + PAD;
  const cardX = MARGIN;
  const cardY = H - Math.max(insets.bottom, MARGIN) - cardH;
  const btnW = duaTombol ? (cardW - PAD * 2 - BTN_GAP) / 2 : cardW - PAD * 2;
  const btnY = cardY + cardH - PAD - BTN_H;
  const akhirKonfirmasi: Rect = {
    x: cardX + cardW - PAD - btnW,
    y: btnY,
    w: btnW,
    h: BTN_H,
    r: BTN_H / 2,
  };
  // Dengan tombol pemicu, kartu "tumbuh" dari tombol itu (seperti Keluar).
  // Tanpa pemicu, kartu utuh meluncur naik dari bawah sambil memudar.
  const morph = req.origin !== null;
  const kartuAkhir: Rect = {
    x: cardX,
    y: cardY,
    w: cardW,
    h: cardH,
    r: RADIUS,
  };
  const asalKartu: Rect = req.origin ?? kartuAkhir;
  const asalTombol: Rect = req.origin ?? akhirKonfirmasi;

  // Buka setelah tinggi isi diketahui.
  useEffect(() => {
    if (contentH === null) return;
    Animated.parallel([
      morph
        ? Animated.spring(p, {
            toValue: 1,
            stiffness: 1089,
            damping: 66,
            mass: 1,
            overshootClamping: true,
            useNativeDriver: false,
          })
        : Animated.timing(p, {
            toValue: 1,
            duration: 340,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }),
      Animated.timing(cancelA, {
        toValue: 1,
        delay: 80,
        duration: 180,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    ]).start();
  }, [contentH, p, cancelA, morph]);

  const tutup = (ok: boolean) => {
    if (menutup.current) return;
    menutup.current = true;
    Animated.parallel([
      Animated.timing(p, {
        toValue: 0,
        duration: morph ? 140 : 240,
        easing: morph ? Easing.inOut(Easing.sin) : Easing.in(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(cancelA, {
        toValue: 0,
        duration: 70,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    ]).start(() => onDone(ok));
  };

  const antara = (a: number, b: number) =>
    p.interpolate({ inputRange: [0, 1], outputRange: [a, b] });

  const kotak = (dari: Rect, ke: Rect) => ({
    left: antara(dari.x, ke.x),
    top: antara(dari.y, ke.y),
    width: antara(dari.w, ke.w),
    height: antara(dari.h, ke.h),
    borderRadius: antara(dari.r, ke.r),
  });

  const opasitasIsi = morph
    ? p.interpolate({
        inputRange: [0, 0.9],
        outputRange: [0, 1],
        extrapolate: "clamp",
      })
    : 1;
  // Mode luncur: seluruh kartu dan tombolnya bergerak bersama dari bawah.
  const luncur = morph
    ? null
    : {
        opacity: p.interpolate({
          inputRange: [0, 0.4, 1],
          outputRange: [0, 1, 1],
        }),
        transform: [
          {
            translateY: p.interpolate({
              inputRange: [0, 1],
              outputRange: [cardH * 0.6 + 40, 0],
            }),
          },
          {
            scale: p.interpolate({
              inputRange: [0, 1],
              outputRange: [0.96, 1],
            }),
          },
        ],
      };
  const opasitasLatar = p.interpolate({
    inputRange: [0, 0.8, 1],
    outputRange: [0, 0.93, 1],
  });

  const labelAsal = req.fromLabel ?? confirmText;
  const gantiLabel = labelAsal !== confirmText;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => tutup(false)}
    >
      <Animated.View style={[styles.latar, { opacity: opasitasLatar }]}>
        <Pressable style={{ flex: 1 }} onPress={() => tutup(false)} />
      </Animated.View>

      <Animated.View
        pointerEvents="box-none"
        style={[StyleSheet.absoluteFill, luncur]}
      >
        {/* Kartu: tumbuh dari kotak tombol pemicu ke kotak kartu. */}
        <Animated.View style={[styles.kartu, kotak(asalKartu, kartuAkhir)]}>
          <Animated.View
            style={[styles.isi, { width: cardW, opacity: opasitasIsi }]}
            onLayout={(e) => {
              if (contentH === null) setContentH(e.nativeEvent.layout.height);
            }}
          >
            <View style={styles.ikon}>
              <Ionicons name={IKON[tone]} size={44} color={warna.ink} />
            </View>
            <Text style={styles.judul}>{title}</Text>
            <Text style={styles.teks}>{message}</Text>

            <Pressable
              hitSlop={8}
              onPress={() => tutup(false)}
              style={styles.tutup}
            >
              <Ionicons name="close" size={22} color={c.mutedLabel} />
            </Pressable>
          </Animated.View>
        </Animated.View>

        {duaTombol && (
          <Animated.View
            style={[
              styles.tombol,
              {
                left: cardX + PAD,
                top: btnY,
                width: btnW,
                backgroundColor: c.chip,
                opacity: morph ? cancelA : 1,
              },
            ]}
          >
            <Pressable style={styles.isiTombol} onPress={() => tutup(false)}>
              <Text style={[styles.labelTombol, { color: c.ink }]}>
                {cancelText}
              </Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Tombol konfirmasi: tombol pemicu yang menyusut ke posisinya. */}
        <Animated.View
          style={[
            styles.tombolMorph,
            kotak(asalTombol, akhirKonfirmasi),
            {
              backgroundColor: p.interpolate({
                inputRange: [0, 1],
                outputRange: [req.fromColor ?? warnaUtama, warnaUtama],
              }),
            },
          ]}
        >
          <Pressable style={styles.isiTombol} onPress={() => tutup(true)}>
            {gantiLabel && (
              <Animated.Text
                numberOfLines={1}
                style={[
                  styles.labelTombol,
                  styles.labelTumpuk,
                  {
                    color: req.fromTextColor ?? "#FFFFFF",
                    opacity: p.interpolate({
                      inputRange: [0, 0.5],
                      outputRange: [1, 0],
                      extrapolate: "clamp",
                    }),
                  },
                ]}
              >
                {labelAsal}
              </Animated.Text>
            )}
            <Animated.Text
              numberOfLines={1}
              style={[
                styles.labelTombol,
                {
                  color: "#FFFFFF",
                  opacity: gantiLabel
                    ? p.interpolate({
                        inputRange: [0.3, 0.8],
                        outputRange: [0, 1],
                        extrapolate: "clamp",
                      })
                    : 1,
                },
              ]}
            >
              {confirmText}
            </Animated.Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Provider + hook: await confirm({...}) mengembalikan true bila dikonfirmasi.
// ---------------------------------------------------------------------------

type ConfirmFn = (o: ConfirmOptions) => Promise<boolean>;
const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [req, setReq] = useState<Req | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (o) =>
      new Promise<boolean>((resolve) => {
        resolver.current?.(false); // dialog sebelumnya dianggap batal
        resolver.current = resolve;
        const node = o.from?.current;
        if (!node) {
          setReq({ ...o, origin: null, key: Date.now() });
          return;
        }
        node.measureInWindow((x, y, w, h) =>
          setReq({
            ...o,
            origin: { x, y, w, h, r: Math.min(o.fromRadius ?? h / 2, h / 2) },
            key: Date.now(),
          }),
        );
      }),
    [],
  );

  // Dipanggil setelah animasi tutup selesai, supaya aksi lanjutan
  // (mis. logout) berjalan setelah dialog kembali ke tombolnya.
  const selesai = (ok: boolean) => {
    setReq(null);
    resolver.current?.(ok);
    resolver.current = null;
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {req && <ConfirmDialog key={req.key} req={req} onDone={selesai} />}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    latar: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: BACKDROP,
    },
    kartu: {
      position: "absolute",
      backgroundColor: c.card,
      overflow: "hidden",
    },
    // Isi menempel ke tepi atas kartu, jadi ikut naik saat kartu tumbuh.
    isi: {
      position: "absolute",
      top: 0,
      left: 0,
      paddingTop: 34,
      paddingHorizontal: 32,
    },
    ikon: { width: 44, height: 44, margin: -4 },

    tutup: {
      position: "absolute",
      top: 28,
      right: 27,
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    judul: {
      fontSize: 19,
      lineHeight: 24,
      fontWeight: "700",
      color: c.ink,
      marginTop: 20,
    },
    teks: {
      fontSize: 15,
      lineHeight: 23,
      fontWeight: "400",
      color: c.muted,
      marginTop: 12,
    },
    tombol: {
      position: "absolute",
      height: BTN_H,
      borderRadius: BTN_H / 2,
    },
    tombolMorph: { position: "absolute", overflow: "hidden" },
    isiTombol: { flex: 1, alignItems: "center", justifyContent: "center" },
    labelTombol: { fontSize: 15.5, fontWeight: "600" },
    labelTumpuk: { position: "absolute" },
  });
