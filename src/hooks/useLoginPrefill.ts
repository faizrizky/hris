// Mengisi awal layar login dari penyimpanan perangkat. Dipisah dari LoginScreen
// supaya komponennya tidak menumpuk banyak useEffect.

import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getServerAddress } from "@/services/api/http";
import { getBiometricName } from "@/services/biometric";

export const USERNAME_STORAGE_KEY = "hris.username";
const SERVER_ADDRESS_READ_MS = 300; // alamat tersimpan dibaca asinkron; isi kolom setelah siap

interface LoginPrefillHandlers {
  onSavedUsername: (username: string) => void;
  onBiometricName: (name: string) => void;
  onServerAddress: (address: string) => void;
}

export function useLoginPrefill({
  onSavedUsername,
  onBiometricName,
  onServerAddress,
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

  useEffect(() => {
    const timer = setTimeout(
      () => onServerAddress(getServerAddress()),
      SERVER_ADDRESS_READ_MS,
    );
    return () => clearTimeout(timer);
  }, [onServerAddress]);
}
