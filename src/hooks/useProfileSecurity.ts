import { useCallback, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import {
  hasBiometricLogin,
  authenticate,
  deleteCredentials,
  getBiometricReadiness,
  getBiometricName,
  saveCredentials,
  type BiometricReadiness,
} from "@/services/biometric";
import { useAppLock } from "@/services/appLock";
import { useConfirm } from "@/components/ConfirmDialog";
import { hrisApi } from "@/services/api";
import { ApiError, describeError } from "@/services/api/http";
import { useSession } from "@/services/session";
import {
  FaceStatus,
  SecurityInfo,
  SecurityToggleKey,
  ActiveDevice,
} from "@/services/types";
import { useT } from "@/i18n";

export function useProfileSecurity() {
  const t = useT();
  const { employee } = useSession();
  const confirm = useConfirm();
  const [info, setInfo] = useState<SecurityInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [face, setFace] = useState<FaceStatus | null>(null);
  const cacheKey = useAppLock();
  const [biometric, setBiometric] = useState<BiometricReadiness>("siap");
  const [isBiometricLogin, setIsBiometricLogin] = useState(false);
  const [biometricMessage, setBiometricMessage] = useState<string | null>(null);
  const [biometricName, setBiometricName] = useState("sidik jari / wajah");
  const [isBiometricDialog, setIsBiometricDialog] = useState(false);
  const [biometricAccount, setBiometricAccount] = useState("");
  const [biometricPassword, setBiometricPassword] = useState("");
  const [biometricError, setBiometricError] = useState<string | null>(null);
  const [isBiometricBusy, setIsBiometricBusy] = useState(false);
  const load = useCallback(() => {
    if (!employee) return;
    setErrorMessage(null);
    hrisApi
      .getSecurityInfo(employee.id)
      .then(setInfo)
      .catch((e) => setErrorMessage(describeError(e)));
    hrisApi
      .getFaceStatus()
      .then(setFace)
      .catch(() => setFace(null));
  }, [employee]);
  useFocusEffect(load);
  useFocusEffect(
    useCallback(() => {
      getBiometricReadiness().then(setBiometric);
      getBiometricName().then(setBiometricName);
      hasBiometricLogin().then(setIsBiometricLogin);
    }, []),
  );
  const toggleBiometric = async (isEnabled: boolean) => {
    setBiometricMessage(null);
    if (!isEnabled) {
      await deleteCredentials();
      setIsBiometricLogin(false);
      cacheKey.update({ ...cacheKey.settings, isActive: false });
      return;
    }
    if (biometric === "tidakAda") return setBiometricMessage(t("bio.tidakAda"));
    if (biometric === "belumDaftar")
      return setBiometricMessage(t("bio.belumDaftar"));
    cacheKey.ignoreBackground(15_000);
    if (!(await authenticate(t("bio.konfirmasi"), t("kunci.batal")))) return;
    setBiometricAccount(
      (await AsyncStorage.getItem("hris.username").catch(() => null)) ?? "",
    );
    setBiometricPassword("");
    setBiometricError(null);
    setIsBiometricDialog(true); // password diminta satu kali untuk login biometrik
  };
  const enableBiometricLogin = async () => {
    setIsBiometricBusy(true);
    setBiometricError(null);
    try {
      await hrisApi.login(biometricAccount.trim(), biometricPassword); // memastikan akun dan password benar
      cacheKey.ignoreBackground(15_000);
      await saveCredentials(biometricAccount.trim(), biometricPassword);
      setIsBiometricLogin(true);
      setIsBiometricDialog(false);
      setBiometricPassword("");
    } catch (e) {
      setBiometricError(
        e instanceof ApiError
          ? describeError(e)
          : t("bio.gagalSimpan", { pesan: (e as Error)?.message ?? "" }),
      );
    } finally {
      setIsBiometricBusy(false);
    }
  };
  const changeLock = (isEnabled: boolean) => {
    setBiometricMessage(null);
    if (isEnabled && !isBiometricLogin)
      return setBiometricMessage(t("bio.kunciButuhBiometrik"));
    cacheKey.update({ ...cacheKey.settings, isActive: isEnabled });
  };
  const TIMEOUT_OPTIONS: [number, string][] = [
    [0, t("bio.segera")],
    [60_000, t("bio.satuMenit")],
    [300_000, t("bio.limaMenit")],
  ];
  const actionFailed = (e: unknown) => {
    void confirm({
      title: t("umum.gagalMemproses"),
      message: describeError(e),
      tone: "bad",
      confirmText: t("umum.mengerti"),
      cancelText: null,
    });
  };
  const changeToggle = (key: SecurityToggleKey, isEnabled: boolean) => {
    if (!employee) return;
    hrisApi
      .setSecurityToggle(employee.id, key, isEnabled)
      .then(setInfo)
      .catch(actionFailed);
  };
  const signOutDevice = async (d: ActiveDevice) => {
    if (!employee) return;
    const isConfirmed = await confirm({
      title: t("sec.keluarkanJudul"),
      message: t("sec.keluarkanPesan", { nama: d.name }),
      tone: "bad",
      confirmText: t("sec.keluarkan"),
      cancelText: t("umum.batal"),
    });
    if (isConfirmed) {
      hrisApi
        .logoutDevice(employee.id, d.sessionIds)
        .then(setInfo)
        .catch(actionFailed);
    }
  };
  return {
    info,
    errorMessage,
    face,
    cacheKey,
    isBiometricLogin,
    biometricMessage,
    biometricName,
    isBiometricDialog,
    setIsBiometricDialog,
    biometricAccount,
    setBiometricAccount,
    biometricPassword,
    setBiometricPassword,
    biometricError,
    isBiometricBusy,
    load,
    toggleBiometric,
    enableBiometricLogin,
    changeLock,
    TIMEOUT_OPTIONS,
    changeToggle,
    signOutDevice,
  };
}
