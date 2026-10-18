import { holdLock } from "@/services/biometric";
import type { ScreenProps } from "@/navigation/types";
import { useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { hrisApi } from "@/services/api";
import { describeError } from "@/services/api/http";
import { useSession } from "@/services/session";
import { DocCategory } from "@/services/types";
import {
  MAX_BYTES,
  extensionOf,
  withoutExtension,
  formatFileSize,
} from "@/utils/file";
import { useConfirm } from "@/components/ConfirmDialog";
import { useT } from "@/i18n";
import { goBackAnimated } from "@/navigation/navigationBack";

export interface FileEntry {
  name: string;
  ext: string;
  size: number;
  uri: string;
  mimeType: string;
}

export function useProfileUpload({
  navigation,
}: Pick<ScreenProps, "navigation">) {
  const t = useT();
  const { employee } = useSession();
  const confirm = useConfirm();
  const [categoryKey, setCategoryKey] = useState<DocCategory>("sertifikat");
  const [pickedFile, setPickedFile] = useState<FileEntry | null>(null);
  const [nama, setNama] = useState("");
  const [validUntil, setValidUntil] = useState<string | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const accept = (f: FileEntry) => {
    if (f.size > MAX_BYTES) {
      void confirm({
        title: t("up.besarJudul"),
        message: t("up.besarPesan", { ukuran: formatFileSize(f.size) }),
        tone: "warn",
        confirmText: t("umum.mengerti"),
        cancelText: null,
      });
      return;
    }
    setPickedFile(f);
    if (!nama.trim()) setNama(withoutExtension(f.name));
  };
  const pickFile = async () => {
    holdLock();
    const r = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/jpeg", "image/png"],
      copyToCacheDirectory: true,
    });
    if (r.canceled) return;
    const a = r.assets[0];
    accept({
      name: a.name,
      ext: extensionOf(a.name),
      size: a.size ?? 0,
      uri: a.uri,
      mimeType: a.mimeType ?? "application/octet-stream",
    });
  };
  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      void confirm({
        title: t("up.izinJudul"),
        message: t("up.izinPesan"),
        tone: "warn",
        confirmText: t("umum.mengerti"),
        cancelText: null,
      });
      return;
    }
    holdLock();
    const r = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (r.canceled) return;
    const a = r.assets[0];
    accept({
      name: a.fileName ?? t("up.fotoNama", { n: Date.now() }),
      ext: "JPG",
      size: a.fileSize ?? 0,
      uri: a.uri,
      mimeType: a.mimeType ?? "image/jpeg",
    });
  };
  const blockMsg = !pickedFile
    ? t("up.blokFile")
    : !nama.trim()
      ? t("up.blokNama")
      : "";
  const canUpload = !blockMsg && !isSending;
  const uploadPickedFile = async () => {
    if (!employee || !pickedFile || !canUpload) return;
    setIsSending(true);
    setErrorMessage(null);
    try {
      await hrisApi.uploadDocument(employee.id, {
        category: categoryKey,
        ext: pickedFile.ext,
        name: nama.trim(),
        sizeLabel: formatFileSize(pickedFile.size),
        expiresOn: validUntil ?? undefined,
        file: {
          uri: pickedFile.uri,
          name: pickedFile.name,
          mimeType: pickedFile.mimeType,
        },
      });
      goBackAnimated(navigation);
    } catch (e) {
      setErrorMessage(describeError(e));
    } finally {
      setIsSending(false);
    }
  };
  const isPdf = pickedFile?.ext === "PDF";
  return {
    categoryKey,
    setCategoryKey,
    pickedFile,
    setPickedFile,
    nama,
    setNama,
    validUntil,
    setValidUntil,
    isDatePickerOpen,
    setIsDatePickerOpen,
    isSending,
    errorMessage,
    pickFile,
    takePhoto,
    blockMsg,
    canUpload,
    uploadPickedFile,
    isPdf,
  };
}
