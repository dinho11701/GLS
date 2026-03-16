import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

export default function ServicesLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
    >

      <Tabs.Screen
        name="DetailServiceScreen"
        options={{ href: null }}
      />


    </Tabs>
  );
}
