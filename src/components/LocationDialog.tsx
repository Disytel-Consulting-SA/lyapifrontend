import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";

import type {
  Location,
} from "../api/libertyaApi";


interface Props {
  open: boolean;
  locationId: string;
  location: Location | null;
  onClose: () => void;
  onAccept: (locationId: string) => void;
}


export default function LocationDialog({
  open,
  locationId,
  location,
  onClose,
  onAccept,
}: Props) {

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
            value={location?.address1 ?? ""}
            fullWidth
          />

          <TextField
            label="Dirección 2"
            value={location?.address2 ?? ""}
            fullWidth
          />

          <TextField
            label="Dirección 3"
            value={location?.address3 ?? ""}
            fullWidth
          />

          <TextField
            label="Dirección 4"
            value={location?.address4 ?? ""}
            fullWidth
          />

          <TextField
            label="Plaza"
            value={location?.plaza ?? ""}
            fullWidth
          />

          <TextField
            label="Ciudad"
            value={location?.city ?? ""}
            fullWidth
          />

          <TextField
            label="C.P."
            value={location?.postal ?? ""}
            fullWidth
          />

          <TextField
            label="Provincia"
            value={
              getReferencedValue(
                "c_region_id__detail"
              )
            }
            fullWidth
          />

          <TextField
            label="País"
            value={
              getReferencedValue(
                "c_country_id__detail"
              )
            }
            fullWidth
          />
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button
          onClick={onClose}
        >
          Cancelar
        </Button>

        <Button
          variant="contained"
          onClick={() =>
            onAccept(locationId)
          }
        >
          Aceptar
        </Button>
      </DialogActions>
    </Dialog>
  );
}