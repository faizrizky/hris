import type {
  NavigationProp,
  ParamListBase,
  RouteProp,
} from "@react-navigation/native";

// Navigasi dipakai lintas tab dan tumpukan (navigate("Profil", { screen })), jadi
// daftar parameternya longgar dan parameter route dibaca lewat getRouteParams.
export type AppNavigation = NavigationProp<ParamListBase>;

export interface ScreenProps {
  navigation: AppNavigation;
  route: RouteProp<ParamListBase>;
}

// Satu-satunya tempat parameter route diberi tipe. Navigator menjamin parameter
// wajib sudah dikirim pemanggil (navigation.navigate); yang opsional ditandai `?`.
export function getRouteParams<Params extends object>(
  route: ScreenProps["route"],
): Params {
  return (route.params ?? {}) as Params;
}
