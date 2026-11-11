import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, TextField, Typography } from "@mui/material";
import { evaluateProcessState, executeProcess, generateProcessReport, getProcessSchema } from "../api/libertyaApi";
import type { ProcessParameterState, ProcessSchema, ProcessSchemaParameter } from "../types/process";
import LookupField from "./LookupField";
import SearchField from "./SearchField";

interface Props {
  open: boolean;
  mode?: "process" | "report";
  processId: number;
  tableName?: string;
  recordId?: string | number;
  onClose: () => void;
}

export default function ProcessDialog({ open, processId, tableName, recordId, onClose, mode = "process" }: Props) {
  const [schema, setSchema] = useState<ProcessSchema | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [valuesTo, setValuesTo] = useState<Record<string, string>>({});
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFilename, setPdfFilename] = useState<string>("informe.pdf");
  const [states, setStates] = useState<Record<string, ProcessParameterState>>({});
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; summary?: string | null } | null>(null);

  const contextValues = useMemo(() => values, [values]);

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  function buildPdfFilename(reportName: string, date: Date): string {
    const safeName = reportName.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "informe";
    const pad = (value: number) => String(value).padStart(2, "0");
    const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
    return `${safeName}-${stamp}.pdf`;
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSchema(null);
    setValues({});
    setValuesTo({});
    setPdfUrl(null);
    setPdfFilename("informe.pdf");
    setStates({});
    setResult(null);

    Promise.all([
      getProcessSchema(processId),
      evaluateProcessState(processId, {
        table: tableName,
        record_id: recordId === undefined ? undefined : Number(recordId),
      }),
    ])
      .then(([nextSchema, state]) => {
        if (cancelled) return;
        setSchema(nextSchema);
        setValues(state.values ?? {});
        setStates(Object.fromEntries((state.parameters ?? []).map((parameter) => [parameter.columnname, parameter])));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, processId, tableName, recordId, mode]);

  async function changeValue(parameter: ProcessSchemaParameter, value: string) {
    const nextValues = { ...values };
    if (value === "") delete nextValues[parameter.columnname];
    else nextValues[parameter.columnname] = value;

    setValues(nextValues);
    setEvaluating(true);
    setError(null);

    try {
      const state = await evaluateProcessState(processId, {
        table: tableName,
        record_id: recordId === undefined ? undefined : Number(recordId),
        values: nextValues,
        changed_parameters: [parameter.columnname],
      });
      setValues(state.values ?? {});
      setStates(Object.fromEntries((state.parameters ?? []).map((item) => [item.columnname, item])));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setEvaluating(false);
    }
  }

  async function runProcess() {
    if (!schema) return;

    const missingRequired = (schema.parameters ?? []).some((parameter) => {
      const state = states[parameter.columnname];
      return state?.displayed !== false && parameter.ismandatory && (values[parameter.columnname] ?? "") === "";
    });
    if (missingRequired) {
      setError(mode === "report" ? "Complete los parámetros obligatorios antes de generar el informe." : "Complete los parámetros obligatorios antes de ejecutar el proceso.");
      return;
    }

    setExecuting(true);
    setError(null);
    setResult(null);
    if (mode === "report") setPdfUrl(null);

    try {
      if (mode === "report") {
        const pdf = await generateProcessReport(processId, { values, values_to: valuesTo });
        setPdfFilename(buildPdfFilename(schema.name, new Date()));
        setPdfUrl(URL.createObjectURL(pdf));
        return;
      }
      const response = await executeProcess(processId, {
        table: tableName,
        record_id: recordId === undefined ? undefined : Number(recordId),
        values,
      });
      setResult({ success: response.success, summary: response.summary });
      if (!response.success) setError(formatProcessSummary(response.summary) || "El proceso finalizó con error.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExecuting(false);
    }
  }

  function changeRangeEnd(parameter: ProcessSchemaParameter, value: string) {
    setValuesTo((current) => {
      const next = { ...current };
      if (value === "") delete next[parameter.columnname];
      else next[parameter.columnname] = value;
      return next;
    });
  }

  function formatProcessSummary(summary?: string | null) {
    if (!summary) return summary;

    /*
     * CORE utiliza <br> en varios resúmenes históricos. El diálogo no
     * renderiza HTML deliberadamente; sólo convertimos los separadores
     * conocidos a saltos de línea.
     */
    return summary.replace(/<br\s*\/?>/gi, "\n");
  }

  function renderParameter(parameter: ProcessSchemaParameter) {
    const state = states[parameter.columnname];
    if (state && !state.displayed) return null;

    const rawValue = values[parameter.columnname] ?? "";
    const editable = !evaluating && parameter.isreadonly !== true && state?.readonly !== true;
    const requiredEmpty = parameter.ismandatory && rawValue === "";
    const visualState = state?.readonly ? "readonly" : editable ? "edit" : "view";

    if (parameter.reference?.type === "lookup") {
      return <LookupField key={parameter.process_para_id} field={parameter} rawValue={rawValue} editable={editable} visualState={visualState} requiredEmpty={requiredEmpty} contextValues={contextValues} onChange={(value) => void changeValue(parameter, value)} />;
    }

    if (parameter.reference?.type === "search") {
      return <SearchField key={parameter.process_para_id} field={parameter} rawValue={rawValue} editable={editable} visualState={visualState} requiredEmpty={requiredEmpty} contextValues={contextValues} onChange={(value) => void changeValue(parameter, value)} />;
    }

    if (parameter.reference?.type === "boolean") {
      return (
        <FormControlLabel key={parameter.process_para_id} control={<Checkbox checked={rawValue === "Y" || rawValue === "true"} disabled={!editable} onChange={(event) => void changeValue(parameter, event.target.checked ? "Y" : "N")} />} label={parameter.ismandatory ? `${parameter.name} *` : parameter.name} />
      );
    }

    if (parameter.reference?.type === "list") {
      return (
        <TextField key={parameter.process_para_id} select fullWidth margin="dense" label={parameter.name} required={parameter.ismandatory} disabled={!editable} value={rawValue} onChange={(event) => void changeValue(parameter, event.target.value)}>
          {!parameter.ismandatory && <MenuItem value=""><em>Sin valor</em></MenuItem>}
          {parameter.reference.values?.map((option) => <MenuItem key={option.value} value={option.value}>{option.name}</MenuItem>)}
        </TextField>
      );
    }

    const type = parameter.reference?.type;
    const inputType = type === "date" ? "date" : type === "datetime" ? "datetime-local" : type === "time" ? "time" : ["integer", "number", "amount", "quantity", "costprice"].includes(type ?? "") ? "number" : "text";

    return (
      <Box key={parameter.process_para_id}>
      <TextField
        fullWidth
        margin="dense"
        label={parameter.name}
        required={parameter.ismandatory}
        disabled={!editable}
        type={inputType}
        multiline={type === "textarea"}
        minRows={type === "textarea" ? 3 : undefined}
        value={rawValue}
        error={requiredEmpty}
        slotProps={{ inputLabel: { shrink: true } }}
        onChange={(event) => setValues((current) => ({ ...current, [parameter.columnname]: event.target.value }))}
        onBlur={(event) => void changeValue(parameter, event.target.value)}
      />
      {parameter.isrange && (
        <TextField
          fullWidth margin="dense" label={`${parameter.name} (hasta)`}
          disabled={!editable} type={inputType} value={valuesTo[parameter.columnname] ?? ""}
          slotProps={{ inputLabel: { shrink: true } }}
          onChange={(event) => changeRangeEnd(parameter, event.target.value)}
        />
      )}
      </Box>
    );
  }

  return (
    <Dialog open={open} onClose={evaluating || executing ? undefined : onClose} fullWidth maxWidth={mode === "report" ? "lg" : "sm"}>
      <DialogTitle>{schema?.name ?? (mode === "report" ? "Informe" : "Proceso")}</DialogTitle>
      <DialogContent>
        {loading && <Box sx={{ display: "flex", justifyContent: "center", padding: 3 }}><CircularProgress size={28} /></Box>}
        {error && <Alert severity="error" sx={{ marginY: 1 }}>{error}</Alert>}
        {result?.success && <Alert severity="success" sx={{ marginY: 1 }}>{formatProcessSummary(result.summary) || "Proceso ejecutado correctamente."}</Alert>}
        {!loading && schema?.description && <Typography variant="body2" sx={{ marginBottom: 1 }}>{schema.description}</Typography>}
        {!loading && schema && (
          <Box sx={mode === "report" ? {
            display: "grid",
            gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" },
            columnGap: 2,
            rowGap: 1,
            alignItems: "start",
            "& > *": { minWidth: 0 },
          } : undefined}>
            {[...schema.parameters].sort((a, b) => (a.seqno ?? 0) - (b.seqno ?? 0)).map(renderParameter)}
          </Box>
        )}
        {evaluating && <Typography variant="caption">Actualizando parámetros...</Typography>}
        {pdfUrl && (
          <Box sx={{ mt: 2, height: "min(70vh, 800px)", minHeight: 320 }}>
            <Box component="iframe" title={schema?.name ?? "Informe PDF"} src={pdfUrl}
              sx={{ width: "100%", height: "100%", border: 0 }} />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={evaluating || executing}>{result?.success || pdfUrl ? "Cerrar" : "Cancelar"}</Button>
        {pdfUrl && <Button href={pdfUrl} download={pdfFilename}>Descargar PDF</Button>}
        {!result?.success && <Button variant="contained" disabled={loading || evaluating || executing || !schema} onClick={() => void runProcess()}>{executing ? (mode === "report" ? "Generando..." : "Ejecutando...") : (mode === "report" ? "Generar informe" : "Ejecutar")}</Button>}
      </DialogActions>
    </Dialog>
  );
}
