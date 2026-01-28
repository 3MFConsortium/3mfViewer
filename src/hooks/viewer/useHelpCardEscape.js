import { useEffect } from "react";

export const useHelpCardEscape = (helpCardOpen, setHelpCardOpen) => {
  useEffect(() => {
    if (!helpCardOpen) return undefined;

    const handleKey = (event) => {
      if (event.key === "Escape") setHelpCardOpen(false);
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [helpCardOpen, setHelpCardOpen]);
};
