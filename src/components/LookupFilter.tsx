import { useEffect, useState } from "react";

import {
  Autocomplete,
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


interface Props {
  field: WindowSchemaField;
  value: string;
  contextValues?: Record<string, string>;
  onChange: (value: string) => void;
}


export default function LookupFilter({
  field,
  value,
  contextValues,
  onChange,
}: Props) {
  const [options, setOptions] =
    useState<LookupValue[]>([]);

  const [selectedOption, setSelectedOption] =
    useState<LookupValue | null>(null);

  const [inputValue, setInputValue] =
    useState("");

  /*
   * Valor que el usuario está escribiendo.
   * Todavía no dispara una búsqueda.
   */
  const [pendingSearchValue, setPendingSearchValue] =
    useState("");

  /*
   * Valor efectivamente utilizado para consultar
   * el lookup remoto, luego del debounce.
   */
  const [searchValue, setSearchValue] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const endpoint =
    field.reference?.endpoint;


  /*
   * Debounce de la búsqueda remota.
   */
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearchValue(pendingSearchValue);
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [pendingSearchValue]);


  /*
   * Resolver el valor seleccionado.
   *
   * Esto permite que, si el filtro ya tiene
   * un ID, el Autocomplete muestre su nombre.
   */
  useEffect(() => {
    if (!endpoint || value === "") {
      setSelectedOption(null);

      if (value === "") {
        setInputValue("");
      }

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
          setSelectedOption(values[0]);
          setInputValue(values[0].name);
        }
      })
      .catch((error) => {
        console.error(
          `Error resolviendo filtro lookup ${field.columnname}`,
          error
        );
      });

    return () => {
      cancelled = true;
    };
  }, [
    endpoint,
    value,
    contextValues,
    field.columnname,
  ]);


  /*
   * Buscar opciones remotamente.
   */
  useEffect(() => {
    if (!endpoint) {
      return;
    }

    let cancelled = false;

    setLoading(true);

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
      .catch((error) => {
        console.error(
          `Error recuperando filtro lookup ${field.columnname}`,
          error
        );

        if (!cancelled) {
          setOptions([]);
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
    field.columnname,
  ]);


  return (
    <Autocomplete
      fullWidth
      options={options}
      value={selectedOption}
      loading={loading}
      filterOptions={(x) => x}
      getOptionLabel={(option) =>
        option.name
      }
      isOptionEqualToValue={(
        option,
        selected
      ) =>
        option.value === selected.value
      }
      inputValue={inputValue}

      onInputChange={(
        _,
        newInputValue,
        reason
      ) => {
        setInputValue(newInputValue);

        if (reason === "input") {
          setPendingSearchValue(newInputValue);
        }

        if (reason === "clear") {
          setPendingSearchValue("");
          setSearchValue("");
        }
      }}

      onChange={(_, newValue) => {
        setSelectedOption(newValue);

        setInputValue(
          newValue
            ? newValue.name
            : ""
        );

        setPendingSearchValue("");
        setSearchValue("");

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
          size="small"
          slotProps={{
            ...params.slotProps,
            inputLabel: {
              ...params.slotProps.inputLabel,
              shrink: true,
            },
          }}
        />
      )}
    />
  );
}