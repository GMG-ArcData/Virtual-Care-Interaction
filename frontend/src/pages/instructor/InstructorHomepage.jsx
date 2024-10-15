import React, { useState, useEffect, useContext } from "react";
import {
  Routes,
  Route,
  useNavigate,
  useParams,
  useLocation,
} from "react-router-dom";
import { fetchAuthSession, fetchUserAttributes } from "aws-amplify/auth";
import {
  Typography,
  Box,
  AppBar,
  Toolbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  TableFooter,
  TablePagination,
  Button,
} from "@mui/material";
import PageContainer from "../Container";
import InstructorHeader from "../../components/InstructorHeader";
import InstructorSidebar from "./InstructorSidebar";
import InstructorAnalytics from "./InstructorAnalytics";
import InstructorEditPatients from "./InstructorEditPatients";
import PromptSettings from "./PromptSettings";
import ViewStudents from "./ViewStudents";
import InstructorModules from "./InstructorModules";
import InstructorNewModule from "./InstructorNewModule";
import StudentDetails from "./StudentDetails";
import { UserContext } from "../../App";
function titleCase(str) {
  if (typeof str !== "string") {
    return str;
  }
  return str
    .toLowerCase()
    .split(" ")
    .map(function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

// group details page
const GroupDetails = () => {
  const location = useLocation();
  const { groupName } = useParams();
  const [selectedComponent, setSelectedComponent] = useState(
    "InstructorAnalytics"
  );
  const { simulation_group_id } = location.state;

  const renderComponent = () => {
    switch (selectedComponent) {
      case "InstructorAnalytics":
        return (
          <InstructorAnalytics groupName={groupName} simulation_group_id={simulation_group_id} />
        );
      case "InstructorEditPatients":
        return (
          <InstructorModules groupName={groupName} simulation_group_id={simulation_group_id} />
        );
      case "PromptSettings":
        return <PromptSettings groupName={groupName} simulation_group_id={simulation_group_id} />;
      case "ViewStudents":
        return <ViewStudents groupName={groupName} simulation_group_id={simulation_group_id} />;
      default:
        return (
          <InstructorAnalytics groupName={groupName} simulation_group_id={simulation_group_id} />
        );
    }
  };

  return (
    <PageContainer>
      <AppBar
        position="fixed"
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
        elevation={1}
      >
        <InstructorHeader />
      </AppBar>
      <InstructorSidebar setSelectedComponent={setSelectedComponent} />
      {renderComponent()}
    </PageContainer>
  );
};

const InstructorHomepage = () => {
  const [rows, setRows] = useState([
    {
      group: "loading...",
      date: "loading...",
      status: "loading...",
      id: "loading...",
    },
  ]);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [groupData, setGroupData] = useState([]);
  const { isInstructorAsStudent } = useContext(UserContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (isInstructorAsStudent) {
      navigate("/");
    }
  }, [isInstructorAsStudent, navigate]);
  // connect to api data
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const session = await fetchAuthSession();
        var token = session.tokens.idToken
        const { email } = await fetchUserAttributes();
        const response = await fetch(
          `${
            import.meta.env.VITE_API_ENDPOINT
          }instructor/groups?email=${encodeURIComponent(email)}`,
          {
            method: "GET",
            headers: {
              Authorization: token,
              "Content-Type": "application/json",
            },
          }
        );
        if (response.ok) {
          console.log(response)
          const data = await response.json();
          setGroupData(data);
          const formattedData = data.map((group) => ({
            group: group.group_name,
            date: new Date().toLocaleDateString(), // REPLACE
            status: group.group_student_access ? "Active" : "Inactive",
            id: group.simulation_group_id,
          }));
          console.log('Formatted Data:', formattedData);
          setRows(formattedData);
        } else {
          console.error("Failed to fetch groups:", response.statusText);
        }
      } catch (error) {
        console.error("Error fetching groups:", error);
      }
    };

    fetchGroups();
  }, []);

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const filteredRows = rows.filter((row) =>
    row.group.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRowClick = (groupName, simulation_group_id) => {
    const group = groupData.find(
      (group) => group.group_name.trim() === groupName.trim()
    );

    if (group) {
      const { simulation_group_id } = group;
      const path = `/group/ ${groupName.trim()}`;
      navigate(path, { state: { simulation_group_id } });
    } else {
      console.error("Group not found!");
    }
  };

  return (
    <Routes>
      <Route
        path="/"
        element={
          <PageContainer>
            <AppBar
              position="fixed"
              sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
              elevation={1}
            >
              <InstructorHeader />
            </AppBar>
            <Box component="main" sx={{ flexGrow: 1, p: 3, marginTop: 1 }}>
              <Toolbar />
              <Typography
                color="black"
                fontStyle="semibold"
                textAlign="left"
                variant="h6"
              >
                Simulation Groups
              </Typography>
              <Paper
                sx={{
                  width: "80%",
                  overflow: "hidden",
                  margin: "0 auto",
                  padding: 2,
                }}
              >
                <TextField
                  label="Search by Group"
                  variant="outlined"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  sx={{ width: "100%", marginBottom: 2 }}
                />
                <TableContainer sx={{ width: "100%", maxHeight: "70vh",
              overflowY: "auto",}}>
                  <Table aria-label="group table">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: "60%", padding: "16px" }}>
                          Group
                        </TableCell>
                        <TableCell sx={{ width: "20%", padding: "16px" }}>
                          Status
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredRows
                        .slice(
                          page * rowsPerPage,
                          page * rowsPerPage + rowsPerPage
                        )
                        .map((row, index) => (
                          <TableRow
                            key={index}
                            onClick={() => handleRowClick(row.group, row.id)}
                            style={{ cursor: "pointer" }}
                          >
                            <TableCell sx={{ padding: "16px" }}>
                              {titleCase(row.group)}
                            </TableCell>
                            <TableCell sx={{ padding: "16px" }}>
                              <Button
                                variant="contained"
                                color={
                                  row.status === "Active"
                                    ? "primary"
                                    : "secondary"
                                }
                              >
                                {row.status}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TablePagination
                          rowsPerPageOptions={[5, 10, 25]}
                          component="div"
                          count={filteredRows.length}
                          rowsPerPage={rowsPerPage}
                          page={page}
                          onPageChange={handleChangePage}
                          onRowsPerPageChange={handleChangeRowsPerPage}
                        />
                      </TableRow>
                    </TableFooter>
                  </Table>
                </TableContainer>
              </Paper>
            </Box>
          </PageContainer>
        }
      />
      <Route exact path=":groupName/*" element={<GroupDetails />} />
      <Route
        path=":groupName/edit-module/:moduleId"
        element={<InstructorEditPatients />}
      />
      <Route path=":groupName/new-module" element={<InstructorNewModule />} />
      <Route
        path=":groupName/student/:studentId"
        element={<StudentDetails />}
      />
    </Routes>
  );
};

export default InstructorHomepage;
