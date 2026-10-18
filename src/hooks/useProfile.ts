import { useEffect, useState, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import { useThemeMode } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { LeaveBalance } from "@/services/types";
import { useProfilePhoto } from "@/hooks/useProfilePhoto";

export function useProfile() {
  const { employee } = useSession();
  const [balances, setBalances] = useState<LeaveBalance[] | null>(null);
  const [isPushOn, setIsPushOn] = useState(true);
  const { mode, toggle } = useThemeMode();
  const exitRef = useRef<View>(null);
  const photo = useProfilePhoto();
  const [photoAppear] = useState(() => new Animated.Value(0));
  const revealPhoto = () =>
    Animated.timing(photoAppear, {
      toValue: 1,
      duration: 520,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: true,
    }).start();
  useEffect(() => {
    if (!employee) return;
    hrisApi
      .getLeaveBalances(employee.id)
      .then(setBalances)
      // Saldo hanya satu statistik di kepala halaman; kalau gagal, layar tetap
      // berguna (menu, keluar), jadi tampilkan kosong, bukan skeleton selamanya.
      .catch(() => setBalances([]));
  }, [employee]);
  return {
    balances,
    isPushOn,
    setIsPushOn,
    mode,
    toggle,
    exitRef,
    photo,
    photoAppear,
    revealPhoto,
  };
}
