import type { Theme } from "@mui/material/styles";
import type { SystemStyleObject } from "@mui/system";


export type FieldVisualState =
  | "view"
  | "edit"
  | "readonly";


const FIELD_STATE_STYLES: Record<
  FieldVisualState,
  SystemStyleObject<Theme>
> = {

    view: {
    "& .MuiInputBase-root": {
        backgroundColor: "#ffffff",
    },

    "& .MuiInputBase-input.Mui-disabled": {
        WebkitTextFillColor: "#555555",
    },

    "& .MuiInputLabel-root.Mui-disabled": {
        color: "#666666",
    },

    "& .MuiOutlinedInput-notchedOutline": {
        borderColor: "#aaaaaa",
    },

    "& .MuiFormHelperText-root.Mui-disabled": {
        color: "#888888",
    },
    },

  edit: {
    "& .MuiInputBase-root": {
      backgroundColor: "#ffffff",
    },
  },

  readonly: {
    "& .MuiInputBase-root": {
      backgroundColor: "#f1f1f1",
    },

    "& .MuiInputBase-input.Mui-disabled": {
      WebkitTextFillColor: "#666666",
    },

    "& .MuiInputLabel-root.Mui-disabled": {
      color: "#707070",
    },

    "& .MuiFormHelperText-root.Mui-disabled": {
      color: "#888888",
    },
  },

};


export function getFieldStateSx(
  state: FieldVisualState
): SystemStyleObject<Theme> {

  return FIELD_STATE_STYLES[state];
}