export interface DynamicFieldReferenceValue {
  value: string;
  name: string;
}


export interface DynamicFieldReference {
  type: string;
  button_type?: string;
  process_id?: number;
  values?: DynamicFieldReferenceValue[];
  endpoint?: string;
}


/**
 * Metadata común necesaria para representar y normalizar
 * un campo dinámico, independientemente de si proviene
 * de AD_Field/AD_Column o de un parámetro de proceso.
 */
export interface DynamicField {
  name: string;
  description?: string;

  columnname: string;

  ad_reference_id: number;
  ad_reference_value_id?: number;

  ismandatory: boolean;
  isreadonly: boolean;
  issameline: boolean;

  has_callout?: boolean;
  defaultvalue?: unknown;

  reference?: DynamicFieldReference;
}
