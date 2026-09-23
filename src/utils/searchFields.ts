import type {
  WindowSchemaField,
} from "../types/metadata";


const STANDARD_SEARCH_COLUMNS = new Set([
  "Value",
  "Name",
  "DocumentNo",
  "Description",
]);


/**
 * Devuelve los campos que Libertya considera
 * apropiados como criterios de búsqueda.
 *
 * Incluye:
 * - IsSelectionColumn = Y
 * - Value
 * - Name
 * - DocumentNo
 * - Description
 *
 * Las columnas PK quedan excluidas.
 */
export function getSearchFields(
  fields: WindowSchemaField[]
): WindowSchemaField[] {
  return fields.filter(
    (field) =>
      !field.iskey &&
      (
        field.isselectioncolumn ||
        STANDARD_SEARCH_COLUMNS.has(
          field.columnname
        )
      )
  );
}