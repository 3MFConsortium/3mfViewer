import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";

const ThemeContext = createContext(null);

const THEME_KEY = "3mf-viewer-theme";
const VALID_THEMES = ["light", "dark", "auto"];
const TRANSITION_DURATION = 300; // ms

/**
 * Determine the effective theme based on preference
 */
const getEffectiveTheme = (preference) => {
  if (preference === "auto") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return preference;
};

/**
 * Apply theme to document
 */
const applyTheme = (effectiveTheme) => {
  if (effectiveTheme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
};

/**
 * Get stored theme preference
 */
const getStoredTheme = () => {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored && VALID_THEMES.includes(stored)) {
      return stored;
    }
  } catch {
    // localStorage not available
  }
  return "auto";
};

/**
 * Store theme preference
 */
const storeTheme = (theme) => {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // localStorage not available
  }
};

export function ThemeProvider({ children, defaultTheme = "auto" }) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const isInitialMount = useRef(true);

  // Initialize from localStorage or default
  const [theme, setThemeState] = useState(() => {
    // Prevent transitions on initial load
    document.documentElement.classList.add("no-transitions");

    const stored = getStoredTheme();
    const effectiveTheme = getEffectiveTheme(stored);
    applyTheme(effectiveTheme);

    // Re-enable transitions after a short delay
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.documentElement.classList.remove("no-transitions");
      });
    });

    return stored;
  });

  // Computed effective theme (resolves "auto" to actual theme)
  const [effectiveTheme, setEffectiveTheme] = useState(() => getEffectiveTheme(theme));

  // Update effective theme and apply to DOM with transition
  useEffect(() => {
    const newEffective = getEffectiveTheme(theme);

    // Skip transition on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      setEffectiveTheme(newEffective);
      applyTheme(newEffective);
      storeTheme(theme);
      return;
    }

    // Show transition overlay
    setIsTransitioning(true);

    // Apply theme after a brief delay to let overlay fade in
    const applyTimer = setTimeout(() => {
      setEffectiveTheme(newEffective);
      applyTheme(newEffective);
      storeTheme(theme);
    }, 100);

    // Hide overlay after transition completes
    const hideTimer = setTimeout(() => {
      setIsTransitioning(false);
    }, TRANSITION_DURATION);

    return () => {
      clearTimeout(applyTimer);
      clearTimeout(hideTimer);
    };
  }, [theme]);

  // Listen for system preference changes when in auto mode
  useEffect(() => {
    if (theme !== "auto") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e) => {
      const newEffective = e.matches ? "dark" : "light";
      setEffectiveTheme(newEffective);
      applyTheme(newEffective);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  // Set theme with validation
  const setTheme = useCallback((newTheme) => {
    if (VALID_THEMES.includes(newTheme)) {
      setThemeState(newTheme);
    }
  }, []);

  // Cycle through themes: light -> dark -> auto -> light
  const cycleTheme = useCallback(() => {
    setThemeState((current) => {
      const cycle = { light: "dark", dark: "auto", auto: "light" };
      return cycle[current];
    });
  }, []);

  // Check if dark mode is active
  const isDark = effectiveTheme === "dark";

  const value = {
    theme,           // User preference: "light" | "dark" | "auto"
    effectiveTheme,  // Resolved theme: "light" | "dark"
    isDark,          // Convenience boolean
    setTheme,        // Set specific theme
    cycleTheme,      // Cycle to next theme
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
      {/* Theme transition overlay */}
      {isTransitioning && (
        <div
          className="fixed inset-0 z-[9999] pointer-events-none bg-background"
          style={{
            animation: `theme-fade ${TRANSITION_DURATION}ms ease-in-out`,
          }}
        />
      )}
      <style>{`
        @keyframes theme-fade {
          0% { opacity: 0; }
          30% { opacity: 1; }
          70% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

// Export for direct use without hook
export { ThemeContext };
