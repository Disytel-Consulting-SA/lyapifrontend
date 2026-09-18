import React, {
  useEffect,
} from "react";

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

import LocationDialog
  from "./LocationDialog";

import type {
  FieldVisualState,
} from "../styles/fieldStateStyles";
import { getFieldStateSx } from "../styles/fieldStateStyles";


interface Props {
  field: WindowSchemaField;
  rawValue: unknown;
  editable: boolean;

  visualState: FieldVisualState;

  onChange: (
    value: string
  ) => void;
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
    React.useState<Location | null>(
      null
    );

  const [loading, setLoading] =
    React.useState(false);


  /*
   * Recupera nuevamente la Location desde
   * backend.
   *
   * Esta función también se utiliza después
   * de guardar el diálogo, para refrescar la
   * representación visible del campo.
   */
  const loadLocation =
    React.useCallback(
      async () => {

        const endpoint =
          field.reference?.endpoint;

        if (!endpoint || !value) {
          setLocation(null);
          return;
        }

        setLoading(true);

        try {

          const result =
            await getLocation(
              endpoint,
              value
            );

          setLocation(result);

        } catch (error) {

          console.error(
            `Error recuperando localización ${value}`,
            error
          );

          setLocation(null);

        } finally {

          setLoading(false);
        }
      },
      [
        field.reference?.endpoint,
        value,
      ]
    );


  /*
   * Recuperar Location cuando cambia el ID
   * asociado al campo.
   */
  useEffect(() => {

    void loadLocation();

  }, [loadLocation]);


  /*
   * Recupera la descripción de una referencia
   * incluida en referencedvalues.
   */
  function getReferencedValue(
    key: string
  ): string | undefined {

    return location
      ?.referencedvalues
      ?.find(
        (item) =>
          item.key === key
      )
      ?.value;
  }


  /*
   * Representación compacta que se muestra
   * dentro de la ventana dinámica.
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
              part !== null &&
              part !== undefined &&
              String(part).trim() !== ""
          )
          .join(", ")
      : value;


  /*
   * El campo puede abrirse únicamente cuando
   * la ventana permite editarlo.
   */
  const canEdit =
    editable;


  return (
    <>
      <TextField
        label={field.name}
        sx={getFieldStateSx(visualState)}
        value={
          loading
            ? "Cargando..."
            : displayValue
        }
        fullWidth
        required={
          field.ismandatory
        }
        slotProps={{
          inputLabel: {
            shrink: true,
        },  
          input: {
            readOnly: true,

            endAdornment: (
              <InputAdornment
                position="end"
              >
                <Tooltip
                  title={
                    canEdit
                      ? "Editar ubicación / dirección"
                      : "Ubicación / dirección"
                  }
                >
                  <span>
                    <IconButton
                      edge="end"
                      disabled={!canEdit}
                      onClick={() =>
                        setOpen(true)
                      }
                    >
                      <EditLocationAltOutlinedIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              </InputAdornment>
            ),
          },
        }}
      />


      <LocationDialog
        open={open}

        endpoint={
          field.reference?.endpoint ?? ""
        }

        locationId={value}

        location={location}

        onClose={() =>
          setOpen(false)
        }

        onAccept={async (
          locationId
        ) => {

          /*
           * El ID de Location sigue siendo el
           * valor del campo del registro padre.
           */
          onChange(locationId);

          setOpen(false);

          /*
           * El PUT ya fue realizado por
           * LocationDialog.
           *
           * Volvemos a recuperar la Location
           * para actualizar address1, city,
           * referencedvalues, etc.
           */
          await loadLocation();
        }}
      />
    </>
  );
}
