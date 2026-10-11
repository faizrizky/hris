import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LineIcon } from "@/components/LineIcon";
import { useConfirm } from "@/components/ConfirmDialog";
import { ICON } from "@/constants/icons";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { useT } from "@/i18n";
import { adalahGambar, bukaLampiran, simpanLampiran } from "@/utils/lampiran";

// Pratinjau satu dokumen: gambar ditampilkan langsung, PDF/lainnya lewat
// pratinjau sistem. Dipakai layar verifikasi HR dan layar dokumen karyawan.
export function DocPreview({
  fileUrl,
  fileName,
  name,
  ext,
}: {
  fileUrl: string | null | undefined;
  fileName: string | null | undefined;
  name: string;
  ext: string;
}) {
  const t = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const confirm = useConfirm();
  const gambar = !!fileUrl && adalahGambar(fileUrl);
  const [uri, setUri] = useState<string | null>(null);
  const [gagal, setGagal] = useState(false);

  // Gambar diunduh dengan sesi aplikasi lalu ditampilkan dari cache lokal.
  useEffect(() => {
    if (!gambar || !fileUrl) return;
    let batal = false;
    simpanLampiran(fileUrl, fileName ?? name)
      .then((u) => !batal && setUri(u))
      .catch(() => !batal && setGagal(true));
    return () => {
      batal = true;
    };
  }, [gambar, fileUrl, fileName, name]);

  const buka = async () => {
    if (!fileUrl) return;
    try {
      if (!(await bukaLampiran(fileUrl, fileName ?? name)))
        throw new Error("unavailable");
    } catch {
      void confirm({
        title: t("lamp.gagalJudul"),
        message: t("lamp.gagalPesan"),
        tone: "warn",
        confirmText: t("umum.mengerti"),
        cancelText: null,
      });
    }
  };

  return (
    <View style={styles.card}>
      {!fileUrl ? (
        <View style={styles.empty}>
          <LineIcon d={ICON.document} color={c.muted} size={26} />
          <Text style={styles.text}>{t("rv.tanpaFile")}</Text>
        </View>
      ) : gambar ? (
        uri ? (
          <Pressable onPress={buka}>
            <Image source={{ uri }} style={styles.image} resizeMode="contain" />
          </Pressable>
        ) : gagal ? (
          <View style={styles.empty}>
            <Text style={styles.text}>{t("lamp.gagalJudul")}</Text>
          </View>
        ) : (
          <View style={styles.empty}>
            <ActivityIndicator color={c.accent} />
          </View>
        )
      ) : (
        <View style={styles.empty}>
          <View style={styles.pdfIcon}>
            <Text style={styles.pdfText}>{ext}</Text>
          </View>
          <Text style={styles.text} numberOfLines={1}>
            {fileName ?? name}
          </Text>
        </View>
      )}
      {fileUrl ? (
        <Pressable style={styles.openBtn} onPress={buka}>
          <Text style={styles.openText}>{t("rv.buka")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 22,
      padding: 16,
    },
    image: { width: "100%", height: 320, borderRadius: 14 },
    empty: {
      height: 180,
      borderRadius: 14,
      backgroundColor: c.chip,
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingHorizontal: 16,
    },
    text: { fontSize: 12, fontWeight: "600", color: c.muted },
    pdfIcon: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: c.bad.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    pdfText: { fontSize: 12, fontWeight: "800", color: c.bad.ink },
    openBtn: {
      marginTop: 12,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: c.info.bg,
      alignItems: "center",
    },
    openText: { fontSize: 12.5, fontWeight: "700", color: c.info.ink },
  });
