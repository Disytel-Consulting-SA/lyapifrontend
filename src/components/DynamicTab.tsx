import { useEffect, useMemo, useState } from "react";

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
  deleteRecord,
  evaluateRecordState,
  getLookupValues,
  getRecord,
  getNewRecordState,
  getRecordByKey,
  updateRecord,
} from "../api/libertyaApi";

import type {
  LookupValue,
  WindowRecordFieldState,
} from "../api/libertyaApi";

import type {
  WindowSchemaField,
  WindowSchemaTab,
} from "../types/metadata";

import {
  buildCreatePayload,
  buildUpdatePayload,
  validateCreateRecord,
  validateUpdateRecord,
} from "../utils/recordPayload";

import {
  getReadOnlyContainerSx,
  getFieldStateSx,
} from "../styles/fieldStateStyles";

import type {
  FieldVisualState,
} from "../styles/fieldStateStyles";

import SearchField from "./SearchField";
import RecordSearchDialog from "./RecordSearchDialog";
import RecordGrid from "./RecordGrid";


interface Props {
  tab: WindowSchemaTab;
  parentTab?: WindowSchemaTab;
  parentRecord?: Record<string, unknown> | null;
  windowIsSOTrx: boolean;
  initialPage: number;

  onRecordChange: (
    tabId: number,
    record: Record<string, unknown> | null
  ) => void;

  onPageChange: (tabId: number, page: number) => void;
}


interface LookupFieldProps {
  field: WindowSchemaField;
  rawValue: unknown;
  editable: boolean;
  visualState: FieldVisualState;
  contextValues: Record<string, string>;
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
  contextValues,
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

    getLookupValues(endpoint, 1, 1, undefined, value, contextValues)
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
  }, [endpoint, value, contextValues]);


  useEffect(() => {
    if (!endpoint)
      return;

    let cancelled = false;

    setLoading(true);
    setError(null);

    getLookupValues(endpoint, 50, 1, inputValue || undefined, undefined, contextValues)
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
  }, [endpoint, inputValue, contextValues]);


  return (
    <Box sx={{ marginTop: .75, marginBottom: .25 }}>
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
            helperText={error ?? undefined}
            slotProps={{
              ...params.slotProps,
              inputLabel: {
                ...params.slotProps.inputLabel,
                shrink: true,
              },
            }}
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
  windowIsSOTrx,
  initialPage,
  onPageChange,
  onRecordChange,
}: Props) {

  const [record, setRecord] = useState<Record<string, unknown>>({});
  const [page, setPage] = useState(initialPage);
  const [totalCount, setTotalCount] = useState(0);

  const [isNewRecord, setIsNewRecord] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [fieldStates, setFieldStates] =
    useState<WindowRecordFieldState[]>([]);

  const [originalRecord, setOriginalRecord] =
    useState<Record<string, unknown> | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [refreshToken, setRefreshToken] = useState(0);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");

  const [viewMode, setViewMode] =
    useState<"form" | "grid">("form");


  function getFieldValue(field: WindowSchemaField): unknown {
    return record[field.columnname.toLowerCase()];
  }


  function getFieldState(
    field: WindowSchemaField
  ): WindowRecordFieldState | undefined {

    return fieldStates.find(
      (state) => state.ad_field_id === field.ad_field_id
    );
  }


  function setFieldValue(
    field: WindowSchemaField,
    value: unknown
  ) {

    setRecord((current) => {
      const updatedRecord = {
        ...current,
        [field.columnname.toLowerCase()]: value,
      };

      void reevaluateRecordState(
        updatedRecord,
        field.columnname
      );

      return updatedRecord;
    });
  }


  function isMetadataReadOnly(
    field: WindowSchemaField
  ): boolean {

    return tab.isreadonly === true ||
      field.isreadonly === true;
  }


  function isFieldEditable(
    field: WindowSchemaField
  ): boolean {

    const state = getFieldState(field);

    if (state)
      return !state.readonly &&
        (isNewRecord || isEditing);

    if (isNewRecord)
      return false;

    return !isMetadataReadOnly(field) &&
      isEditing;
  }


  function getFieldVisualState(
    field: WindowSchemaField
  ): FieldVisualState {

    const state = getFieldState(field);

    if (state) {
      if (state.readonly)
        return "readonly";

      return isNewRecord || isEditing
        ? "edit"
        : "view";
    }

    if (isNewRecord)
      return "readonly";

    if (isMetadataReadOnly(field))
      return "readonly";

    if (isEditing)
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

    const keyField =
      parentTab.fields.find(
        (field) => field.iskey
      );

    if (!keyField)
      return undefined;

    return parentRecord[
      keyField.columnname.toLowerCase()
    ];
  }


  function buildParentValues():
    Record<string, string> | undefined {

    if (
      tab.parent_ad_tab_id === undefined ||
      !parentTab ||
      !parentRecord
    ) {
      return undefined;
    }

    const keyField =
      parentTab.fields.find(
        (field) => field.iskey
      );

    if (!keyField)
      return undefined;

    const parentValue =
      parentRecord[
        keyField.columnname.toLowerCase()
      ];

    if (
      parentValue === undefined ||
      parentValue === null
    ) {
      return undefined;
    }

    return {
      [keyField.columnname]:
        String(parentValue),
    };
  }


  function buildRecordFilter():
    string | undefined {

    const filters: string[] = [];

    if (
      tab.parent_ad_tab_id !== undefined
    ) {

      const parentValue =
        getParentKeyValue();

      if (
        parentValue === undefined ||
        parentValue === null ||
        !tab.link_columnname
      ) {
        return undefined;
      }

      filters.push(
        `${tab.link_columnname}=${parentValue}`
      );
    }

    if (searchFilter)
      filters.push(searchFilter);

    return filters.length > 0
      ? filters.join(" and ")
      : undefined;
  }


  function buildRecordStateValues(
    currentRecord: Record<string, unknown>
  ): Record<string, string> {

    const values: Record<string, string> = {};

    for (const field of tab.fields) {
      const value =
        currentRecord[
          field.columnname.toLowerCase()
        ];

      if (
        value === undefined ||
        value === null
      ) {
        continue;
      }

      if (typeof value === "boolean") {
        values[field.columnname] =
          value ? "Y" : "N";
      } else {
        values[field.columnname] =
          String(value);
      }
    }

    return values;
  }


  const lookupContextValues = useMemo(() => {
    return {
      ...buildParentValues(),
      ...buildRecordStateValues(record),
      IsSOTrx: windowIsSOTrx ? "Y" : "N",
    };
  }, [windowIsSOTrx, record, parentRecord, parentTab, tab.fields]);


  async function reevaluateRecordState(
    currentRecord: Record<string, unknown>,
    changedColumn?: string
  ) {

    try {
      const state =
        await evaluateRecordState(
          tab.ad_tab_id,
          {
            values:
              buildRecordStateValues(
                currentRecord
              ),

            parent_values:
              buildParentValues(),

            changed_columns:
              changedColumn
                ? [changedColumn]
                : undefined,

            inserting:
              isNewRecord,
          }
        );

      setFieldStates(state.fields);

    } catch (error) {
      console.error(
        `Error reevaluando estado para AD_Tab_ID=${tab.ad_tab_id}`,
        error
      );
    }
  }


  function escapeFilterValue(
    value: string
  ): string {

    return value.replace(/'/g, "''");
  }


  function handleSearchRecords(
    criteria: Record<string, string>
  ) {

    const filters =
      Object.entries(criteria)
        .filter(
          ([, value]) =>
            value.trim() !== ""
        )
        .map(
          ([columnName, value]) => {

            const field =
              tab.fields.find(
                (candidate) =>
                  candidate.columnname ===
                  columnName
              );

            const escapedValue =
              escapeFilterValue(
                value.trim()
              );

            const type =
              field?.reference?.type;

            if (
              type === "integer" ||
              type === "number" ||
              type === "amount" ||
              type === "quantity" ||
              type === "costprice"
            ) {
              return `${columnName}=${escapedValue}`;
            }

            if (
              type === "boolean" ||
              type === "list" ||
              type === "lookup" ||
              type === "search" ||
              type === "date" ||
              type === "datetime" ||
              type === "time"
            ) {
              return `${columnName}='${escapedValue}'`;
            }

            return `${columnName} ILIKE '%${escapedValue}%'`;
          }
        );

    const filter =
      filters.join(" and ");

    setSearchFilter(filter);
    setPage(1);
    setSearchOpen(false);
  }


  function handleGridSelectRecord(
    selectedRecord: Record<string, unknown>,
    recordPage: number
  ) {

    setRecord(selectedRecord);
    setPage(recordPage);
    setViewMode("form");

    onPageChange(
      tab.ad_tab_id,
      recordPage
    );

    onRecordChange(
      tab.ad_tab_id,
      selectedRecord
    );

    void reevaluateRecordState(
      selectedRecord
    );
  }


  async function handleNewRecord() {

    if (tab.isinsertrecord === false)
      return;

    setSaveError(null);
    setSaveMessage(null);

    try {
      const state =
        await getNewRecordState(
          tab.ad_tab_id,
          {
            parent_values:
              buildParentValues(),
          }
        );

      const newRecord:
        Record<string, unknown> = {};

      Object.entries(
        state.values
      ).forEach(
        ([columnName, value]) => {

          newRecord[
            columnName.toLowerCase()
          ] = value;
        }
      );

      setFieldStates(state.fields);
      setIsNewRecord(true);
      setRecord(newRecord);

      onRecordChange(
        tab.ad_tab_id,
        newRecord
      );

    } catch (error) {
      console.error(
        `Error construyendo nuevo registro para AD_Tab_ID=${tab.ad_tab_id}`,
        error
      );

      setSaveError(
        error instanceof Error
          ? error.message
          : "No fue posible inicializar el nuevo registro"
      );
    }
  }


  function handleEditRecord() {
    setSaveError(null);
    setSaveMessage(null);

    setOriginalRecord({
      ...record,
    });

    setIsEditing(true);
  }


  function handleCancelEdit() {
    if (originalRecord) {
      const restoredRecord = {
        ...originalRecord,
      };

      setRecord(restoredRecord);

      void reevaluateRecordState(
        restoredRecord
      );
    }

    setSaveError(null);
    setIsEditing(false);
  }


  function getRecordKeyValues():
    Array<string | number> | undefined {

    if (
      !tab.pk_columns ||
      tab.pk_columns.length === 0
    ) {
      return undefined;
    }

    const values:
      Array<string | number> = [];

    for (
      const columnName
      of tab.pk_columns
    ) {

      const value =
        record[
          columnName.toLowerCase()
        ];

      if (
        typeof value !== "string" &&
        typeof value !== "number"
      ) {
        return undefined;
      }

      values.push(value);
    }

    return values;
  }


  async function handleSaveNewRecord() {
    if (!tab.data_endpoint) {
      setSaveError(
        "La pestaña no posee un endpoint REST configurado"
      );
      return;
    }

    const missingFields =
      validateCreateRecord(
        tab,
        record
      );

    if (missingFields.length > 0) {
      setSaveError(
        `Complete los campos obligatorios: ${missingFields
          .map((field) => field.name)
          .join(", ")}`
      );

      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      const payload =
        buildCreatePayload(
          tab,
          record
        );

      const createdId =
        await createRecord(
          tab.data_endpoint,
          payload
        );

      setSaveMessage(
        createdId
          ? `Registro creado correctamente. ID: ${createdId}`
          : "Registro creado correctamente."
      );

      setIsNewRecord(false);

    } catch (error) {
      console.error(
        `Error creando registro en ${tab.data_endpoint}`,
        error
      );

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
      setSaveError(
        "La pestaña no posee un endpoint REST configurado"
      );
      return;
    }

    if (!originalRecord) {
      setSaveError(
        "No se dispone del estado original del registro"
      );
      return;
    }

    const recordKeyValues =
      getRecordKeyValues();

    if (!recordKeyValues) {
      setSaveError(
        "No fue posible determinar la clave primaria del registro"
      );
      return;
    }

    const missingFields =
      validateUpdateRecord(
        tab,
        record
      );

    if (missingFields.length > 0) {
      setSaveError(
        `Complete los campos obligatorios: ${missingFields
          .map((field) => field.name)
          .join(", ")}`
      );

      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      const payload =
        buildUpdatePayload(
          tab,
          record,
          originalRecord
        );

      if (
        Object.keys(payload).length === 0
      ) {
        setSaveMessage(
          "No existen cambios para guardar."
        );

        setIsEditing(false);
        return;
      }

      await updateRecord(
        tab.data_endpoint,
        recordKeyValues,
        payload
      );

      const updatedRecord =
        await getRecordByKey(
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

      setOriginalRecord({
        ...updatedRecord,
      });

      onRecordChange(
        tab.ad_tab_id,
        updatedRecord
      );

      void reevaluateRecordState(
        updatedRecord
      );

      setSaveMessage(
        "Registro actualizado correctamente."
      );

      setIsEditing(false);

    } catch (error) {
      console.error(
        `Error actualizando registro en ${tab.data_endpoint}`,
        error
      );

      setSaveError(
        error instanceof Error
          ? error.message
          : "No fue posible actualizar el registro"
      );

    } finally {
      setSaving(false);
    }
  }


  async function handleDeleteRecord() {
    if (!tab.data_endpoint) {
      setSaveError(
        "La pestaña no posee un endpoint REST configurado"
      );
      return;
    }

    const recordKeyValues =
      getRecordKeyValues();

    if (!recordKeyValues) {
      setSaveError(
        "No fue posible determinar la clave primaria del registro"
      );
      return;
    }

    const confirmed =
      window.confirm(
        "¿Confirma eliminar este registro?\n\nEsta operación no puede deshacerse."
      );

    if (!confirmed)
      return;

    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      await deleteRecord(
        tab.data_endpoint,
        recordKeyValues
      );

      setSaveMessage(
        "Registro eliminado correctamente."
      );

      setRefreshToken(
        (current) => current + 1
      );

    } catch (error) {
      console.error(
        `Error eliminando registro en ${tab.data_endpoint}`,
        error
      );

      setSaveError(
        error instanceof Error
          ? error.message
          : "No fue posible eliminar el registro"
      );

    } finally {
      setSaving(false);
    }
  }


  function formatDateValue(
    rawValue: unknown,
    type: string
  ): string {

    if (
      rawValue === null ||
      rawValue === undefined ||
      rawValue === ""
    ) {
      return "";
    }

    const value =
      String(rawValue);

    if (type === "date") {
      return value.length >= 10
        ? value.substring(0, 10)
        : value;
    }

    if (type === "datetime") {
      const normalized =
        value.replace(" ", "T");

      return normalized.length >= 16
        ? normalized.substring(0, 16)
        : normalized;
    }

    if (type === "time") {
      if (value.includes("T")) {
        const time =
          value.split("T")[1];

        return time
          ? time.substring(0, 5)
          : "";
      }

      if (value.includes(" ")) {
        const time =
          value.split(" ")[1];

        return time
          ? time.substring(0, 5)
          : "";
      }

      return value.length >= 5
        ? value.substring(0, 5)
        : value;
    }

    return value;
  }


  function renderField(
    field: WindowSchemaField
  ) {

    const state =
      getFieldState(field);

    if (
      state &&
      !state.displayed
    ) {
      return null;
    }

    if (
      isNewRecord &&
      !state
    ) {
      return null;
    }

    const rawValue =
      getFieldValue(field);

    const editable =
      isFieldEditable(field);

    const visualState =
      getFieldVisualState(field);

    const effectiveReadOnly =
      !editable &&
      (
        state?.readonly === true ||
        isNewRecord ||
        isMetadataReadOnly(field)
      );


    if (
      field.reference?.type === "button"
    ) {
      return (
        <Box
          key={field.ad_field_id}
          sx={{
            marginTop: 2,
            marginBottom: 1,
          }}
        >
          <Button
            variant="contained"
            size="small"
            disabled
          >
            {field.name}
          </Button>

        </Box>
      );
    }


    if (
      field.reference?.type === "boolean"
    ) {

      const checked =
        rawValue === true ||
        rawValue === "Y" ||
        rawValue === "true";

      return (
        <Box
          key={field.ad_field_id}
          sx={[
            {
              marginTop: 0.75,
              marginBottom: 0.25,
            },
            getReadOnlyContainerSx(
              effectiveReadOnly
            ),
          ]}
        >
          <FormControlLabel
            control={
              <Checkbox
                checked={checked}
                disabled={!editable}
                onChange={
                  (event) =>
                    setFieldValue(
                      field,
                      event.target.checked
                    )
                }
              />
            }
            label={
              field.ismandatory
                ? `${field.name} *`
                : field.name
            }
          />

        </Box>
      );
    }


    if (
      field.reference?.type === "search"
    ) {
      return (
        <SearchField
          key={field.ad_field_id}
          field={field}
          rawValue={rawValue}
          editable={editable}
          visualState={visualState}
          onChange={
            (value) =>
              setFieldValue(
                field,
                value
              )
          }
        />
      );
    }


    if (
      field.reference?.type === "lookup"
    ) {
      return (
        <LookupField
          key={field.ad_field_id}
          field={field}
          rawValue={rawValue}
          editable={editable}
          visualState={visualState}
          contextValues={lookupContextValues}
          onChange={
            (value) =>
              setFieldValue(
                field,
                value
              )
          }
        />
      );
    }


    if (
      field.reference?.type === "list"
    ) {

      const value =
        rawValue === null ||
        rawValue === undefined
          ? ""
          : String(rawValue);

      return (
        <FormControl
          key={field.ad_field_id}
          fullWidth
          margin="dense"
          required={field.ismandatory}
          disabled={!editable}
          sx={
            getFieldStateSx(
              visualState
            )
          }
        >
          <InputLabel shrink>
            {field.name}
          </InputLabel>

          <Select
            value={value}
            notched
            label={field.name}
            onChange={
              (event) =>
                setFieldValue(
                  field,
                  event.target.value
                )
            }
          >
            {!field.ismandatory && (
              <MenuItem value="">
                <em>Sin valor</em>
              </MenuItem>
            )}

            {field.reference.values?.map(
              (option) => (
                <MenuItem
                  key={option.value}
                  value={option.value}
                >
                  {option.name}
                </MenuItem>
              )
            )}
          </Select>

        </FormControl>
      );
    }


    if (
      field.reference?.type === "date" ||
      field.reference?.type === "datetime" ||
      field.reference?.type === "time"
    ) {

      const type =
        field.reference.type;

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
          value={
            formatDateValue(
              rawValue,
              type
            )
          }
          onChange={
            (event) =>
              setFieldValue(
                field,
                event.target.value
              )
          }
          fullWidth
          margin="dense"
          slotProps={{
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
      );
    }


    if (
      field.reference?.type === "integer"
    ) {
      return (
        <TextField
          key={field.ad_field_id}
          label={field.name}
          required={field.ismandatory}
          disabled={!editable}
          type="number"
          value={
            rawValue === null ||
            rawValue === undefined
              ? ""
              : String(rawValue)
          }
          onChange={
            (event) =>
              setFieldValue(
                field,
                event.target.value
              )
          }
          fullWidth
          margin="dense"
          slotProps={{
            inputLabel: {
              shrink: true,
            },
            htmlInput: {
              step: 1,
            },
          }}
          sx={
            getFieldStateSx(
              visualState
            )
          }
        />
      );
    }


    if (
      field.reference?.type === "number"
    ) {
      return (
        <TextField
          key={field.ad_field_id}
          label={field.name}
          required={field.ismandatory}
          disabled={!editable}
          type="number"
          value={
            rawValue === null ||
            rawValue === undefined
              ? ""
              : String(rawValue)
          }
          onChange={
            (event) =>
              setFieldValue(
                field,
                event.target.value
              )
          }
          fullWidth
          margin="dense"
          slotProps={{
            inputLabel: {
              shrink: true,
            },
            htmlInput: {
              step: "any",
            },
          }}
          sx={
            getFieldStateSx(
              visualState
            )
          }
        />
      );
    }


    if (
      field.reference?.type === "amount" ||
      field.reference?.type === "quantity" ||
      field.reference?.type === "costprice"
    ) {

      const type =
        field.reference.type;

      const labelSuffix =
        type === "amount"
          ? " (importe)"
          : type === "quantity"
          ? " (cantidad)"
          : " (costo/precio)";

      return (
        <TextField
          key={field.ad_field_id}
          label={
            `${field.name}${labelSuffix}`
          }
          required={field.ismandatory}
          disabled={!editable}
          type="number"
          value={
            rawValue === null ||
            rawValue === undefined
              ? ""
              : String(rawValue)
          }
          onChange={
            (event) =>
              setFieldValue(
                field,
                event.target.value
              )
          }
          fullWidth
          margin="dense"
          slotProps={{
            inputLabel: {
              shrink: true,
            },
            htmlInput: {
              step: "any",
            },
          }}
          sx={[
            getFieldStateSx(
              visualState
            ),
            {
              "& input": {
                textAlign: "right",
              },
            },
          ]}
        />
      );
    }


    if (
      field.reference?.type === "textarea"
    ) {
      return (
        <TextField
          key={field.ad_field_id}
          label={field.name}
          required={field.ismandatory}
          disabled={!editable}
          value={
            rawValue === null ||
            rawValue === undefined
              ? ""
              : String(rawValue)
          }
          onChange={
            (event) =>
              setFieldValue(
                field,
                event.target.value
              )
          }
          fullWidth
          multiline
          minRows={3}
          margin="dense"
          slotProps={{
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
      );
    }


    return (
      <TextField
        key={field.ad_field_id}
        label={field.name}
        required={field.ismandatory}
        value={
          rawValue === null ||
          rawValue === undefined
            ? ""
            : String(rawValue)
        }
        onChange={
          (event) =>
            setFieldValue(
              field,
              event.target.value
            )
        }
        fullWidth
        margin="dense"
        disabled={!editable}
        slotProps={{
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
    );
  }


  useEffect(() => {
    onPageChange(
      tab.ad_tab_id,
      page
    );
  }, [
    tab.ad_tab_id,
    page,
  ]);


  useEffect(() => {
    setIsNewRecord(false);
    setIsEditing(false);
    setOriginalRecord(null);

    setViewMode("form");

    if (
      tab.parent_ad_tab_id !== undefined
    ) {
      setPage(1);
    }
  }, [
    tab.ad_tab_id,
    parentRecord,
  ]);


  useEffect(() => {

    if (isNewRecord)
      return;

    if (!tab.data_endpoint) {
      setRecord({});
      setFieldStates([]);
      setTotalCount(0);

      onRecordChange(
        tab.ad_tab_id,
        null
      );

      return;
    }

    const filter =
      buildRecordFilter();

    if (
      tab.parent_ad_tab_id !== undefined &&
      filter === undefined
    ) {
      setRecord({});
      setFieldStates([]);
      setTotalCount(0);

      onRecordChange(
        tab.ad_tab_id,
        null
      );

      return;
    }

    getRecord(
      tab.data_endpoint,
      page,
      filter
    )
      .then(
        ({
          record: result,
          totalCount,
        }) => {

          setTotalCount(totalCount);

          if (result === null) {
            if (
              totalCount > 0 &&
              page > totalCount
            ) {
              setPage(totalCount);
            } else {
              setRecord({});
              setFieldStates([]);

              onRecordChange(
                tab.ad_tab_id,
                null
              );
            }

            return;
          }

          setRecord(result);

          setOriginalRecord({
            ...result,
          });

          onRecordChange(
            tab.ad_tab_id,
            result
          );

          void reevaluateRecordState(
            result
          );
        }
      )
      .catch((error) => {
        console.error(
          `Error recuperando datos desde ${tab.data_endpoint}`,
          error
        );

        setRecord({});
        setFieldStates([]);
        setTotalCount(0);

        onRecordChange(
          tab.ad_tab_id,
          null
        );
      });

  }, [
    tab,
    page,
    parentRecord,
    isNewRecord,
    refreshToken,
    searchFilter,
  ]);


  return (
    <Box
      sx={{
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >

      {/* CABECERA DE LA PESTAÑA */}
      <Box
        sx={{
          flexShrink: 0,
        }}
      >
        <Typography
          variant="h6"
          gutterBottom
        >
          {tab.name}
        </Typography>

        <Typography variant="body2">
          tabla: {tab.tablename}
        </Typography>

        <Typography variant="body2">
          endpoint: {
            tab.data_endpoint ??
            "sin endpoint"
          }
        </Typography>

        {tab.parent_ad_tab_id !==
          undefined && (
          <Typography variant="body2">
            parent tab: {
              tab.parent_ad_tab_id
            }

            {tab.link_columnname
              ? ` — link: ${tab.link_columnname}`
              : ""}
          </Typography>
        )}

        {tab.isreadonly && (
          <Alert
            severity="info"
            sx={{
              marginTop: 2,
            }}
          >
            Esta pestaña es de solo lectura.
          </Alert>
        )}

        {!tab.data_endpoint && (
          <Alert
            severity="warning"
            sx={{
              marginTop: 2,
            }}
          >
            No existe un endpoint REST configurado
            para la tabla {tab.tablename}.
          </Alert>
        )}
      </Box>


      {tab.data_endpoint && (
        <>

          {/* BOTONERA DE NAVEGACIÓN / CRUD */}
          <Box
            sx={{
              flexShrink: 0,
              marginTop: 1,
              marginBottom: 2,
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            <ButtonGroup
              variant="outlined"
              size="small"
            >

              <Button
                onClick={() => setPage(1)}
                disabled={
                  viewMode === "grid" ||
                  isNewRecord ||
                  isEditing ||
                  page === 1 ||
                  totalCount === 0
                }
              >
                |← Primero
              </Button>

              <Button
                onClick={() =>
                  setPage(
                    (current) =>
                      Math.max(
                        1,
                        current - 1
                      )
                  )
                }
                disabled={
                  viewMode === "grid" ||
                  isNewRecord ||
                  isEditing ||
                  page === 1
                }
              >
                ← Anterior
              </Button>

              <Button
                onClick={() =>
                  setPage(
                    (current) =>
                      current + 1
                  )
                }
                disabled={
                  viewMode === "grid" ||
                  isNewRecord ||
                  isEditing ||
                  totalCount === 0 ||
                  page >= totalCount
                }
              >
                Siguiente →
              </Button>

              <Button
                onClick={() =>
                  setPage(totalCount)
                }
                disabled={
                  viewMode === "grid" ||
                  isNewRecord ||
                  isEditing ||
                  totalCount === 0 ||
                  page >= totalCount
                }
              >
                Último →|
              </Button>

              <Button
                onClick={handleNewRecord}
                disabled={
                  viewMode === "grid" ||
                  tab.isreadonly === true ||
                  tab.isinsertrecord === false ||
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
                  viewMode === "grid" ||
                  tab.isreadonly === true ||
                  isNewRecord ||
                  isEditing ||
                  saving ||
                  getRecordKeyValues() ===
                    undefined
                }
              >
                Editar
              </Button>

              <Button
                onClick={handleDeleteRecord}
                disabled={
                  viewMode === "grid" ||
                  tab.isreadonly === true ||
                  isNewRecord ||
                  isEditing ||
                  saving ||
                  getRecordKeyValues() ===
                    undefined
                }
              >
                Eliminar
              </Button>

              <Button
                onClick={() =>
                  setSearchOpen(true)
                }
                disabled={
                  isNewRecord ||
                  isEditing ||
                  saving
                }
              >
                Buscar
              </Button>

              <Button
                onClick={() => {
                  setSearchFilter("");
                  setPage(1);
                }}
                disabled={
                  isNewRecord ||
                  isEditing ||
                  saving ||
                  searchFilter === ""
                }
              >
                Limpiar búsqueda
              </Button>

              <Button
                onClick={() =>
                  setViewMode(
                    (current) =>
                      current === "form"
                        ? "grid"
                        : "form"
                  )
                }
                disabled={
                  isNewRecord ||
                  isEditing ||
                  saving
                }
              >
                {viewMode === "form"
                  ? "Grilla"
                  : "Ficha"}
              </Button>

              {isNewRecord && (
                <>
                  <Button
                    onClick={
                      handleSaveNewRecord
                    }
                    disabled={saving}
                  >
                    {saving
                      ? "Guardando..."
                      : "Guardar"}
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
                    onClick={
                      handleSaveEditedRecord
                    }
                    disabled={saving}
                  >
                    {saving
                      ? "Guardando..."
                      : "Guardar"}
                  </Button>

                  <Button
                    onClick={
                      handleCancelEdit
                    }
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                </>
              )}

            </ButtonGroup>


            <Typography variant="body2">
              {viewMode === "grid"
                ? `Grilla — ${totalCount} registros`
                : isNewRecord
                ? "Nuevo registro"
                : isEditing
                ? `Editando registro ${page} de ${totalCount}`
                : totalCount > 0
                ? `Registro ${page} de ${totalCount}`
                : "Sin registros"}
            </Typography>


            {searchFilter && (
              <Typography variant="body2">
                Búsqueda activa
              </Typography>
            )}
          </Box>


          {/* MENSAJES CRUD */}
          <Box
            sx={{
              flexShrink: 0,
            }}
          >
            {saveError && (
              <Alert
                severity="error"
                sx={{
                  marginBottom: 2,
                }}
              >
                {saveError}
              </Alert>
            )}

            {saveMessage && (
              <Alert
                severity="success"
                sx={{
                  marginBottom: 2,
                }}
              >
                {saveMessage}
              </Alert>
            )}
          </Box>


          {/* FICHA / GRILLA */}
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              paddingRight: 1,
              paddingBottom: 2,
            }}
          >

            {viewMode === "form" ? (
              <>
                {[...tab.fields]
                  .filter(
                    (field) =>
                      field.isdisplayed !==
                      false
                  )
                  .sort(
                    (a, b) =>
                      a.seqno - b.seqno
                  )
                  .map(renderField)}
              </>
            ) : (
              <RecordGrid
                tab={tab}
                filter={
                  buildRecordFilter()
                }
                currentRecordPage={page}
                onSelectRecord={
                  handleGridSelectRecord
                }
              />
            )}

          </Box>

        </>
      )}


      <RecordSearchDialog
        open={searchOpen}
        tab={tab}
        onClose={() =>
          setSearchOpen(false)
        }
        onSearch={
          handleSearchRecords
        }
      />

    </Box>
  );
}