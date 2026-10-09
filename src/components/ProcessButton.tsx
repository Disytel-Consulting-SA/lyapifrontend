import { useState } from "react";
import { Button } from "@mui/material";
import ProcessDialog from "./ProcessDialog";

interface Props {
  processId: number;
  label: string;
  tableName: string;
  recordId?: string | number;
  disabled?: boolean;
}

export default function ProcessButton({ processId, label, tableName, recordId, disabled = false }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="contained" size="small" disabled={disabled || recordId === undefined} onClick={() => setOpen(true)}>
        {label}
      </Button>

      <ProcessDialog
        open={open}
        processId={processId}
        tableName={tableName}
        recordId={recordId}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
