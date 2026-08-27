import { useEffect, useState } from "react";

import {
  Box,
  Container,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Typography,
} from "@mui/material";

import WindowSelector from "./components/WindowSelector";
import DynamicTab from "./components/DynamicTab";

import { getWindowSchema } from "./api/libertyaApi";
import libertyaLogo from "./assets/libertya-next-logo.png";

import type {
  WindowSchema,
  WindowSchemaTab,
} from "./types/metadata";


type CurrentRecords =
  Record<number, Record<string, unknown> | null>;


function App() {

  const [windowId, setWindowId] =
    useState<number | "">("");

  const [windowSchema, setWindowSchema] =
    useState<WindowSchema | null>(null);

  const [activeTab, setActiveTab] =
    useState(0);

  /*
   * Registro actualmente seleccionado por cada AD_Tab_ID.
   */
  const [currentRecords, setCurrentRecords] =
    useState<CurrentRecords>({});


  useEffect(() => {

    if (windowId === "") {

      setWindowSchema(null);
      setActiveTab(0);
      setCurrentRecords({});

      return;
    }


    /*
     * Nueva ventana:
     * limpiar navegación y registros seleccionados.
     */
    setActiveTab(0);
    setCurrentRecords({});


    getWindowSchema(windowId)
      .then(setWindowSchema)
      .catch((error) => {

        console.error(
          `Error recuperando schema de ventana ${windowId}`,
          error
        );

        setWindowSchema(null);
      });

  }, [windowId]);


  const selectedTab: WindowSchemaTab | undefined =
    windowSchema?.tabs[activeTab];


  /*
   * Metadata de la pestaña padre,
   * si la pestaña actual es detalle.
   */
  const parentTab =
    selectedTab?.parent_ad_tab_id !== undefined
      ? windowSchema?.tabs.find(
          (tab) =>
            tab.ad_tab_id ===
            selectedTab.parent_ad_tab_id
        )
      : undefined;


  /*
   * Registro actual de la pestaña padre.
   */
  const parentRecord =
    selectedTab?.parent_ad_tab_id !== undefined
      ? currentRecords[
          selectedTab.parent_ad_tab_id
        ]
      : undefined;


  function handleRecordChange(
    tabId: number,
    record: Record<string, unknown> | null
  ) {

    setCurrentRecords((current) => ({
      ...current,
      [tabId]: record,
    }));
  }


  /*
   * Devuelve la indentación visual de una pestaña.
   *
   * Usamos tablevel porque representa directamente
   * la jerarquía de tabs de Libertya.
   */
  function getTabIndent(
    tab: WindowSchemaTab
  ): number {

    const level =
      tab.tablevel ?? 0;

    /*
     * 24 px por nivel.
     */
    return level * 3;
  }


  return (
    <Container
      maxWidth="md"
      sx={{
        marginTop: 4,
      }}
    >

      <Box
  sx={{
    display: "flex",
    alignItems: "center",
    gap: 2,
    marginBottom: 3,
  }}
>
    <Box
        component="img"
        src={libertyaLogo}
        alt="Libertya Next"
        sx={{
          width: 190,
          height: "auto",
        }}
      />

      <Typography
        variant="h6"
        color="text.secondary"
        sx={{
          borderLeft: 1,
          borderColor: "divider",
          paddingLeft: 2,
        }}
      >
        Dynamic UI
      </Typography>
    </Box>


      <WindowSelector
        value={windowId}
        onChange={setWindowId}
      />


      {windowSchema && (
        <>

          <Typography
            variant="h5"
            sx={{
              marginTop: 3,
            }}
          >
            {windowSchema.name}
          </Typography>


          {windowSchema.description && (

            <Typography
              sx={{
                marginTop: 1,
              }}
            >
              {windowSchema.description}
            </Typography>

          )}


          {/*
           * Navegación jerárquica superior.
           *
           * Visualmente sigue la idea del cliente Swing:
           *
           * Nivel 0
           *   Nivel 1
           *     Nivel 2
           *
           * pero ubicada arriba del formulario.
           */}
          <Paper
            variant="outlined"

            sx={{
              marginTop: 3,
              marginBottom: 3,

              /*
               * Evita que una ventana con muchísimas tabs
               * se coma toda la pantalla.
               *
               * En ese caso aparece scroll VERTICAL.
               */
              maxHeight: 360,
              overflowY: "auto",
            }}
          >

            <List
              disablePadding
              dense
            >

              {windowSchema.tabs.map(
                (tab, index) => {

                  const active =
                    index === activeTab;

                  const level =
                    tab.tablevel ?? 0;


                  return (

                    <ListItemButton
                      key={tab.ad_tab_id}

                      selected={active}

                      onClick={() =>
                        setActiveTab(index)
                      }

                      sx={{
                        /*
                         * Indentación jerárquica real.
                         */
                        paddingLeft:
                          1.5 +
                          getTabIndent(tab),

                        paddingTop:
                          level === 0
                            ? 0.8
                            : 0.35,

                        paddingBottom:
                          level === 0
                            ? 0.8
                            : 0.35,

                        borderRadius: 1,

                        marginY: 0.15,

                        /*
                         * Las tabs raíz tienen un fondo
                         * apenas distinto cuando no están
                         * seleccionadas.
                         */
                        ...(
                          level === 0 &&
                          !active
                            ? {
                                backgroundColor:
                                  "action.hover",
                              }
                            : {}
                        ),
                      }}
                    >

                      {/*
                       * Indicador visual de jerarquía.
                       */}
                      {level > 0 && (

                        <Box
                          component="span"

                          sx={{
                            marginRight: 1,
                            color:
                              "text.secondary",
                            fontSize:
                              "0.8rem",
                          }}
                        >
                          └─
                        </Box>

                      )}


                      <ListItemText
                        primary={
                          tab.name
                        }

                        slotProps={{
                          primary: {
                            sx: {
                              fontWeight:
                                active
                                  ? 600
                                  : level === 0
                                  ? 500
                                  : 400,

                              fontSize:
                                level === 0
                                  ? "0.95rem"
                                  : "0.9rem",
                            },
                          },
                        }}
                      />

                    </ListItemButton>

                  );
                }
              )}

            </List>

          </Paper>


          {selectedTab && (

            <DynamicTab
              key={
                selectedTab.ad_tab_id
              }

              tab={
                selectedTab
              }

              parentTab={
                parentTab
              }

              parentRecord={
                parentRecord
              }

              onRecordChange={
                handleRecordChange
              }
            />

          )}

        </>
      )}

    </Container>
  );
}


export default App;