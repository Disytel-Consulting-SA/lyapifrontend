import { useEffect, useMemo, useState } from "react";

import {
  Alert,
  Box,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
} from "@mui/material";

import {
  getLookupValues,
  searchRecords,
} from "../api/libertyaApi";

import type {
  WindowSchemaField,
  WindowSchemaTab,
} from "../types/metadata";


interface Props {
  tab: WindowSchemaTab;
  filter?: string;
  currentRecordPage: number;

  onSelectRecord: (
    record: Record<string, unknown>,
    recordPage: number
  ) => void;
}


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
 * Esto evita que 20 celdas con el mismo ID lancen
 * simultáneamente 20 requests antes de que el primero
 * alcance a completar el cache.
 */
const pendingReferenceRequests = new Map<string, Promise<string>>();


interface GridReferenceValueProps {
  field: WindowSchemaField;
  value: string;
}


function GridReferenceValue({
  field,
  value,
}: GridReferenceValueProps) {

  const endpoint = field.reference?.endpoint;
  const cacheKey = endpoint ? `${endpoint}|${value}` : "";

  const [displayValue, setDisplayValue] = useState(
    cacheKey && referenceValueCache.has(cacheKey)
      ? referenceValueCache.get(cacheKey)!
      : value
  );


  useEffect(() => {
    if (!endpoint || value === "") {
      setDisplayValue(value);
      return;
    }

    const key = `${endpoint}|${value}`;
    const cachedValue = referenceValueCache.get(key);

    if (cachedValue !== undefined) {
      setDisplayValue(cachedValue);
      return;
    }

    let cancelled = false;

    let request = pendingReferenceRequests.get(key);

    if (!request) {
      request = getLookupValues(endpoint, 1, 1, undefined, value)
        .then((values) => {
          const resolvedValue = values.length > 0
            ? values[0].name
            : value;

          referenceValueCache.set(key, resolvedValue);

          return resolvedValue;
        })
        .catch((error) => {
          console.error(
            `Error resolviendo valor ${value} para ${field.columnname}`,
            error
          );

          /*
           * Si no podemos resolverlo, mantenemos el ID.
           */
          referenceValueCache.set(key, value);

          return value;
        })
        .finally(() => {
          pendingReferenceRequests.delete(key);
        });

      pendingReferenceRequests.set(key, request);
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


export default function RecordGrid({
  tab,
  filter,
  currentRecordPage,
  onSelectRecord,
}: Props) {

  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const [gridPage, setGridPage] = useState(
    Math.floor(Math.max(currentRecordPage - 1, 0) / 25)
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const gridFields = useMemo(() => {
    return tab.fields
      .filter((field) => field.isdisplayed && field.isdisplayedingrid)
      .sort((a, b) => a.seqno - b.seqno);
  }, [tab.fields]);


  useEffect(() => {
    setGridPage(
      Math.floor(Math.max(currentRecordPage - 1, 0) / rowsPerPage)
    );
  }, [tab.ad_tab_id]);


  useEffect(() => {
    if (!tab.data_endpoint) {
      setRecords([]);
      setTotalCount(0);
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError(null);

    searchRecords(
      tab.data_endpoint,
      filter ?? "",
      rowsPerPage,
      gridPage + 1
    )
      .then((result) => {
        if (cancelled)
          return;

        setRecords(result.records);
        setTotalCount(result.totalCount);
      })
      .catch((err) => {
        console.error(
          `Error recuperando grilla para AD_Tab_ID=${tab.ad_tab_id}`,
          err
        );

        if (!cancelled) {
          setRecords([]);
          setTotalCount(0);
          setError("No fue posible recuperar los registros.");
        }
      })
      .finally(() => {
        if (!cancelled)
          setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    tab.ad_tab_id,
    tab.data_endpoint,
    filter,
    gridPage,
    rowsPerPage,
  ]);


  function getRawValue(
    record: Record<string, unknown>,
    field: WindowSchemaField
  ): unknown {
    return record[field.columnname.toLowerCase()];
  }


  function renderValue(
    record: Record<string, unknown>,
    field: WindowSchemaField
  ) {

    const rawValue = getRawValue(record, field);

    if (rawValue === undefined || rawValue === null)
      return "";

    const value = String(rawValue);
    const type = field.reference?.type;


    if (type === "boolean") {
      if (value === "Y" || value === "true")
        return "Sí";

      if (value === "N" || value === "false")
        return "No";

      return value;
    }


    if (type === "list") {
      const option = field.reference?.values?.find(
        (item) => item.value === value
      );

      return option?.name ?? value;
    }


    if (
      type === "lookup" ||
      type === "search"
    ) {
      return (
        <GridReferenceValue
          field={field}
          value={value}
        />
      );
    }


    return value;
  }


  function handleSelectRecord(
    record: Record<string, unknown>,
    rowIndex: number
  ) {
    const recordPage = gridPage * rowsPerPage + rowIndex + 1;

    onSelectRecord(record, recordPage);
  }


  function handleChangePage(
    _event: unknown,
    newPage: number
  ) {
    setGridPage(newPage);
  }


  function handleChangeRowsPerPage(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    setRowsPerPage(parseInt(event.target.value, 10));
    setGridPage(0);
  }


  if (!tab.data_endpoint) {
    return (
      <Alert severity="warning">
        La pestaña no posee un endpoint REST configurado.
      </Alert>
    );
  }


  if (gridFields.length === 0) {
    return (
      <Alert severity="info">
        La pestaña no posee campos configurados para mostrarse en grilla.
      </Alert>
    );
  }


  return (
    <Paper
      variant="outlined"
      sx={{
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {error && (
        <Alert severity="error">
          {error}
        </Alert>
      )}

      <TableContainer
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
        }}
      >
        <Table
          size="small"
          stickyHeader
          sx={{
            minWidth: "max-content",
          }}
        >
          <TableHead>
            <TableRow>
              {gridFields.map((field) => (
                <TableCell
                  key={field.ad_field_id}
                  sx={{
                    whiteSpace: "nowrap",
                    fontWeight: 600,
                  }}
                >
                  {field.name}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {loading && (
              <TableRow>
                <TableCell
                  colSpan={gridFields.length}
                  align="center"
                  sx={{ py: 4 }}
                >
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            )}

            {!loading && records.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={gridFields.length}
                  align="center"
                  sx={{ py: 4 }}
                >
                  No existen registros.
                </TableCell>
              </TableRow>
            )}

            {!loading && records.map((record, rowIndex) => (
              <TableRow
                key={rowIndex}
                hover
                onClick={() => handleSelectRecord(record, rowIndex)}
                sx={{ cursor: "pointer" }}
              >
                {gridFields.map((field) => (
                  <TableCell
                    key={field.ad_field_id}
                    sx={{
                      whiteSpace: "nowrap",
                    }}
                  >
                    {renderValue(record, field)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box
        sx={{
          flexShrink: 0,
          borderTop: 1,
          borderColor: "divider",
        }}
      >
        <TablePagination
          component="div"
          count={totalCount}
          page={gridPage}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[10, 25, 50]}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="Filas por página:"
          labelDisplayedRows={({ from, to, count }) =>
            `${from}-${to} de ${count}`
          }
        />
      </Box>
    </Paper>
  );
}