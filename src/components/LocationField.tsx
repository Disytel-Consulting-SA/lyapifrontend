import React from "react";

import {
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
} from "@mui/material";

import EditLocationAltOutlinedIcon
  from "@mui/icons-material/EditLocationAltOutlined";

import {
  getLocation,
} from "../api/libertyaApi";

import type {
  Location,
} from "../api/libertyaApi";

import type {
  WindowSchemaField,
} from "../types/metadata";

import type {
  FieldVisualState,
} from "../styles/fieldStateStyles";

import {
  getFieldStateSx,
} from "../styles/fieldStateStyles";

import LocationDialog from "./LocationDialog";


interface Props {
  field: WindowSchemaField;
  rawValue: unknown;
  editable: boolean;
  visualState: FieldVisualState;
  onChange: (value: string) => void;
}


export default function LocationField({
  field,
  rawValue,
  editable,
  visualState,
  onChange,
}: Props) {

  const value =
    rawValue === null ||
    rawValue === undefined
      ? ""
      : String(rawValue);

  const [open, setOpen] =
    React.useState(false);

  const [location, setLocation] =
    React.useState<Location | null>(null);

  const [loading, setLoading] =
    React.useState(false);


  /*
   * Recupera la localización existente cuando
   * el campo contiene un C_Location_ID.
   */
  React.useEffect(() => {

    const endpoint =
      field.reference?.endpoint;

    if (!endpoint || !value) {
      setLocation(null);
      return;
    }

    let cancelled = false;

    setLoading(true);

    getLocation(
      endpoint,
      value
    )
      .then((result) => {
        if (!cancelled)
          setLocation(result);
      })
      .catch((error) => {
        console.error(
          `Error recuperando localización ${value}`,
          error
        );

        if (!cancelled)
          setLocation(null);
      })
      .finally(() => {
        if (!cancelled)
          setLoading(false);
      });

    return () => {
      cancelled = true;
    };

  }, [
    field.reference?.endpoint,
    value,
  ]);


  /*
   * Recupera el texto descriptivo de una referencia
   * incluida por la REST API en referencedvalues.
   */
  function getReferencedValue(
    key: string
  ): string {

    return (
      location?.referencedvalues?.find(
        (item) => item.key === key
      )?.value ?? ""
    );
  }


  /*
   * Por ahora usamos una representación simple
   * de la dirección.
   *
   * Más adelante podremos reproducir exactamente
   * el formato utilizado por Libertya CORE.
   */
  const displayValue =
    location
      ? [
          location.address1,
          location.city,
          getReferencedValue(
            "c_region_id__detail"
          ),
        ]
          .filter(
            (part) =>
              part !== undefined &&
              part !== null &&
              part !== ""
          )
          .join(", ")
      : value;


  return (
    <>
      <TextField
        label={field.name}
        value={
          loading
            ? "Cargando..."
            : displayValue
        }
        required={field.ismandatory}
        fullWidth
        margin="dense"
        slotProps={{
          input: {
            readOnly: true,

            endAdornment: (
              <InputAdornment position="end">
                <Tooltip title="Editar ubicación / dirección">
                  <span>
                    <IconButton
                      size="small"
                      disabled={!editable}
                      onClick={() =>
                        setOpen(true)
                      }
                    >
                      <EditLocationAltOutlinedIcon
                        fontSize="small"
                      />
                    </IconButton>
                  </span>
                </Tooltip>
              </InputAdornment>
            ),
          },

          inputLabel: {
            shrink: true,
          },
        }}
        sx={
          getFieldStateSx(
            visualState
          )
        }
      />

      <LocationDialog
        open={open}
        locationId={value}
        location={location}
        onClose={() =>
          setOpen(false)
        }
        onAccept={(locationId: string) => {
          onChange(locationId);
          setOpen(false);
        }}
      />
    </>
  );
}