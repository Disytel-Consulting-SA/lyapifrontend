import type { Theme } from "@mui/material/styles";
import type { SystemStyleObject } from "@mui/system";


export type FieldVisualState =
  | "view"
  | "edit"
  | "readonly";


function getViewStyle(theme: Theme): SystemStyleObject<Theme> {
  const dark = theme.palette.mode === "dark";

  return {
    "& .MuiInputBase-root": {
      backgroundColor: dark
        ? theme.palette.background.paper
        : "#ffffff",
    },

    "& .MuiInputBase-input.Mui-disabled": {
      WebkitTextFillColor: dark
        ? "#D0D0D0"
        : "#555555",
    },

    "& .MuiSelect-select.Mui-disabled": {
      WebkitTextFillColor: dark
        ? "#D0D0D0"
        : "#555555",
    },

    "& .MuiInputLabel-root.Mui-disabled": {
      color: dark
        ? "#C0C0C0"
        : "#666666",
    },

    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: dark
        ? "#616A6F"
        : "#aaaaaa",
    },

    "& .MuiFormHelperText-root.Mui-disabled": {
      color: dark
        ? "#999999"
        : "#888888",
    },
  };
}


function getEditStyle(theme: Theme): SystemStyleObject<Theme> {
  return {
    "& .MuiInputBase-root": {
      backgroundColor: theme.palette.background.paper,
    },
  };
}


function getReadOnlyStyle(theme: Theme): SystemStyleObject<Theme> {
  const dark = theme.palette.mode === "dark";

  return {
    "& .MuiInputBase-root": {
      backgroundColor: dark
        ? "#2A2A2A"
        : "#f1f1f1",
    },

    "& .MuiInputBase-input.Mui-disabled": {
      WebkitTextFillColor: dark
        ? "#AFAFAF"
        : "#666666",
    },

    "& .MuiSelect-select.Mui-disabled": {
      WebkitTextFillColor: dark
        ? "#AFAFAF"
        : "#666666",
    },

    "& .MuiInputLabel-root.Mui-disabled": {
      color: dark
        ? "#999999"
        : "#707070",
    },

    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: dark
        ? "#4A4A4A"
        : "#C0C0C0",
    },

    "& .MuiFormHelperText-root.Mui-disabled": {
      color: dark
        ? "#808080"
        : "#888888",
    },
  };
}


export function getFieldStateSx(
  state: FieldVisualState
): (theme: Theme) => SystemStyleObject<Theme> {

  return (theme: Theme) => {
    if (state === "view")
      return getViewStyle(theme);

    if (state === "edit")
      return getEditStyle(theme);

    return getReadOnlyStyle(theme);
  };
}