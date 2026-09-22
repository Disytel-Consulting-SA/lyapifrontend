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
  searchRecords,
} from "../api/libertyaApi";

import type {
  WindowSchemaTab,
} from "../types/metadata";

import RecordDisplayValue from "./RecordDisplayValue";


interface Props {
  tab: WindowSchemaTab;
  filter?: string;
  currentRecordPage: number;

  onSelectRecord: (
    record: Record<string, unknown>,
    recordPage: number
  ) => void;
}


export default function RecordGrid({
  tab,
  filter,
  currentRecordPage,
  onSelectRecord,
}: Props) {

  const [records, setRecords] =
    useState<Record<string, unknown>[]>([]);

  const [totalCount, setTotalCount] =
    useState(0);

  const [rowsPerPage, setRowsPerPage] =
    useState(25);

  const [gridPage, setGridPage] =
    useState(
      Math.floor(
        Math.max(currentRecordPage - 1, 0) / 25
      )
    );

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);


  /*
   * Campos configurados para mostrarse
   * en la grilla.
   */
  const gridFields = useMemo(() => {
    return tab.fields
      .filter(
        (field) =>
          !field.isencrypted &&
          field.isdisplayed &&
          field.isdisplayedingrid
      )
      .sort(
        (a, b) =>
          a.seqno - b.seqno
      );
  }, [tab.fields]);


  /*
   * Al cambiar de pestaña, recuperar la página
   * correspondiente al registro actualmente
   * seleccionado.
   */
  useEffect(() => {
    setGridPage(
      Math.floor(
        Math.max(
          currentRecordPage - 1,
          0
        ) / rowsPerPage
      )
    );
  }, [tab.ad_tab_id]);


  /*
   * Recuperar los registros correspondientes
   * a la página actual.
   */
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

        setRecords(
          result.records
        );

        setTotalCount(
          result.totalCount
        );
      })
      .catch((err) => {
        console.error(
          `Error recuperando grilla para AD_Tab_ID=${tab.ad_tab_id}`,
          err
        );

        if (!cancelled) {
          setRecords([]);
          setTotalCount(0);

          setError(
            "No fue posible recuperar los registros."
          );
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


  /*
   * Seleccionar un registro de la grilla.
   *
   * recordPage representa la posición absoluta
   * del registro dentro del conjunto completo.
   */
  function handleSelectRecord(
    record: Record<string, unknown>,
    rowIndex: number
  ) {

    const recordPage =
      gridPage * rowsPerPage +
      rowIndex +
      1;

    onSelectRecord(
      record,
      recordPage
    );
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

    setRowsPerPage(
      parseInt(
        event.target.value,
        10
      )
    );

    setGridPage(0);
  }


  /*
   * La pestaña necesita un endpoint de datos
   * para poder mostrar una grilla.
   */
  if (!tab.data_endpoint) {
    return (
      <Alert severity="warning">
        La pestaña no posee un endpoint REST configurado.
      </Alert>
    );
  }


  /*
   * No existen campos configurados para
   * mostrarse en grilla.
   */
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

              {gridFields.map(
                (field) => (
                  <TableCell
                    key={
                      field.ad_field_id
                    }
                    sx={{
                      whiteSpace:
                        "nowrap",

                      fontWeight:
                        600,
                    }}
                  >
                    {field.name}
                  </TableCell>
                )
              )}

            </TableRow>
          </TableHead>


          <TableBody>

            {loading && (
              <TableRow>
                <TableCell
                  colSpan={
                    gridFields.length
                  }
                  align="center"
                  sx={{
                    py: 4,
                  }}
                >
                  <CircularProgress
                    size={28}
                  />
                </TableCell>
              </TableRow>
            )}


            {!loading &&
              records.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={
                      gridFields.length
                    }
                    align="center"
                    sx={{
                      py: 4,
                    }}
                  >
                    No existen registros.
                  </TableCell>
                </TableRow>
              )}


            {!loading &&
              records.map(
                (
                  record,
                  rowIndex
                ) => (

                  <TableRow
                    key={rowIndex}
                    hover

                    onClick={() =>
                      handleSelectRecord(
                        record,
                        rowIndex
                      )
                    }

                    sx={{
                      cursor:
                        "pointer",
                    }}
                  >

                    {gridFields.map(
                      (field) => (
                        <TableCell
                          key={
                            field.ad_field_id
                          }
                          sx={{
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          <RecordDisplayValue
                            record={
                              record
                            }
                            field={
                              field
                            }
                          />
                        </TableCell>
                      )
                    )}

                  </TableRow>
                )
              )}

          </TableBody>

        </Table>

      </TableContainer>


      <Box
        sx={{
          flexShrink: 0,

          borderTop: 1,
          borderColor:
            "divider",
        }}
      >

        <TablePagination
          component="div"

          count={
            totalCount
          }

          page={
            gridPage
          }

          rowsPerPage={
            rowsPerPage
          }

          rowsPerPageOptions={[
            10,
            25,
            50,
          ]}

          onPageChange={
            handleChangePage
          }

          onRowsPerPageChange={
            handleChangeRowsPerPage
          }

          labelRowsPerPage={
            "Filas por página:"
          }

          labelDisplayedRows={({
            from,
            to,
            count,
          }) =>
            `${from}-${to} de ${count}`
          }
        />

      </Box>

    </Paper>
  );
}