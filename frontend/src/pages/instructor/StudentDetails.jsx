import { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import { fetchAuthSession, fetchUserAttributes } from "aws-amplify/auth";
import { toast, ToastContainer } from "react-toastify";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import "react-toastify/dist/ReactToastify.css";
import PageContainer from "../Container";
import {
  Box,
  Typography,
  Divider,
  TextField,
  Button,
  Paper,
  IconButton,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

const handleBackClick = () => {
  window.history.back();
};

// Helper function to format chat messages
const formatMessages = (messages) => {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid Date";
    return date
      .toLocaleDateString(undefined, {
        year: "2-digit",
        month: "2-digit",
        day: "2-digit",
      })
      .replace(/\//g, "-");
  };

  const groupedMessages = messages.reduce((acc, message) => {
    const date = formatDate(message.time_sent);
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(message);
    return acc;
  }, {});

  const formattedMessages = Object.keys(groupedMessages)
    .map((date) => {
      const messagesForDate = groupedMessages[date]
        .map((message) => {
          const speaker = message.student_sent ? "Student" : "LLM";
          return `${speaker}: ${message.message_content.trim()}`;
        })
        .join("\n");

      return `${date}:\n${messagesForDate}`;
    })
    .join("\n\n");

  return formattedMessages;
};

// Mock function for fetching notes (replace with API later)
const fetchNotes = async (studentEmail, simulationGroupId) => {
  // Simulate fetching from an API
  return {
    "Session 1": "Notes for session 1: Patient was responsive and participated actively.",
    "Session 2": "Notes for session 2: Patient was quiet and required more prompts.",
  };
};

const StudentDetails = () => {
  const { studentId } = useParams();
  const location = useLocation();
  const { simulation_group_id, student } = location.state;
  const [tabs, setTabs] = useState([]);
  const [sessions, setSessions] = useState({});
  const [activeTab, setActiveTab] = useState(0);
  const [chatHistory, setChatHistory] = useState("loading...");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notes, setNotes] = useState({}); // Store patient notes
  const textFieldRef = useRef(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const session = await fetchAuthSession();
        const token = session.tokens.idToken;
        const response = await fetch(
          `${
            import.meta.env.VITE_API_ENDPOINT
          }instructor/student_patients_messages?simulation_group_id=${encodeURIComponent(
            simulation_group_id
          )}&student_email=${encodeURIComponent(student.email)}`,
          {
            method: "GET",
            headers: {
              Authorization: token,
              "Content-Type": "application/json",
            },
          }
        );
        if (response.ok) {
          const data = await response.json();
          setSessions(data);
          setTabs(Object.keys(data));
        } else {
          console.error("Failed to fetch student data:", response.statusText);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    const fetchStudentNotes = async () => {
      const fetchedNotes = await fetchNotes(student.email, simulation_group_id);
      setNotes(fetchedNotes);
    };

    fetchHistory();
    fetchStudentNotes();
  }, [simulation_group_id, student.email]);

  useEffect(() => {
    if (textFieldRef.current) {
      textFieldRef.current.scrollTop = textFieldRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleDialogOpen = () => {
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
  };

  const handleUnenroll = async () => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens.idToken;
      const { email } = await fetchUserAttributes();
      const response = await fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }instructor/delete_student?simulation_group_id=${encodeURIComponent(
          simulation_group_id
        )}&user_email=${encodeURIComponent(
          student.email
        )}&instructor_email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        }
      );
      if (response.ok) {
        toast.success("Student unenrolled successfully", {
          position: "top-center",
          autoClose: 1000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
        });
        setTimeout(() => {
          window.history.back();
        }, 1000);
      } else {
        toast.error("Failed to unenroll student", {
          position: "top-center",
          autoClose: 1000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
        });
        console.error("Failed to unenroll student:", response.statusText);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  return (
    <>
      <PageContainer>
        <IconButton
          onClick={handleBackClick}
          sx={{ position: "absolute", top: 44, left: 30 }}
          aria-label="Go back"
        >
          <ArrowBackIcon />
        </IconButton>
        <Paper
          sx={{
            width: "100%",
            overflow: "auto",
            padding: 2,
            overflowY: "scroll",
            marginTop: 4,
          }}
        >
          <Box mb={2} sx={{ flexGrow: 1, p: 3, textAlign: "left", mt: 6 }}>
            <Typography variant="h5">Student Name: {studentId}</Typography>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body1">Email: {student.email}</Typography>

            <Button
              onClick={handleDialogOpen}
              sx={{ marginBottom: 6 }}
              variant="contained"
              color="primary"
            >
              Unenroll Student
            </Button>

            <Dialog
              open={dialogOpen}
              onClose={handleDialogClose}
              aria-labelledby="confirm-unenroll-dialog"
            >
              <DialogTitle id="confirm-unenroll-dialog">
                Confirm Unenroll
              </DialogTitle>
              <DialogContent>
                <DialogContentText>
                  Are you sure you want to unenroll the student from this
                  simulation group?
                </DialogContentText>
              </DialogContent>
              <DialogActions>
                <Button onClick={handleDialogClose} color="primary">
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    handleDialogClose();
                    handleUnenroll();
                  }}
                  color="error"
                >
                  Confirm
                </Button>
              </DialogActions>
            </Dialog>

            <Typography variant="h5" sx={{ mb: 2 }}>
              Chat History:
            </Typography>

            <Box
              sx={{
                borderBottom: 1,
                borderColor: "divider",
                overflowX: "auto",
              }}
            >
              <Tabs
                value={activeTab}
                onChange={(_, newValue) => setActiveTab(newValue)}
                variant="scrollable"
                scrollButtons="auto"
              >
                {tabs.map((tabName, index) => (
                  <Tab key={index} label={tabName} />
                ))}
              </Tabs>
            </Box>

            {sessions[tabs[activeTab]]?.length > 0 ? (
              sessions[tabs[activeTab]].map((session, index) => (
                <Accordion key={index}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>{session.sessionName}</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <TextField
                      label="Chat History"
                      variant="outlined"
                      fullWidth
                      multiline
                      rows={10}
                      value={formatMessages(session.messages)}
                      InputProps={{
                        readOnly: true,
                      }}
                      sx={{ my: 2 }}
                      inputRef={textFieldRef}
                    />

                    {/* Display patient-specific notes */}
                    <Typography variant="h6">Notes</Typography>
                    <Paper
                      sx={{
                        padding: 2,
                        backgroundColor: "#f1f1f1",
                      }}
                    >
                      <Typography variant="body1">
                        {notes[session.sessionName] || "No notes available."}
                      </Typography>
                    </Paper>
                  </AccordionDetails>
                </Accordion>
              ))
            ) : (
              <Typography sx={{ ml: 2, mt: 4 }} variant="body1">
                Student has not entered any simulation groups yet.
              </Typography>
            )}
          </Box>
        </Paper>
      </PageContainer>
      <ToastContainer />
    </>
  );
};

export default StudentDetails;
