import { useEffect, useState } from "react";

import {
  Autocomplete,
  Box,
  TextField,
} from "@mui/material";

import {
  getLookupValues,
} from "../api/libertyaApi";

import type {
  LookupValue,
} from "../api/libertyaApi";

import type {
  WindowSchemaField,
} from "../types/metadata";

import {
  getFieldStateSx,
} from "../styles/fieldStateStyles";

import type {
  FieldVisualState,
} from "../styles/fieldStateStyles";


interface Props {
  field: WindowSchemaField;
  rawValue: unknown;
  editable: boolean;
  visualState: FieldVisualState;
  requiredEmpty: boolean;
  contextValues: Record<string, string>;
  onChange: (value: string) => void;
}


export default function LookupField({
  field,
  rawValue,
  editable,
  visualState,
  requiredEmpty,
  contextValues,
  onChange,
}: Props) {
  const [options, setOptions] =
    useState<LookupValue[]>([]);

  const [selectedOption, setSelectedOption] =
    useState<LookupValue | null>(null);

  const [inputValue, setInputValue] =
    useState("");

  const [searchValue, setSearchValue] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const endpoint =
    field.reference?.endpoint;

  const value =
    rawValue === null ||
    rawValue === undefined
      ? ""
      : String(rawValue);


  /*
   * Resolver el valor actualmente seleccionado.
   */
  useEffect(() => {
    if (!endpoint || value === "") {
      setSelectedOption(null);
      setInputValue("");
      return;
    }

    let cancelled = false;

    getLookupValues(
      endpoint,
      1,
      1,
      undefined,
      value,
      contextValues
    )
      .then((values) => {
        if (cancelled) {
          return;
        }

        if (values.length > 0) {
          setSelectedOption(
            values[0]
          );

          setInputValue(
            values[0].name
          );
        } else {
          setSelectedOption(null);
          setInputValue("");
        }
      })
      .catch((err) => {
        console.error(
          `Error resolviendo valor ${value} en ${endpoint}`,
          err
        );
      });

    return () => {
      cancelled = true;
    };
  }, [
    endpoint,
    value,
    contextValues,
  ]);


  /*
   * Recuperar las opciones disponibles.
   */
  useEffect(() => {
    if (!endpoint || !editable) {
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError(null);

    getLookupValues(
      endpoint,
      50,
      1,
      searchValue || undefined,
      undefined,
      contextValues
    )
      .then((values) => {
        if (!cancelled) {
          setOptions(values);
        }
      })
      .catch((err) => {
        console.error(
          `Error recuperando lookup ${endpoint}`,
          err
        );

        if (!cancelled) {
          setOptions([]);
          setError(
            "No fue posible cargar los valores"
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    endpoint,
    searchValue,
    contextValues,
    editable,
  ]);


  return (
    <Box>
      <Autocomplete
        fullWidth
        options={options}
        value={selectedOption}
        loading={loading}
        disabled={!editable}
        filterOptions={(x) => x}
        getOptionLabel={(option) =>
          option.name
        }
        isOptionEqualToValue={(
          option,
          selected
        ) =>
          option.value ===
          selected.value
        }
        inputValue={inputValue}

        onInputChange={(
          _,
          newInputValue,
          reason
        ) => {
          setInputValue(
            newInputValue
          );

          if (reason === "input") {
            setSearchValue(
              newInputValue
            );
          }

          if (reason === "clear") {
            setSearchValue("");
          }
        }}

        onChange={(
          _,
          newValue
        ) => {
          setSelectedOption(
            newValue
          );

          setInputValue(
            newValue
              ? newValue.name
              : ""
          );

          onChange(
            newValue
              ? newValue.value
              : ""
          );
        }}

        renderInput={(params) => (
          <TextField
            {...params}
            label={field.name}
            required={
              field.ismandatory
            }
            error={Boolean(error)}
            helperText={
              error ?? undefined
            }
            margin="dense"
            slotProps={{
              ...params.slotProps,
              inputLabel: {
                ...params
                  .slotProps
                  .inputLabel,
                shrink: true,
              },
            }}
            sx={getFieldStateSx(
              visualState,
              requiredEmpty
            )}
          />
        )}
      />
    </Box>
  );
}