import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import * as Device from "expo-device";

// Identitas perangkat untuk pengikatan perangkat. Android ID / identifierForVendor bertahan melewati
// pembaruan; bila tak tersedia dipakai ID acak yang disimpan di penyimpanan aplikasi.
const KUNCI = "hris.deviceId";
let cache: { id: string; nama: string; platform: string } | null = null;

export async function infoPerangkat() {
  if (cache) return cache;
  let id: string | null = null;
  try {
    id =
      Platform.OS === "android"
        ? Application.getAndroidId()
        : await Application.getIosIdForVendorAsync();
  } catch {
    id = null;
  }
  if (!id) {
    id = await AsyncStorage.getItem(KUNCI).catch(() => null);
    if (!id) {
      id = `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
      await AsyncStorage.setItem(KUNCI, id).catch(() => {});
    }
  }
  cache = {
    id: `${Platform.OS}:${id}`,
    nama: Device.deviceName ?? Device.modelName ?? Platform.OS,
    platform: Platform.OS,
  };
  return cache;
}
