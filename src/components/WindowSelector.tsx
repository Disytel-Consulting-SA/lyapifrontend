import { useEffect, useState } from "react";
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from "@mui/material";

import { getWindows } from "../api/libertyaApi";
import type { WindowOption } from "../types/metadata";

interface Props {
  value: number | "";
  onChange: (windowId: number) => void;
}

export default function WindowSelector({ value, onChange }: Props) {
  const [windows, setWindows] = useState<WindowOption[]>([]);

  useEffect(() => {
    getWindows()
      .then(setWindows)
      .catch((error) => {
        console.error("Error recuperando ventanas", error);
      });
  }, []);

  return (
    <FormControl fullWidth>
      <InputLabel>Ventana</InputLabel>

      <Select
        value={value}
        label="Ventana"
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {windows.map((window) => (
          <MenuItem
            key={window.ad_window_id}
            value={window.ad_window_id}
          >
            {window.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
