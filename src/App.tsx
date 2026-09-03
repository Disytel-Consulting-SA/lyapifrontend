import { useEffect, useState } from "react";

import {
  Box,
  Button,
  Container,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Typography,
} from "@mui/material";

import WindowSelector from "./components/WindowSelector";
import RoleSelector from "./components/RoleSelector";
import DynamicTab from "./components/DynamicTab";
import Login from "./components/Login";
import LibertyaLogo from "./components/LibertyaLogo";
import ThemeModeToggle from "./components/ThemeModeToggle";

import {
  getWindowSchema,
  selectRole,
  type RoleOption,
} from "./api/libertyaApi";

import {
  clearRole,
  clearSession,
  getRoleId,
  getUsername,
  isAuthenticated,
  SESSION_EXPIRED_EVENT,
  setRole,
  setToken,
} from "./auth";

import type {
  WindowSchema,
  WindowSchemaTab,
} from "./types/metadata";


type CurrentRecords =
  Record<number, Record<string, unknown> | null>;


function App() {

  const [authenticated, setAuthenticated] =
    useState(isAuthenticated());

  const [roleId, setRoleId] =
    useState<number | "">(getRoleId() ?? "");

  const [windowId, setWindowId] =
    useState<number | "">("");

  const [windowSchema, setWindowSchema] =
    useState<WindowSchema | null>(null);

  const [activeTab, setActiveTab] =
    useState(0);

  const [currentRecords, setCurrentRecords] =
    useState<CurrentRecords>({});


  /*
   * Escuchar vencimiento / invalidación de sesión.
   */
  useEffect(() => {
    function handleSessionExpired() {
      setRoleId("");
      setWindowId("");
      setWindowSchema(null);
      setActiveTab(0);
      setCurrentRecords({});
      setAuthenticated(false);
    }

    window.addEventListener(
      SESSION_EXPIRED_EVENT,
      handleSessionExpired
    );

    return () => {
      window.removeEventListener(
        SESSION_EXPIRED_EVENT,
        handleSessionExpired
      );
    };
  }, []);


  /*
   * Recuperar metadata de la ventana seleccionada.
   */
  useEffect(() => {
    if (!authenticated || roleId === "") {
      return;
    }

    if (windowId === "") {
      setWindowSchema(null);
      setActiveTab(0);
      setCurrentRecords({});
      return;
    }

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

  }, [
    authenticated,
    roleId,
    windowId,
  ]);


  if (!authenticated) {
    return (
      <Login
        onLogin={() => {
          clearRole();

          setRoleId("");
          setWindowId("");
          setWindowSchema(null);
          setActiveTab(0);
          setCurrentRecords({});

          setAuthenticated(true);
        }}
      />
    );
  }


  const selectedTab: WindowSchemaTab | undefined =
    windowSchema?.tabs[activeTab];


  const parentTab =
    selectedTab?.parent_ad_tab_id !== undefined
      ? windowSchema?.tabs.find(
          (tab) =>
            tab.ad_tab_id ===
            selectedTab.parent_ad_tab_id
        )
      : undefined;


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
    setCurrentRecords(
      (current) => ({
        ...current,
        [tabId]: record,
      })
    );
  }


  async function handleRoleChange(role: RoleOption) {
    try {
      const contextualToken =
        await selectRole(role.ad_role_id);

      setToken(contextualToken);

      setRole(
        role.ad_role_id,
        role.name
      );

      setRoleId(role.ad_role_id);
      setWindowId("");
      setWindowSchema(null);
      setActiveTab(0);
      setCurrentRecords({});

    } catch (error) {
      console.error(
        `Error seleccionando perfil ${role.name}`,
        error
      );
    }
  }


  function handleLogout() {
    clearSession();

    setRoleId("");
    setWindowId("");
    setWindowSchema(null);
    setActiveTab(0);
    setCurrentRecords({});

    setAuthenticated(false);
  }


  function getTabIndent(
    tab: WindowSchemaTab
  ): number {
    const level =
      tab.tablevel ?? 0;

    return level * 2;
  }


  return (
    <Container
      maxWidth="xl"
      sx={{
        height: "100vh",
        paddingTop: 2,
        paddingBottom: 2,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >

      {/* HEADER */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          marginBottom: 3,
        }}
      >
        <LibertyaLogo width={190} />

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

        <Box
          sx={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 1.5,
          }}
        >
          <ThemeModeToggle />

          <Typography
            variant="body2"
            color="text.secondary"
          >
            {getUsername()}
          </Typography>

          <Button
            variant="outlined"
            size="small"
            onClick={handleLogout}
          >
            Salir
          </Button>
        </Box>
      </Box>


      {/* SELECTOR DE PERFIL */}
      <RoleSelector
        value={roleId}
        onChange={handleRoleChange}
      />


      {/* SELECTOR DE VENTANA */}
      {roleId !== "" && (
        <Box sx={{ marginTop: 1 }}>
          <WindowSelector
            key={roleId}
            value={windowId}
            onChange={setWindowId}
          />
        </Box>
      )}


      {/* VENTANA SELECCIONADA */}
      {windowSchema && (
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >

        <Box
          sx={{
            marginTop: 1.5,
            marginBottom: 1.5,
            display: "flex",
            alignItems: "baseline",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <Typography variant="h5">
            {windowSchema.name}
          </Typography>

          {windowSchema.description && (
            <Typography
              variant="body2"
              color="text.secondary"
            >
              {windowSchema.description}
            </Typography>
          )}
        </Box>


          {/* ÁRBOL + FORMULARIO */}
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "260px minmax(0, 1fr)",
              },
              gap: 3,
              alignItems: "stretch",
            }}
          >

            {/* ÁRBOL DE PESTAÑAS */}
            <Paper
              variant="outlined"
              sx={{
                minHeight: 0,
                overflowY: "auto",
              }}
            >
              <List
                disablePadding
                dense
              >
                {windowSchema.tabs.map(
                  (
                    tab,
                    index
                  ) => {

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

                        {level > 0 && (
                          <Box
                            component="span"
                            sx={{
                              marginRight: 1,
                              color: "text.secondary",
                              fontSize: "0.8rem",
                            }}
                          >
                            └─
                          </Box>
                        )}


                        <ListItemText
                          primary={tab.name}
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


            {/* CONTENIDO DE LA PESTAÑA */}
            <Box
              sx={{
                minWidth: 0,
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              {selectedTab && (
                <DynamicTab
                  key={selectedTab.ad_tab_id}
                  tab={selectedTab}
                  parentTab={parentTab}
                  parentRecord={parentRecord}
                  onRecordChange={handleRecordChange}
                />
              )}
            </Box>

          </Box>

        </Box>
      )}

    </Container>
  );
}


export default App;