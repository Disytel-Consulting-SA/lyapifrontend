import { Box, Button } from "@mui/material";
import type { WindowSchemaField } from "../types/metadata";
import DocumentActionButton from "./DocumentActionButton";

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

  return (
    <Box sx={{ marginTop: 2, marginBottom: 1 }}>
      <Button variant="contained" size="small" disabled>
        {field.name}
      </Button>
    </Box>
  );
}