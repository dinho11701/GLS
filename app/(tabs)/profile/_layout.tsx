import { Stack } from "expo-router";

export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,  // On contrôle nos headers nous-mêmes
        contentStyle: { backgroundColor: "#0A0F2C" },
      }}
    />
  );
}
