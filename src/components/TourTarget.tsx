// Registri tutorial: elemen yang bisa disorot dan daftar gulir yang bisa digeser agar elemen itu terlihat.
import type { ReactNode } from "react";
import { View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

const targets = new Map<string, Set<View>>();
const callbacks = new Map<string, (node: View | null) => void>();

// Layar yang sama bisa terpasang di dua stack, jadi satu id menampung beberapa node.
export function tourTarget(id: string) {
  let callback = callbacks.get(id);
  if (!callback) {
    callback = (node) => {
      if (!node) return;
      const nodes = targets.get(id) ?? new Set<View>();
      targets.set(id, nodes.add(node));
      return () => {
        nodes.delete(node);
      };
    };
    callbacks.set(id, callback);
  }
  return callback;
}

// Terbaru dulu: layar yang baru dibuka tutorial adalah yang terakhir terpasang.
export const tourNodes = (id: string): View[] =>
  [...(targets.get(id) ?? [])].reverse();

export function TourTarget({
  id,
  style,
  children,
}: {
  id: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  return (
    <View ref={tourTarget(id)} collapsable={false} style={style}>
      {children}
    </View>
  );
}

export interface TourScroller {
  isFocused: () => boolean;
  scrollBy: (dy: number) => void;
}

const scrollers = new Set<TourScroller>();

export function registerScroller(scroller: TourScroller) {
  scrollers.add(scroller);
  return () => {
    scrollers.delete(scroller);
  };
}

export function scrollFocused(dy: number): boolean {
  const active = [...scrollers].reverse().find((s) => s.isFocused());
  active?.scrollBy(dy);
  return !!active;
}
