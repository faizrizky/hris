import { useState } from "react";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { ApiError, describeError } from "@/services/api/http";
import { useSession } from "@/services/session";
import {
  TOTAL_REQUIREMENTS,
  scorePassword,
  getPasswordRequirements,
  getStrengthTone,
} from "@/utils/password";
import { useT } from "@/i18n";
import { useConfirm } from "@/components/ConfirmDialog";
import { deleteCredentials } from "@/services/biometric";

export function useProfilePassword() {
  const t = useT();
  const confirm = useConfirm();
  const { employee, setEmployee } = useSession();
  const c = useTheme();
  const [lama, setLama] = useState("");
  const [baru, setBaru] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isPasswordShown, setIsPasswordShown] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requirement = getPasswordRequirements(baru);
  const score = scorePassword(baru);
  const tone = c[getStrengthTone(baru)];
  const isMatching = confirmation.length > 0 && confirmation === baru;
  const blockMsg = !lama
    ? t("pw.blokLama")
    : score < TOTAL_REQUIREMENTS
      ? t("pw.blokSyarat")
      : baru === lama
        ? t("pw.blokSama")
        : !isMatching
          ? t("pw.blokKonfirmasi")
          : "";
  const canSave = !blockMsg && !isSending;
  const save = async () => {
    if (!employee || !canSave) return;
    setIsSending(true);
    setErrorMessage(null);
    try {
      await hrisApi.changePassword(employee.id, lama, baru);
      await deleteCredentials(); // login biometrik memakai password lama; aktifkan lagi dengan password baru
      setIsFinished(true);
    } catch (e) {
      // Frappe menghapus sesi bila password lama salah (cookie sid dikosongkan),
      // jadi percobaan berikutnya selalu ditolak. Pengguna harus masuk lagi.
      if (e instanceof ApiError && e.excType === "WrongPassword") {
        await confirm({
          title: t("pw.salahJudul"),
          message: t("pw.salahPesan"),
          tone: "bad",
          confirmText: t("pw.masukLagi2"),
          cancelText: null,
        });
        setEmployee(null);
        return;
      }
      setErrorMessage(describeError(e));
    } finally {
      setIsSending(false);
    }
  };
  return {
    lama,
    setLama,
    baru,
    setBaru,
    confirmation,
    setConfirmation,
    isPasswordShown,
    setIsPasswordShown,
    isSending,
    isFinished,
    errorMessage,
    requirement,
    score,
    tone,
    isMatching,
    blockMsg,
    canSave,
    save,
  };
}
