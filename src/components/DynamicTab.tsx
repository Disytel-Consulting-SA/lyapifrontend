import type { AncestorIdentities } from "../utils/recordIdentity";
import { getRecordIdentity, identityPathValues } from "../utils/recordIdentity";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import FirstPageIcon from "@mui/icons-material/FirstPage";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import LastPageIcon from "@mui/icons-material/LastPage";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import ReplayIcon from "@mui/icons-material/Replay";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import GridOnIcon from "@mui/icons-material/GridOn";
import ViewListIcon from "@mui/icons-material/ViewList";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import CloseIcon from "@mui/icons-material/Close";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";

import {
  CalloutValidationError,
  createContextualRecord,
  deleteContextualRecord,
  evaluateRecordState,
  executeTabFieldCallout,
  getTabRecords,
  getNewRecordState,
  getRecordByKey,
  updateContextualRecord,
  getRecordByIdentity,
} from "../api/libertyaApi";

import type {
  WindowRecordFieldState,
} from "../api/libertyaApi";

import type {
  WindowSchemaField,
  WindowSchemaTab,
} from "../types/metadata";

import {
  buildCreatePayload,
  isIdentityColumn,
  isGeneratedIdentityColumn,
  isContextualParentColumn,
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
import LocationField from "./LocationField";
import RecordSearchDialog from "./RecordSearchDialog";
import RecordGrid from "./RecordGrid";
import RecordList from "./RecordList";

import type {
  ListViewState,
} from "./RecordList";

import LookupField from "./LookupField";

import ButtonField from "./ButtonField";

interface Props {
  tab: WindowSchemaTab;
  parentTab?: WindowSchemaTab;
  ancestors?: AncestorIdentities | null;
  parentRecord?: Record<string, unknown> | null;
  windowIsSOTrx: boolean;
  initialPage: number;

  onRecordChange: (
    tabId: number,
    record: Record<string, unknown> | null
  ) => void;

  onPageChange: (tabId: number, page: number) => void;
  onCloseWindow: () => void;
}


interface FormFieldRow {
  fields: WindowSchemaField[];
}

interface FormFieldGroup {
  name?: string;
  rows: FormFieldRow[];
}


const numericFieldSx = {
  "& input": {
    textAlign: "right",
  },
};

function toCalloutValue(field: WindowSchemaField, value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  const type = field.reference?.type;
  if (type === "boolean") {
    return value === true || value === "Y" || value === "true";
  }

  if (
    field.columnname.endsWith("_ID") ||
    type === "integer" ||
    type === "number" ||
    type === "amount" ||
    type === "quantity" ||
    type === "costprice" ||
    type === "lookup" ||
    type === "search"
  ) {
    if (value === "") {
      return null;
    }
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }

  return value;
}


export default function DynamicTab({
  tab,
  parentTab,
  ancestors,
  parentRecord,
  windowIsSOTrx,
  initialPage,
  onPageChange,
  onRecordChange,
  onCloseWindow,
}: Props) {

  const [record, setRecord] = useState<Record<string, unknown>>({});
  const recordRef = useRef<Record<string, unknown>>({});
  const dirtyFieldsRef = useRef(new Set<string>());
  const previousCalloutValuesRef = useRef(new Map<string, unknown>());
  const queuedFieldsRef = useRef(new Map<string, WindowSchemaField>());
  const calloutEpochRef = useRef(0);
  const calloutPendingRef = useRef(false);
  const stateEvaluationRef = useRef(0);
  const [page, setPage] = useState(initialPage);
  const [totalCount, setTotalCount] = useState(0);

  const [isNewRecord, setIsNewRecord] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  /*
   * Durante un alta dejamos temporalmente la navegación normal.
   * Después de guardar, el registro recién creado permanece como
   * registro actual hasta que el usuario vuelva explícitamente al
   * conjunto navegable.
   */
  const [isNavigationDetached, setIsNavigationDetached] =
    useState(false);

  const [fieldStates, setFieldStates] =
    useState<WindowRecordFieldState[]>([]);

  const [originalRecord, setOriginalRecord] =
    useState<Record<string, unknown> | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [calloutPending, setCalloutPending] = useState(false);
  const [calloutError, setCalloutError] = useState<string | null>(null);
  const [calloutMessage, setCalloutMessage] = useState<string | null>(null);
  const [failedCalloutField, setFailedCalloutField] =
    useState<WindowSchemaField | null>(null);

  const [refreshToken, setRefreshToken] = useState(0);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");

  const [viewMode, setViewMode] =
    useState<"form" | "grid" | "list">("form");

  const [listViewState, setListViewState] =
    useState<ListViewState>({
      searchText: "",
      listFilterValues: {},
      lookupFilterValues: {},
      page: 0,
      rowsPerPage: 25,
    });    

 /*
  * Determina si la ficha respeta IsSameLine.
  *
  * true  = distribución definida por los metadatos
  * false = un campo por línea
  */
  const [useSameLineLayout, setUseSameLineLayout] =
    useState(true);

  useEffect(() => {
    recordRef.current = record;
  }, [record]);

  useEffect(() => () => {
    calloutEpochRef.current += 1;
    stateEvaluationRef.current += 1;
  }, []);


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
    value: unknown,
    commitImmediately = false
  ) {
    const key = field.columnname.toLowerCase();
    if (Object.is(recordRef.current[key], value)) {
      return;
    }

  if ((isNewRecord || isEditing)
      && tab.parent_ad_tab_id === undefined
      && field.has_callout
      && !previousCalloutValuesRef.current.has(key)) {
    previousCalloutValuesRef.current.set(
      key,
      recordRef.current[key]
    );
  }

    const updatedRecord = {
      ...recordRef.current,
      [key]: value,
    };
    recordRef.current = updatedRecord;
    dirtyFieldsRef.current.add(key);
    setRecord(updatedRecord);
    setCalloutMessage(null);
    if (!failedCalloutField || failedCalloutField.ad_field_id === field.ad_field_id) {
      setCalloutError(null);
    }

    if (commitImmediately) {
      void commitFieldValue(field, updatedRecord);
    }
  }

  function buildCalloutValues(
    currentRecord: Record<string, unknown>
  ): Record<string, unknown> {
    const values: Record<string, unknown> = {};
    for (const field of tab.fields) {
      const key = field.columnname.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(currentRecord, key)) {
        values[field.columnname] = toCalloutValue(field, currentRecord[key]);
      }
    }
    return values;
  }

  async function commitFieldValue(
    field: WindowSchemaField,
    currentRecord = recordRef.current
  ) {
    const key = field.columnname.toLowerCase();
    if (!dirtyFieldsRef.current.has(key)) {
      return;
    }
    if (calloutPendingRef.current) {
      queuedFieldsRef.current.set(key, field);
      return;
    }
    dirtyFieldsRef.current.delete(key);

    if ((!isNewRecord && !isEditing)
        || tab.parent_ad_tab_id !== undefined
        || !field.has_callout) {
      await reevaluateRecordState(
        currentRecord,
        field.columnname
      );
      return;
    }


    let recordIds: string[] | undefined;

    if (isEditing) {
      const keyValues =
        getRecordKeyValues();

      if (!keyValues) {
        setCalloutError(
          "No fue posible determinar la clave del registro para ejecutar el callout"
        );
        return;
      }

      recordIds =
        keyValues.map(
          (value) => String(value)
        );
    }


    const epoch = ++calloutEpochRef.current;
    calloutPendingRef.current = true;
    setCalloutPending(true);
    setCalloutError(null);
    setCalloutMessage(null);

    let succeeded = false;
    try {

      const result = await executeTabFieldCallout(
        tab.ad_tab_id,
        {
          ad_field_id:
            field.ad_field_id,

          value:
            toCalloutValue(
              field,
              currentRecord[key]
            ),

          values:
            buildCalloutValues(
              currentRecord
            ),

          inserting:
            isNewRecord,

          ...(recordIds !== undefined
          ? { record_ids: recordIds }
          : {}),
        }
      );

      if (epoch !== calloutEpochRef.current) {
        return;
      }

      const updatedRecord = { ...recordRef.current };
      for (const [columnName, value] of Object.entries(result.changes ?? {})) {
        const changedKey = columnName.toLowerCase();
        if (!dirtyFieldsRef.current.has(changedKey)) {
          updatedRecord[changedKey] = value;
        }
      }
      recordRef.current = updatedRecord;
      setRecord(updatedRecord);
      setCalloutMessage(result.message || null);
      setFailedCalloutField(null);
      previousCalloutValuesRef.current.delete(key);
      await reevaluateRecordState(updatedRecord, field.columnname);
      succeeded = true;
    } catch (error) {
      if (epoch !== calloutEpochRef.current) {
        return;
      }
      console.error(`Error ejecutando callout para ${field.columnname}`, error);
      if (error instanceof CalloutValidationError) {
        const previousValue = previousCalloutValuesRef.current.get(key);
        const restoredRecord = { ...recordRef.current, [key]: previousValue };
        recordRef.current = restoredRecord;
        setRecord(restoredRecord);
        previousCalloutValuesRef.current.delete(key);
        dirtyFieldsRef.current.delete(key);
        setFailedCalloutField(null);
      } else {
        dirtyFieldsRef.current.add(key);
        setFailedCalloutField(field);
      }
      setCalloutError(
        error instanceof Error ? error.message : "No fue posible actualizar los campos"
      );
    } finally {
      if (epoch === calloutEpochRef.current) {
        calloutPendingRef.current = false;
        setCalloutPending(false);
        while (succeeded && queuedFieldsRef.current.size > 0 && !calloutPendingRef.current) {
          const nextField = queuedFieldsRef.current.values().next().value;
          if (!nextField) {
            break;
          }
          queuedFieldsRef.current.delete(nextField.columnname.toLowerCase());
          void commitFieldValue(nextField);
        }
      }
    }
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

    if ((isEditing && (isIdentityColumn(tab, field) || isContextualParentColumn(tab, field))) || (isNewRecord && (isGeneratedIdentityColumn(tab, field) || isContextualParentColumn(tab, field))))
      return false;

    const state = getFieldState(field);

    if (state)
      return !calloutPending && !state.readonly &&
        (isNewRecord || isEditing);

    if (isNewRecord)
      return false;

    return !isMetadataReadOnly(field) &&
      isEditing;
  }


  function getFieldVisualState(
    field: WindowSchemaField
  ): FieldVisualState {

    if ((isEditing && (isIdentityColumn(tab, field) || isContextualParentColumn(tab, field))) || (isNewRecord && (isGeneratedIdentityColumn(tab, field) || isContextualParentColumn(tab, field))))
      return "readonly";

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



  function isRequiredFieldEmpty(
      field: WindowSchemaField
    ): boolean {

      if ((isEditing && (isIdentityColumn(tab, field) || isContextualParentColumn(tab, field))) || (isNewRecord && (isGeneratedIdentityColumn(tab, field) || isContextualParentColumn(tab, field))))
        return false;

      if (!field.ismandatory) {
        return false;
      }

      const state = getFieldState(field);

      if (
        state?.displayed === false ||
        state?.readonly === true
      ) {
        return false;
      }

      const value = getFieldValue(field);

      return (
        value === undefined ||
        value === null ||
        (
          typeof value === "string" &&
          value.trim() === ""
        )
      );
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

    const values: Record<string, string> = {};

    for (const field of parentTab.fields) {
      const value =
        parentRecord[
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

    return Object.keys(values).length > 0
      ? values
      : undefined;
  }


  function buildRecordFilter(): string | undefined {
    return searchFilter || undefined;
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
    IsSOTrx: windowIsSOTrx ? "Y" : "N",
    ...buildParentValues(),
    ...buildRecordStateValues(record),
  };
}, [windowIsSOTrx, record, parentRecord, parentTab, tab.fields]);


  async function reevaluateRecordState(
    currentRecord: Record<string, unknown>,
    changedColumn?: string,
    inserting = isNewRecord
  ) {
    const evaluation = ++stateEvaluationRef.current;
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

            inserting,
          }
        );

      if (evaluation === stateEvaluationRef.current) {
        setFieldStates(state.fields);
      }

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


  function handleGridSelectRecord(selectedRecord: Record<string, unknown>, recordPage: number) {
    void openProjectedRecord(selectedRecord, recordPage, false);
  }

  function canWrite(method: "POST" | "PUT" | "DELETE"): boolean {
    return !!ancestors && tab.isreadonly !== true && !!tab.crud_endpoints?.[method]
      && (method !== "POST" || tab.isinsertrecord !== false)
      && (method === "DELETE" || !!(tab.crud_endpoints?.GET ?? tab.data_endpoint));
  }

  function handleListEditRecord(selectedRecord: Record<string, unknown>, recordPage: number) {
    if (!canWrite("PUT")) return;
    void openProjectedRecord(selectedRecord, recordPage, true);
  }

  async function openProjectedRecord(selectedRecord: Record<string, unknown>, recordPage: number, editing: boolean) {
    if (saving) return;
    const identity = getRecordIdentity(tab, selectedRecord);
    const keys = identity ? identityPathValues(tab, identity) : null;
    const endpoint = tab.crud_endpoints?.GET ?? tab.data_endpoint;
    if (!identity || !keys || !endpoint) {
      setSaveError("No fue posible identificar el registro seleccionado");
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const fullRecord = endpoint.startsWith("/v1.0/genericidentity/")
        ? await getRecordByIdentity(endpoint, identity)
        : await getRecordByKey(endpoint, keys);
      if (!fullRecord) throw new Error("No fue posible recuperar el registro seleccionado");

      selectRecord(fullRecord, recordPage);
      setOriginalRecord({ ...fullRecord });
      // La posición de una fila filtrada u ordenada no equivale necesariamente a la ficha.
      setIsNavigationDetached(true);
      setViewMode("form");
      setIsEditing(editing);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "No fue posible recuperar el registro");
    } finally {
      setSaving(false);
    }
  }

  async function handleListDeleteRecord(
    selectedRecord: Record<string, unknown>
  ) {
    await deleteSelectedRecord(selectedRecord);
  }

  async function deleteSelectedRecord(selectedRecord: Record<string, unknown>) {
    if (saving) return;
    if (!canWrite("DELETE")) {
      setSaveError("La pestaña no admite eliminaciones contextuales");
      return;
    }
    if (!ancestors) {
      setSaveError("No se dispone del contexto ancestral completo");
      return;
    }

    const identity = getRecordIdentity(tab, selectedRecord);
    if (!identity) {
      setSaveError("No fue posible determinar la clave primaria del registro");
      return;
    }

    const confirmed =
      window.confirm(
        "¿Confirma eliminar este registro?\n\nEsta operación no puede deshacerse."
      );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      await deleteContextualRecord(tab, ancestors, identity);

      resetAfterDelete();
    } catch (error) {
      console.error(
        `Error eliminando registro en ${tab.crud_endpoints?.DELETE}`,
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



  function selectRecord(
    selectedRecord: Record<string, unknown>,
    recordPage: number
  ) {
    setRecord(selectedRecord);
    recordRef.current = selectedRecord;

    setPage(recordPage);

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

    if (!canWrite("POST") || saving)
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
      calloutEpochRef.current += 1;
      dirtyFieldsRef.current.clear();
      previousCalloutValuesRef.current.clear();
      queuedFieldsRef.current.clear();
      recordRef.current = newRecord;
      setCalloutError(null);
      setCalloutMessage(null);
      setFailedCalloutField(null);
      setIsNavigationDetached(true);
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
    if (!canWrite("PUT") || saving || !getRecordIdentity(tab, record)) return;
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


  function getRecordKeyValues(): Array<string | number> | undefined {
    // Durante la edición, la identidad pertenece al registro original.
    const identity = getRecordIdentity(tab, isEditing && originalRecord ? originalRecord : record);
    return identity ? identityPathValues(tab, identity) ?? undefined : undefined;
  }


  function getDocumentRecordId(): string | number | undefined {
  const keyValues = getRecordKeyValues();

  if (!keyValues || keyValues.length !== 1) return undefined;

  return keyValues[0];
}


  async function handleSaveNewRecord() {
    if (calloutPendingRef.current || failedCalloutField) {
      return;
    }

    const createEndpoint = tab.crud_endpoints?.POST;
    const readEndpoint = tab.crud_endpoints?.GET ?? tab.data_endpoint;

    if (!createEndpoint || !readEndpoint) {
      setSaveError(
        "La pestaña no posee un endpoint REST configurado para creación"
      );
      return;
    }

    if (!ancestors) {
      setSaveError("No se dispone del contexto ancestral completo");
      return;
    }

    const missingFields =
      validateCreateRecord(
        tab,
        record,
        fieldStates,
        true
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

    let persisted = false;
    try {
      const payload =
        buildCreatePayload(
          tab,
          record,
          true
        );

      const identity = await createContextualRecord(tab, ancestors, payload);

      persisted = true;
      // El alta ya fue confirmada: no permitir repetirla si falla la lectura.
      setIsNewRecord(false);
      setIsNavigationDetached(true);
      setRecord({});
      recordRef.current = {};
      setOriginalRecord(null);
      onRecordChange(tab.ad_tab_id, null);
      const keyValues = identityPathValues(tab, identity);
      if (!keyValues)
        throw new Error("El registro fue creado pero su identidad no es válida");

      const createdRecord = readEndpoint.startsWith("/v1.0/genericidentity/")
        ? await getRecordByIdentity(readEndpoint, identity)
        : await getRecordByKey(readEndpoint, keyValues);

      if (!createdRecord) {
        throw new Error(
          "El registro fue creado pero no pudo recuperarse nuevamente."
        );
      }

      calloutEpochRef.current += 1;
      stateEvaluationRef.current += 1;

      setIsNewRecord(false);
      setRecord(createdRecord);
      recordRef.current = createdRecord;

      setOriginalRecord({
        ...createdRecord,
      });

      onRecordChange(
        tab.ad_tab_id,
        createdRecord
      );

      setIsNavigationDetached(true);

      void reevaluateRecordState(
        createdRecord,
        undefined,
        false
      );

      setSaveMessage("Registro creado correctamente.");

    } catch (error) {
      console.error(
        `Error creando registro en ${createEndpoint}`,
        error
      );

      setSaveError(
        persisted ? "El registro fue creado pero no pudo recuperarse nuevamente." :
          error instanceof Error ? error.message : "No fue posible crear el registro"
      );

    } finally {
      setSaving(false);
    }
  }


  async function handleSaveEditedRecord() {
    if (!tab.crud_endpoints?.PUT || !(tab.crud_endpoints.GET ?? tab.data_endpoint)) {
      setSaveError(
        "La pestaña no admite modificaciones contextuales"
      );
      return;
    }

    if (!originalRecord) {
      setSaveError(
        "No se dispone del estado original del registro"
      );
      return;
    }

    if (!ancestors) {
      setSaveError("No se dispone del contexto ancestral completo");
      return;
    }

    const identity = getRecordIdentity(tab, originalRecord);
    const recordKeyValues = identity ? identityPathValues(tab, identity) : null;

    if (!identity || !recordKeyValues) {
      setSaveError(
        "No fue posible determinar la clave primaria del registro"
      );
      return;
    }

    const missingFields =
      validateUpdateRecord(
        tab,
        record,
        fieldStates,
        true
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
          originalRecord,
          true
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

      await updateContextualRecord(tab, ancestors, identity, payload);
      setIsEditing(false);

      const endpoint = tab.crud_endpoints.GET ?? tab.data_endpoint;
      const updatedRecord = endpoint
        ? endpoint.startsWith("/v1.0/genericidentity/")
          ? await getRecordByIdentity(endpoint, identity)
          : await getRecordByKey(endpoint, recordKeyValues)
        : null;

      if (!updatedRecord) {
        setSaveError(
          "El registro fue actualizado pero no pudo recuperarse nuevamente."
        );

        setIsEditing(false);
        return;
      }

      setRecord(updatedRecord);
      recordRef.current = updatedRecord;

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


  function resetAfterDelete() {
    // Invalidar la ficha y las evaluaciones pendientes del registro eliminado.
    stateEvaluationRef.current += 1;
    calloutEpochRef.current += 1;
    dirtyFieldsRef.current.clear();
    previousCalloutValuesRef.current.clear();
    queuedFieldsRef.current.clear();
    setRecord({});
    recordRef.current = {};
    setOriginalRecord(null);
    setFieldStates([]);
    setCalloutError(null);
    setCalloutMessage(null);
    setFailedCalloutField(null);
    setIsNewRecord(false);
    setIsEditing(false);
    setIsNavigationDetached(false);
    setTotalCount(0);
    if (isNavigationDetached) {
      setPage(1);
      onPageChange(tab.ad_tab_id, 1);
    }
    onRecordChange(tab.ad_tab_id, null);
    setSaveMessage("Registro eliminado correctamente.");
    setRefreshToken((current) => current + 1);
  }

  async function handleDeleteRecord() {
    await deleteSelectedRecord(isEditing && originalRecord ? originalRecord : record);
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


    function isFieldDisplayed(
    field: WindowSchemaField
  ): boolean {

    /*
     * Las columnas encriptadas pueden formar parte de la
     * definición original de la ventana de Libertya, pero
     * no son expuestas por la REST API.
     *
     * Por lo tanto tampoco deben renderizarse en el
     * frontend dinámico.
     */
    if (field.isencrypted === true)
      return false;

    if (field.isdisplayed === false)
      return false;

    const state = getFieldState(field);

    if (state && !state.displayed)
      return false;

    if (isNewRecord && !state)
      return false;

    return true;
  }


    function buildFormLayout(): FormFieldGroup[] {

    const fields = [...tab.fields]
      .filter(isFieldDisplayed)
      .sort((a, b) => {
        if (a.seqno == null && b.seqno == null)
          return 0;

        if (a.seqno == null)
          return 1;

        if (b.seqno == null)
          return -1;

        return a.seqno - b.seqno;
      });

    const groups: FormFieldGroup[] = [];

    let currentGroup: FormFieldGroup | undefined;
    let activeFieldGroup: string | undefined;

    for (const field of fields) {

      const fieldGroup =
        field.fieldgroup?.trim() || undefined;

      let startsNewGroup = false;

      if (
        fieldGroup &&
        fieldGroup !== activeFieldGroup
      ) {
        activeFieldGroup = fieldGroup;
        startsNewGroup = true;

        currentGroup = {
          name: fieldGroup,
          rows: [],
        };

        groups.push(currentGroup);
      }

      if (!currentGroup) {
        currentGroup = {
          rows: [],
        };

        groups.push(currentGroup);
      }

      const previousRow =
        currentGroup.rows[
          currentGroup.rows.length - 1
        ];

      const sameLine =
        useSameLineLayout &&
        !startsNewGroup &&
        field.issameline === true &&
        previousRow !== undefined &&
        previousRow.fields.length < 2;

      if (sameLine) {
        previousRow.fields.push(field);
      } else {
        currentGroup.rows.push({
          fields: [field],
        });
      }
    }

    return groups;
  }

  /*
   * Accesos rápidos: los botones de la pestaña activa y las acciones
   * del documento padre cuando estamos en una subpestaña.
   * Los controles originales del formulario permanecen intactos.
   */
  const activeButtons = tab.fields
    .filter((field) => field.reference?.type === "button" && isFieldDisplayed(field))
    .sort((a, b) => a.seqno - b.seqno);

  const ownDocumentAction = activeButtons.find(
    (field) => field.columnname.toLowerCase() === "docaction" &&
      field.reference?.button_type === "document-action"
  );

  const parentDocumentAction = parentTab?.fields.find(
    (field) => field.columnname.toLowerCase() === "docaction" &&
      field.reference?.button_type === "document-action" &&
      field.isdisplayed !== false && field.isencrypted !== true
  );

  const documentTab = ownDocumentAction ? tab : parentDocumentAction ? parentTab : undefined;
  const documentRecord = ownDocumentAction ? record : parentRecord;
  const documentActionField = ownDocumentAction ?? parentDocumentAction;
  const documentIdField = documentTab?.fields.find((field) => field.iskey);
  const documentIdValue = documentIdField && documentRecord
    ? documentRecord[documentIdField.columnname.toLowerCase()]
    : undefined;
  const documentRecordId =
    typeof documentIdValue === "string" || typeof documentIdValue === "number"
      ? documentIdValue
      : undefined;
  const docStatusField = documentTab?.fields.find(
    (field) => field.columnname.toLowerCase() === "docstatus"
  );
  const docStatusValue = docStatusField && documentRecord
    ? documentRecord[docStatusField.columnname.toLowerCase()]
    : undefined;
  const docStatusLabel = docStatusField?.reference?.values?.find(
    (value) => value.value === String(docStatusValue)
  )?.name ?? (docStatusValue == null ? "—" : String(docStatusValue));
  const documentNoField = documentTab?.fields.find(
    (field) => field.columnname.toLowerCase() === "documentno"
  );
  const documentNoValue = documentNoField && documentRecord
    ? documentRecord[documentNoField.columnname.toLowerCase()]
    : undefined;
  const documentNo = documentNoValue == null ? "" : String(documentNoValue).trim();
  const hasDocumentStatus = docStatusValue !== undefined && docStatusValue !== null && String(docStatusValue).trim() !== "";


  async function handleQuickActionProcessed() {
    setRefreshToken((current) => current + 1);
    if (!documentTab?.data_endpoint || documentRecordId === undefined) return;
    try {
      const updated = await getRecordByKey(documentTab.data_endpoint, [documentRecordId]);
      if (updated) {
        onRecordChange(documentTab.ad_tab_id, updated);
        if (documentTab.ad_tab_id === tab.ad_tab_id) {
          setRecord(updated);
          recordRef.current = updated;
          await reevaluateRecordState(updated);
        }
      }
    } catch (error) {
      console.error("No se pudo actualizar el estado del documento procesado", error);
      setSaveError("El documento fue procesado, pero no se pudo actualizar su estado en pantalla.");
    }
  }

  const formLayout = buildFormLayout();


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


    if (field.reference?.type === "button") {
      return (
        <ButtonField
          key={field.ad_field_id}
          field={field}
          tableName={tab.tablename}
          recordId={getDocumentRecordId()}
          disabled={isNewRecord || isEditing}
          onProcessed={() => setRefreshToken((current) => current + 1)}
        />
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
                      event.target.checked,
                      true
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
      field.reference?.type === "location"
    ) {
      return (
        <LocationField
          key={field.ad_field_id}
          field={field}
          rawValue={rawValue}
          editable={editable}
          visualState={visualState}
          onChange={
            (value) =>
              setFieldValue(
                field,
                value,
                true
              )
          }
        />
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
          requiredEmpty={isRequiredFieldEmpty(field)}
          contextValues={lookupContextValues}
          onChange={(value) => setFieldValue(field, value, true)}
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
          requiredEmpty={isRequiredFieldEmpty(field)}
          contextValues={lookupContextValues}
          onChange={
            (value) =>
              setFieldValue(
                field,
                value,
                true
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
        <TextField
          key={field.ad_field_id}
          select
          label={field.name}
          value={value}
          required={field.ismandatory}
          disabled={!editable}
          fullWidth
          margin="dense"
          onChange={(event) =>
            setFieldValue(
              field,
              event.target.value,
              true
            )
          }
          slotProps={{
            inputLabel: {
              shrink: true,
            },
          }}
          sx={[
            getFieldStateSx(visualState, isRequiredFieldEmpty(field)),
            {
              marginTop: 0.375,
            },
          ]}
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
        </TextField>
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
          onBlur={() => void commitFieldValue(field)}
          fullWidth
          margin="dense"
          slotProps={{
            inputLabel: {
              shrink: true,
            },
          }}
          sx={
            getFieldStateSx(visualState, isRequiredFieldEmpty(field))
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
          onBlur={() => void commitFieldValue(field)}
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
          sx={[
            getFieldStateSx(visualState),
            numericFieldSx,
          ]}
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
          onBlur={() => void commitFieldValue(field)}
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
            getFieldStateSx(visualState, isRequiredFieldEmpty(field)),
            numericFieldSx,
          ]}
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
          onBlur={() => void commitFieldValue(field)}
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
            getFieldStateSx(visualState, isRequiredFieldEmpty(field)),
            numericFieldSx,
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
          onBlur={() => void commitFieldValue(field)}
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
              visualState,
              isRequiredFieldEmpty(field)
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
        onBlur={() => void commitFieldValue(field)}
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
            visualState, isRequiredFieldEmpty(field)
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
    calloutEpochRef.current += 1;
    stateEvaluationRef.current += 1;
    calloutPendingRef.current = false;
    dirtyFieldsRef.current.clear();
    previousCalloutValuesRef.current.clear();
    queuedFieldsRef.current.clear();
    setCalloutPending(false);
    setCalloutError(null);
    setCalloutMessage(null);
    setFailedCalloutField(null);
    setIsNewRecord(false);
    setIsEditing(false);
    setIsNavigationDetached(false);
    setOriginalRecord(null);
    setViewMode("form");
  }, [
    tab.ad_tab_id,
  ]);


  const previousParentRecordRef =
    useRef(parentRecord);

  useEffect(() => {
    /*
     * Reiniciar una detail solamente cuando cambia realmente su padre
     * mientras la misma pestaña permanece montada.
     *
     * useEffect se ejecuta también en el montaje inicial. En ese caso
     * debemos conservar initialPage, que contiene la posición guardada
     * por App al volver desde una pestaña hija.
     */
    if (
      tab.parent_ad_tab_id !== undefined &&
      previousParentRecordRef.current !== parentRecord
    ) {
      setPage(1);
    }

    previousParentRecordRef.current = parentRecord;
  }, [
    parentRecord,
    tab.parent_ad_tab_id,
  ]);


  useEffect(() => {
    if (isNewRecord || isEditing || isNavigationDetached)
      return;

    if (!(tab.crud_endpoints?.GET ?? tab.data_endpoint)) {
      setRecord({});
      setFieldStates([]);
      setTotalCount(0);
      onRecordChange(tab.ad_tab_id, null);
      return;
    }

    const parentValues = buildParentValues();

    /*
    * Una pestaña detail sin registro padre seleccionado
    * no debe recuperar registros.
    */
    if (tab.parent_ad_tab_id !== undefined && !parentValues) {
      setRecord({});
      setFieldStates([]);
      setTotalCount(0);
      onRecordChange(tab.ad_tab_id, null);
      return;
    }

    // La lectura contextual soporta también identidades compuestas.
    let cancelled = false;
    const recordRequest = getTabRecords(tab.ad_tab_id, {
      parent_values: parentValues,
      filter: buildRecordFilter(),
      limit: 1,
      page,
      include_total: true,
    });

    recordRequest
      .then(({ records, totalCount }) => {
        if (cancelled) return;
        const result = records.length > 0 ? records[0] : null;

        setTotalCount(totalCount);

        if (result === null) {
          if (totalCount > 0 && page > totalCount) {
            setPage(totalCount);
            onPageChange(tab.ad_tab_id, totalCount);
          } else {
            setRecord({});
            recordRef.current = {};
            setOriginalRecord(null);
            setFieldStates([]);
            onRecordChange(tab.ad_tab_id, null);
          }

          return;
        }

        setRecord(result);
        recordRef.current = result;

        setOriginalRecord({
          ...result,
        });

        onRecordChange(
          tab.ad_tab_id,
          result
        );

        void reevaluateRecordState(result);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error(
          `Error recuperando registros de AD_Tab_ID=${tab.ad_tab_id}`,
          error
        );

        setRecord({});
        recordRef.current = {};
        setOriginalRecord(null);
        setFieldStates([]);
        setTotalCount(0);

        onRecordChange(
          tab.ad_tab_id,
          null
        );
      });

    return () => { cancelled = true; };

  }, [
    tab,
    page,
    parentRecord,
    isNewRecord,
    isEditing,
    isNavigationDetached,
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
          paddingLeft: 4,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, minWidth: 0 }}>
      <Tooltip
        arrow
        placement="right"
        title={
          <>
            <div>Tabla: {tab.tablename}</div>
            <div>Endpoint: {tab.data_endpoint ?? "sin endpoint"}</div>
            <div>Creation: {tab.create_endpoint ?? tab.data_endpoint}</div>

            {tab.parent_ad_tab_id !== undefined && (
              <div>
                Parent tab: {tab.parent_ad_tab_id}
                {tab.link_columnname
                  ? ` — Link: ${tab.link_columnname}`
                  : ""}
              </div>
            )}
          </>
        }
      >
        <Typography
          variant="h6"
          sx={{
            display: "inline-block",
            cursor: "help",
          }}
        >
          {tab.name}
        </Typography>
      </Tooltip>
            {documentNo && (
              <Tooltip title={documentNoField?.name ?? "Número de documento"}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, overflowWrap: "anywhere" }}>
                  {documentNo}
                </Typography>
              </Tooltip>
            )}
            {hasDocumentStatus && (
              <Tooltip title={docStatusField?.name ?? "Estado del documento"}>
                <Box
                  component="span"
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    px: 1,
                    py: 0.25,
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    color: "text.secondary",
                    fontSize: "0.75rem",
                    lineHeight: 1.5,
                    whiteSpace: "nowrap",
                  }}
                >
                  {docStatusLabel}
                </Box>
              </Tooltip>
            )}
          </Box>
          {tab.data_endpoint && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ marginLeft: "auto", whiteSpace: "nowrap", fontSize: "0.75rem" }}
            >
          {viewMode === "grid"
            ? `Grilla — ${totalCount} registros`
            : viewMode === "list"
            ? `Lista — ${totalCount} registros`
            : isNewRecord
            ? "Nuevo registro"
            : isEditing
            ? isNavigationDetached
              ? "Editando registro recién creado"
              : `Editando registro ${page} de ${totalCount}`
            : isNavigationDetached
            ? "Registro recién creado"
            : totalCount > 0
            ? `Registro ${page} de ${totalCount}`
            : "Sin registros"}
            </Typography>
          )}
        </Box>

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
            {tab.data_endpoint_error ||
              `No existe un endpoint REST configurado para la tabla ${tab.tablename}.`}
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
          marginBottom: (documentActionField || activeButtons.length > 0) && viewMode === "form" ? 0.75 : 2,

          display: "flex",
          flexWrap: "wrap",
          gap: 0.75,
          alignItems: "center",

          "& .MuiButton-root": {
            minWidth: 36,
            width: 36,
            height: 34,
            padding: 0.5,
          },
          "& .MuiButton-root.Mui-disabled": {
            opacity: 0.45,
          },
          "& .MuiButtonGroup-root > span": {
            display: "inline-flex",
          },
        }}
      >

        {/* Navegación */}
        <ButtonGroup
          variant="outlined"
          size="small"
        >
          <Tooltip title="Primero">
            <span>
              <Button
            onClick={() => setPage(1)}
            disabled={
              viewMode !== "form" ||
              isNewRecord ||
              isNavigationDetached ||
              isEditing ||
              page === 1 ||
              totalCount === 0
            }
            aria-label="Primero"
          >
                <FirstPageIcon fontSize="small" />
              </Button>
            </span>
          </Tooltip>

          <Tooltip title="Anterior">
            <span>
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
              viewMode !== "form" ||
              isNewRecord ||
              isNavigationDetached ||
              isEditing ||
              page === 1
            }
            aria-label="Anterior"
          >
                <NavigateBeforeIcon fontSize="small" />
              </Button>
            </span>
          </Tooltip>

          <Tooltip title="Siguiente">
            <span>
              <Button
            onClick={() =>
              setPage(
                (current) =>
                  current + 1
              )
            }
            disabled={
              viewMode !== "form" ||
              isNewRecord ||
              isNavigationDetached ||
              isEditing ||
              totalCount === 0 ||
              page >= totalCount
            }
            aria-label="Siguiente"
          >
                <NavigateNextIcon fontSize="small" />
              </Button>
            </span>
          </Tooltip>

          <Tooltip title="Último">
            <span>
              <Button
            onClick={() =>
              setPage(totalCount)
            }
            disabled={
              viewMode !== "form" ||
              isNewRecord ||
              isNavigationDetached ||
              isEditing ||
              totalCount === 0 ||
              page >= totalCount
            }
            aria-label="Último"
          >
                <LastPageIcon fontSize="small" />
              </Button>
            </span>
          </Tooltip>
        </ButtonGroup>


        {/* Edición */}
        <ButtonGroup
          variant="outlined"
          size="small"
        >
          <Tooltip title="Nuevo">
            <span>
              <Button
            onClick={handleNewRecord}
            disabled={
              !canWrite("POST") ||
              viewMode !== "form" ||
              tab.isreadonly === true ||
              tab.isinsertrecord === false ||
              isNewRecord ||
              isEditing ||
              saving
            }
            aria-label="Nuevo"
          >
                <AddIcon fontSize="small" />
              </Button>
            </span>
          </Tooltip>

          <Tooltip title="Editar">
            <span>
              <Button
            onClick={handleEditRecord}
            disabled={
              !canWrite("PUT") ||
              viewMode !== "form" ||
              tab.isreadonly === true ||
              isNewRecord ||
              isEditing ||
              saving ||
              getRecordKeyValues() ===
                undefined
            }
            aria-label="Editar"
          >
                <EditIcon fontSize="small" />
              </Button>
            </span>
          </Tooltip>

          <Tooltip title="Eliminar">
            <span>
              <Button
            onClick={handleDeleteRecord}
            disabled={
              !canWrite("DELETE") ||
              viewMode !== "form" ||
              tab.isreadonly === true ||
              isNewRecord ||
              isEditing ||
              saving ||
              getRecordKeyValues() ===
                undefined
            }
            aria-label="Eliminar"
          >
                <DeleteIcon fontSize="small" />
              </Button>
            </span>
          </Tooltip>
        </ButtonGroup>


        {/* Búsqueda */}
        <ButtonGroup
          variant="outlined"
          size="small"
        >
          <Tooltip title="Buscar">
            <span>
              <Button
            onClick={() =>
              setSearchOpen(true)
            }
            disabled={
              isNewRecord ||
              isNavigationDetached ||
              isEditing ||
              saving
            }
            aria-label="Buscar"
          >
                <SearchIcon fontSize="small" />
              </Button>
            </span>
          </Tooltip>

          <Tooltip title="Limpiar búsqueda">
            <span>
              <Button
            onClick={() => {
              setSearchFilter("");
              setPage(1);
            }}
            disabled={
              isNewRecord ||
              isNavigationDetached ||
              isEditing ||
              saving ||
              searchFilter === ""
            }
            aria-label="Limpiar búsqueda"
          >
                <SearchOffIcon fontSize="small" />
              </Button>
            </span>
          </Tooltip>
        </ButtonGroup>



        {isNavigationDetached && !isNewRecord && (
          <ButtonGroup
            variant="outlined"
            size="small"
          >
            <Tooltip title="Volver a registros">
            <span>
              <Button
              onClick={() => {
                /*
                 * Al volver al conjunto navegable comenzamos desde
                 * la primera página. La posición anterior puede haber
                 * dejado de ser válida después del alta.
                 */
                setSaveMessage(null);
                setSaveError(null);
                setPage(1);
                setIsNavigationDetached(false);
              }}
              disabled={
                isEditing ||
                saving
              }
              aria-label="Volver a registros"
            >
                <ReplayIcon fontSize="small" />
              </Button>
            </span>
          </Tooltip>
          </ButtonGroup>
        )}


        {/* Layout de ficha */}
        <ButtonGroup
          variant="outlined"
          size="small"
        >
          <Tooltip title={useSameLineLayout ? "Mostrar una columna" : "Mostrar dos columnas"}>
            <span>
              <Button
            onClick={() =>
              setUseSameLineLayout(
                (current) => !current
              )
            }
            disabled={
              viewMode !== "form" ||
              saving
            }
            aria-label={useSameLineLayout ? "Mostrar una columna" : "Mostrar dos columnas"}
          >
                <ViewColumnIcon fontSize="small" />
              </Button>
            </span>
          </Tooltip>
        </ButtonGroup>


        {/* Modos de visualización */}
        <ButtonGroup
          variant="outlined"
          size="small"
        >
          <Tooltip title="Ficha">
            <span>
              <Button
            onClick={() =>
              setViewMode("form")
            }
            disabled={
              isNewRecord ||
              isNavigationDetached ||
              isEditing ||
              saving ||
              viewMode === "form"
            }
            aria-label="Ficha"
          >
                <ArticleOutlinedIcon fontSize="small" />
              </Button>
            </span>
          </Tooltip>

          <Tooltip title="Grilla">
            <span>
              <Button
            onClick={() =>
              setViewMode("grid")
            }
            disabled={
              isNewRecord ||
              isNavigationDetached ||
              isEditing ||
              saving ||
              viewMode === "grid"
            }
            aria-label="Grilla"
          >
                <GridOnIcon fontSize="small" />
              </Button>
            </span>
          </Tooltip>

          <Tooltip title="Lista">
            <span>
              <Button
            onClick={() =>
              setViewMode("list")
            }
            disabled={
              isNewRecord ||
              isNavigationDetached ||
              isEditing ||
              saving ||
              viewMode === "list"
            }
            aria-label="Lista"
          >
                <ViewListIcon fontSize="small" />
              </Button>
            </span>
          </Tooltip>
        </ButtonGroup>


        {/* Acciones de alta */}
        {isNewRecord && (
          <ButtonGroup
            variant="outlined"
            size="small"
          >
            <Tooltip title={saving ? "Guardando..." : "Guardar"}>
            <span>
              <Button
              onClick={
                handleSaveNewRecord
              }
              disabled={
                saving ||
                calloutPending ||
                failedCalloutField !== null
              }
              aria-label={saving ? "Guardando..." : "Guardar"}
            >
                <SaveOutlinedIcon fontSize="small" />
              </Button>
            </span>
          </Tooltip>

            <Tooltip title="Cancelar">
            <span>
              <Button
              onClick={() => {
                calloutEpochRef.current += 1;
                stateEvaluationRef.current += 1;
                calloutPendingRef.current = false;

                dirtyFieldsRef.current.clear();
                previousCalloutValuesRef.current.clear();
                queuedFieldsRef.current.clear();

                setCalloutPending(false);
                setCalloutError(null);
                setCalloutMessage(null);
                setFailedCalloutField(null);
                setSaveError(null);
                setIsNewRecord(false);
                setIsNavigationDetached(false);
              }}
              disabled={saving}
              aria-label="Cancelar"
            >
                <CloseIcon fontSize="small" />
              </Button>
            </span>
          </Tooltip>
          </ButtonGroup>
        )}


        {/* Acciones de edición */}
        {isEditing && (
          <ButtonGroup
            variant="outlined"
            size="small"
          >
            <Tooltip title={saving ? "Guardando..." : "Guardar"}>
            <span>
              <Button
              onClick={
                handleSaveEditedRecord
              }
              disabled={saving}
              aria-label={saving ? "Guardando..." : "Guardar"}
            >
                <SaveOutlinedIcon fontSize="small" />
              </Button>
            </span>
          </Tooltip>

            <Tooltip title="Cancelar">
            <span>
              <Button
              onClick={
                handleCancelEdit
              }
              disabled={saving}
              aria-label="Cancelar"
            >
                <CloseIcon fontSize="small" />
              </Button>
            </span>
          </Tooltip>
          </ButtonGroup>
        )}


        {/* Ventana */}
        <ButtonGroup
          variant="outlined"
          size="small"
        >
          <Tooltip title="Cerrar">
            <span>
              <Button
            onClick={onCloseWindow}
            disabled={saving}
            aria-label="Cerrar"
          >
                <ExitToAppIcon fontSize="small" />
              </Button>
            </span>
          </Tooltip>
        </ButtonGroup>

      </Box>

      {/* Acciones específicas de la pestaña, siempre en su propia línea */}
        {/* Accesos rápidos a campos Button y acciones del documento */}
        {viewMode === "form" && (documentActionField || activeButtons.length > 0) && (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, alignItems: "center", marginBottom: 2 }}>
            {documentActionField && documentTab && (
              <>
                <ButtonField
                  key={`documento-${documentTab.ad_tab_id}-${documentRecordId ?? "nuevo"}`}
                  compact
                  field={documentActionField}
                  tableName={documentTab.tablename}
                  recordId={documentRecordId}
                  disabled={isNewRecord || isEditing || saving || calloutPending || documentRecordId === undefined}
                  onProcessed={() => void handleQuickActionProcessed()}
                />
              </>
            )}
            {activeButtons
              .filter((field) => field !== ownDocumentAction)
              .map((field) => (
                <ButtonField
                  key={field.ad_field_id}
                  compact
                  field={field}
                  tableName={tab.tablename}
                  recordId={getDocumentRecordId()}
                  disabled={isNewRecord || isEditing || saving || calloutPending}
                  onProcessed={() => setRefreshToken((current) => current + 1)}
                />
              ))}
          </Box>
        )}


      {/* INDICADORES DE ESTADO */}
      {((isNewRecord || isEditing) && calloutPending || searchFilter) && (
        <Box
          sx={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 1,
            marginBottom: 2,
          }}
        >
        {(isNewRecord || isEditing) && (
          <Box
            role={
              calloutPending
                ? "status"
                : undefined
            }
            aria-label={
              calloutPending
                ? "Actualizando campos"
                : undefined
            }
            sx={{
              width: 20,
              height: 20,
              flexShrink: 0,
            }}
          >
            {calloutPending && (
              <CircularProgress
                size={18}
              />
            )}
          </Box>
        )}

        {searchFilter && (
          <Typography variant="body2">
            Búsqueda activa
          </Typography>
        )}
        </Box>
      )}

      {/* MENSAJES CRUD */}
          <Box
            sx={{
              flexShrink: 0,
            }}
          >
            {calloutError && (
              <Alert
                severity="error"
                sx={{ marginBottom: 2 }}
                action={failedCalloutField ? (
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => void commitFieldValue(failedCalloutField)}
                  >
                    Reintentar
                  </Button>
                ) : undefined}
              >
                {calloutError}
              </Alert>
            )}

            {calloutMessage && (
              <Alert severity="info" sx={{ marginBottom: 2 }}>
                {calloutMessage}
              </Alert>
            )}

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


        {/* FICHA / GRILLA / LISTA */}
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
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 1,
              }}
            >
              {formLayout.map((group, groupIndex) => (
                <Box
                  key={`${group.name ?? "default"}-${groupIndex}`}
                >
                  {group.name && (
                    <Typography
                      variant="subtitle2"
                      sx={{
                        marginTop: groupIndex === 0 ? 0.5 : 2,
                        marginBottom: 1,
                        paddingBottom: 0.5,
                        borderBottom: 1,
                        borderColor: "divider",
                        fontWeight: 600,
                      }}
                    >
                      {group.name}
                    </Typography>
                  )}

                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 0.5,
                    }}
                  >
                    {group.rows.map((row, rowIndex) => (
                      <Box
                        key={rowIndex}
                        sx={{
                          display: "grid",
                          gridTemplateColumns: {
                            xs: "1fr",
                            md:
                              row.fields.length === 2
                                ? "repeat(2, minmax(0, 1fr))"
                                : "1fr",
                          },
                          columnGap: 2,
                          alignItems: "start",
                        }}
                      >
                        {row.fields.map((field) => (
                          <Box
                            key={field.ad_field_id}
                            sx={{
                              minWidth: 0,
                              "& > .MuiFormControl-root": {
                                marginTop: 1,
                                marginBottom: 0.5,
                              },
                            }}
                          >
                            {renderField(field)}
                          </Box>
                        ))}
                      </Box>
                    ))}
                  </Box>
                </Box>
              ))}
            </Box>
          ) : viewMode === "grid" ? (
            <RecordGrid
              tab={tab}
              filter={buildRecordFilter()}
              parentValues={buildParentValues()}
              currentRecordPage={page}
              onSelectRecord={handleGridSelectRecord}
            />
          ) : (
            <RecordList
              tab={tab}
              filter={buildRecordFilter()}
              parentValues={buildParentValues()}
              refreshToken={refreshToken}
              state={listViewState}
              onStateChange={setListViewState}
              onSelectRecord={handleGridSelectRecord}
              canEdit={canWrite("PUT") && !saving}
              canDelete={canWrite("DELETE") && !saving}
              onEditRecord={handleListEditRecord}
              onDeleteRecord={handleListDeleteRecord}
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

