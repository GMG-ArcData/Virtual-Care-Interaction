import React, { useState } from "react";
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
} from "@mui/material";
import ContactPageIcon from "@mui/icons-material/ContactPage";
import GroupsIcon from "@mui/icons-material/Groups";

const InstructorSidebar = ({ setSelectedComponent }) => {
  const [drawerWidth, setDrawerWidth] = useState(220);

  // Handle resizing functionality
  const handleMouseMove = (e) => {
    const newWidth = e.clientX;
    if (newWidth >= 85 && newWidth <= 400) {
      setDrawerWidth(newWidth);
    }
  };

  const stopResizing = () => {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", stopResizing);
    document.body.style.userSelect = "";
  };

  const startResizing = (e) => {
    e.preventDefault();
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", stopResizing);
    document.body.style.userSelect = "none";
  };

  return (
    <>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: "border-box",
            backgroundColor: "#36bd78", // Same color as admin sidebar
            color: "#FFFFFF", // Text color for contrast
            boxShadow: "none",
            transition: "width 0.2s ease",
            overflowX: "hidden",
          },
        }}
      >
        <Box
          sx={{
            overflow: "hidden",
            paddingTop: 10,
            textAlign: drawerWidth <= 160 ? "center" : "left",
          }}
        >
          <List>
            <ListItem
              button
              onClick={() => setSelectedComponent("InstructorDashboard")}
              sx={{
                "&:hover": {
                  backgroundColor: "rgba(255, 255, 255, 0.15)",
                },
              }}
            >
              <ListItemIcon
                sx={{
                  justifyContent: drawerWidth <= 160 ? "center" : "flex-start",
                  color: "#FFFFFF",
                }}
              >
                <ContactPageIcon />
              </ListItemIcon>
              {drawerWidth > 160 && <ListItemText primary="Dashboard" />}
            </ListItem>

            <Divider sx={{ borderColor: "rgba(255, 255, 255, 0.2)" }} />

            <ListItem
              button
              onClick={() => setSelectedComponent("InstructorGroups")}
              sx={{
                "&:hover": {
                  backgroundColor: "rgba(255, 255, 255, 0.15)",
                },
              }}
            >
              <ListItemIcon
                sx={{
                  justifyContent: drawerWidth <= 160 ? "center" : "flex-start",
                  color: "#FFFFFF",
                }}
              >
                <GroupsIcon />
              </ListItemIcon>
              {drawerWidth > 160 && <ListItemText primary="Groups" />}
            </ListItem>
          </List>
        </Box>
      </Drawer>

      {/* Resizing Handle */}
      <div
        onMouseDown={startResizing}
        style={{
          width: "5px",
          cursor: "col-resize",
          height: "100vh",
          backgroundColor: "transparent",
          position: "absolute",
          top: 0,
          left: drawerWidth,
        }}
      />
    </>
  );
};

export default InstructorSidebar;
