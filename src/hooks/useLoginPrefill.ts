// Mengisi awal layar login dari penyimpanan perangkat. Dipisah dari LoginScreen
// supaya komponennya tidak menumpuk banyak useEffect.

import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { alamatServer } from "@/services/api/http";
import { namaBiometrik } from "@/services/biometrik";

export const KUNCI_USERNAME = "hris.username";
const ALAMAT_SERVER_DIBACA_MS = 300; // alamat tersimpan dibaca asinkron; isi kolom setelah siap

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
    AsyncStorage.getItem(KUNCI_USERNAME)
      .then((username) => {
        if (username) onSavedUsername(username);
      })
      .catch(() => {});
  }, [onSavedUsername]);

  // Biometrik hanya ditawarkan bila perangkat ini sudah punya sidik jari / wajah terdaftar.
  useEffect(() => {
    namaBiometrik().then(onBiometricName);
  }, [onBiometricName]);

  useEffect(() => {
    const timer = setTimeout(
      () => onServerAddress(alamatServer()),
      ALAMAT_SERVER_DIBACA_MS,
    );
    return () => clearTimeout(timer);
  }, [onServerAddress]);
}
