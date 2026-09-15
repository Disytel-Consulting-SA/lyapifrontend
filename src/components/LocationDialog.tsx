import React from "react";

import {
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";

import {
  createLocation,
  getLookupValues,
  updateLocation,
} from "../api/libertyaApi";

import type {
  Location,
  LookupValue,
} from "../api/libertyaApi";


interface Props {
  open: boolean;
  endpoint: string;
  locationId: string;
  location: Location | null;
  onClose: () => void;
  onAccept: (locationId: string) => void;
}


interface LocationFormState {
  address1: string;
  address2: string;
  address3: string;
  address4: string;
  plaza: string;
  city: string;
  postal: string;

  c_country_id: number | null;
  c_region_id: number | null;
}


function createFormState(
  location: Location | null
): LocationFormState {

  return {
    address1:
      location?.address1 ?? "",

    address2:
      location?.address2 ?? "",

    address3:
      location?.address3 ?? "",

    address4:
      location?.address4 ?? "",

    plaza:
      location?.plaza ?? "",

    city:
      location?.city ?? "",

    postal:
      location?.postal ?? "",

    c_country_id:
      location?.c_country_id ?? null,

    c_region_id:
      location?.c_region_id ?? null,
  };
}


export default function LocationDialog({
  open,
  endpoint,
  locationId,
  location,
  onClose,
  onAccept,
}: Props) {

  const [form, setForm] =
    React.useState<LocationFormState>(
      createFormState(location)
    );


    const [countries, setCountries] =
        React.useState<LookupValue[]>([]);    

    const [regions, setRegions] =
        React.useState<LookupValue[]>([]);

    const [loadingCountries, setLoadingCountries] =
        React.useState(false);

    const [loadingRegions, setLoadingRegions] =
        React.useState(false);

    const [saving, setSaving] =
        React.useState(false);

    const [saveError, setSaveError] =
        React.useState<string | null>(null);   

  /*
   * Cada vez que se abre el diálogo, copiamos
   * la Location recibida al estado local.
   *
   * De esta manera Cancelar descarta todos los
   * cambios realizados dentro del diálogo.
   */
  React.useEffect(() => {

    if (!open)
      return;

    setForm(
      createFormState(location)
    );

  }, [
    open,
    location,
  ]);



    React.useEffect(() => {

    if (!open)
        return;

    let cancelled = false;

    setLoadingCountries(true);

    getLookupValues(
        "/v1.0/columns/2250/lookup",
        500,
        1
    )
        .then((values) => {

        if (!cancelled)
            setCountries(values);
        })
        .catch((error) => {

        console.error(
            "Error recuperando países",
            error
        );

        if (!cancelled)
            setCountries([]);
        })
        .finally(() => {

        if (!cancelled)
            setLoadingCountries(false);
        });

    return () => {
        cancelled = true;
    };

    }, [open]);



    React.useEffect(() => {

    if (!open) {
        return;
    }

    if (form.c_country_id === null) {
        setRegions([]);
        return;
    }

    let cancelled = false;

    setLoadingRegions(true);

    getLookupValues(
        "/v1.0/columns/2251/lookup",
        500,
        1,
        undefined,
        undefined,
        {
        C_Country_ID:
            String(form.c_country_id),
        }
    )
        .then((values) => {

        if (!cancelled)
            setRegions(values);
        })
        .catch((error) => {

        console.error(
            "Error recuperando provincias",
            error
        );

        if (!cancelled)
            setRegions([]);
        })
        .finally(() => {

        if (!cancelled)
            setLoadingRegions(false);
        });

    return () => {
        cancelled = true;
    };

    }, [
    open,
    form.c_country_id,
    ]);


  function setTextValue(
    field:
      | "address1"
      | "address2"
      | "address3"
      | "address4"
      | "plaza"
      | "city"
      | "postal",
    value: string
  ) {

    setForm(
      (current) => ({
        ...current,
        [field]: value,
      })
    );
  }


async function handleAccept() {

  try {

    setSaving(true);
    setSaveError(null);


    const payload = {
      address1: form.address1,
      address2: form.address2,
      address3: form.address3,
      address4: form.address4,
      plaza: form.plaza,
      city: form.city,
      postal: form.postal,

      ...(form.c_country_id !== null
        ? {
            c_country_id:
              form.c_country_id,
          }
        : {}),

      ...(form.c_region_id !== null
        ? {
            c_region_id:
              form.c_region_id,
          }
        : {}),
    };


    /*
     * Location existente:
     * actualizarla.
     */
    if (locationId) {

      await updateLocation(
        endpoint,
        locationId,
        payload
      );

      onAccept(locationId);

      return;
    }


    /*
     * Location nueva:
     * crearla inmediatamente.
     */
    const createdId =
      await createLocation(
        endpoint,
        payload
      );


    if (!createdId) {
      throw new Error(
        "El backend no retornó el ID de la localización creada"
      );
    }


    /*
     * Devolvemos el nuevo C_Location_ID
     * al LocationField.
     */
    onAccept(createdId);


  } catch (error) {

    console.error(
      "Error guardando localización",
      error
    );

    setSaveError(
      error instanceof Error
        ? error.message
        : "Error guardando localización"
    );

  } finally {

    setSaving(false);
  }
}


  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>
        Actualizar ubicación / dirección
      </DialogTitle>

      <DialogContent>
        <Stack
          spacing={1}
          sx={{ paddingTop: 1 }}
        >
          <TextField
            label="Dirección 1"
            value={form.address1}
            onChange={(event) =>
              setTextValue(
                "address1",
                event.target.value
              )
            }
            fullWidth
          />

          <TextField
            label="Dirección 2"
            value={form.address2}
            onChange={(event) =>
              setTextValue(
                "address2",
                event.target.value
              )
            }
            fullWidth
          />

          <TextField
            label="Dirección 3"
            value={form.address3}
            onChange={(event) =>
              setTextValue(
                "address3",
                event.target.value
              )
            }
            fullWidth
          />

          <TextField
            label="Dirección 4"
            value={form.address4}
            onChange={(event) =>
              setTextValue(
                "address4",
                event.target.value
              )
            }
            fullWidth
          />

          <TextField
            label="Plaza"
            value={form.plaza}
            onChange={(event) =>
              setTextValue(
                "plaza",
                event.target.value
              )
            }
            fullWidth
          />

          <TextField
            label="Ciudad"
            value={form.city}
            onChange={(event) =>
              setTextValue(
                "city",
                event.target.value
              )
            }
            fullWidth
          />

          <TextField
            label="C.P."
            value={form.postal}
            onChange={(event) =>
              setTextValue(
                "postal",
                event.target.value
              )
            }
            fullWidth
          />




        <Autocomplete
        options={countries}
        loading={loadingCountries}

        value={
            countries.find(
            (option) =>
                Number(option.value) ===
                form.c_country_id
            ) ?? null
        }

        getOptionLabel={(option) =>
            option.name
        }

        isOptionEqualToValue={
            (option, selected) =>
            option.value === selected.value
        }

        onChange={(
            _event,
            selected
        ) => {

            const newCountryId =
            selected
                ? Number(selected.value)
                : null;

            setForm(
            (current) => ({
                ...current,

                c_country_id:
                newCountryId,

                /*
                * Al cambiar país, la provincia
                * anterior deja de ser válida.
                */
                c_region_id:
                newCountryId ===
                current.c_country_id
                    ? current.c_region_id
                    : null,
            })
            );
        }}

        renderInput={(params) => (
        <TextField
            {...params}
            label="País"
        />
        )}
        />


        <Autocomplete
        options={regions}
        loading={loadingRegions}

        disabled={
            form.c_country_id === null
        }

        value={
            regions.find(
            (option) =>
                Number(option.value) ===
                form.c_region_id
            ) ?? null
        }

        getOptionLabel={(option) =>
            option.name
        }

        isOptionEqualToValue={
            (option, selected) =>
            option.value === selected.value
        }

        onChange={(
            _event,
            selected
        ) => {

            setForm(
            (current) => ({
                ...current,

                c_region_id:
                selected
                    ? Number(selected.value)
                    : null,
            })
            );
        }}

        renderInput={(params) => (
        <TextField
            {...params}
            label="Provincia"
        />
        )}
        />

        </Stack>
      </DialogContent>

      <DialogActions>

        {saveError && (
        <div
            style={{
            flex: 1,
            color: "red",
            fontSize: "0.85rem",
            }}
        >
            {saveError}
        </div>
        )}


        <Button
          onClick={onClose}
        >
          Cancelar
        </Button>

        <Button
        variant="contained"
        onClick={handleAccept}
        disabled={saving}
        >
        {saving
            ? "Guardando..."
            : "Aceptar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}