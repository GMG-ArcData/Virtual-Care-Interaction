import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";

import {
  Box,
  Button,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  Switch,
  Typography,
  Paper,
  FormControlLabel,
  Toolbar,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  DialogContentText,
  Autocomplete,
  TextField,
} from "@mui/material";

import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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

const GroupDetails = ({ group, onBack }) => {
  const courseStatus = JSON.parse(group.status);
  const [activeInstructors, setActiveInstructors] = useState([]);
  const [isActive, setIsActive] = useState(courseStatus);
  const [loading, setLoading] = useState(true);
  const [allInstructors, setAllInstructors] = useState([]);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    const fetchActiveInstructors = async () => {
      try {
        const session = await fetchAuthSession();
        var token = session.tokens.idToken
        const response = await fetch(
          `${
            import.meta.env.VITE_API_ENDPOINT
          }admin/courseInstructors?course_id=${group.id}`,
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
          setActiveInstructors(data);
        } else {
          console.error("Failed to fetch courses:", response.statusText);
        }
      } catch (error) {
        console.error("Error fetching courses:", error);
      }
    };
    const fetchInstructors = async () => {
      try {
        const session = await fetchAuthSession();
        var token = session.tokens.idToken
        //replace if analytics for admin actions is needed
        const response = await fetch(
          `${
            import.meta.env.VITE_API_ENDPOINT
          }admin/instructors?instructor_email=replace`,
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
          setAllInstructors(data);
        } else {
          console.error("Failed to fetch courses:", response.statusText);
        }
      } catch (error) {
        console.error("Error fetching courses:", error);
      }
    };
    fetchActiveInstructors();
    fetchInstructors();
    setLoading(false);
  }, []);

  const handleConfirmDeleteOpen = () => {
    setConfirmDeleteOpen(true);
  };

  const handleConfirmDeleteClose = () => {
    setConfirmDeleteOpen(false);
  };

  const handleConfirmDelete = async () => {
    handleConfirmDeleteClose();
    handleDelete();
  };

  const handleInstructorsChange = (event, newValue) => {
    // Filter out duplicates
    const uniqueInstructors = Array.from(
      new Map(
        newValue.map((instructor) => [instructor.user_email, instructor])
      ).values()
    );
    setActiveInstructors(uniqueInstructors);
  };

  const handleStatusChange = (event) => {
    setIsActive(event.target.checked);
  };

  const handleDelete = async () => {
    const session = await fetchAuthSession();
    var token = session.tokens.idToken
    const deleteResponse = await fetch(
      `${
        import.meta.env.VITE_API_ENDPOINT
      }admin/delete_course?&course_id=${encodeURIComponent(group.id)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
      }
    );

    if (deleteResponse.ok) {
      const enrollData = await deleteResponse.json();
      toast.success("Simulation Group Successfully Deleted", {
        position: "top-center",
        autoClose: 1000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
      });
      setTimeout(function () {
        onBack();
      }, 1000);
    } else {
      console.error("Failed to update enrolment:", deleteResponse.statusText);
      toast.error("update enrolment Failed", {
        position: "top-center",
        autoClose: 1000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
      });
    }
  };

  const handleSave = async () => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens.idToken

      // Delete existing enrollments
      const deleteResponse = await fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }admin/delete_course_instructor_enrolments?&course_id=${encodeURIComponent(
          group.id
        )}`,
        {
          method: "DELETE",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        }
      );

      if (!deleteResponse.ok) {
        console.error("Failed to update enrolment:", deleteResponse.statusText);
        toast.error("Update enrolment Failed", {
          position: "top-center",
          autoClose: 1000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
        });
        return;
      }
      // Enroll new instructors in parallel
      const enrollPromises = activeInstructors.map((instructor) =>
        fetch(
          `${
            import.meta.env.VITE_API_ENDPOINT
          }admin/enroll_instructor?course_id=${encodeURIComponent(
            group.id
          )}&instructor_email=${encodeURIComponent(instructor.user_email)}`,
          {
            method: "POST",
            headers: {
              Authorization: token,
              "Content-Type": "application/json",
            },
          }
        ).then((enrollResponse) => {
          if (enrollResponse.ok) {
            return enrollResponse.json().then((enrollData) => {
              return { success: true };
            });
          } else {
            console.error(
              "Failed to enroll instructor:",
              enrollResponse.statusText
            );
            toast.error("Enroll Instructor Failed", {
              position: "top-center",
              autoClose: 1000,
              hideProgressBar: false,
              closeOnClick: true,
              pauseOnHover: true,
              draggable: true,
              progress: undefined,
              theme: "colored",
            });
            return { success: false };
          }
        })
      );

      const enrollResults = await Promise.all(enrollPromises);
      const allEnrolledSuccessfully = enrollResults.every(
        (result) => result.success
      );

      if (!allEnrolledSuccessfully) {
        toast.error("Some instructors could not be enrolled", {
          position: "top-center",
          autoClose: 1000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
        });
      } else {
        toast.success("🦄 Enrolment Updated!", {
          position: "top-center",
          autoClose: 1000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
        });
      }

      // Update group access
      const updateCourseAccess = await fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }admin/updateCourseAccess?&course_id=${encodeURIComponent(
          group.id
        )}&access=${encodeURIComponent(isActive)}`,
        {
          method: "POST",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        }
      );

      if (!updateCourseAccess.ok) {
        console.error(
          "Failed to update group access:",
          updateCourseAccess.statusText
        );
        toast.error("Update group access Failed", {
          position: "top-center",
          autoClose: 1000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
        });
      } else {
        console.log(
          "Update group access data:",
          await updateCourseAccess.json()
        );
      }
    } catch (error) {
      console.error("Error in handleSave:", error);
      toast.error("An error occurred", {
        position: "top-center",
        autoClose: 1000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
        transition: "Bounce",
      });
    }
  };

  return (
    <>
      {!loading && (
        <Box
          component="main"
          sx={{ flexGrow: 1, p: 3, marginTop: 1, textAlign: "left" }}
        >
          <Toolbar />
          <Paper sx={{ padding: 2, marginBottom: 2 }}>
            <Typography variant="h4" sx={{ marginBottom: 0 }}>
              {group.group}
            </Typography>
            <Divider sx={{ p: 1, marginBottom: 3 }} />
            <FormControl fullWidth sx={{ marginBottom: 2 }}>
              <Autocomplete
                multiple
                id="autocomplete-instructors"
                options={allInstructors}
                getOptionLabel={(option) =>
                  option.first_name && option.last_name
                    ? `${titleCase(option.first_name)} ${titleCase(
                        option.last_name
                      )}`
                    : option.user_email
                }
                value={activeInstructors}
                onChange={handleInstructorsChange}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Active Instructors"
                    variant="outlined"
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      label={option.user_email}
                      {...getTagProps({ index })}
                      key={option.user_email}
                    />
                  ))
                }
              />
            </FormControl>

            <FormControlLabel
              control={
                <Switch checked={isActive} onChange={handleStatusChange} />
              }
              label={isActive ? "Active" : "Inactive"}
            />
          </Paper>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Button
                variant="contained"
                onClick={onBack}
                sx={{ width: "30%" }}
              >
                Back
              </Button>
            </Grid>
            <Grid item xs={6} sx={{ textAlign: "right" }}>
              <Button
                variant="contained"
                color="red"
                onClick={handleConfirmDeleteOpen}
                sx={{ width: "30%", marginRight: "15px" }}
              >
                Delete
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSave}
                sx={{ width: "30%" }}
              >
                Save
              </Button>
            </Grid>
          </Grid>
          <Dialog
            open={confirmDeleteOpen}
            onClose={handleConfirmDeleteClose}
            aria-labelledby="alert-dialog-title"
            aria-describedby="alert-dialog-description"
          >
            <DialogTitle id="alert-dialog-title">
              {"Confirm Delete"}
            </DialogTitle>
            <DialogContent>
              <DialogContentText id="alert-dialog-description">
                Are you sure you want to delete this group? This action cannot
                be undone.
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleConfirmDeleteClose} color="primary">
                Cancel
              </Button>
              <Button onClick={handleConfirmDelete} color="error">
                Confirm
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      )}
      <ToastContainer />
    </>
  );
};

export default GroupDetails;
