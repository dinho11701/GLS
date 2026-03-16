import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
} from "react-native";

type Props = {
  isFullscreen: boolean;
  onToggle: () => void;
};

export default function MapFullscreenToggleNative({
  isFullscreen,
  onToggle,
}: Props) {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        isFullscreen && styles.buttonActive,
      ]}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <Text style={styles.text}>
        {isFullscreen ? "✕" : "⛶"}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    left: 16,
    top: Platform.OS === "ios" ? 60 : 30,
    width: 44,
    height: 44,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    zIndex: 1000,
  },
  buttonActive: {
    backgroundColor: "rgba(10,15,44,0.85)",
  },
  text: {
    color: "white",
    fontSize: 18,
  },
});