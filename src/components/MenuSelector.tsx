import { useEffect, useMemo, useState } from "react";
import { Autocomplete, TextField } from "@mui/material";
import { getMenuOptions } from "../api/libertyaApi";
import type { MenuOption } from "../types/metadata";

interface Props {
  value: MenuOption | null;
  onChange: (option: MenuOption | null) => void;
}

export default function MenuSelector({ value, onChange }: Props) {
  const [options, setOptions] = useState<MenuOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getMenuOptions()
      .then(setOptions)
      .catch((error) => {
        console.error("Error recuperando menu", error);
        setOptions([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const selected = useMemo(() => value == null ? null : options.find((option) => option.ad_menu_id === value.ad_menu_id) ?? null, [options, value]);

  return (
    <Autocomplete
      fullWidth
      options={options}
      value={selected}
      loading={loading}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(option, current) => option.ad_menu_id === current.ad_menu_id}
      onChange={(_, option) => onChange(option)}
      renderInput={(params) => <TextField {...params} label="Menú" />}
    />
  );
}
