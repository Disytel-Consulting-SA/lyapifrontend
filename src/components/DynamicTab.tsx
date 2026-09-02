import { useEffect, useState } from "react";

import {
  Alert,
  Autocomplete,
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";

import {
  createRecord,
  getLookupValues,
  getRecord,
  getRecordByKey,
  updateRecord,
} from "../api/libertyaApi";

import type { LookupValue } from "../api/libertyaApi";
import type { WindowSchemaField, WindowSchemaTab } from "../types/metadata";

import {
  buildCreatePayload,
  buildUpdatePayload,
  validateCreateRecord,
  validateUpdateRecord,
} from "../utils/recordPayload";

import { getFieldStateSx } from "../styles/fieldStateStyles";
import type { FieldVisualState } from "../styles/fieldStateStyles";

import SearchField from "./SearchField";


interface Props {
  tab: WindowSchemaTab;
  parentTab?: WindowSchemaTab;
  parentRecord?: Record<string, unknown> | null;

  onRecordChange: (
    tabId: number,
    record: Record<string, unknown> | null
  ) => void;
}


interface LookupFieldProps {
  field: WindowSchemaField;
  rawValue: unknown;
  editable: boolean;
  visualState: FieldVisualState;
  onChange: (value: string) => void;
}


/**
 * Lookup remoto para Table / Table Direct.
 */
function LookupField({
  field,
  rawValue,
  editable,
  visualState,
  onChange,
}: LookupFieldProps) {

  const [options, setOptions] = useState<LookupValue[]>([]);
  const [selectedOption, setSelectedOption] = useState<LookupValue | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endpoint = field.reference?.endpoint;
  const value = rawValue === null || rawValue === undefined ? "" : String(rawValue);


  useEffect(() => {
    if (!endpoint || value === "") {
      setSelectedOption(null);
      setInputValue("");
      return;
    }

    let cancelled = false;

    getLookupValues(endpoint, 1, 1, undefined, value)
      .then((values) => {
        if (!cancelled && values.length > 0) {
          setSelectedOption(values[0]);
          setInputValue(values[0].name);
        }
      })
      .catch((err) => {
        console.error(`Error resolviendo valor ${value} en ${endpoint}`, err);
      });

    return () => {
      cancelled = true;
    };
  }, [endpoint, value]);


  useEffect(() => {
    if (!endpoint)
      return;

    let cancelled = false;

    setLoading(true);
    setError(null);

    getLookupValues(endpoint, 50, 1, inputValue || undefined)
      .then((values) => {
        if (!cancelled)
          setOptions(values);
      })
      .catch((err) => {
        console.error(`Error recuperando lookup ${endpoint}`, err);

        if (!cancelled) {
          setOptions([]);
          setError("No fue posible cargar los valores");
        }
      })
      .finally(() => {
        if (!cancelled)
          setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [endpoint, inputValue]);


  return (
    <Box sx={{ marginTop: 2, marginBottom: 1 }}>
      <Autocomplete
        options={options}
        value={selectedOption}
        loading={loading}
        disabled={!editable}
        filterOptions={(x) => x}
        getOptionLabel={(option) => option.name}
        isOptionEqualToValue={(option, selected) => option.value === selected.value}
        inputValue={inputValue}

        onInputChange={(_, newInputValue) => {
          setInputValue(newInputValue);
        }}

        onChange={(_, newValue) => {
          setSelectedOption(newValue);
          setInputValue(newValue ? newValue.name : "");
          onChange(newValue ? newValue.value : "");
        }}

        renderInput={(params) => (
          <TextField
            {...params}
            label={field.name}
            required={field.ismandatory}
            helperText={error ? error : `column: ${field.columnname}`}
            sx={getFieldStateSx(visualState)}
          />
        )}
      />
    </Box>
  );
}


export default function DynamicTab({
  tab,
  parentTab,
  parentRecord,
  onRecordChange,
}: Props) {

  const [record, setRecord] = useState<Record<string, unknown>>({});
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(true);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [originalRecord, setOriginalRecord] =
    useState<Record<string, unknown> | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);


  function getFieldValue(field: WindowSchemaField): unknown {
    return record[field.columnname.toLowerCase()];
  }


  function setFieldValue(field: WindowSchemaField, value: unknown) {
    setRecord((current) => ({
      ...current,
      [field.columnname.toLowerCase()]: value,
    }));
  }


  function isMetadataReadOnly(field: WindowSchemaField): boolean {
    return tab.isreadonly === true || field.isreadonly === true;
  }


  function isFieldEditable(field: WindowSchemaField): boolean {
    return !isMetadataReadOnly(field) && (isNewRecord || isEditing);
  }


  function getFieldVisualState(field: WindowSchemaField): FieldVisualState {
    if (isMetadataReadOnly(field))
      return "readonly";

    if (isNewRecord || isEditing)
      return "edit";

    return "view";
  }


  function getParentKeyValue(): unknown {
    if (
      tab.parent_ad_tab_id === undefined ||
      !parentTab ||
      !parentRecord
    ) {
      return undefined;
    }

    const keyField = parentTab.fields.find((field) => field.iskey);

    if (!keyField)
      return undefined;

    return parentRecord[keyField.columnname.toLowerCase()];
  }


  function createNewRecord(): Record<string, unknown> {
    const newRecord: Record<string, unknown> = {};

    /*
     * Aplicar los defaults ya resueltos por el backend.
     */
    tab.fields.forEach((field) => {
      if (field.defaultvalue !== undefined)
        newRecord[field.columnname.toLowerCase()] = field.defaultvalue;
    });

    /*
     * Para tabs detalle, propagar además el vínculo
     * con el registro padre.
     */
    if (tab.parent_ad_tab_id !== undefined && tab.link_columnname) {
      const parentValue = getParentKeyValue();

      if (parentValue !== undefined && parentValue !== null)
        newRecord[tab.link_columnname.toLowerCase()] = parentValue;
    }

    return newRecord;
  }


  function handleNewRecord() {
    const newRecord = createNewRecord();

    setSaveError(null);
    setSaveMessage(null);
    setIsNewRecord(true);
    setRecord(newRecord);

    onRecordChange(tab.ad_tab_id, newRecord);
  }


  function handleEditRecord() {
    setSaveError(null);
    setSaveMessage(null);
    setOriginalRecord({ ...record });
    setIsEditing(true);
  }


  function handleCancelEdit() {
    if (originalRecord)
      setRecord({ ...originalRecord });

    setSaveError(null);
    setIsEditing(false);
  }


  function getRecordKeyValues(): Array<string | number> | undefined {
    if (!tab.pk_columns || tab.pk_columns.length === 0)
      return undefined;

    const values: Array<string | number> = [];

    for (const columnName of tab.pk_columns) {
      const value = record[columnName.toLowerCase()];

      if (typeof value !== "string" && typeof value !== "number")
        return undefined;

      values.push(value);
    }

    return values;
  }


  async function handleSaveNewRecord() {
    if (!tab.data_endpoint) {
      setSaveError("La pestaña no posee un endpoint REST configurado");
      return;
    }

    const missingFields = validateCreateRecord(tab, record);

    if (missingFields.length > 0) {
      setSaveError(
        `Complete los campos obligatorios: ${missingFields.map((field) => field.name).join(", ")}`
      );
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      const payload = buildCreatePayload(tab, record);
      const createdId = await createRecord(tab.data_endpoint, payload);

      setSaveMessage(
        createdId
          ? `Registro creado correctamente. ID: ${createdId}`
          : "Registro creado correctamente."
      );

      /*
       * Al salir del modo Nuevo, el effect vuelve a consultar
       * el backend para no mantener datos sólo existentes en memoria.
       */
      setIsNewRecord(false);

    } catch (error) {
      console.error(`Error creando registro en ${tab.data_endpoint}`, error);

      setSaveError(
        error instanceof Error
          ? error.message
          : "No fue posible crear el registro"
      );

    } finally {
      setSaving(false);
    }
  }


  async function handleSaveEditedRecord() {
    if (!tab.data_endpoint) {
      setSaveError("La pestaña no posee un endpoint REST configurado");
      return;
    }

    if (!originalRecord) {
      setSaveError("No se dispone del estado original del registro");
      return;
    }

    const recordKeyValues = getRecordKeyValues();

    if (!recordKeyValues) {
      setSaveError("No fue posible determinar la clave primaria del registro");
      return;
    }

    const missingFields = validateUpdateRecord(tab, record);

    if (missingFields.length > 0) {
      setSaveError(
        `Complete los campos obligatorios: ${missingFields.map((field) => field.name).join(", ")}`
      );
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      const payload = buildUpdatePayload(tab, record, originalRecord);

      if (Object.keys(payload).length === 0) {
        setSaveMessage("No existen cambios para guardar.");
        setIsEditing(false);
        return;
      }

      await updateRecord(tab.data_endpoint, recordKeyValues, payload);

      const updatedRecord = await getRecordByKey(
        tab.data_endpoint,
        recordKeyValues
      );

      if (!updatedRecord) {
        setSaveError(
          "El registro fue actualizado pero no pudo recuperarse nuevamente."
        );
        setIsEditing(false);
        return;
      }

      setRecord(updatedRecord);
      setOriginalRecord({ ...updatedRecord });
      onRecordChange(tab.ad_tab_id, updatedRecord);

      setSaveMessage("Registro actualizado correctamente.");
      setIsEditing(false);

    } catch (error) {
      console.error(`Error actualizando registro en ${tab.data_endpoint}`, error);

      setSaveError(
        error instanceof Error
          ? error.message
          : "No fue posible actualizar el registro"
      );

    } finally {
      setSaving(false);
    }
  }


  function formatDateValue(rawValue: unknown, type: string): string {
    if (
      rawValue === null ||
      rawValue === undefined ||
      rawValue === ""
    ) {
      return "";
    }

    const value = String(rawValue);

    if (type === "date")
      return value.length >= 10 ? value.substring(0, 10) : value;

    if (type === "datetime") {
      const normalized = value.replace(" ", "T");
      return normalized.length >= 16 ? normalized.substring(0, 16) : normalized;
    }

    if (type === "time") {
      if (value.includes("T")) {
        const time = value.split("T")[1];
        return time ? time.substring(0, 5) : "";
      }

      if (value.includes(" ")) {
        const time = value.split(" ")[1];
        return time ? time.substring(0, 5) : "";
      }

      return value.length >= 5 ? value.substring(0, 5) : value;
    }

    return value;
  }


  function renderField(field: WindowSchemaField) {
    const rawValue = getFieldValue(field);
    const editable = isFieldEditable(field);
    const visualState = getFieldVisualState(field);
    const metadataReadOnly = isMetadataReadOnly(field);


    if (field.reference?.type === "button") {
      return (
        <Box
          key={field.ad_field_id}
          sx={{ marginTop: 2, marginBottom: 1 }}
        >
          <Button variant="contained" size="small" disabled>
            {field.name}
          </Button>

          <Typography
            variant="caption"
            sx={{ display: "block", marginTop: 0.5 }}
          >
            column: {field.columnname}
          </Typography>
        </Box>
      );
    }


    if (field.reference?.type === "boolean") {
      const checked =
        rawValue === true ||
        rawValue === "Y" ||
        rawValue === "true";

      return (
        <Box
          key={field.ad_field_id}
          sx={{
            marginTop: 2,
            marginBottom: 1,
            ...(metadataReadOnly
              ? {
                  backgroundColor: "#f1f1f1",
                  borderRadius: 1,
                  paddingLeft: 1,
                  paddingTop: 0.5,
                  paddingBottom: 0.5,
                }
              : {}),
          }}
        >
          <FormControlLabel
            control={
              <Checkbox
                checked={checked}
                disabled={!editable}
                onChange={(event) => setFieldValue(field, event.target.checked)}
              />
            }
            label={field.ismandatory ? `${field.name} *` : field.name}
          />

          <Typography
            variant="caption"
            sx={{ display: "block", marginLeft: 4 }}
          >
            column: {field.columnname}
          </Typography>
        </Box>
      );
    }


    if (field.reference?.type === "search") {
      return (
        <SearchField
          key={field.ad_field_id}
          field={field}
          rawValue={rawValue}
          editable={editable}
          visualState={visualState}
          onChange={(value) => setFieldValue(field, value)}
        />
      );
    }


    if (field.reference?.type === "lookup") {
      return (
        <LookupField
          key={field.ad_field_id}
          field={field}
          rawValue={rawValue}
          editable={editable}
          visualState={visualState}
          onChange={(value) => setFieldValue(field, value)}
        />
      );
    }


    if (field.reference?.type === "list") {
      const value =
        rawValue === null || rawValue === undefined
          ? ""
          : String(rawValue);

      return (
        <FormControl
          key={field.ad_field_id}
          fullWidth
          margin="normal"
          required={field.ismandatory}
          disabled={!editable}
          sx={getFieldStateSx(visualState)}
        >
          <InputLabel>{field.name}</InputLabel>

          <Select
            value={value}
            label={field.name}
            onChange={(event) => setFieldValue(field, event.target.value)}
          >
            {!field.ismandatory && (
              <MenuItem value="">
                <em>Sin valor</em>
              </MenuItem>
            )}

            {field.reference.values?.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.name}
              </MenuItem>
            ))}
          </Select>

          <Typography
            variant="caption"
            sx={{ marginLeft: 2, marginTop: 0.5 }}
          >
            column: {field.columnname}
          </Typography>
        </FormControl>
      );
    }


    if (
      field.reference?.type === "date" ||
      field.reference?.type === "datetime" ||
      field.reference?.type === "time"
    ) {
      const type = field.reference.type;

      const inputType =
        type === "date"
          ? "date"
          : type === "datetime"
          ? "datetime-local"
          : "time";

      return (
        <TextField
          key={field.ad_field_id}
          label={field.name}
          required={field.ismandatory}
          disabled={!editable}
          type={inputType}
          value={formatDateValue(rawValue, type)}
          onChange={(event) => setFieldValue(field, event.target.value)}
          helperText={`column: ${field.columnname}`}
          fullWidth
          margin="normal"
          slotProps={{ inputLabel: { shrink: true } }}
          sx={getFieldStateSx(visualState)}
        />
      );
    }


    if (field.reference?.type === "integer") {
      return (
        <TextField
          key={field.ad_field_id}
          label={field.name}
          required={field.ismandatory}
          disabled={!editable}
          type="number"
          value={
            rawValue === null || rawValue === undefined
              ? ""
              : String(rawValue)
          }
          onChange={(event) => setFieldValue(field, event.target.value)}
          helperText={`column: ${field.columnname}`}
          fullWidth
          margin="normal"
          slotProps={{ htmlInput: { step: 1 } }}
          sx={getFieldStateSx(visualState)}
        />
      );
    }


    if (field.reference?.type === "number") {
      return (
        <TextField
          key={field.ad_field_id}
          label={field.name}
          required={field.ismandatory}
          disabled={!editable}
          type="number"
          value={
            rawValue === null || rawValue === undefined
              ? ""
              : String(rawValue)
          }
          onChange={(event) => setFieldValue(field, event.target.value)}
          helperText={`column: ${field.columnname}`}
          fullWidth
          margin="normal"
          slotProps={{ htmlInput: { step: "any" } }}
          sx={getFieldStateSx(visualState)}
        />
      );
    }


    if (
      field.reference?.type === "amount" ||
      field.reference?.type === "quantity" ||
      field.reference?.type === "costprice"
    ) {
      const type = field.reference.type;

      const labelSuffix =
        type === "amount"
          ? " (importe)"
          : type === "quantity"
          ? " (cantidad)"
          : " (costo/precio)";

      return (
        <TextField
          key={field.ad_field_id}
          label={`${field.name}${labelSuffix}`}
          required={field.ismandatory}
          disabled={!editable}
          type="number"
          value={
            rawValue === null || rawValue === undefined
              ? ""
              : String(rawValue)
          }
          onChange={(event) => setFieldValue(field, event.target.value)}
          helperText={`column: ${field.columnname}`}
          fullWidth
          margin="normal"
          slotProps={{ htmlInput: { step: "any" } }}
          sx={[
            getFieldStateSx(visualState),
            { "& input": { textAlign: "right" } },
          ]}
        />
      );
    }


    if (field.reference?.type === "textarea") {
      return (
        <TextField
          key={field.ad_field_id}
          label={field.name}
          required={field.ismandatory}
          disabled={!editable}
          value={
            rawValue === null || rawValue === undefined
              ? ""
              : String(rawValue)
          }
          onChange={(event) => setFieldValue(field, event.target.value)}
          helperText={`column: ${field.columnname}`}
          fullWidth
          multiline
          minRows={3}
          margin="normal"
          sx={getFieldStateSx(visualState)}
        />
      );
    }


    return (
      <TextField
        key={field.ad_field_id}
        label={field.name}
        required={field.ismandatory}
        value={
          rawValue === null || rawValue === undefined
            ? ""
            : String(rawValue)
        }
        onChange={(event) => setFieldValue(field, event.target.value)}
        helperText={`column: ${field.columnname}`}
        fullWidth
        margin="normal"
        disabled={!editable}
        sx={getFieldStateSx(visualState)}
      />
    );
  }


  useEffect(() => {
    setPage(1);
    setIsNewRecord(false);
    setIsEditing(false);
    setOriginalRecord(null);
  }, [tab.ad_tab_id, parentRecord]);


  useEffect(() => {
    /*
     * Mientras estamos creando un registro no debemos
     * reemplazarlo mediante GET.
     */
    if (isNewRecord)
      return;

    if (!tab.data_endpoint) {
      setRecord({});
      setHasNext(false);
      onRecordChange(tab.ad_tab_id, null);
      return;
    }

    let filter: string | undefined;

    if (tab.parent_ad_tab_id !== undefined) {
      const parentValue = getParentKeyValue();

      if (
        parentValue === undefined ||
        parentValue === null ||
        !tab.link_columnname
      ) {
        setRecord({});
        setHasNext(false);
        onRecordChange(tab.ad_tab_id, null);
        return;
      }

      filter = `${tab.link_columnname}=${parentValue}`;
    }

    getRecord(tab.data_endpoint, page, filter)
      .then((result) => {
        if (result === null) {
          setHasNext(false);

          if (page > 1) {
            setPage((current) => current - 1);
          } else {
            setRecord({});
            onRecordChange(tab.ad_tab_id, null);
          }

          return;
        }

        setRecord(result);
        setOriginalRecord({ ...result });
        setHasNext(true);
        onRecordChange(tab.ad_tab_id, result);
      })
      .catch((error) => {
        console.error(
          `Error recuperando datos desde ${tab.data_endpoint}`,
          error
        );

        setRecord({});
        setHasNext(false);
        onRecordChange(tab.ad_tab_id, null);
      });

  }, [tab, page, parentRecord, isNewRecord]);


  return (
    <Box sx={{ marginTop: 4 }}>
      <Typography variant="h6" gutterBottom>
        {tab.name}
      </Typography>

      <Typography variant="body2">
        tabla: {tab.tablename}
      </Typography>

      <Typography variant="body2">
        endpoint: {tab.data_endpoint ?? "sin endpoint"}
      </Typography>

      {tab.parent_ad_tab_id !== undefined && (
        <Typography variant="body2">
          parent tab: {tab.parent_ad_tab_id}
          {tab.link_columnname ? ` — link: ${tab.link_columnname}` : ""}
        </Typography>
      )}

      {tab.isreadonly && (
        <Alert severity="info" sx={{ marginTop: 2 }}>
          Esta pestaña es de solo lectura.
        </Alert>
      )}

      {!tab.data_endpoint && (
        <Alert severity="warning" sx={{ marginTop: 2 }}>
          No existe un endpoint REST configurado para la tabla {tab.tablename}.
        </Alert>
      )}

      {tab.data_endpoint && (
        <>
          <Box
            sx={{
              marginTop: 1,
              marginBottom: 2,
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            <ButtonGroup variant="outlined" size="small">
              <Button
                onClick={() =>
                  setPage((current) => Math.max(1, current - 1))
                }
                disabled={isNewRecord || isEditing || page === 1}
              >
                ← Anterior
              </Button>

              <Button
                onClick={() => setPage((current) => current + 1)}
                disabled={isNewRecord || isEditing || !hasNext}
              >
                Siguiente →
              </Button>

              <Button
                onClick={handleNewRecord}
                disabled={
                  tab.isreadonly === true ||
                  isNewRecord ||
                  isEditing ||
                  saving
                }
              >
                Nuevo
              </Button>

              <Button
                onClick={handleEditRecord}
                disabled={
                  tab.isreadonly === true ||
                  isNewRecord ||
                  isEditing ||
                  saving ||
                  getRecordKeyValues() === undefined
                }
              >
                Editar
              </Button>

              {isNewRecord && (
                <>
                  <Button
                    onClick={handleSaveNewRecord}
                    disabled={saving}
                  >
                    {saving ? "Guardando..." : "Guardar"}
                  </Button>

                  <Button
                    onClick={() => {
                      setSaveError(null);
                      setIsNewRecord(false);
                    }}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                </>
              )}

              {isEditing && (
                <>
                  <Button
                    onClick={handleSaveEditedRecord}
                    disabled={saving}
                  >
                    {saving ? "Guardando..." : "Guardar"}
                  </Button>

                  <Button
                    onClick={handleCancelEdit}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                </>
              )}
            </ButtonGroup>

            <Typography variant="body2">
              {isNewRecord
                ? "Nuevo registro"
                : isEditing
                ? `Editando registro ${page}`
                : `Registro ${page}`}
            </Typography>
          </Box>

          {saveError && (
            <Alert severity="error" sx={{ marginBottom: 2 }}>
              {saveError}
            </Alert>
          )}

          {saveMessage && (
            <Alert severity="success" sx={{ marginBottom: 2 }}>
              {saveMessage}
            </Alert>
          )}

          {[...tab.fields]
            .filter((field) => field.isdisplayed !== false)
            .sort((a, b) => a.seqno - b.seqno)
            .map(renderField)}
        </>
      )}
    </Box>
  );
}