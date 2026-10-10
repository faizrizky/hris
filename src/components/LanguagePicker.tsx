import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/theme/ThemeContext";
import { useBahasa } from "@/i18n";

// Dua tombol kecil untuk memilih bahasa aplikasi (ID / EN).
export function LanguagePicker() {
  const c = useTheme();
  const { bahasa, setBahasa } = useBahasa();
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {(["id", "en"] as const).map((b) => {
        const aktif = bahasa === b;
        return (
          <Pressable
            key={b}
            onPress={() => setBahasa(b)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 999,
              backgroundColor: aktif ? c.accent : c.chip,
            }}
          >
            <Text
              style={{
                fontSize: 11.5,
                fontWeight: "700",
                color: aktif ? "#fff" : c.muted,
              }}
            >
              {b.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
