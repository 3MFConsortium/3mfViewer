import { useEffect } from "react";

export const useKeyboardShortcuts = ({
  panLeft,
  panRight,
  panUp,
  panDown,
  toggleHelpCard,
}) => {
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "ArrowLeft") {
        panLeft();
        e.preventDefault();
      } else if (e.key === "ArrowRight") {
        panRight();
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        panUp();
        e.preventDefault();
      } else if (e.key === "ArrowDown") {
        panDown();
        e.preventDefault();
      } else if (e.key === "?") {
        toggleHelpCard();
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [panLeft, panRight, panUp, panDown, toggleHelpCard]);
};
