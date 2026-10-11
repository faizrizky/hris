// Push notification lewat Expo Push. Hanya jalan di perangkat fisik pada dev build
// atau build rilis; di simulator atau tanpa izin/projectId, fungsinya diam saja.
// Notifikasi sumbernya Notification Log ERPNext, dikirim server ke token yang didaftarkan di sini.

import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

let tokenTerdaftar: string | null = null;
export const tokenPushSaatIni = () => tokenTerdaftar;

// Notifikasi yang datang saat aplikasi terbuka tetap ditampilkan sebagai banner.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export interface TokenPush {
  token: string;
  platform: string;
  deviceName: string;
}

// Meminta izin lalu mengambil Expo push token. null = tidak tersedia (bukan galat).
export async function ambilTokenPush(): Promise<TokenPush | null> {
  try {
    if (!Device.isDevice) return null;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    if (!projectId) return null;

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    tokenTerdaftar = data;
    return {
      token: data,
      platform: Platform.OS,
      deviceName: Device.deviceName ?? Device.modelName ?? Platform.OS,
    };
  } catch {
    return null;
  }
}
