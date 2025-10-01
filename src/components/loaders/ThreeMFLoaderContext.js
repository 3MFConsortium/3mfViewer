import { createContext, useContext } from "react";

export const ThreeMFLoaderContext = createContext(null);

export function useThreeMFLoader() {
  const ctx = useContext(ThreeMFLoaderContext);
  if (!ctx) {
    throw new Error("useThreeMFLoader must be used within a ThreeMFLoaderProvider");
  }
  return ctx;
}
