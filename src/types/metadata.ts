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

  tabs: WindowSchemaTab[];
}


/**
 * Pestaña incluida en el esquema de una ventana.
 */
export interface WindowSchemaTab {
  ad_tab_id: number;

  name: string;
  description?: string;

  seqno: number;
  tablevel: number;

  ad_table_id: number;
  tablename: string;
  data_endpoint?: string;

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
export interface WindowSchemaField {
  ad_field_id: number;

  name: string;
  description?: string;

  seqno: number;
  isdisplayed: boolean;
  isreadonly: boolean;

  ad_column_id: number;
  columnname: string;

  ad_reference_id: number;
  ad_reference_value_id: number;

  ismandatory: boolean;
  iskey: boolean;
  isparent: boolean;

  /**
   * Valor inicial efectivo para la creación de
   * un nuevo registro.
   *
   * Si la propiedad no está presente, el field
   * no posee un default aplicable.
   */
  defaultvalue?: string;

  reference?: WindowSchemaReference;
}


export interface WindowSchemaReferenceValue {
  value: string;
  name: string;
}


export interface WindowSchemaReference {
  type: string;
  values?: WindowSchemaReferenceValue[];
  endpoint?: string;
}