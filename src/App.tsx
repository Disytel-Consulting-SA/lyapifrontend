import { useEffect, useState } from "react";

import {
  Box,
  Button,
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

type CurrentPages = Record<number, number>;  

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

  const [currentPages, setCurrentPages] =
    useState<CurrentPages>({});

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
      setCurrentPages({});
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

  function handlePageChange(tabId: number, page: number) {
    setCurrentPages((current) => ({
      ...current,
      [tabId]: page,
    }));
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
    <Box
      sx={{
        height: "100vh",
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          md: "280px minmax(0, 1fr)",
        },
        overflow: "hidden",
        backgroundColor: "background.default",
      }}
    >

      {/* SIDEBAR */}
      <Paper
        square
        variant="outlined"
        sx={{
          minHeight: 0,
          display: {
            xs: "none",
            md: "flex",
          },
          flexDirection: "column",
          borderTop: 0,
          borderBottom: 0,
          borderLeft: 0,
          overflow: "hidden",
        }}
      >

        {/* BRANDING */}
        <Box
          sx={{
            padding: 2,
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <LibertyaLogo width={185} />

        </Box>


        {/* USUARIO */}
        <Box
          sx={{
            paddingX: 2,
            paddingY: 1.5,
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <ThemeModeToggle />

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
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


        {/* SELECTORES */}
        <Box
          sx={{
            padding: 2,
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <RoleSelector
            value={roleId}
            onChange={handleRoleChange}
          />

          {roleId !== "" && (
            <Box sx={{ marginTop: 1.5 }}>
              <WindowSelector
                key={roleId}
                value={windowId}
                onChange={setWindowId}
              />
            </Box>
          )}
        </Box>


        {/* ÁRBOL DE PESTAÑAS */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: 1,
          }}
        >
          {windowSchema && (
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
          )}
        </Box>

      </Paper>


      {/* WORKSPACE */}
      <Box
        sx={{
          minWidth: 0,
          minHeight: 0,
          overflow: "hidden",
          padding: 2,
        }}
      >

        {windowSchema && selectedTab ? (
          <DynamicTab
            key={selectedTab.ad_tab_id}
            tab={selectedTab}
            parentTab={parentTab}
            parentRecord={parentRecord}
            windowIsSOTrx={windowSchema.issotrx}
            initialPage={currentPages[selectedTab.ad_tab_id] ?? 1}
            onPageChange={handlePageChange}
            onRecordChange={handleRecordChange}
          />
        ) : (
          <Box
            sx={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography
              color="text.secondary"
            >
              Seleccioná una ventana para comenzar
            </Typography>
          </Box>
        )}

      </Box>

    </Box>
  );
}


export default App;