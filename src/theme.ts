import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: {
      main: "#E2A92D",
      dark: "#BE8224",
      contrastText: "#000000",
    },

    secondary: {
      main: "#616A6F",
    },

    text: {
      primary: "#000000",
      secondary: "#616A6F",
    },

    background: {
      default: "#FFFFFF",
      paper: "#FFFFFF",
    },

    divider: "#C0C0C0",
  },

  typography: {
    fontFamily: '"Exo 2", sans-serif',

    h4: {
      fontWeight: 600,
    },

    h5: {
      fontWeight: 600,
    },

    h6: {
      fontWeight: 600,
    },

    button: {
      fontWeight: 600,
      textTransform: "none",
    },
  },

  shape: {
    borderRadius: 6,
  },

  components: {
        MuiButton: {
    styleOverrides: {
        root: ({ ownerState }) => ({
        boxShadow: "none",

        ...(ownerState.variant === "contained" &&
        ownerState.color === "primary"
            ? {
                backgroundColor: "#E2A92D",
                color: "#000000",

                "&:hover": {
                backgroundColor: "#BE8224",
                boxShadow: "none",
                },
            }
            : {}),
        }),
    },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#E2A92D",
          },
        },
      },
    },

    MuiInputLabel: {
      styleOverrides: {
        root: {
          "&.Mui-focused": {
            color: "#BE8224",
          },
        },
      },
    },

    MuiCheckbox: {
      styleOverrides: {
        root: {
          "&.Mui-checked": {
            color: "#E2A92D",
          },
        },
      },
    },

    MuiListItemButton: {
      styleOverrides: {
        root: {
          "&.Mui-selected": {
            backgroundColor: "#E2A92D",
            color: "#000000",
          },

          "&.Mui-selected:hover": {
            backgroundColor: "#BE8224",
          },
        },
      },
    },
  },
});

export default theme;