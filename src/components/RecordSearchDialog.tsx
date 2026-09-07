import { useMemo, useState } from "react";

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";

import type {
  WindowSchemaField,
  WindowSchemaTab,
} from "../types/metadata";


interface Props {
  open: boolean;
  tab: WindowSchemaTab;
  onClose: () => void;
  onSearch: (criteria: Record<string, string>) => void;
}


const STANDARD_SEARCH_COLUMNS = new Set([
  "Value",
  "Name",
  "DocumentNo",
  "Description",
]);


export default function RecordSearchDialog({
  open,
  tab,
  onClose,
  onSearch,
}: Props) {

  const [criteria, setCriteria] = useState<Record<string, string>>({});


  const searchFields = useMemo(() => {
    return tab.fields.filter(
      (field) =>
        STANDARD_SEARCH_COLUMNS.has(field.columnname) ||
        field.isselectioncolumn
    );
  }, [tab.fields]);


  function handleChange(field: WindowSchemaField, value: string) {
    setCriteria((current) => ({
      ...current,
      [field.columnname]: value,
    }));
  }


  function handleClear() {
    setCriteria({});
  }


  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (Object.values(criteria).every((value) => value.trim() === ""))
      return;

    onSearch(criteria);
  }


  function renderSearchField(field: WindowSchemaField) {
    const value = criteria[field.columnname] ?? "";
    const type = field.reference?.type;


    if (type === "boolean") {
      return (
        <FormControl
          key={field.ad_field_id}
          fullWidth
          size="small"
        >
          <InputLabel>{field.name}</InputLabel>

          <Select
            value={value}
            label={field.name}
            onChange={(event) => handleChange(field, event.target.value)}
          >
            <MenuItem value="">
              <em>Cualquiera</em>
            </MenuItem>

            <MenuItem value="Y">
              Sí
            </MenuItem>

            <MenuItem value="N">
              No
            </MenuItem>
          </Select>
        </FormControl>
      );
    }


    if (type === "list") {
      return (
        <FormControl
          key={field.ad_field_id}
          fullWidth
          size="small"
        >
          <InputLabel>{field.name}</InputLabel>

          <Select
            value={value}
            label={field.name}
            onChange={(event) => handleChange(field, event.target.value)}
          >
            <MenuItem value="">
              <em>Cualquiera</em>
            </MenuItem>

            {field.reference?.values?.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      );
    }


    if (
      type === "date" ||
      type === "datetime" ||
      type === "time"
    ) {
      const inputType =
        type === "date"
          ? "date"
          : type === "datetime"
          ? "datetime-local"
          : "time";

      return (
        <TextField
          key={field.ad_field_id}
          label={field.name}
          type={inputType}
          value={value}
          onChange={(event) => handleChange(field, event.target.value)}
          size="small"
          fullWidth
          slotProps={{ inputLabel: { shrink: true } }}
        />
      );
    }


    if (
      type === "integer" ||
      type === "number" ||
      type === "amount" ||
      type === "quantity" ||
      type === "costprice"
    ) {
      return (
        <TextField
          key={field.ad_field_id}
          label={field.name}
          type="number"
          value={value}
          onChange={(event) => handleChange(field, event.target.value)}
          size="small"
          fullWidth
          slotProps={{
            htmlInput: {
              step: type === "integer" ? 1 : "any",
            },
          }}
        />
      );
    }


    return (
      <TextField
        key={field.ad_field_id}
        label={field.name}
        value={value}
        onChange={(event) => handleChange(field, event.target.value)}
        size="small"
        fullWidth
      />
    );
  }


  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>
        Buscar: {tab.name}
      </DialogTitle>

      <Box component="form" onSubmit={handleSubmit}>

        <DialogContent>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              pt: 1,
            }}
          >
            {searchFields.map(renderSearchField)}
          </Box>
        </DialogContent>

        <DialogActions>
          <Button
            type="button"
            onClick={handleClear}
          >
            Limpiar
          </Button>

          <Button
            type="button"
            onClick={onClose}
          >
            Cancelar
          </Button>

          <Button
            type="submit"
            variant="contained"
            disabled={Object.values(criteria).every(
              (value) => value.trim() === ""
            )}
          >
            Buscar
          </Button>
        </DialogActions>

      </Box>
    </Dialog>
  );
}