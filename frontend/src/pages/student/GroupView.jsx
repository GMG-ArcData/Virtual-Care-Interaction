import React, { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { fetchUserAttributes } from "aws-amplify/auth";

import { BiCheck } from "react-icons/bi";
import { FaInfoCircle } from "react-icons/fa";

import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

// Function to calculate the color based on the average score
const calculateColor = (score) => {
  if (score === null) {
    return "bg-red-500"; // Red for null scores
  }

  const redStart = 255; // Starting red component for red
  const redMiddle = 255; // Red component for less vibrant yellow
  const redEnd = 0; // Ending red component for green

  const greenStart = 0; // Starting green component for red
  const greenMiddle = 200; // Less vibrant yellow (lower green component)
  const greenEnd = 150; // Ending green component for green

  const blueStart = 0; // Starting blue component for red
  const blueMiddle = 0; // Blue component for less vibrant yellow
  const blueEnd = 0; // Ending blue component for green

  let r, g, b;

  if (score <= 50) {
    // Transition from red to less vibrant yellow
    const ratio = score / 50; // Ratio from 0 to 1
    r = redStart;
    g = greenStart + ratio * (greenMiddle - greenStart);
    b = blueStart + ratio * (blueMiddle - blueStart);
  } else {
    // Transition from less vibrant yellow to green
    const ratio = (score - 50) / 50; // Ratio from 0 to 1
    r = redMiddle + ratio * (redEnd - redMiddle);
    g = greenMiddle + ratio * (greenEnd - greenMiddle);
    b = blueMiddle + ratio * (blueEnd - blueMiddle);
  }

  return `rgb(${r}, ${g}, ${b})`;
};

function titleCase(str) {
  if (typeof str !== "string") {
    return str;
  }
  return str
    .split(" ")
    .map(function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1); // Capitalize only the first letter, leave the rest of the word unchanged
    })
    .join(" ");
}

export const GroupView = ({ group, setPatient, setGroup }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const enterPatient = (patient) => {
    setPatient(patient);
    sessionStorage.setItem("patient", JSON.stringify(patient));
    navigate(`/student_chat`);
  };

  const handleBack = () => {
    sessionStorage.removeItem("group");
    navigate("/home");
  };

  useEffect(() => {
    const fetchGroupPage = async () => {
      try {
        const session = await fetchAuthSession();
        const { email } = await fetchUserAttributes();

        const token = session.tokens.idToken;
        const response = await fetch(
          `${
            import.meta.env.VITE_API_ENDPOINT
          }student/simulation_group_page?email=${encodeURIComponent(
            email
          )}&simulation_group_id=${encodeURIComponent(
            group.simulation_group_id
          )}`,
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
          setData(data);
          setLoading(false);
          console.log(data);
        } else {
          console.error("Failed to fetch name:", response.statusText);
        }
      } catch (error) {
        console.error("Error fetching name:", error);
      }
    };
    fetchGroupPage();
  }, [group]);

  useEffect(() => {
    sessionStorage.removeItem("patient");
    const storedGroup = sessionStorage.getItem("group");
    if (storedGroup) {
      setGroup(JSON.parse(storedGroup));
    }
  }, [setGroup]);

  if (loading) {
    return (
      <div className="bg-[#F8F9FD] w-screen flex justify-center items-center h-screen">
        <l-cardio
          size="50" // pulse for loading animation
          stroke="4"
          speed="2"
          color="black"
        ></l-cardio>
      </div>
    );
  }

  if (!group) {
    return <div>Loading...</div>;
  }

  return (
    <div className="bg-[#F8F9FD] w-screen h-screen">
      <header className="bg-[#F8F9FD] p-2 flex justify-between items-center max-h-20">
        <div className="text-black text-xl font-roboto font-semibold p-2 flex flex-row">
          <img
            onClick={() => handleBack()}
            className="mt-1 mr-2 w-6 h-6 cursor-pointer"
            src="./ArrowCircleDownRounded.png"
            alt="back"
          />
        </div>
      </header>
      <div className="flex flex-col">
        <div className="text-black text-start text-xl font-roboto font-semibold p-2 ml-4">
          Patients
        </div>
        <div className="flex justify-center items-center">
          {data.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No patients to display
            </div>
          ) : (
            <TableContainer
              component={Paper}
              sx={{
                width: "80%",
                maxHeight: "60vh",
                overflowY: "auto",
                marginX: 2,
              }}
            >
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontSize: "1.1rem" }}>Patient</TableCell>
                    <TableCell sx={{ fontSize: "1.1rem" }}>Completion</TableCell>
                    <TableCell sx={{ fontSize: "1.1rem" }}>Review</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.map((entry, index) => (
                    <TableRow key={entry.patient_id + index}>
                      <TableCell sx={{ fontSize: "1rem" }}>
                        <div className="flex flex-row gap-3 items-center">
                          {/* Placeholder for patient profile picture */}
                          <div
                            className="w-10 h-10 rounded-full bg-gray-300"
                            style={{
                              backgroundColor: "#e0e0e0",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.8rem",
                              color: "#757575",
                            }}
                          >
                            {/* Placeholder text or image */}
                            <span>IMG</span>
                          </div>
                          <div className="flex flex-row items-center gap-1">
                            <FaInfoCircle className="text-xs" />
                            <span className="text-base">
                              {titleCase(entry.patient_name)}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell sx={{ fontSize: "1rem" }}>
                        {entry.patient_score === 100 ? (
                          <span
                            className="bg-[#2E7D32] text-white text-light rounded px-2 py-2"
                            style={{ display: "inline-block" }}
                          >
                            Complete
                          </span>
                        ) : (
                          "Incomplete"
                        )}
                      </TableCell>
                      <TableCell sx={{ fontSize: "1rem" }}>
                        <Button
                          variant="contained"
                          color="primary"
                          onClick={() => enterPatient(entry)}
                          sx={{ textTransform: "none", fontSize: "0.9rem" }}
                        >
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupView;
