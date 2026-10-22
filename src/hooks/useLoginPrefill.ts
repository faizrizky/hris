// Mengisi awal layar login dari penyimpanan perangkat. Dipisah dari LoginScreen
// supaya komponennya tidak menumpuk banyak useEffect.

import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getBiometricName } from "@/services/biometric";

export const USERNAME_STORAGE_KEY = "hris.username";

interface LoginPrefillHandlers {
  onSavedUsername: (username: string) => void;
  onBiometricName: (name: string) => void;
}

export function useLoginPrefill({
  onSavedUsername,
  onBiometricName,
}: LoginPrefillHandlers) {
  // "Ingat saya": username terakhir diisi otomatis (password tidak pernah disimpan).
  useEffect(() => {
    AsyncStorage.getItem(USERNAME_STORAGE_KEY)
      .then((username) => {
        if (username) onSavedUsername(username);
      })
      .catch(() => {});
  }, [onSavedUsername]);

  // Biometrik hanya ditawarkan bila perangkat ini sudah punya sidik jari / wajah terdaftar.
  useEffect(() => {
    getBiometricName().then(onBiometricName);
  }, [onBiometricName]);
}
