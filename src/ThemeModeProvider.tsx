import {
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";

import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import type { PaletteMode } from "@mui/material";

import { createLibertyaTheme } from "./theme";


const THEME_STORAGE_KEY = "libertya-theme-mode";


interface ThemeModeContextValue {
  mode: PaletteMode;
  toggleMode: () => void;
}


const ThemeModeContext = createContext<ThemeModeContextValue | undefined>(
  undefined
);


function getInitialThemeMode(): PaletteMode {
  const storedMode = localStorage.getItem(THEME_STORAGE_KEY);

  if (storedMode === "light" || storedMode === "dark")
    return storedMode;

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}


export function ThemeModeProvider({
  children,
}: {
  children: React.ReactNode;
}) {

  const [mode, setMode] = useState<PaletteMode>(getInitialThemeMode);

  const theme = useMemo(
    () => createLibertyaTheme(mode),
    [mode]
  );


  function toggleMode() {
    setMode((current) => {
      const nextMode = current === "light" ? "dark" : "light";

      localStorage.setItem(THEME_STORAGE_KEY, nextMode);

      return nextMode;
    });
  }


  return (
    <ThemeModeContext.Provider value={{ mode, toggleMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}


export function useThemeMode(): ThemeModeContextValue {
  const context = useContext(ThemeModeContext);

  if (!context)
    throw new Error("useThemeMode debe utilizarse dentro de ThemeModeProvider");

  return context;
}