import { useEffect } from "react";

export const useTouchGestures = (canvasElement, handleFit, handleResetView) => {
  useEffect(() => {
    if (!canvasElement) return undefined;

    let lastSingleTap = 0;
    let multiTapStart = 0;
    let multiTapActive = false;

    const handleTouchStart = (event) => {
      if (event.touches.length >= 2) {
        multiTapStart = performance.now();
        multiTapActive = true;
      }
    };

    const handleTouchEnd = (event) => {
      const now = performance.now();

      if (multiTapActive && event.touches.length === 0) {
        if (event.changedTouches.length >= 2 && now - multiTapStart < 280) {
          handleResetView();
        }
        multiTapActive = false;
        return;
      }

      if (event.changedTouches.length === 1 && event.touches.length === 0) {
        if (now - lastSingleTap < 320) {
          handleFit();
          lastSingleTap = 0;
        } else {
          lastSingleTap = now;
        }
      }
    };

    canvasElement.addEventListener("touchstart", handleTouchStart, { passive: true });
    canvasElement.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      canvasElement.removeEventListener("touchstart", handleTouchStart);
      canvasElement.removeEventListener("touchend", handleTouchEnd);
    };
  }, [canvasElement, handleFit, handleResetView]);
};
