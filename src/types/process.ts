import type { DynamicField } from "./dynamicField";

export interface ProcessSchemaParameter extends DynamicField {
  process_para_id: number;
  seqno?: number | null;
  isrange: boolean;
  calloutalsoonload?: boolean;
  fieldlength?: number;
  vformat?: string;
  valuemin?: string;
  valuemax?: string;
}

export interface ProcessSchema {
  process_id: number;
  name: string;
  description?: string;
  help?: string;
  parameters: ProcessSchemaParameter[];
}

export interface ProcessParameterState {
  process_para_id: number;
  columnname: string;
  displayed: boolean;
  readonly: boolean;
}

export interface ProcessState {
  values: Record<string, string>;
  parameters: ProcessParameterState[];
}

export interface ProcessStateRequest {
  table?: string;
  record_id?: number;
  values?: Record<string, string>;
  changed_parameters?: string[];
}
