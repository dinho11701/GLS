// app/(tabs)/HomeScreen.tsx
import { Platform } from "react-native";
import HomeScreenWeb from "./HomeScreen.web";

export default function HomeScreen() {
  return Platform.OS === "web"
    ? <HomeScreenWeb />
    : null; // ou un HomeScreen.native plus tard
}
