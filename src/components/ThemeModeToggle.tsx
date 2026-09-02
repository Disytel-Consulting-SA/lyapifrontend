import {
  IconButton,
  Tooltip,
} from "@mui/material";

import {
  DarkModeOutlined,
  LightModeOutlined,
} from "@mui/icons-material";

import { useThemeMode } from "../ThemeModeProvider";


export default function ThemeModeToggle() {
  const { mode, toggleMode } = useThemeMode();

  const dark = mode === "dark";

  return (
    <Tooltip title={dark ? "Usar modo claro" : "Usar modo oscuro"}>
      <IconButton
        onClick={toggleMode}
        color="primary"
        aria-label={dark ? "Usar modo claro" : "Usar modo oscuro"}
      >
        {dark
          ? <LightModeOutlined />
          : <DarkModeOutlined />
        }
      </IconButton>
    </Tooltip>
  );
}