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

import {
  CalloutValidationError,
  createRecord,
  deleteRecord,
  evaluateRecordState,
  executeTabFieldCallout,
  getRecord,
  getNewRecordState,
  getRecordByKey,
  updateRecord,
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
  parentRecord,
  windowIsSOTrx,
  initialPage,
  onPageChange,
  onRecordChange,
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
    IsSOTrx: windowIsSOTrx ? "Y" : "N",
    ...buildParentValues(),
    ...buildRecordStateValues(record),
  };
}, [windowIsSOTrx, record, parentRecord, parentTab, tab.fields]);


  async function reevaluateRecordState(
    currentRecord: Record<string, unknown>,
    changedColumn?: string
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

            inserting:
              isNewRecord,
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


  function handleGridSelectRecord(
    selectedRecord: Record<string, unknown>,
    recordPage: number
  ) {
    selectRecord(
      selectedRecord,
      recordPage
    );

    setViewMode("form");
  }


    function handleListEditRecord(
    selectedRecord: Record<string, unknown>,
    recordPage: number
  ) {
    selectRecord(
      selectedRecord,
      recordPage
    );

    setOriginalRecord({
      ...selectedRecord,
    });

    setSaveError(null);
    setSaveMessage(null);

    setViewMode("form");
    setIsEditing(true);
  }

  

  async function handleListDeleteRecord(
    selectedRecord: Record<string, unknown>
  ) {
    if (!tab.data_endpoint) {
      return;
    }

    if (
      !tab.pk_columns ||
      tab.pk_columns.length === 0
    ) {
      setSaveError(
        "No fue posible determinar la clave primaria del registro"
      );
      return;
    }

    const recordKeyValues:
      Array<string | number> = [];

    for (const columnName of tab.pk_columns) {
      const value =
        selectedRecord[
          columnName.toLowerCase()
        ];

      if (
        typeof value !== "string" &&
        typeof value !== "number"
      ) {
        setSaveError(
          "No fue posible determinar la clave primaria del registro"
        );
        return;
      }

      recordKeyValues.push(value);
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
      calloutEpochRef.current += 1;
      dirtyFieldsRef.current.clear();
      previousCalloutValuesRef.current.clear();
      queuedFieldsRef.current.clear();
      recordRef.current = newRecord;
      setCalloutError(null);
      setCalloutMessage(null);
      setFailedCalloutField(null);
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
    if (calloutPendingRef.current || failedCalloutField) {
      return;
    }

    const createEndpoint = tab.create_endpoint ?? tab.data_endpoint;

    if (!createEndpoint) {
      setSaveError(
        "La pestaña no posee un endpoint REST configurado para creación"
      );
      return;
    }

    const missingFields =
      validateCreateRecord(
        tab,
        record,
        fieldStates
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
          createEndpoint,
          payload
        );

      /*
      * El nuevo registro queda al final de la navegación.
      *
      * totalCount todavía contiene la cantidad anterior
      * al alta, por lo que la nueva posición es + 1.
      */
      const newPage =
        totalCount + 1;

      setSaveMessage(
        createdId
          ? `Registro creado correctamente. ID: ${createdId}`
          : "Registro creado correctamente."
      );

      /*
      * Primero posicionamos la navegación sobre
      * el registro recién creado.
      */
      setPage(newPage);

      onPageChange(
        tab.ad_tab_id,
        newPage
      );

      /*
      * Al salir del modo alta se vuelve a ejecutar
      * el efecto de carga. Como page ahora apunta
      * al nuevo registro, se recuperará desde REST.
      */
      setIsNewRecord(false);
      calloutEpochRef.current += 1;
      stateEvaluationRef.current += 1;

    } catch (error) {
      console.error(
        `Error creando registro en ${createEndpoint}`,
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
        record,
        fieldStates
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

          width: "100%",
          maxWidth: "100%",

          overflowX: "auto",
          overflowY: "hidden",

          paddingBottom: 0.5,

          WebkitOverflowScrolling:
            "touch",
        }}
      >
        <ButtonGroup
          variant="outlined"
          size="small"
          sx={{
            width: "max-content",
            flexWrap: "nowrap",

            "& .MuiButton-root": {
              whiteSpace: "nowrap",
            },
          }}
        >

              <Button
                onClick={() => setPage(1)}
                disabled={
                  viewMode !== "form" ||
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
                  viewMode !== "form" ||
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
                  viewMode !== "form" ||
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
                  viewMode !== "form" ||
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
                  viewMode !== "form" ||
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
                  viewMode !== "form" ||
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
                  viewMode !== "form" ||
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
                  setUseSameLineLayout(
                    (current) => !current
                  )
                }
                disabled={
                  viewMode !== "form" ||
                  saving
                }
              >
                {useSameLineLayout
                  ? "Una columna"
                  : "Dos columnas"}
              </Button>


              <Button
                onClick={() =>
                  setViewMode("form")
                }
                disabled={
                  isNewRecord ||
                  isEditing ||
                  saving ||
                  viewMode === "form"
                }
              >
                Ficha
              </Button>

              <Button
                onClick={() =>
                  setViewMode("grid")
                }
                disabled={
                  isNewRecord ||
                  isEditing ||
                  saving ||
                  viewMode === "grid"
                }
              >
                Grilla
              </Button>

              <Button
                onClick={() =>
                  setViewMode("list")
                }
                disabled={
                  isNewRecord ||
                  isEditing ||
                  saving ||
                  viewMode === "list"
                }
              >
                Lista
              </Button>

              {isNewRecord && (
                <>
                  <Button
                    onClick={
                      handleSaveNewRecord
                    }
                    disabled={saving || calloutPending || failedCalloutField !== null}
                  >
                    {saving
                      ? "Guardando..."
                      : "Guardar"}
                  </Button>

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
                : viewMode === "list"
                ? `Lista — ${totalCount} registros`
                : isNewRecord
                ? "Nuevo registro"
                : isEditing
                ? `Editando registro ${page} de ${totalCount}`
                : totalCount > 0
                ? `Registro ${page} de ${totalCount}`
                : "Sin registros"}
            </Typography>

            {(isNewRecord || isEditing) && (
              <Box
                role={calloutPending ? "status" : undefined}
                aria-label={calloutPending ? "Actualizando campos" : undefined}
                sx={{ width: 20, height: 20, flexShrink: 0 }}
              >
                {calloutPending && <CircularProgress size={18} />}
              </Box>
            )}


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
              currentRecordPage={page}
              onSelectRecord={handleGridSelectRecord}
            />
          ) : (
            <RecordList
              tab={tab}
              filter={buildRecordFilter()}
              state={listViewState}
              onStateChange={setListViewState}
              onSelectRecord={handleGridSelectRecord}
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
