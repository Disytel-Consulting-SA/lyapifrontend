import {
  Alert,
  Box,
  Button,
  Paper,
  TextField,
  Typography,
} from "@mui/material";

import {
  useState,
} from "react";

import {
  login,
} from "../api/libertyaApi";

import {
  setSession,
} from "../auth";

import libertyaLogo
  from "../assets/libertya-next-logo.png";


interface Props {
  onLogin: () => void;
}


const DEFAULT_CLIENT_ID =
  Number(
    import.meta.env
      .VITE_LIBERTYA_CLIENT_ID ??
    1010016
  );


const DEFAULT_ORG_ID =
  Number(
    import.meta.env
      .VITE_LIBERTYA_ORG_ID ??
    0
  );


export default function Login({
  onLogin,
}: Props) {

  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);


  async function handleSubmit(
    event: React.FormEvent
  ) {

    event.preventDefault();


    if (
      username.trim() === "" ||
      password === ""
    ) {

      setError(
        "Ingresá usuario y contraseña"
      );

      return;
    }


    setLoading(true);
    setError(null);


    try {

      const token =
        await login({
          username:
            username.trim(),

          password,

          clientId:
            DEFAULT_CLIENT_ID,

          orgId:
            DEFAULT_ORG_ID,
        });


      setSession(
        token,
        username.trim()
      );


      onLogin();


    } catch (err) {

      setError(
        err instanceof Error
          ? err.message
          : "Error de autenticación"
      );


    } finally {

      setLoading(false);
    }
  }


  return (
    <Box
      sx={{
        minHeight: "100vh",

        display: "flex",
        alignItems: "center",
        justifyContent: "center",

        backgroundColor:
          "#f7f7f7",

        padding: 2,
      }}
    >

      <Paper
        elevation={3}

        sx={{
          width: "100%",
          maxWidth: 420,

          padding: 4,
        }}
      >

        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 3,
          }}
        >

          <Box
            component="img"

            src={
              libertyaLogo
            }

            alt="Libertya Next"

            sx={{
              width: 220,
              height: "auto",
            }}
          />

        </Box>


        <Typography
          variant="h6"
          align="center"

          sx={{
            marginBottom: 3,
          }}
        >
          Dynamic UI
        </Typography>


        <Box
          component="form"

          onSubmit={
            handleSubmit
          }
        >

          <TextField
            label="Usuario"

            value={
              username
            }

            onChange={(event) =>
              setUsername(
                event.target.value
              )
            }

            fullWidth

            autoFocus

            autoComplete="username"

            margin="normal"

            disabled={
              loading
            }
          />


          <TextField
            label="Contraseña"

            type="password"

            value={
              password
            }

            onChange={(event) =>
              setPassword(
                event.target.value
              )
            }

            fullWidth

            autoComplete="current-password"

            margin="normal"

            disabled={
              loading
            }
          />


          {error && (

            <Alert
              severity="error"

              sx={{
                marginTop: 2,
              }}
            >
              {error}
            </Alert>

          )}


          <Button
            type="submit"

            variant="contained"

            fullWidth

            disabled={
              loading
            }

            sx={{
              marginTop: 3,
            }}
          >
            {loading
              ? "Ingresando..."
              : "Ingresar"}
          </Button>

        </Box>


        <Typography
          variant="caption"

          color="text.secondary"

          align="center"

          sx={{
            display: "block",
            marginTop: 3,
          }}
        >
          Compañía: {DEFAULT_CLIENT_ID}
          {" · "}
          Organización: {DEFAULT_ORG_ID}
        </Typography>

      </Paper>

    </Box>
  );
}