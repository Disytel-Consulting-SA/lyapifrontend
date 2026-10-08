import type {
  WindowSchemaField,
  WindowSchemaTab,
} from "../types/metadata";
import type { WindowRecordFieldState } from "../api/libertyaApi";
import { normalizeDynamicFieldValue } from "./dynamicFieldValue";


/*
 * Valores que no deben provenir del formulario
 * al crear un registro.
 *
 * El backend los completa desde el contexto/JWT.
 */
const SERVER_MANAGED_COLUMNS =
  new Set([
    "ad_client_id",
    "created",
    "createdby",
    "updated",
    "updatedby",
  ]);


function isEmptyValue(
  value: unknown
): boolean {

  if (
    value === null ||
    value === undefined
  ) {
    return true;
  }


  if (
    typeof value === "string" &&
    value.trim() === ""
  ) {
    return true;
  }


  return false;
}


/**
 * Construye el payload destinado al POST.
 *
 * Sólo se consideran columnas pertenecientes
 * al schema de la pestaña.
 */
export function buildCreatePayload(
  tab: WindowSchemaTab,
  record: Record<string, unknown>
): Record<string, unknown> {

  const payload:
    Record<string, unknown> = {};


  tab.fields.forEach((field) => {

    const columnName =
      field.columnname.toLowerCase();


    /*
     * La PK de un registro nuevo será
     * generada por Libertya.
     */
    if (field.iskey) {
      return;
    }


    /*
     * Contexto y auditoría son responsabilidad
     * del backend.
     */
    if (
      SERVER_MANAGED_COLUMNS.has(
        columnName
      )
    ) {
      return;
    }


    /*
     * Los botones no representan un valor
     * editable para la inserción.
     */
    if (
      field.reference?.type === "button"
    ) {
      return;
    }


    const value =
      record[columnName];


    /*
     * No enviar propiedades sin valor.
     *
     * Esto permite que Libertya aplique su
     * propia lógica cuando corresponda.
     */
    if (isEmptyValue(value)) {
      return;
    }


    payload[columnName] =
      normalizeDynamicFieldValue(
        field,
        value
      );

  });


  return payload;
}


/**
 * Valida los obligatorios que el usuario
 * puede completar visualmente.
 *
 * Campos ocultos o readonly pueden depender
 * de contexto/defaults/backend y no deben
 * bloquear el formulario.
 */
export function validateCreateRecord(
  tab: WindowSchemaTab,
  record: Record<string, unknown>,
  fieldStates: WindowRecordFieldState[]
): WindowSchemaField[] {

  return tab.fields.filter(
    (field) => {

      if (!field.ismandatory) {
        return false;
      }

      const state = fieldStates.find(
        (candidate) => candidate.ad_field_id === field.ad_field_id
      );

      if (!state || !state.displayed || state.readonly || field.isencrypted === true) {
        return false;
      }


      if (
        field.isdisplayed === false
      ) {
        return false;
      }


      if (
        tab.isreadonly === true ||
        field.isreadonly === true
      ) {
        return false;
      }


      const value =
        record[
          field.columnname.toLowerCase()
        ];


      return isEmptyValue(
        value
      );
    }
  );
}

/**
 * Construye el payload destinado al PUT.
 *
 * A diferencia del POST, un campo vacío debe poder
 * representar la intención explícita de limpiar su valor.
 */
export function buildUpdatePayload(
  tab: WindowSchemaTab,
  record: Record<string, unknown>,
  originalRecord: Record<string, unknown>
): Record<string, unknown> {

  const payload: Record<string, unknown> = {};
  const pkColumns = new Set(
    (tab.pk_columns ?? []).map((columnName) => columnName.toLowerCase())
  );

  tab.fields.forEach((field) => {
    const columnName = field.columnname.toLowerCase();

    if (field.iskey || pkColumns.has(columnName))
      return;

    if (SERVER_MANAGED_COLUMNS.has(columnName))
      return;

    if (field.reference?.type === "button")
      return;

    if (tab.isreadonly === true || field.isreadonly === true)
      return;

    const value = record[columnName];
    const originalValue = originalRecord[columnName];

    /*
     * No enviar campos que no cambiaron.
     */
    if (value === originalValue)
      return;

    /*
     * Si antes había un valor y ahora quedó vacío,
     * indicamos explícitamente al backend que debe
     * persistir NULL.
     */
    if (isEmptyValue(value)) {
      if (!isEmptyValue(originalValue))
        payload[columnName] = "[NULL]";

      return;
    }

    payload[columnName] = normalizeDynamicFieldValue(field, value);
  });

  return payload;
}


/**
 * Valida los campos obligatorios durante la edición.
 */
export function validateUpdateRecord(
  tab: WindowSchemaTab,
  record: Record<string, unknown>,
  fieldStates: WindowRecordFieldState[]
): WindowSchemaField[] {

  return tab.fields.filter((field) => {
    if (!field.ismandatory)
      return false;

    const state = fieldStates.find(
      (candidate) => candidate.ad_field_id === field.ad_field_id
    );

    if (field.isencrypted === true || state?.displayed === false || state?.readonly === true)
      return false;

    if (field.isdisplayed === false)
      return false;

    if (tab.isreadonly === true || field.isreadonly === true)
      return false;

    const value = record[field.columnname.toLowerCase()];

    return isEmptyValue(value);
  });
}
