import { holdLock } from "@/services/biometric";
import type { ScreenProps } from "@/navigation/types";
import { useState } from "react";
import { Animated, Easing } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { hrisApi } from "@/services/api";
import { describeError } from "@/services/api/http";
import { useT } from "@/i18n";
import { useConfirm } from "@/components/ConfirmDialog";
import { goBackAnimated } from "@/navigation/navigationBack";
import { saveAttachment } from "@/utils/attachment";
import { toJpeg } from "@/utils/toJpeg";
import { useProfilePhoto } from "@/hooks/useProfilePhoto";
import { getFaceEmbedding } from "@/services/faceCheck";

export const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

export type UpdateStage = "panduan" | "pilih" | "tinjau" | "selesai";

export function useProfilePhotoScreen({
  navigation,
}: Pick<ScreenProps, "navigation">) {
  const t = useT();
  const confirm = useConfirm();
  const now = useProfilePhoto();
  const [stage, setStage] = useState<UpdateStage>("panduan");
  const [baru, setBaru] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [appear] = useState(() => new Animated.Value(1));
  const goToStep = (next: UpdateStage) => {
    setErrorMessage(null);
    setStage(next);
    appear.setValue(0);
    Animated.timing(appear, {
      toValue: 1,
      duration: 320,
      easing: EASE,
      useNativeDriver: true,
    }).start();
  };
  const pick = async (isFromCamera: boolean) => {
    setErrorMessage(null);
    const permission = isFromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setErrorMessage(t("pf.izin"));
      return;
    }
    holdLock();
    const launchPicker = isFromCamera
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;
    const r = await launchPicker({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsEditing: true,
      aspect: [3, 4],
      cameraType: ImagePicker.CameraType.front,
    });
    if (r.canceled) return;
    try {
      setBaru(await toJpeg(r.assets[0]!.uri));
      goToStep("tinjau");
    } catch {
      setErrorMessage(t("pf.formatGagal"));
    }
  };
  const submitRequest = async () => {
    if (!baru) return;
    setIsBusy(true);
    setErrorMessage(null);
    try {
      const faceEmbedding = await getFaceEmbedding(baru);
      if (!faceEmbedding) {
        setErrorMessage(t("pf.tanpaWajah"));
        return;
      }
      const status = await hrisApi.getFaceStatus();
      let idCardEmbedding: number[] | undefined;
      if (status.ktpUrl) {
        try {
          const k = await getFaceEmbedding(
            await saveAttachment(status.ktpUrl, "ktp"),
          );
          if (k) idCardEmbedding = k;
        } catch {
          // pembanding KTP opsional
        }
      }
      const checkResult = await hrisApi.submitProfilePhoto({
        embedding: faceEmbedding,
        ktpEmbedding: idCardEmbedding,
        dryRun: true,
      });
      if (checkResult.belowMin) {
        const isConfirmed = await confirm({
          title: t("pf.rendahJudul"),
          message: t("pf.rendahPesan"),
          tone: "warn",
          confirmText: t("pf.tetapAjukan"),
          cancelText: t("pf.pilihLain"),
        });
        if (!isConfirmed) return;
      }
      await hrisApi.submitProfilePhoto({
        photo: { uri: baru, name: "profil.jpg", mimeType: "image/jpeg" },
        embedding: faceEmbedding,
        ktpEmbedding: idCardEmbedding,
      });
      goToStep("selesai");
    } catch (e) {
      setErrorMessage(describeError(e));
    } finally {
      setIsBusy(false);
    }
  };
  const stepBack = () => {
    if (stage === "tinjau") goToStep("pilih");
    else if (stage === "pilih") goToStep("panduan");
    else goBackAnimated(navigation);
  };
  const styleVariant = {
    flex: 1,
    opacity: appear,
    transform: [
      {
        translateY: appear.interpolate({
          inputRange: [0, 1],
          outputRange: [14, 0],
        }),
      },
    ],
  };
  return {
    now,
    stage,
    baru,
    isBusy,
    errorMessage,
    goToStep,
    pick,
    submitRequest,
    stepBack,
    styleVariant,
  };
}
