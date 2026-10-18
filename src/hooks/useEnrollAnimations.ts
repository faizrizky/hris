// Animasi layar pendaftaran wajah: cincin berputar + denyut yang terus berulang,
// dan isi yang memudar masuk tiap ganti tahap.

import { useEffect } from "react";
import { Animated, Easing } from "react-native";

const SPIN_MS = 14_000;
const PULSE_MS = 900;
const ENTER_MS = 420;
const ENTER_EASING = Easing.bezier(0.25, 0.1, 0.25, 1);

interface EnrollAnimationValues {
  spin: Animated.Value;
  pulse: Animated.Value;
  masuk: Animated.Value;
}

export function useEnrollAnimations(
  { spin, pulse, masuk }: EnrollAnimationValues,
  phase: string,
) {
  useEffect(() => {
    const loops = [
      Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: SPIN_MS,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: PULSE_MS,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0,
            duration: PULSE_MS,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ),
    ];
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [spin, pulse]);

  // Setiap ganti tahap: isi memudar masuk.
  useEffect(() => {
    masuk.setValue(0);
    Animated.timing(masuk, {
      toValue: 1,
      duration: ENTER_MS,
      easing: ENTER_EASING,
      useNativeDriver: true,
    }).start();
  }, [phase, masuk]);
}
