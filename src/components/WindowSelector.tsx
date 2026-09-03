import { useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  TextField,
} from "@mui/material";

import { getWindows } from "../api/libertyaApi";
import type { WindowOption } from "../types/metadata";

interface Props {
  value: number | "";
  onChange: (windowId: number) => void;
}

export default function WindowSelector({ value, onChange }: Props) {
  const [windows, setWindows] = useState<WindowOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);

    getWindows()
      .then(setWindows)
      .catch((error) => {
        console.error("Error recuperando ventanas", error);
        setWindows([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);


  const selectedWindow = useMemo(
    () =>
      value === ""
        ? null
        : windows.find((window) => window.ad_window_id === value) ?? null,
    [windows, value]
  );


  return (
    <Autocomplete
      fullWidth
      options={windows}
      value={selectedWindow}
      loading={loading}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(option, selected) =>
        option.ad_window_id === selected.ad_window_id
      }
      onChange={(_, selected) => {
        if (selected) {
          onChange(selected.ad_window_id);
        }
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Ventana"
        />
      )}
    />
  );
}