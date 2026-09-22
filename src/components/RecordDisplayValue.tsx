import { useEffect, useState } from "react";

import { getLookupValues } from "../api/libertyaApi";

import type { WindowSchemaField } from "../types/metadata";


/*
 * Cache global para valores referenciados.
 *
 * La clave combina endpoint + valor.
 *
 * Ejemplo:
 *
 * /v1.0/columns/123/lookup|1010053
 *      ->
 * Organización Central
 */
const referenceValueCache = new Map<string, string>();


/*
 * También cacheamos requests en curso.
 *
 * Esto evita que múltiples campos con el mismo ID lancen
 * simultáneamente múltiples requests antes de que el primero
 * alcance a completar el cache.
 */
const pendingReferenceRequests =
  new Map<string, Promise<string>>();


interface ReferencedValueProps {
  field: WindowSchemaField;
  value: string;
}


function ReferencedValue({
  field,
  value,
}: ReferencedValueProps) {

  const endpoint = field.reference?.endpoint;
  const cacheKey =
    endpoint ? `${endpoint}|${value}` : "";

  const [displayValue, setDisplayValue] =
    useState(
      cacheKey &&
      referenceValueCache.has(cacheKey)
        ? referenceValueCache.get(cacheKey)!
        : value
    );


  useEffect(() => {
    if (!endpoint || value === "") {
      setDisplayValue(value);
      return;
    }

    const key = `${endpoint}|${value}`;
    const cachedValue =
      referenceValueCache.get(key);

    if (cachedValue !== undefined) {
      setDisplayValue(cachedValue);
      return;
    }

    let cancelled = false;

    let request =
      pendingReferenceRequests.get(key);

    if (!request) {
      request = getLookupValues(
        endpoint,
        1,
        1,
        undefined,
        value
      )
        .then((values) => {
          const resolvedValue =
            values.length > 0
              ? values[0].name
              : value;

          referenceValueCache.set(
            key,
            resolvedValue
          );

          return resolvedValue;
        })
        .catch((error) => {
          console.error(
            `Error resolviendo valor ${value} para ${field.columnname}`,
            error
          );

          /*
           * Si no podemos resolverlo,
           * mantenemos el ID.
           */
          referenceValueCache.set(
            key,
            value
          );

          return value;
        })
        .finally(() => {
          pendingReferenceRequests.delete(key);
        });

      pendingReferenceRequests.set(
        key,
        request
      );
    }

    request.then((resolvedValue) => {
      if (!cancelled)
        setDisplayValue(resolvedValue);
    });

    return () => {
      cancelled = true;
    };
  }, [
    endpoint,
    value,
    field.columnname,
  ]);


  return <>{displayValue}</>;
}


interface Props {
  record: Record<string, unknown>;
  field: WindowSchemaField;
}


/**
 * Representa el valor de un campo de un registro utilizando
 * la metadata de la ventana.
 *
 * Centraliza la representación utilizada por las distintas
 * vistas de registros (grilla, lista, etc.).
 */
export default function RecordDisplayValue({
  record,
  field,
}: Props) {

  const rawValue =
    record[field.columnname.toLowerCase()];

  if (
    rawValue === undefined ||
    rawValue === null
  ) {
    return null;
  }

  const value = String(rawValue);
  const type = field.reference?.type;


  if (type === "boolean") {
    if (
      value === "Y" ||
      value === "true"
    ) {
      return <>Sí</>;
    }

    if (
      value === "N" ||
      value === "false"
    ) {
      return <>No</>;
    }

    return <>{value}</>;
  }


  if (type === "list") {
    const option =
      field.reference?.values?.find(
        (item) =>
          item.value === value
      );

    return <>{option?.name ?? value}</>;
  }


  if (
    type === "lookup" ||
    type === "search"
  ) {
    return (
      <ReferencedValue
        field={field}
        value={value}
      />
    );
  }


  return <>{value}</>;
}