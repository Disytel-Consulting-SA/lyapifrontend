import type { Theme } from "@mui/material/styles";
import type { SystemStyleObject } from "@mui/system";


export type FieldVisualState =
  | "view"
  | "edit"
  | "readonly";


function getViewStyle(
  theme: Theme
): SystemStyleObject<Theme> {

  const dark = theme.palette.mode === "dark";

  return {
    "& .MuiInputBase-root": {
      backgroundColor: dark
        ? "rgba(255,255,255,0.04)"
        : "rgba(0,0,0,0.025)",
    },
  };
}


function getEditStyle(
  _theme: Theme
): SystemStyleObject<Theme> {

  return {
    "& .MuiInputBase-root": {
      backgroundColor: "transparent",
    },
  };
}


function getReadOnlyStyle(
  theme: Theme
): SystemStyleObject<Theme> {

  const dark = theme.palette.mode === "dark";

  return {
    "& .MuiInputBase-root": {
      backgroundColor: dark
        ? "rgba(255,255,255,0.06)"
        : "rgba(0,0,0,0.045)",
    },
    "& .MuiInputBase-input.Mui-disabled": {
      WebkitTextFillColor: theme.palette.text.primary,
    },
    "& .MuiInputLabel-root.Mui-disabled": {
      color: theme.palette.text.secondary,
    },
  };
}


export function getFieldStateSx(
  state: FieldVisualState,
  requiredEmpty = false
): (theme: Theme) => SystemStyleObject<Theme> {

  return (theme: Theme) => {

    if (requiredEmpty && state === "edit") {
      const dark = theme.palette.mode === "dark";

      return {
        "& .MuiInputBase-root": {
          backgroundColor: dark
            ? "rgba(237, 170, 20, 0.10)"
            : "rgba(237, 170, 20, 0.07)",
        },
      };
    }

    if (state === "view") {
      return getViewStyle(theme);
    }

    if (state === "edit") {
      return getEditStyle(theme);
    }

    return getReadOnlyStyle(theme);
  };
}


export function getReadOnlyContainerSx(
  readOnly: boolean
): (theme: Theme) => SystemStyleObject<Theme> {

  return (theme: Theme) => {

    if (!readOnly) {
      return {};
    }

    const dark = theme.palette.mode === "dark";

    return {
      opacity: 1,

      "& .MuiCheckbox-root.Mui-disabled": {
        color: dark
          ? "rgba(255,255,255,0.50)"
          : "rgba(0,0,0,0.45)",
      },

      "& .MuiFormControlLabel-label.Mui-disabled": {
        color: theme.palette.text.primary,
      },
    };
  };
}