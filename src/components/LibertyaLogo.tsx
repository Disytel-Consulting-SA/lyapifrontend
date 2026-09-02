import { Box } from "@mui/material";

import { useThemeMode } from "../ThemeModeProvider";

import lightLogo from "../assets/libertya-next-logo.png";
import darkLogo from "../assets/libertya-next-logo-dark-transparent.png";


interface Props {
  width?: number;
}


export default function LibertyaLogo({
  width = 190,
}: Props) {

  const { mode } = useThemeMode();

  return (
    <Box
      component="img"
      src={mode === "dark" ? darkLogo : lightLogo}
      alt="Libertya Next"
      sx={{
        width,
        height: "auto",
        display: "block",
      }}
    />
  );
}