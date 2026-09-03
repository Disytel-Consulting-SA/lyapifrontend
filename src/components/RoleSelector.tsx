import { useEffect, useState } from "react";
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from "@mui/material";

import {
  getRoleOptions,
  type RoleOption,
} from "../api/libertyaApi";

interface Props {
  value: number | "";
  onChange: (role: RoleOption) => void;
}

export default function RoleSelector({ value, onChange }: Props) {
  const [roles, setRoles] = useState<RoleOption[]>([]);

  useEffect(() => {
    getRoleOptions()
      .then(setRoles)
      .catch((error) => {
        console.error("Error recuperando perfiles", error);
      });
  }, []);

  const handleChange = (roleId: number) => {
    const role = roles.find((item) => item.ad_role_id === roleId);

    if (role) {
      onChange(role);
    }
  };

  return (
    <FormControl fullWidth>
      <InputLabel>Perfil</InputLabel>

      <Select
        value={value}
        label="Perfil"
        onChange={(event) => handleChange(Number(event.target.value))}
      >
        {roles.map((role) => (
          <MenuItem
            key={role.ad_role_id}
            value={role.ad_role_id}
          >
            {role.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}