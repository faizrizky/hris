import { useState, useEffect, useEffectEvent } from "react";
import { USERNAME_STORAGE_KEY, useLoginPrefill } from "@/hooks/useLoginPrefill";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { describeError } from "@/services/api/http";
import { useT } from "@/i18n";
import { useConfirm } from "@/components/ConfirmDialog";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  hasBiometricLogin,
  readCredentials,
  deleteCredentials,
  getBiometricReadiness,
} from "@/services/biometric";

export function useLogin() {
  const { setEmployee, loginNotice, clearLoginNotice } = useSession();
  const confirm = useConfirm();
  const t = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRememberMe, setIsRememberMe] = useState(true);
  const [biometricName, setBiometricName] = useState("sidik jari / wajah");
  const [isShowPassword, setIsShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useLoginPrefill({
    onSavedUsername: setEmail,
    onBiometricName: setBiometricName,
  });
  const showSessionNotice = useEffectEvent(() => {
    void confirm({
      title: t("login.sesiJudul"),
      message: t("login.sesiPesan"),
      tone: "warn",
      confirmText: t("umum.mengerti"),
      cancelText: null,
    }).then(clearLoginNotice);
  });
  useEffect(() => {
    if (loginNotice) showSessionNotice();
  }, [loginNotice]);
  const signInWithBiometric = async () => {
    setError(null);
    const k = await getBiometricReadiness();
    if (k === "tidakAda") return setError(t("bio.tidakAda"));
    if (k === "belumDaftar") return setError(t("bio.belumDaftar"));
    if (!(await hasBiometricLogin())) return setError(t("bio.belumAktif"));
    const credentials = await readCredentials(
      t("bio.pesanLogin"),
      t("kunci.batal"),
    );
    if (!credentials) return; // dibatalkan atau gagal verifikasi
    setIsLoading(true);
    try {
      const employee = await hrisApi.login(credentials.u, credentials.p);
      setEmployee(employee);
    } catch {
      await deleteCredentials(); // password berubah atau sesi tidak valid: aktifkan lagi dengan password
      setError(t("bio.gagalMasuk"));
    } finally {
      setIsLoading(false);
    }
  };
  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const employee = await hrisApi.login(email.trim(), password);

      if (isRememberMe) {
        await AsyncStorage.setItem(USERNAME_STORAGE_KEY, email.trim()).catch(
          () => {},
        );
      } else {
        await AsyncStorage.removeItem(USERNAME_STORAGE_KEY).catch(() => {});
      }
      setEmployee(employee);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setIsLoading(false);
    }
  };
  return {
    email,
    setEmail,
    password,
    setPassword,
    isLoading,
    isRememberMe,
    setIsRememberMe,
    biometricName,
    isShowPassword,
    setIsShowPassword,
    error,
    signInWithBiometric,
    handleLogin,
  };
}
