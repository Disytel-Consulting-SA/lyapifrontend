import { useEffect, useState } from "react";
import {
  Button,
  ButtonGroup,
  CircularProgress,
  Menu,
  MenuItem,
  Tooltip,
} from "@mui/material";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";

import {
  getDocumentActions,
  processDocument,
} from "../api/libertyaApi";

import type {
  DocumentAction,
  DocumentActions,
} from "../api/libertyaApi";


interface Props {
  tableName: string;
  recordId: string | number;
  disabled?: boolean;
  onProcessed: () => void;
  listMode?: boolean;
}


export default function DocumentActionButton({
  tableName,
  recordId,
  disabled = false,
  onProcessed,
  listMode = false,
}: Props) {

  const [documentActions, setDocumentActions] = useState<DocumentActions | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);


  async function loadActions() {
    setLoading(true);
    setError(null);

    try {
      const result = await getDocumentActions(tableName, recordId);
      setDocumentActions(result);
    } catch (error) {
      console.error(`Error recuperando acciones para ${tableName}/${recordId}`, error);

      setDocumentActions(null);
      setError(
        error instanceof Error
          ? error.message
          : "No fue posible recuperar las acciones del documento"
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    void loadActions();
  }, [tableName, recordId]);


  const actions = documentActions?.actions ?? [];

  const defaultAction =
    actions.find((action) => action.value === documentActions?.defaultAction)
    ?? actions[0];


  async function executeAction(action: DocumentAction) {
    setAnchorEl(null);
    setProcessing(true);
    setError(null);

    try {
      await processDocument(tableName, recordId, action.value);

      onProcessed();

      await loadActions();
    } catch (error) {
      console.error(`Error procesando ${tableName}/${recordId} con acción ${action.value}`, error);

      setError(
        error instanceof Error
          ? error.message
          : "No fue posible procesar el documento"
      );
    } finally {
      setProcessing(false);
    }
  }


  if (listMode) {
    return (
      <>
        <Tooltip title={error ?? "Acciones del documento"}>
          <span>
            <Button
              size="small"
              variant="outlined"
              aria-label="Acciones del documento"
              disabled={disabled || loading || processing || actions.length === 0}
              onClick={(event) => { event.stopPropagation(); setAnchorEl(event.currentTarget); }}
              sx={{ minWidth: 36, px: 0.5 }}
            >
              {loading || processing ? <CircularProgress size={16} /> : <DescriptionOutlinedIcon fontSize="small" />}
              <ArrowDropDownIcon fontSize="small" />
            </Button>
          </span>
        </Tooltip>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)} onClick={(event) => event.stopPropagation()}>
          {actions.map((action) => (
            <MenuItem key={action.value} onClick={() => void executeAction(action)}>{action.name}</MenuItem>
          ))}
        </Menu>
      </>
    );
  }

  if (loading) {
    return (
      <Button variant="contained" size="small" disabled startIcon={<CircularProgress size={14} />}>
        Cargando...
      </Button>
    );
  }


  if (!defaultAction) {
    return (
      <Tooltip title={error ?? "No existen acciones disponibles para este documento"}>
        <span>
          <Button variant="contained" size="small" disabled>
            Sin acciones
          </Button>
        </span>
      </Tooltip>
    );
  }


  return (
    <>
      <Tooltip title={error ?? defaultAction.description ?? ""}>
        <ButtonGroup variant="contained" size="small" disabled={disabled || processing}>
          <Button onClick={() => void executeAction(defaultAction)}>
            {processing ? <CircularProgress size={16} /> : defaultAction.name}
          </Button>

          {actions.length > 1 && (
            <Button onClick={(event) => setAnchorEl(event.currentTarget)}>
              <ArrowDropDownIcon />
            </Button>
          )}
        </ButtonGroup>
      </Tooltip>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {actions.map((action) => (
          <MenuItem key={action.value} onClick={() => void executeAction(action)}>
            {action.name}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}