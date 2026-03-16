import React, { useEffect, useState } from "react";

export default function ScrollDownButton() {
  const [show, setShow] = useState(false);
  const [atBottom, setAtBottom] = useState(false);

  useEffect(() => {
    // Trouve automatiquement le conteneur scrollable
    const root =
      document.querySelector("#root") ||
      document.querySelector("main") ||
      window; // fallback

    const getScrollTop = () =>
      root === window ? window.scrollY : root.scrollTop;

    const getHeight = () =>
      root === window
        ? document.documentElement.scrollHeight
        : root.scrollHeight;

    const getWinHeight = () =>
      root === window ? window.innerHeight : root.clientHeight;

    const onScroll = () => {
      const top = getScrollTop();
      const height = getHeight();
      const wHeight = getWinHeight();

      setShow(top > 150);
      setAtBottom(top + wHeight >= height - 40);
    };

    root.addEventListener("scroll", onScroll);
    onScroll();

    return () => root.removeEventListener("scroll", onScroll);
  }, []);

  const scroll = () => {
    const root =
      document.querySelector("#root") ||
      document.querySelector("main") ||
      window;

    if (root === window) {
      window.scrollTo({
        top: atBottom ? 0 : document.body.scrollHeight,
        behavior: "smooth",
      });
    } else {
      root.scrollTo({
        top: atBottom ? 0 : root.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        right: 22,
        bottom: 30,
        cursor: "pointer",
        zIndex: 99999,
        padding: 6,
      }}
      onClick={scroll}
    >
      <svg
        width="60"
        height="60"
        viewBox="0 0 24 24"
        fill="#FFD700"
        style={{ transform: atBottom ? "rotate(180deg)" : "none" }}
      >
        <path d="M12 21c4.971 0 9-4.029 9-9s-4.029-9-9-9-9 
                4.029-9 9 4.029 9 9 9zm0-15l5 6h-10l5-6z"/>
      </svg>
    </div>
  );
}
