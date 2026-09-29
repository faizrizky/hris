import React, { useEffect, useRef } from "react";
import { Animated, Easing, ViewStyle } from "react-native";
import { colors } from "@/theme/colors";

export function Skeleton({
  width,
  height,
  radius = 8,
  style,
}: {
  width?: ViewStyle["width"];
  height: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 750,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    // Dihentikan saat komponen dilepas, kalau tidak animasinya terus jalan
    // di belakang layar setelah datanya datang.
    return () => loop.stop();
  }, [anim]);

  const opacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.4],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: colors.track,
          opacity,
        },
        style,
      ]}
    />
  );
}
