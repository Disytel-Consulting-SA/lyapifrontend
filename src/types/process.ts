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

export interface ProcessExecuteRequest {
  table?: string;
  record_id?: number;
  values?: Record<string, string>;
  values_to?: Record<string, string>;
}

export interface ProcessExecuteResponse {
  process_instance_id: number;
  success: boolean;
  summary?: string | null;
}
