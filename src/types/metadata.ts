import type { DynamicField, DynamicFieldReference, DynamicFieldReferenceValue } from "./dynamicField";

export type { DynamicField, DynamicFieldReference, DynamicFieldReferenceValue } from "./dynamicField";

export interface MenuOption {
  ad_menu_id: number;
  name: string;
  type: "window" | "process";
  target_id: number;
}

export interface WindowOption {
  ad_window_id: number;
  name: string;
}


/**
 * Definición completa de una ventana recuperada mediante:
 *
 * GET /v1.0/windows/{id}/schema
 */
export interface WindowSchema {
  ad_window_id: number;
  name: string;
  description?: string;
  issotrx: boolean;

  tabs: WindowSchemaTab[];
}


/**
 * Pestaña incluida en el esquema de una ventana.
 */
export interface WindowSchemaTab {
  ad_tab_id: number;

  name: string;
  description?: string;

  seqno?: number | null;
  tablevel: number;
  isinsertrecord: boolean;

  ad_table_id: number;
  tablename: string;
  data_endpoint?: string;
  // Endpoint alternativo para la creación de un nuevo registro. Si no esta definido, se utiliza el mismo endpoint de data_endpoint.
  create_endpoint?: string;
  pk_columns?: string[];

  /**
   * Pestaña padre estructural.
   *
   * Para una pestaña de nivel N, corresponde a la primera
   * pestaña anterior cuyo TabLevel sea N - 1.
   */
  parent_ad_tab_id?: number;

  /**
   * Columna utilizada para vincular los registros
   * master/detail con la pestaña padre.
   */
  link_columnname?: string;

  /**
   * Restricciones propias de AD_Tab.
   */
  whereclause?: string;
  orderbyclause?: string;

  isreadonly?: boolean;

  fields: WindowSchemaField[];
}


/**
 * Metadata necesaria para dibujar un campo.
 *
 * Combina información proveniente de AD_Field y AD_Column.
 */
export interface WindowSchemaField extends DynamicField {
  ad_field_id: number;

  seqno: number;
  isdisplayed: boolean;
  isdisplayedingrid: boolean;
  fieldgroup?: string;

  ad_column_id: number;
  isencrypted: boolean;
  iskey: boolean;
  isparent: boolean;
  isselectioncolumn: boolean;
}


export type WindowSchemaReferenceValue = DynamicFieldReferenceValue;

export type WindowSchemaReference = DynamicFieldReference;
