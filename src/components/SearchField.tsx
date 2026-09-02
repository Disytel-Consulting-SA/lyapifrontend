import { useEffect, useState } from "react";

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";

import { getLookupValues } from "../api/libertyaApi";
import type { LookupValue } from "../api/libertyaApi";
import type { WindowSchemaField } from "../types/metadata";

import { getFieldStateSx } from "../styles/fieldStateStyles";
import type { FieldVisualState } from "../styles/fieldStateStyles";


interface Props {
  field: WindowSchemaField;
  rawValue: unknown;
  editable: boolean;
  visualState: FieldVisualState;
  onChange: (value: string) => void;
}


export default function SearchField({
  field,
  rawValue,
  editable,
  visualState,
  onChange,
}: Props) {

  const [open, setOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState<LookupValue | null>(null);
  const [results, setResults] = useState<LookupValue[]>([]);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endpoint = field.reference?.endpoint;
  const value = rawValue === null || rawValue === undefined ? "" : String(rawValue);


  useEffect(() => {
    if (!endpoint || value === "") {
      setSelectedOption(null);
      return;
    }

    let cancelled = false;

    getLookupValues(endpoint, 1, 1, undefined, value)
      .then((values) => {
        if (!cancelled && values.length > 0)
          setSelectedOption(values[0]);
        else if (!cancelled)
          setSelectedOption(null);
      })
      .catch((err) => {
        console.error(`Error resolviendo valor ${value} en ${endpoint}`, err);

        if (!cancelled)
          setSelectedOption(null);
      });

    return () => {
      cancelled = true;
    };
  }, [endpoint, value]);


  useEffect(() => {
    if (!open || !endpoint || !editable)
      return;

    let cancelled = false;

    setLoading(true);
    setError(null);

    getLookupValues(endpoint, 50, 1, searchText || undefined)
      .then((values) => {
        if (!cancelled)
          setResults(values);
      })
      .catch((err) => {
        console.error(`Error recuperando búsqueda ${endpoint}`, err);

        if (!cancelled) {
          setResults([]);
          setError("No fue posible recuperar los resultados");
        }
      })
      .finally(() => {
        if (!cancelled)
          setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, endpoint, searchText, editable]);


  function handleSelect(option: LookupValue) {
    if (!editable)
      return;

    setSelectedOption(option);
    onChange(option.value);
    setOpen(false);
  }


  function handleClear() {
    if (!editable)
      return;

    setSelectedOption(null);
    onChange("");
  }


  function handleOpen() {
    if (!editable)
      return;

    setSearchText("");
    setResults([]);
    setError(null);
    setOpen(true);
  }


  return (
    <Box sx={{ marginTop: 2, marginBottom: 1 }}>
      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
        <TextField
          label={field.name}
          value={selectedOption?.name ?? ""}
          required={field.ismandatory}
          disabled={!editable}
          fullWidth
          slotProps={{ input: { readOnly: true } }}
          helperText={`column: ${field.columnname}`}
          sx={getFieldStateSx(visualState)}
        />

        <Button
          variant="contained"
          disabled={!editable}
          onClick={handleOpen}
          sx={{ minWidth: 100, marginTop: 1 }}
        >
          Buscar
        </Button>

        {!field.ismandatory && (
          <Button
            variant="outlined"
            disabled={!editable}
            onClick={handleClear}
            sx={{ minWidth: 90, marginTop: 1 }}
          >
            Limpiar
          </Button>
        )}
      </Box>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          Buscar {field.name}
        </DialogTitle>

        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Buscar"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            sx={{ marginTop: 1, marginBottom: 2 }}
          />

          {loading && (
            <Typography>
              Buscando...
            </Typography>
          )}

          {error && (
            <Typography color="error">
              {error}
            </Typography>
          )}

          {!loading && !error && results.length === 0 && (
            <Typography>
              No se encontraron resultados.
            </Typography>
          )}

          {!loading && !error && results.length > 0 && (
            <List>
              {results.map((option) => (
                <ListItemButton
                  key={option.value}
                  disabled={!option.isactive}
                  selected={selectedOption?.value === option.value}
                  onClick={() => handleSelect(option)}
                >
                  <ListItemText
                    primary={option.name}
                    secondary={`ID: ${option.value}`}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpen(false)}>
            Cancelar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}