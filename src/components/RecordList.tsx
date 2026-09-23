import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  ChangeEvent,
  MouseEvent,
} from "react";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TablePagination,
  TextField,
  Typography,
} from "@mui/material";

import {
  searchRecords,
} from "../api/libertyaApi";

import type {
  WindowSchemaTab,
} from "../types/metadata";

import RecordDisplayValue from "./RecordDisplayValue";
import LookupFilter from "./LookupFilter";

import {
  getSearchFields,
} from "../utils/searchFields";


export interface ListViewState {
  searchText: string;
  listFilterValues: Record<string, string>;
  lookupFilterValues: Record<string, string>;
  page: number;
  rowsPerPage: number;
  orderBy?: string;
  orderDirection?: "ASC" | "DESC";
}


interface Props {
  tab: WindowSchemaTab;
  filter?: string;
  refreshToken: number;

  state: ListViewState;

  onStateChange: (
    state: ListViewState
  ) => void;

  onSelectRecord: (
    record: Record<string, unknown>,
    recordPage: number
  ) => void;

  onEditRecord: (
    record: Record<string, unknown>,
    recordPage: number
  ) => void;

  onDeleteRecord: (
    record: Record<string, unknown>
  ) => Promise<void>;
}


const TEXT_REFERENCE_IDS = new Set([
  10, // String
  14, // Text
  34, // Memo
]);


function escapeFilterValue(
  value: string
) {
  return value.replace(/'/g, "''");
}


export default function RecordList({
  tab,
  filter,
  refreshToken,
  state,
  onStateChange,
  onSelectRecord,
  onEditRecord,
  onDeleteRecord,
}: Props) {

  /*
   * Campos base del modo Lista.
   *
   * Se utiliza la misma semántica que
   * la búsqueda tradicional:
   *
   * - Value
   * - Name
   * - DocumentNo
   * - Description
   * - IsSelectionColumn = Y
   */
  const listFields = useMemo(() => {
    return getSearchFields(tab.fields)
      .filter(
        (field) =>
          !field.isencrypted
      )
      .sort(
        (a, b) =>
          a.seqno - b.seqno
      );
  }, [tab.fields]);


  const searchFields = useMemo(() => {
    return getSearchFields(tab.fields)
      .filter(
        (field) =>
          !field.isencrypted
      )
      .sort(
        (a, b) =>
          a.seqno - b.seqno
      );
  }, [tab.fields]);


  /*
   * Campos textuales que participan
   * del multibuscador.
   */
  const textSearchFields = useMemo(() => {
    return searchFields.filter(
      (field) =>
        TEXT_REFERENCE_IDS.has(
          field.ad_reference_id
        )
    );
  }, [searchFields]);


  /*
   * Campos de tipo List:
   * se muestran como Select.
   */
  const listFilterFields = useMemo(() => {
    return searchFields.filter(
      (field) =>
        field.reference?.type === "list" &&
        field.reference.values &&
        field.reference.values.length > 0
    );
  }, [searchFields]);


  /*
   * Campos Lookup / Search:
   * se muestran mediante LookupFilter.
   */
  const lookupFilterFields = useMemo(() => {
    return searchFields.filter(
      (field) =>
        (
          field.reference?.type === "lookup" ||
          field.reference?.type === "search"
        ) &&
        Boolean(
          field.reference?.endpoint
        )
    );
  }, [searchFields]);


  /*
   * Estado persistente de la vista Lista.
   *
   * Este estado pertenece a DynamicTab,
   * por lo que sobrevive cuando RecordList
   * se desmonta al pasar a Ficha o Grilla.
   */
  const {
    searchText,
    listFilterValues,
    lookupFilterValues,
    page: listPage,
    rowsPerPage,
    orderBy,
    orderDirection,
  } = state;


  /*
   * Estado interno/transitorio.
   */
  const [records, setRecords] =
    useState<Record<string, unknown>[]>([]);

  const [totalCount, setTotalCount] =
    useState(0);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [
    debouncedSearchText,
    setDebouncedSearchText,
  ] = useState(searchText);


  const sort = useMemo(() => {
    if (
      !orderBy ||
      !orderDirection
    ) {
      return undefined;
    }

    return `${orderBy} ${orderDirection}`;
  }, [
    orderBy,
    orderDirection,
  ]);

  /*
   * Debounce del multibuscador textual.
   */
  useEffect(() => {
    const timeoutId =
      window.setTimeout(() => {
        setDebouncedSearchText(
          searchText
        );
      }, 350);

    return () => {
      window.clearTimeout(
        timeoutId
      );
    };
  }, [searchText]);


  /*
   * Multi-search textual.
   *
   * Ejemplo:
   *
   * (
   *   Value ILIKE '%acme%'
   *   OR Name ILIKE '%acme%'
   *   OR TaxID ILIKE '%acme%'
   * )
   */
  const textFilter = useMemo(() => {
    const value =
      debouncedSearchText.trim();

    if (
      !value ||
      textSearchFields.length === 0
    ) {
      return "";
    }

    const escapedValue =
      value.replace(/'/g, "''");

    const conditions =
      textSearchFields.map(
        (field) =>
          `${field.columnname} ILIKE '%${escapedValue}%'`
      );

    return `(${conditions.join(" OR ")})`;
  }, [
    debouncedSearchText,
    textSearchFields,
  ]);


  /*
   * Filtros correspondientes a
   * referencias List.
   */
  const listValueFilter =
    useMemo(() => {
      const conditions: string[] = [];

      for (
        const field of listFilterFields
      ) {
        const value =
          listFilterValues[
            field.columnname
          ];

        if (
          value === undefined ||
          value === ""
        ) {
          continue;
        }

        const escapedValue =
          escapeFilterValue(value);

        conditions.push(
          `${field.columnname} = '${escapedValue}'`
        );
      }

      return conditions.join(" AND ");
    }, [
      listFilterFields,
      listFilterValues,
    ]);


  /*
   * Filtros correspondientes a
   * Lookup / Search.
   */
  const lookupValueFilter =
    useMemo(() => {
      const conditions: string[] = [];

      for (
        const field of lookupFilterFields
      ) {
        const value =
          lookupFilterValues[
            field.columnname
          ];

        if (
          value === undefined ||
          value === ""
        ) {
          continue;
        }

        const escapedValue =
          escapeFilterValue(value);

        conditions.push(
          `${field.columnname} = '${escapedValue}'`
        );
      }

      return conditions.join(" AND ");
    }, [
      lookupFilterFields,
      lookupFilterValues,
    ]);


  /*
   * Filtro final enviado al REST API.
   */
  const effectiveFilter =
    useMemo(() => {
      const filters = [
        filter?.trim(),
        textFilter,
        listValueFilter,
        lookupValueFilter,
      ].filter(
        (item): item is string =>
          Boolean(item)
      );

      return filters.join(" AND ");
    }, [
      filter,
      textFilter,
      listValueFilter,
      lookupValueFilter,
    ]);


  /*
   * Recuperación server-side.
   */
  useEffect(() => {
    if (!tab.data_endpoint) {
      setRecords([]);
      setTotalCount(0);
      return;
    }

    let cancelled = false;

    async function loadRecords() {
      setLoading(true);
      setError(null);

      try {
        const result =
          await searchRecords(
            tab.data_endpoint!,
            effectiveFilter,
            rowsPerPage,
            listPage + 1,
            sort
          );

        if (cancelled) {
          return;
        }

        /*
        * Si la página actual dejó de existir
        * (por ejemplo, al eliminar el único
        * registro de la última página),
        * retrocedemos a la última página válida.
        *
        * El cambio de estado disparará
        * automáticamente una nueva consulta.
        */
        if (
          result.records.length === 0 &&
          result.totalCount > 0 &&
          listPage > 0
        ) {
          const lastPage =
            Math.max(
              0,
              Math.ceil(
                result.totalCount /
                  rowsPerPage
              ) - 1
            );

          if (lastPage < listPage) {
            onStateChange({
              ...state,
              page: lastPage,
            });

            return;
          }
        }

        setRecords(
          result.records
        );

        setTotalCount(
          result.totalCount
        );
      } catch (err) {
        if (cancelled) {
          return;
        }

        console.error(
          "Error cargando registros para modo lista",
          err
        );

        setRecords([]);
        setTotalCount(0);

        setError(
          err instanceof Error
            ? err.message
            : "No fue posible recuperar los registros"
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadRecords();

    return () => {
      cancelled = true;
    };
  }, [
    tab.data_endpoint,
    effectiveFilter,
    rowsPerPage,
    listPage,
    sort,
    refreshToken,
  ]);


  function getRecordPage(
    rowIndex: number
  ) {
    return (
      listPage *
        rowsPerPage +
      rowIndex +
      1
    );
  }


  function handleSort(
    columnName: string
  ) {
    const sameColumn =
      state.orderBy === columnName;

    const newDirection =
      sameColumn &&
      state.orderDirection === "ASC"
        ? "DESC"
        : "ASC";

    onStateChange({
      ...state,
      orderBy: columnName,
      orderDirection: newDirection,
      page: 0,
    });
  }


  function handleSelectRecord(
    record: Record<string, unknown>,
    rowIndex: number
  ) {
    onSelectRecord(
      record,
      getRecordPage(rowIndex)
    );
  }


  function handleEditRecord(
    event: MouseEvent,
    record: Record<string, unknown>,
    rowIndex: number
  ) {
    event.stopPropagation();

    onEditRecord(
      record,
      getRecordPage(rowIndex)
    );
  }


  function handleDeleteRecord(
    event: MouseEvent,
    record: Record<string, unknown>
  ) {
    event.stopPropagation();

    void onDeleteRecord(record);
  }


  function handleSearchChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    onStateChange({
      ...state,
      searchText:
        event.target.value,
      page: 0,
    });
  }


  function handleListFilterChange(
    columnName: string,
    value: string
  ) {
    onStateChange({
      ...state,

      listFilterValues: {
        ...state.listFilterValues,
        [columnName]: value,
      },

      page: 0,
    });
  }


  function handleLookupFilterChange(
    columnName: string,
    value: string
  ) {
    onStateChange({
      ...state,

      lookupFilterValues: {
        ...state.lookupFilterValues,
        [columnName]: value,
      },

      page: 0,
    });
  }


  function handlePageChange(
    _event: unknown,
    newPage: number
  ) {
    onStateChange({
      ...state,
      page: newPage,
    });
  }


  function handleRowsPerPageChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    onStateChange({
      ...state,

      rowsPerPage:
        parseInt(
          event.target.value,
          10
        ),

      page: 0,
    });
  }


  /*
   * No existen campos configurados
   * para el modo Lista.
   */
  if (listFields.length === 0) {
    return (
      <Alert severity="info">
        La pestaña no posee campos
        disponibles para el modo lista.
      </Alert>
    );
  }


  /*
   * Layout desktop.
   *
   * Se agrega una columna final
   * para las acciones.
   */
  const desktopGridTemplate =
    `${listFields
      .map(
        () =>
          "minmax(120px, 1fr)"
      )
      .join(" ")} minmax(150px, auto)`;


  return (
    <Box>

      {/* ============================
          FILTROS
          ============================ */}

      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 2,
          mb: 2,
          alignItems: "center",
        }}
      >

        {/* Multi-search textual */}

        {textSearchFields.length > 0 && (
          <TextField
            size="small"
            value={searchText}
            onChange={
              handleSearchChange
            }
            placeholder={`Buscar por ${textSearchFields
              .map(
                (field) =>
                  field.name
              )
              .join(", ")}`}
            sx={{
              flex: "1 1 400px",
              minWidth: 250,
            }}
          />
        )}


        {/* Referencias List */}

        {listFilterFields.map(
          (field) => {
            const value =
              listFilterValues[
                field.columnname
              ] ?? "";

            return (
              <FormControl
                key={
                  field.ad_field_id
                }
                size="small"
                sx={{
                  flex: "0 1 220px",
                  minWidth: 180,
                }}
              >
                <InputLabel>
                  {field.name}
                </InputLabel>

                <Select
                  value={value}
                  label={field.name}
                  onChange={(event) =>
                    handleListFilterChange(
                      field.columnname,
                      String(
                        event.target.value
                      )
                    )
                  }
                >
                  <MenuItem value="">
                    <em>Todos</em>
                  </MenuItem>

                  {field.reference
                    ?.values
                    ?.map(
                      (option) => (
                        <MenuItem
                          key={
                            option.value
                          }
                          value={
                            option.value
                          }
                        >
                          {
                            option.name
                          }
                        </MenuItem>
                      )
                    )}
                </Select>
              </FormControl>
            );
          }
        )}


        {/* Lookup / Search */}

        {lookupFilterFields.map(
          (field) => (
            <Box
              key={
                field.ad_field_id
              }
              sx={{
                flex: "0 1 280px",
                minWidth: 220,
              }}
            >
              <LookupFilter
                field={field}
                value={
                  lookupFilterValues[
                    field.columnname
                  ] ?? ""
                }
                onChange={(value) =>
                  handleLookupFilterChange(
                    field.columnname,
                    value
                  )
                }
              />
            </Box>
          )
        )}

      </Box>


      {/* ============================
          ERROR
          ============================ */}

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
        >
          {error}
        </Alert>
      )}


      {/* ============================
          ENCABEZADO DESKTOP
          ============================ */}

      <Box
        sx={{
          display: {
            xs: "none",
            md: "grid",
          },

          gridTemplateColumns:
            desktopGridTemplate,

          gap: 2,
          px: 2,
          pb: 1,
        }}
      >
        {listFields.map(
          (field) => {
            const active =
              orderBy === field.columnname;

            return (
              <Typography
                key={field.ad_field_id}
                variant="subtitle2"
                onClick={() =>
                  handleSort(
                    field.columnname
                  )
                }
                sx={{
                  fontWeight: 600,
                  cursor: "pointer",
                  userSelect: "none",

                  "&:hover": {
                    textDecoration:
                      "underline",
                  },
                }}
              >
                {field.name}

                {active &&
                  (
                    orderDirection === "ASC"
                      ? " ↑"
                      : " ↓"
                  )}
              </Typography>
            );
          }
        )}

        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 600,
            textAlign: "right",
          }}
        >
          Acciones
        </Typography>
      </Box>


      {/* ============================
          LOADING
          ============================ */}

      {loading && (
        <Box
          sx={{
            display: "flex",
            justifyContent:
              "center",
            py: 4,
          }}
        >
          <CircularProgress
            size={28}
          />
        </Box>
      )}


      {/* ============================
          SIN RESULTADOS
          ============================ */}

      {!loading &&
        records.length === 0 && (
          <Alert severity="info">
            No se encontraron registros.
          </Alert>
        )}


      {/* ============================
          REGISTROS
          ============================ */}

      {!loading &&
        records.map(
          (
            record,
            rowIndex
          ) => (
            <Paper
              key={`${listPage}-${rowIndex}`}
              variant="outlined"
              onClick={() =>
                handleSelectRecord(
                  record,
                  rowIndex
                )
              }
              sx={{
                mb: 1,
                px: 2,
                py: 1.5,

                cursor: "pointer",

                display: "grid",

                gridTemplateColumns: {
                  xs: "1fr",
                  md: desktopGridTemplate,
                },

                gap: {
                  xs: 1,
                  md: 2,
                },

                alignItems:
                  "center",

                transition:
                  "background-color 0.15s ease",

                "&:hover": {
                  backgroundColor:
                    "action.hover",
                },
              }}
            >

              {/* Valores */}

              {listFields.map(
                (field) => (
                  <Box
                    key={
                      field.ad_field_id
                    }
                    sx={{
                      minWidth: 0,
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
                  </Box>
                )
              )}


              {/* Acciones */}

              <Box
                sx={{
                  display: "flex",

                  justifyContent: {
                    xs: "flex-start",
                    md: "flex-end",
                  },

                  gap: 1,

                  mt: {
                    xs: 1,
                    md: 0,
                  },
                }}
              >
                <Button
                  size="small"
                  variant="text"
                  disabled={
                    tab.isreadonly ===
                    true
                  }
                  onClick={(
                    event
                  ) =>
                    handleEditRecord(
                      event,
                      record,
                      rowIndex
                    )
                  }
                >
                  Editar
                </Button>

                <Button
                  size="small"
                  variant="text"
                  color="error"
                  disabled={
                    tab.isreadonly ===
                    true
                  }
                  onClick={(
                    event
                  ) =>
                    handleDeleteRecord(
                      event,
                      record
                    )
                  }
                >
                  Eliminar
                </Button>
              </Box>

            </Paper>
          )
        )}


      {/* ============================
          PAGINACIÓN
          ============================ */}

      <TablePagination
        component="div"
        count={totalCount}
        page={listPage}
        onPageChange={handlePageChange}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={
          handleRowsPerPageChange
        }
        rowsPerPageOptions={[
          10,
          25,
          50,
          100,
        ]}
        labelRowsPerPage="Registros por página:"
        labelDisplayedRows={({
          from,
          to,
          count,
        }) =>
          `${from}-${to} de ${count}`
        }
      />

    </Box>
  );
}