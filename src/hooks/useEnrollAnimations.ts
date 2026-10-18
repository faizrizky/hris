// Animasi layar pendaftaran wajah: cincin berputar + denyut yang terus berulang,
// dan isi yang memudar masuk tiap ganti tahap.

import { useEffect } from "react";
import { Animated, Easing } from "react-native";

const PUTAR_MS = 14_000;
const DENYUT_MS = 900;
const MASUK_MS = 420;
const EASE_MASUK = Easing.bezier(0.25, 0.1, 0.25, 1);

interface EnrollAnimationValues {
  putar: Animated.Value;
  denyut: Animated.Value;
  masuk: Animated.Value;
}

export function useEnrollAnimations(
  { putar, denyut, masuk }: EnrollAnimationValues,
  fase: string,
) {
  useEffect(() => {
    const loops = [
      Animated.loop(
        Animated.timing(putar, {
          toValue: 1,
          duration: PUTAR_MS,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(denyut, {
            toValue: 1,
            duration: DENYUT_MS,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(denyut, {
            toValue: 0,
            duration: DENYUT_MS,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ),
    ];
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [putar, denyut]);

  // Setiap ganti tahap: isi memudar masuk.
  useEffect(() => {
    masuk.setValue(0);
    Animated.timing(masuk, {
      toValue: 1,
      duration: MASUK_MS,
      easing: EASE_MASUK,
      useNativeDriver: true,
    }).start();
  }, [fase, masuk]);
}
