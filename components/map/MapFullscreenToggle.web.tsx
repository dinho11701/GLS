import React, { useState, useEffect } from "react";

type Props = {
  containerId: string;
};

export default function MapFullscreenToggleWeb({ containerId }: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  const toggleFullscreen = async () => {
    const element = document.getElementById(containerId);
    if (!element) return;

    try {
      if (!document.fullscreenElement) {
        await element.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.warn("Fullscreen not supported:", error);
    }
  };

  return (
    <button
      style={{
        ...styles.button,
        backgroundColor: isFullscreen
          ? "rgba(10,15,44,0.85)"
          : "rgba(0,0,0,0.6)",
      }}
      onClick={toggleFullscreen}
    >
      {isFullscreen ? "✕" : "⛶"}
    </button>
  );
}

const styles: any = {
  button: {
    position: "absolute",
    left: 16,
    top: 16,
    width: 44,
    height: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    color: "white",
    border: "none",
    cursor: "pointer",
    zIndex: 1000,
    fontSize: 18,
  },
};