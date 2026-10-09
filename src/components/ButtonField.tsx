import { Box, Button } from "@mui/material";
import type { WindowSchemaField } from "../types/metadata";
import DocumentActionButton from "./DocumentActionButton";
import ProcessButton from "./ProcessButton";

interface ButtonFieldProps {
  field: WindowSchemaField;
  tableName: string;
  recordId?: string | number;
  disabled?: boolean;
  onProcessed: () => void;
}

export default function ButtonField({
  field,
  tableName,
  recordId,
  disabled = false,
  onProcessed,
}: ButtonFieldProps) {

  const buttonType = field.reference?.button_type;

  if (buttonType === "document-action" && recordId !== undefined) {
    return (
      <Box sx={{ marginTop: 2, marginBottom: 1 }}>
        <DocumentActionButton
          tableName={tableName}
          recordId={recordId}
          disabled={disabled}
          onProcessed={onProcessed}
        />
      </Box>
    );
  }

  if (buttonType === "process" && field.reference?.process_id !== undefined) {
    return (
      <Box sx={{ marginTop: 2, marginBottom: 1 }}>
        <ProcessButton processId={field.reference.process_id} label={field.name} tableName={tableName} recordId={recordId} disabled={disabled} />
      </Box>
    );
  }

  return (
    <Box sx={{ marginTop: 2, marginBottom: 1 }}>
      <Button variant="contained" size="small" disabled>
        {field.name}
      </Button>
    </Box>
  );
}