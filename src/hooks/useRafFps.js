import { useEffect, useRef, useState } from "react";

/**
 * Lightweight FPS sampler using requestAnimationFrame.
 * Returns the latest frames-per-second estimate, updated every sample window.
 */
export function useRafFps({ sample = 500 } = {}) {
  const frameCount = useRef(0);
  const lastTimestamp = useRef(performance.now());
  const rafId = useRef(0);
  const [fps, setFps] = useState(0);

  useEffect(() => {
    const loop = (now) => {
      frameCount.current += 1;
      if (now - lastTimestamp.current >= sample) {
        const delta = now - lastTimestamp.current;
        const currentFps = (frameCount.current / delta) * 1000;
        setFps(currentFps);
        frameCount.current = 0;
        lastTimestamp.current = now;
      }
      rafId.current = requestAnimationFrame(loop);
    };

    rafId.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId.current);
  }, [sample]);

  return fps;
}
