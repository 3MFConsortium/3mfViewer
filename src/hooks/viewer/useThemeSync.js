import { useEffect } from "react";

export const useThemeSync = ({
  prefs,
  isDark,
  setPrefs,
  defaultLight,
  defaultDark,
}) => {
  useEffect(() => {
    if (!prefs.syncWithTheme) return;
    const themePrefs = isDark ? defaultDark : defaultLight;
    setPrefs((p) => ({
      ...p,
      background: themePrefs.background,
      hemiSkyColor: themePrefs.hemiSkyColor,
      hemiGroundColor: themePrefs.hemiGroundColor,
      rimColor: themePrefs.rimColor,
      edgeColor: themePrefs.edgeColor,
      ambient: themePrefs.ambient,
      hemiIntensity: themePrefs.hemiIntensity,
      rimIntensity: themePrefs.rimIntensity,
    }));
  }, [isDark, prefs.syncWithTheme, setPrefs, defaultDark, defaultLight]);
};
