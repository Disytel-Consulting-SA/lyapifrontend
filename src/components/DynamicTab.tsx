import { useEffect, useState } from "react";

import {
  Alert,
  Autocomplete,
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";

import type {
  Theme,
} from "@mui/material/styles";

import type {
  SystemStyleObject,
} from "@mui/system";

import {
  getLookupValues,
  getRecord,
} from "../api/libertyaApi";

import type {
  LookupValue,
} from "../api/libertyaApi";

import type {
  WindowSchemaField,
  WindowSchemaTab,
} from "../types/metadata";

import SearchField from "./SearchField";


interface Props {
  tab: WindowSchemaTab;

  parentTab?: WindowSchemaTab;

  parentRecord?: Record<string, unknown> | null;

  onRecordChange: (
    tabId: number,
    record: Record<string, unknown> | null
  ) => void;
}


interface LookupFieldProps {
  field: WindowSchemaField;

  rawValue: unknown;

  readOnly: boolean;

  onChange: (
    value: string
  ) => void;
}


function getReadOnlySx(
  readOnly: boolean
): SystemStyleObject<Theme> {

  if (!readOnly) {
    return {};
  }

  return {

    "& .MuiInputBase-root": {
      backgroundColor: "#f1f1f1",
    },

    "& .MuiInputBase-input.Mui-disabled": {
      WebkitTextFillColor: "#666666",
    },

    "& .MuiInputLabel-root.Mui-disabled": {
      color: "#707070",
    },

    "& .MuiFormHelperText-root.Mui-disabled": {
      color: "#888888",
    },

  };
}


/**
 * Lookup remoto para Table / Table Direct.
 */
function LookupField({
  field,
  rawValue,
  readOnly,
  onChange,
}: LookupFieldProps) {

  const [options, setOptions] =
    useState<LookupValue[]>([]);

  const [selectedOption, setSelectedOption] =
    useState<LookupValue | null>(null);

  const [inputValue, setInputValue] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);


  const endpoint =
    field.reference?.endpoint;


  const value =
    rawValue === null ||
    rawValue === undefined
      ? ""
      : String(rawValue);


  useEffect(() => {

    if (!endpoint || value === "") {

      setSelectedOption(null);
      setInputValue("");

      return;
    }


    let cancelled = false;


    getLookupValues(
      endpoint,
      1,
      1,
      undefined,
      value
    )
      .then((values) => {

        if (
          !cancelled &&
          values.length > 0
        ) {

          setSelectedOption(
            values[0]
          );

          setInputValue(
            values[0].name
          );
        }

      })
      .catch((err) => {

        console.error(
          `Error resolviendo valor ${value} en ${endpoint}`,
          err
        );

      });


    return () => {
      cancelled = true;
    };

  }, [
    endpoint,
    value,
  ]);


  useEffect(() => {

    if (!endpoint) {
      return;
    }


    let cancelled = false;

    setLoading(true);
    setError(null);


    getLookupValues(
      endpoint,
      50,
      1,
      inputValue || undefined
    )
      .then((values) => {

        if (!cancelled) {
          setOptions(values);
        }

      })
      .catch((err) => {

        console.error(
          `Error recuperando lookup ${endpoint}`,
          err
        );

        if (!cancelled) {

          setOptions([]);

          setError(
            "No fue posible cargar los valores"
          );
        }

      })
      .finally(() => {

        if (!cancelled) {
          setLoading(false);
        }

      });


    return () => {
      cancelled = true;
    };

  }, [
    endpoint,
    inputValue,
  ]);


  return (
    <Box
      sx={{
        marginTop: 2,
        marginBottom: 1,
      }}
    >

      <Autocomplete
        options={options}

        value={selectedOption}

        loading={loading}

        disabled={readOnly}

        filterOptions={(x) => x}

        getOptionLabel={(option) =>
          option.name
        }

        isOptionEqualToValue={(
          option,
          selected
        ) =>
          option.value ===
          selected.value
        }

        inputValue={inputValue}

        onInputChange={(
          _,
          newInputValue
        ) => {

          setInputValue(
            newInputValue
          );

        }}

        onChange={(
          _,
          newValue
        ) => {

          setSelectedOption(
            newValue
          );

          setInputValue(
            newValue
              ? newValue.name
              : ""
          );

          onChange(
            newValue
              ? newValue.value
              : ""
          );

        }}

        renderInput={(params) => (

          <TextField
            {...params}

            label={field.name}

            required={
              field.ismandatory
            }

            helperText={
              error
                ? error
                : `column: ${field.columnname}`
            }

            sx={
              getReadOnlySx(
                readOnly
              )
            }
          />

        )}
      />

    </Box>
  );
}


export default function DynamicTab({
  tab,
  parentTab,
  parentRecord,
  onRecordChange,
}: Props) {

  const [record, setRecord] =
    useState<Record<string, unknown>>({});

  const [page, setPage] =
    useState(1);

  const [hasNext, setHasNext] =
    useState(true);

  const [isNewRecord, setIsNewRecord] =
    useState(false);

  function getFieldValue(
    field: WindowSchemaField
  ): unknown {

    return record[
      field.columnname.toLowerCase()
    ];
  }


  function setFieldValue(
    field: WindowSchemaField,
    value: unknown
  ) {

    setRecord((current) => ({
      ...current,

      [field.columnname.toLowerCase()]:
        value,
    }));
  }


  function isFieldReadOnly(
    field: WindowSchemaField
  ): boolean {

    return (
      tab.isreadonly === true ||
      field.isreadonly === true
    );
  }


  function getParentKeyValue(): unknown {

    if (
      tab.parent_ad_tab_id === undefined ||
      !parentTab ||
      !parentRecord
    ) {
      return undefined;
    }


    const keyField =
      parentTab.fields.find(
        (field) => field.iskey
      );


    if (!keyField) {
      return undefined;
    }


    return parentRecord[
      keyField.columnname.toLowerCase()
    ];
  }

function createNewRecord():
  Record<string, unknown> {

  const newRecord:
    Record<string, unknown> = {};


  /*
   * Aplicar los defaults ya resueltos
   * por el backend.
   */
  tab.fields.forEach((field) => {

    if (
      field.defaultvalue !== undefined
    ) {

      newRecord[
        field.columnname.toLowerCase()
      ] = field.defaultvalue;
    }

  });


  /*
   * Para tabs detalle, propagar además
   * el vínculo con el registro padre.
   */
  if (
    tab.parent_ad_tab_id !== undefined &&
    tab.link_columnname
  ) {

    const parentValue =
      getParentKeyValue();


    if (
      parentValue !== undefined &&
      parentValue !== null
    ) {

      newRecord[
        tab.link_columnname.toLowerCase()
      ] = parentValue;
    }
  }


  return newRecord;
}


function handleNewRecord() {

  const newRecord =
    createNewRecord();


  setIsNewRecord(true);

  setRecord(
    newRecord
  );


  onRecordChange(
    tab.ad_tab_id,
    newRecord
  );
}


  function formatDateValue(
    rawValue: unknown,
    type: string
  ): string {

    if (
      rawValue === null ||
      rawValue === undefined ||
      rawValue === ""
    ) {
      return "";
    }


    const value =
      String(rawValue);


    if (type === "date") {

      return value.length >= 10
        ? value.substring(0, 10)
        : value;
    }


    if (type === "datetime") {

      const normalized =
        value.replace(" ", "T");

      return normalized.length >= 16
        ? normalized.substring(0, 16)
        : normalized;
    }


    if (type === "time") {

      if (value.includes("T")) {

        const time =
          value.split("T")[1];

        return time
          ? time.substring(0, 5)
          : "";
      }


      if (value.includes(" ")) {

        const time =
          value.split(" ")[1];

        return time
          ? time.substring(0, 5)
          : "";
      }


      return value.length >= 5
        ? value.substring(0, 5)
        : value;
    }


    return value;
  }


  function renderField(
    field: WindowSchemaField
  ) {

    const rawValue =
      getFieldValue(field);

    const readOnly =
      isFieldReadOnly(field);


    if (
      field.reference?.type === "button"
    ) {

      return (
        <Box
          key={field.ad_field_id}

          sx={{
            marginTop: 2,
            marginBottom: 1,
          }}
        >

          <Button
            variant="contained"
            size="small"
            disabled
          >
            {field.name}
          </Button>


          <Typography
            variant="caption"

            sx={{
              display: "block",
              marginTop: 0.5,
            }}
          >
            column: {field.columnname}
          </Typography>

        </Box>
      );
    }


    if (
      field.reference?.type === "boolean"
    ) {

      const checked =
        rawValue === true ||
        rawValue === "Y" ||
        rawValue === "true";


      return (
        <Box
          key={field.ad_field_id}

          sx={
            readOnly
              ? {
                  marginTop: 2,
                  marginBottom: 1,
                  backgroundColor: "#f1f1f1",
                  borderRadius: 1,
                  paddingLeft: 1,
                  paddingTop: 0.5,
                  paddingBottom: 0.5,
                }
              : {
                  marginTop: 2,
                  marginBottom: 1,
                }
          }
        >

          <FormControlLabel
            disabled={readOnly}

            control={
              <Checkbox
                checked={checked}

                disabled={readOnly}

                onChange={(event) => {

                  setFieldValue(
                    field,
                    event.target.checked
                  );

                }}
              />
            }

            label={
              field.ismandatory
                ? `${field.name} *`
                : field.name
            }
          />


          <Typography
            variant="caption"

            sx={{
              display: "block",
              marginLeft: 4,
            }}
          >
            column: {field.columnname}
          </Typography>

        </Box>
      );
    }


    if (
      field.reference?.type === "search"
    ) {

      return (
        <SearchField
          key={field.ad_field_id}

          field={field}

          rawValue={rawValue}

          readOnly={readOnly}

          onChange={(value) => {

            setFieldValue(
              field,
              value
            );

          }}
        />
      );
    }


    if (
      field.reference?.type === "lookup"
    ) {

      return (
        <LookupField
          key={field.ad_field_id}

          field={field}

          rawValue={rawValue}

          readOnly={readOnly}

          onChange={(value) => {

            setFieldValue(
              field,
              value
            );

          }}
        />
      );
    }


    if (
      field.reference?.type === "list"
    ) {

      const value =
        rawValue === null ||
        rawValue === undefined
          ? ""
          : String(rawValue);


      return (
        <FormControl
          key={field.ad_field_id}

          fullWidth

          margin="normal"

          required={
            field.ismandatory
          }

          disabled={readOnly}

          sx={
            readOnly
              ? {
                  "& .MuiInputBase-root": {
                    backgroundColor:
                      "#f1f1f1",
                  },

                  "& .MuiSelect-select.Mui-disabled":
                    {
                      WebkitTextFillColor:
                        "#666666",
                    },

                  "& .MuiInputLabel-root.Mui-disabled":
                    {
                      color:
                        "#707070",
                    },
                }
              : undefined
          }
        >

          <InputLabel>
            {field.name}
          </InputLabel>


          <Select
            value={value}

            label={field.name}

            onChange={(event) => {

              setFieldValue(
                field,
                event.target.value
              );

            }}
          >

            {!field.ismandatory && (

              <MenuItem value="">
                <em>Sin valor</em>
              </MenuItem>

            )}


            {field.reference.values?.map(
              (option) => (

                <MenuItem
                  key={option.value}
                  value={option.value}
                >
                  {option.name}
                </MenuItem>

              )
            )}

          </Select>


          <Typography
            variant="caption"

            sx={{
              marginLeft: 2,
              marginTop: 0.5,
            }}
          >
            column: {field.columnname}
          </Typography>

        </FormControl>
      );
    }


    if (
      field.reference?.type === "date" ||
      field.reference?.type === "datetime" ||
      field.reference?.type === "time"
    ) {

      const type =
        field.reference.type;


      const inputType =
        type === "date"
          ? "date"
          : type === "datetime"
          ? "datetime-local"
          : "time";


      return (
        <TextField
          key={field.ad_field_id}

          label={field.name}

          required={
            field.ismandatory
          }

          disabled={readOnly}

          type={inputType}

          value={
            formatDateValue(
              rawValue,
              type
            )
          }

          onChange={(event) => {

            setFieldValue(
              field,
              event.target.value
            );

          }}

          helperText={
            `column: ${field.columnname}`
          }

          fullWidth

          margin="normal"

          slotProps={{
            inputLabel: {
              shrink: true,
            },
          }}

          sx={
            getReadOnlySx(
              readOnly
            )
          }
        />
      );
    }


    if (
      field.reference?.type === "integer"
    ) {

      return (
        <TextField
          key={field.ad_field_id}

          label={field.name}

          required={
            field.ismandatory
          }

          disabled={readOnly}

          type="number"

          value={
            rawValue === null ||
            rawValue === undefined
              ? ""
              : String(rawValue)
          }

          onChange={(event) => {

            setFieldValue(
              field,
              event.target.value
            );

          }}

          helperText={
            `column: ${field.columnname}`
          }

          fullWidth

          margin="normal"

          slotProps={{
            htmlInput: {
              step: 1,
            },
          }}

          sx={
            getReadOnlySx(
              readOnly
            )
          }
        />
      );
    }


    if (
      field.reference?.type === "number"
    ) {

      return (
        <TextField
          key={field.ad_field_id}

          label={field.name}

          required={
            field.ismandatory
          }

          disabled={readOnly}

          type="number"

          value={
            rawValue === null ||
            rawValue === undefined
              ? ""
              : String(rawValue)
          }

          onChange={(event) => {

            setFieldValue(
              field,
              event.target.value
            );

          }}

          helperText={
            `column: ${field.columnname}`
          }

          fullWidth

          margin="normal"

          slotProps={{
            htmlInput: {
              step: "any",
            },
          }}

          sx={
            getReadOnlySx(
              readOnly
            )
          }
        />
      );
    }


    if (
      field.reference?.type === "amount" ||
      field.reference?.type === "quantity" ||
      field.reference?.type === "costprice"
    ) {

      const type =
        field.reference.type;


      let labelSuffix = "";

      if (type === "amount") {
        labelSuffix = " (importe)";
      }

      if (type === "quantity") {
        labelSuffix = " (cantidad)";
      }

      if (type === "costprice") {
        labelSuffix = " (costo/precio)";
      }


      return (
        <TextField
          key={field.ad_field_id}

          label={
            `${field.name}${labelSuffix}`
          }

          required={
            field.ismandatory
          }

          disabled={readOnly}

          type="number"

          value={
            rawValue === null ||
            rawValue === undefined
              ? ""
              : String(rawValue)
          }

          onChange={(event) => {

            setFieldValue(
              field,
              event.target.value
            );

          }}

          helperText={
            `column: ${field.columnname}`
          }

          fullWidth

          margin="normal"

          slotProps={{
            htmlInput: {
              step: "any",
            },
          }}

          sx={[
            getReadOnlySx(
              readOnly
            ),
            {
              "& input": {
                textAlign: "right",
              },
            },
          ]}
        />
      );
    }


    if (
      field.reference?.type === "textarea"
    ) {

      return (
        <TextField
          key={field.ad_field_id}

          label={field.name}

          required={
            field.ismandatory
          }

          disabled={readOnly}

          value={
            rawValue === null ||
            rawValue === undefined
              ? ""
              : String(rawValue)
          }

          onChange={(event) => {

            setFieldValue(
              field,
              event.target.value
            );

          }}

          helperText={
            `column: ${field.columnname}`
          }

          fullWidth

          multiline

          minRows={3}

          margin="normal"

          sx={
            getReadOnlySx(
              readOnly
            )
          }
        />
      );
    }


    return (
      <TextField
        key={field.ad_field_id}

        label={field.name}

        required={
          field.ismandatory
        }

        value={
          rawValue === null ||
          rawValue === undefined
            ? ""
            : String(rawValue)
        }

        helperText={
          `column: ${field.columnname}`
        }

        fullWidth

        margin="normal"

        disabled={readOnly}

        slotProps={{
          input: {
            readOnly: true,
          },
        }}

        sx={
          getReadOnlySx(
            readOnly
          )
        }
      />
    );
  }


  useEffect(() => {

    setPage(1);
    setIsNewRecord(false);

  }, [
    tab.ad_tab_id,
    parentRecord,
  ]);


  useEffect(() => {

   /*
    * Mientras estamos creando un registro
    * no debemos reemplazarlo mediante GET.
    */
    if (isNewRecord) {
      return;
    }

    if (!tab.data_endpoint) {

      setRecord({});
      setHasNext(false);

      onRecordChange(
        tab.ad_tab_id,
        null
      );

      return;
    }


    let filter: string | undefined;


    if (
      tab.parent_ad_tab_id !== undefined
    ) {

      const parentValue =
        getParentKeyValue();


      if (
        parentValue === undefined ||
        parentValue === null ||
        !tab.link_columnname
      ) {

        setRecord({});
        setHasNext(false);

        onRecordChange(
          tab.ad_tab_id,
          null
        );

        return;
      }


      filter =
        `${tab.link_columnname}=${parentValue}`;
    }


    getRecord(
      tab.data_endpoint,
      page,
      filter
    )
      .then((result) => {

        if (result === null) {

          setHasNext(false);


          if (page > 1) {

            setPage(
              (current) =>
                current - 1
            );

          } else {

            setRecord({});

            onRecordChange(
              tab.ad_tab_id,
              null
            );
          }


          return;
        }


        setRecord(result);

        setHasNext(true);


        onRecordChange(
          tab.ad_tab_id,
          result
        );

      })
      .catch((error) => {

        console.error(
          `Error recuperando datos desde ${tab.data_endpoint}`,
          error
        );


        setRecord({});

        setHasNext(false);


        onRecordChange(
          tab.ad_tab_id,
          null
        );

      });


  }, [
    tab,
    page,
    parentRecord,
    isNewRecord
  ]);


  return (

    <Box sx={{ marginTop: 4 }}>

      <Typography
        variant="h6"
        gutterBottom
      >
        {tab.name}
      </Typography>


      <Typography variant="body2">
        tabla: {tab.tablename}
      </Typography>


      <Typography variant="body2">
        endpoint:{" "}
        {tab.data_endpoint ?? "sin endpoint"}
      </Typography>


      {tab.parent_ad_tab_id !== undefined && (

        <Typography variant="body2">

          parent tab:{" "}
          {tab.parent_ad_tab_id}

          {tab.link_columnname
            ? ` — link: ${tab.link_columnname}`
            : ""}

        </Typography>

      )}


      {tab.isreadonly && (

        <Alert
          severity="info"
          sx={{ marginTop: 2 }}
        >
          Esta pestaña es de solo lectura.
        </Alert>

      )}


      {!tab.data_endpoint && (

        <Alert
          severity="warning"
          sx={{ marginTop: 2 }}
        >

          No existe un endpoint REST configurado
          para la tabla {tab.tablename}.

        </Alert>

      )}


      {tab.data_endpoint && (
        <>

          <Box
            sx={{
              marginTop: 1,
              marginBottom: 2,
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >

            <ButtonGroup
              variant="outlined"
              size="small"
            >

              <Button
                onClick={() =>
                  setPage(
                    (current) =>
                      Math.max(
                        1,
                        current - 1
                      )
                  )
                }

                disabled={
                  isNewRecord ||
                  page === 1
                }
              >
                ← Anterior
              </Button>


              <Button
                onClick={() =>
                  setPage(
                    (current) =>
                      current + 1
                  )
                }

                disabled={
                  isNewRecord ||
                  !hasNext
                }
              >
                Siguiente →
              </Button>


              <Button
                onClick={handleNewRecord}

                disabled={
                  tab.isreadonly === true
                }
              >
                Nuevo
              </Button>


              {isNewRecord && (

                <Button
                  onClick={() => {

                    setIsNewRecord(false);

                    /*
                    * Al salir del modo Nuevo,
                    * el effect volverá a recuperar
                    * el registro correspondiente
                    * a page.
                    */
                  }}
                >
                  Cancelar
                </Button>

              )}

            </ButtonGroup>


            <Typography variant="body2">

              {isNewRecord
                ? "Nuevo registro"
                : `Registro ${page}`}

            </Typography>

          </Box>


          {[...tab.fields]
            .filter(
              (field) =>
                field.isdisplayed !== false
            )
            .sort(
              (a, b) =>
                a.seqno - b.seqno
            )
            .map(renderField)}

        </>
      )}

    </Box>
  );
}