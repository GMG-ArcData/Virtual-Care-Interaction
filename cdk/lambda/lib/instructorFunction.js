const { initializeConnection } = require("./lib.js");
let { SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT, USER_POOL } = process.env;
const {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
} = require("@aws-sdk/client-cognito-identity-provider");

let sqlConnection = global.sqlConnection;

exports.handler = async (event) => {
  const cognito_id = event.requestContext.authorizer.userId;
  const client = new CognitoIdentityProviderClient();
  const userAttributesCommand = new AdminGetUserCommand({
    UserPoolId: USER_POOL,
    Username: cognito_id,
  });
  const userAttributesResponse = await client.send(userAttributesCommand);

  const emailAttr = userAttributesResponse.UserAttributes.find(
    (attr) => attr.Name === "email"
  );
  const userEmailAttribute = emailAttr ? emailAttr.Value : null;
  console.log(userEmailAttribute);

  // Check for query string parameters

  const queryStringParams = event.queryStringParameters || {};
  const queryEmail = queryStringParams.email;
  const instructorEmail = queryStringParams.instructor_email;

  const isUnauthorized =
    (queryEmail && queryEmail !== userEmailAttribute) ||
    (instructorEmail && instructorEmail !== userEmailAttribute);

  if (isUnauthorized) {
    return {
      statusCode: 401,
      headers: {
        "Access-Control-Allow-Headers":
          "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "*",
      },
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }

  const response = {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Headers":
        "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "*",
    },
    body: "",
  };

  // Initialize the database connection if not already initialized
  if (!sqlConnection) {
    await initializeConnection(SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT);
    sqlConnection = global.sqlConnection;
  }

  // Function to format student full names (lowercase and spaces replaced with "_")
  const formatNames = (name) => {
    return name.toLowerCase().replace(/\s+/g, "_");
  };

  function generateAccessCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 16; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code.match(/.{1,4}/g).join("-");
  }

  let data;
  try {
    const pathData = event.httpMethod + " " + event.resource;
    switch (pathData) {
      case "GET /instructor/student_course":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.email
        ) {
          const email = event.queryStringParameters.email;

          // First, get the user_id for the given email
          const userResult = await sqlConnection`
            SELECT user_id FROM "Users" WHERE user_email = ${email};
          `;

          if (userResult.length === 0) {
            response.statusCode = 404;
            response.body = "User not found";
            break;
          }

          const userId = userResult[0].user_id;

          // Now, fetch the courses for that user_id
          data = await sqlConnection`SELECT "Courses".*
            FROM "Enrolments"
            JOIN "Courses" ON "Enrolments".course_id = "Courses".course_id
            WHERE "Enrolments".user_id = ${userId}
            ORDER BY "Courses".course_name, "Courses".course_id;`;

          response.body = JSON.stringify(data);
        } else {
          response.statusCode = 400;
          response.body = "Invalid value";
        }
        break;
      case "GET /instructor/groups":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.email
        ) {
          const instructorEmail = event.queryStringParameters.email;

          try {
            // First, get the user ID using the email
            const userIdResult = await sqlConnection`
                SELECT user_id
                FROM "users"
                WHERE user_email = ${instructorEmail}
                LIMIT 1;
              `;

            const userId = userIdResult[0]?.user_id;

            if (!userId) {
              response.statusCode = 404;
              response.body = JSON.stringify({ error: "Instructor not found" });
              break;
            }

            // Query to get all courses where the instructor is enrolled
            const data = await sqlConnection`
                SELECT g.*
                FROM "enrolments" e
                JOIN "simulation_groups" g ON e.simulation_group_id = g.simulation_group_id
                WHERE e.user_id = ${userId}
                AND e.enrolment_type = 'instructor'
                ORDER BY g.group_name, g.simulation_group_id;
              `;

            response.statusCode = 200;
            response.body = JSON.stringify(data);
          } catch (err) {
            response.statusCode = 500;
            console.error(err);
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "email is required" });
        }
        break;
        case "GET /instructor/analytics":
          if (
              event.queryStringParameters != null &&
              event.queryStringParameters.simulation_group_id
          ) {
              const simulationGroupId = event.queryStringParameters.simulation_group_id;

              try {
                  // Query to get all patients and their message counts, filtering by student role
                  const messageCreations = await sqlConnection`
                      SELECT p.patient_id, p.patient_name, p.patient_number, COUNT(m.message_id) AS message_count
                      FROM "patients" p
                      LEFT JOIN "student_patients" sp ON p.patient_id = sp.patient_id
                      LEFT JOIN "sessions" s ON sp.student_patient_id = s.student_patient_id
                      LEFT JOIN "messages" m ON s.session_id = m.session_id
                      LEFT JOIN "enrolments" e ON sp.enrolment_id = e.enrolment_id
                      LEFT JOIN "users" u ON e.user_id = u.user_id
                      WHERE p.simulation_group_id = ${simulationGroupId}
                      AND 'student' = ANY(u.roles)
                      GROUP BY p.patient_id, p.patient_name, p.patient_number
                      ORDER BY p.patient_number ASC, p.patient_name ASC;
                  `;

                  // Query to get the number of patient accesses using User_Engagement_Log, filtering by student role
                  const patientAccesses = await sqlConnection`
                      SELECT p.patient_id, COUNT(uel.log_id) AS access_count
                      FROM "patients" p
                      LEFT JOIN "user_engagement_log" uel ON p.patient_id = uel.patient_id
                      LEFT JOIN "enrolments" e ON uel.enrolment_id = e.enrolment_id
                      LEFT JOIN "users" u ON e.user_id = u.user_id
                      WHERE p.simulation_group_id = ${simulationGroupId}
                      AND uel.engagement_type = 'patient access'
                      AND 'student' = ANY(u.roles)
                      GROUP BY p.patient_id;
                  `;

                  // Query to get the average score for each patient, filtering by student role
                  const averageScores = await sqlConnection`
                      SELECT p.patient_id, AVG(sp.patient_score) AS average_score
                      FROM "patients" p
                      LEFT JOIN "student_patients" sp ON p.patient_id = sp.patient_id
                      LEFT JOIN "enrolments" e ON sp.enrolment_id = e.enrolment_id
                      LEFT JOIN "users" u ON e.user_id = u.user_id
                      WHERE p.simulation_group_id = ${simulationGroupId}
                      AND 'student' = ANY(u.roles)
                      GROUP BY p.patient_id;
                  `;

                  // Query to get the percentage of perfect scores for each patient, filtering by student role
                  const perfectScores = await sqlConnection`
                      SELECT p.patient_id, 
                          CASE 
                              WHEN COUNT(sp.student_patient_id) = 0 THEN 0 
                              ELSE COUNT(CASE WHEN sp.patient_score = 100 THEN 1 END) * 100.0 / COUNT(sp.student_patient_id)
                          END AS perfect_score_percentage
                      FROM "patients" p
                      LEFT JOIN "student_patients" sp ON p.patient_id = sp.patient_id
                      LEFT JOIN "enrolments" e ON sp.enrolment_id = e.enrolment_id
                      LEFT JOIN "users" u ON e.user_id = u.user_id
                      WHERE p.simulation_group_id = ${simulationGroupId}
                      AND 'student' = ANY(u.roles)
                      GROUP BY p.patient_id;
                  `;

                  // Combine all data into a single response, ensuring all patients are included
                  const analyticsData = messageCreations.map((patient) => {
                      const accesses =
                          patientAccesses.find((pa) => pa.patient_id === patient.patient_id) || {};
                      const scores =
                          averageScores.find((as) => as.patient_id === patient.patient_id) || {};
                      const perfectScore =
                          perfectScores.find((ps) => ps.patient_id === patient.patient_id) || {};

                      return {
                          patient_id: patient.patient_id,
                          patient_name: patient.patient_name,
                          patient_number: patient.patient_number,  // New addition based on schema
                          message_count: patient.message_count || 0,
                          access_count: accesses.access_count || 0,
                          average_score: parseFloat(scores.average_score) || 0,
                          perfect_score_percentage:
                              parseFloat(perfectScore.perfect_score_percentage) || 0,
                      };
                  });

                  response.statusCode = 200;
                  response.body = JSON.stringify(analyticsData);
              } catch (err) {
                  response.statusCode = 500;
                  console.error(err);
                  response.body = JSON.stringify({ error: "Internal server error" });
              }
          } else {
              response.statusCode = 400;
              response.body = JSON.stringify({ error: "simulation_group_id is required" });
          }
          break;
      case "PUT /instructor/update_metadata":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.module_id &&
          event.queryStringParameters.filename &&
          event.queryStringParameters.filetype
        ) {
          const moduleId = event.queryStringParameters.module_id;
          const filename = event.queryStringParameters.filename;
          const filetype = event.queryStringParameters.filetype;
          const { metadata } = JSON.parse(event.body);

          try {
            // Query to find the file with the given module_id and filename
            const existingFile = await sqlConnection`
                      SELECT * FROM "Module_Files"
                      WHERE module_id = ${moduleId}
                      AND filename = ${filename}
                      AND filetype = ${filetype};
                  `;

            if (existingFile.length === 0) {
              const result = await sqlConnection`
                INSERT INTO "Module_Files" (module_id, filename, filetype, metadata)
                VALUES (${moduleId}, ${filename}, ${filetype}, ${metadata})
                RETURNING *;
              `;
              response.body = JSON.stringify({
                message: "File metadata added successfully",
              });
            }

            // Update the metadata field
            const result = await sqlConnection`
                      UPDATE "Module_Files"
                      SET metadata = ${metadata}
                      WHERE module_id = ${moduleId}
                      AND filename = ${filename}
                      AND filetype = ${filetype}
                      RETURNING *;
                  `;

            if (result.length > 0) {
              response.statusCode = 200;
              response.body = JSON.stringify(result[0]);
            } else {
              response.statusCode = 500;
              response.body = JSON.stringify({
                error: "Failed to update metadata.",
              });
            }
          } catch (err) {
            response.statusCode = 500;
            console.error(err);
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "module_id and filename are required",
          });
        }
        break;
      case "POST /instructor/create_module":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.course_id &&
          event.queryStringParameters.concept_id &&
          event.queryStringParameters.module_name &&
          event.queryStringParameters.module_number &&
          event.queryStringParameters.instructor_email
        ) {
          const {
            course_id,
            concept_id,
            module_name,
            module_number,
            instructor_email,
          } = event.queryStringParameters;

          try {
            // Check if a module with the same name already exists
            const existingModule = await sqlConnection`
                    SELECT * FROM "Course_Modules"
                    WHERE concept_id = ${concept_id}
                    AND module_name = ${module_name};
                  `;

            if (existingModule.length > 0) {
              response.statusCode = 400;
              response.body = JSON.stringify({
                error:
                  "A module with this name already exists in the given concept.",
              });
              break;
            }

            // Insert new module into Course_Modules table
            const newModule = await sqlConnection`
                    INSERT INTO "Course_Modules" (module_id, concept_id, module_name, module_number)
                    VALUES (uuid_generate_v4(), ${concept_id}, ${module_name}, ${module_number})
                    RETURNING *;
                  `;

            // Insert into User Engagement Log
            await sqlConnection`
                  INSERT INTO "User_Engagement_Log" (log_id, user_id, course_id, module_id, enrolment_id, timestamp, engagement_type)
                  VALUES (uuid_generate_v4(), (SELECT user_id FROM "Users" WHERE user_email = ${instructor_email}), ${course_id}, ${newModule[0].module_id}, null, CURRENT_TIMESTAMP, 'instructor_created_module')
              `;

            // Find all student enrolments for the given course_id
            const enrolments = await sqlConnection`
                    SELECT enrolment_id FROM "Enrolments"
                    WHERE course_id = ${course_id};
                  `;

            // Create Student_Module entries for each enrolment
            await Promise.all(
              enrolments.map(async (enrolment) => {
                await sqlConnection`
                      INSERT INTO "Student_Modules" (student_module_id, course_module_id, enrolment_id, module_score)
                      VALUES (uuid_generate_v4(), ${newModule[0].module_id}, ${enrolment.enrolment_id}, 0);
                    `;
              })
            );

            response.statusCode = 201;
            response.body = JSON.stringify(newModule[0]);
          } catch (err) {
            response.statusCode = 500;
            console.log(err);
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error:
              "course_id, concept_id, module_name, module_number, or instructor_email is missing",
          });
        }
        break;
      case "PUT /instructor/reorder_patient":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.patient_id &&
          event.queryStringParameters.patient_number &&
          event.queryStringParameters.instructor_email
        ) {
          const { patient_id, patient_number, instructor_email } =
            event.queryStringParameters;
          const { patient_name } = JSON.parse(event.body || "{}");

          if (patient_name) {
            try {
              // Update the patient in the patients table
              await sqlConnection`
                    UPDATE "patients"
                    SET patient_name = ${patient_name}, patient_number = ${patient_number}
                    WHERE patient_id = ${patient_id};
                  `;

              // Insert into User Engagement Log
              await sqlConnection`
                    INSERT INTO "user_engagement_log" (log_id, user_id, simulation_group_id, patient_id, enrolment_id, timestamp, engagement_type)
                    VALUES (uuid_generate_v4(), (SELECT user_id FROM "users" WHERE user_email = ${instructor_email}), NULL, ${patient_id}, NULL, CURRENT_TIMESTAMP, 'instructor_edited_module');
                  `;

              response.statusCode = 200;
              response.body = JSON.stringify({
                message: "Patient updated successfully",
              });
            } catch (err) {
              response.statusCode = 500;
              console.error(err);
              response.body = JSON.stringify({
                error: "Internal server error",
              });
            }
          } else {
            response.statusCode = 400;
            response.body = JSON.stringify({
              error: "patient_name is required in the body",
            });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error:
              "patient_id, patient_number, or instructor_email is missing in query string parameters",
          });
        }
        break;
      case "PUT /instructor/edit_module":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.module_id &&
          event.queryStringParameters.instructor_email &&
          event.queryStringParameters.concept_id
        ) {
          const { module_id, instructor_email, concept_id } =
            event.queryStringParameters;
          const { module_name } = JSON.parse(event.body || "{}");

          if (module_name) {
            try {
              // Check if another module with the same name already exists under the same concept
              const existingModule = await sqlConnection`
                    SELECT * FROM "Course_Modules"
                    WHERE concept_id = ${concept_id}
                    AND module_name = ${module_name}
                    AND module_id != ${module_id};
                  `;

              if (existingModule.length > 0) {
                response.statusCode = 400;
                response.body = JSON.stringify({
                  error:
                    "A module with this name already exists under the same concept.",
                });
                break;
              }

              // Update the module in the Course_Modules table
              await sqlConnection`
                    UPDATE "Course_Modules"
                    SET module_name = ${module_name}, concept_id = ${concept_id}
                    WHERE module_id = ${module_id};
                  `;

              // Insert into User Engagement Log
              await sqlConnection`
                    INSERT INTO "User_Engagement_Log" (log_id, user_id, course_id, module_id, enrolment_id, timestamp, engagement_type)
                    VALUES (uuid_generate_v4(), (SELECT user_id FROM "Users" WHERE user_email = ${instructor_email}), NULL, ${module_id}, NULL, CURRENT_TIMESTAMP, 'instructor_edited_module');
                  `;

              response.statusCode = 200;
              response.body = JSON.stringify({
                message: "Module updated successfully",
              });
            } catch (err) {
              response.statusCode = 500;
              console.error(err);
              response.body = JSON.stringify({
                error: "Internal server error",
              });
            }
          } else {
            response.statusCode = 400;
            response.body = JSON.stringify({
              error: "module_name is required in the body",
            });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error:
              "module_id, instructor_email, or concept_id is missing in query string parameters",
          });
        }
        break;
      case "PUT /instructor/prompt":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.course_id &&
          event.queryStringParameters.instructor_email &&
          event.body
        ) {
          try {
            const { course_id, instructor_email } = event.queryStringParameters;
            const { prompt } = JSON.parse(event.body);

            // Retrieve the current system prompt
            const currentPromptResult = await sqlConnection`
                      SELECT system_prompt
                      FROM "Courses"
                      WHERE course_id = ${course_id};
                    `;

            if (currentPromptResult.length === 0) {
              response.statusCode = 404;
              response.body = JSON.stringify({ error: "Course not found" });
              break;
            }

            const oldPrompt = currentPromptResult[0].system_prompt;

            // Update system prompt for the course in Courses table
            const updatedCourse = await sqlConnection`
                      UPDATE "Courses"
                      SET system_prompt = ${prompt}
                      WHERE course_id = ${course_id}
                      RETURNING *;
                    `;

            // Insert into User Engagement Log with old prompt in engagement_details
            await sqlConnection`
                      INSERT INTO "User_Engagement_Log" (
                        log_id,
                        user_id,
                        course_id,
                        module_id,
                        enrolment_id,
                        timestamp,
                        engagement_type,
                        engagement_details
                      )
                      VALUES (
                        uuid_generate_v4(),
                        (SELECT user_id FROM "Users" WHERE user_email = ${instructor_email}),
                        ${course_id},
                        null,
                        null,
                        CURRENT_TIMESTAMP,
                        'instructor_updated_prompt',
                        ${oldPrompt}
                      );
                    `;

            response.body = JSON.stringify(updatedCourse[0]);
          } catch (err) {
            response.statusCode = 500;
            console.log(err);
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body =
            "course_id, instructor_email, or request body is missing";
        }
        break;
      case "GET /instructor/view_students":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.course_id
        ) {
          const { course_id } = event.queryStringParameters;

          try {
            // Query to get all students enrolled in the given course
            const enrolledStudents = await sqlConnection`
                    SELECT u.user_email, u.username, u.first_name, u.last_name
                    FROM "Enrolments" e
                    JOIN "Users" u ON e.user_id = u.user_id  -- Change to use user_id
                    WHERE e.course_id = ${course_id} AND e.enrolment_type = 'student';
                  `;

            response.statusCode = 200;
            response.body = JSON.stringify(enrolledStudents);
          } catch (err) {
            response.statusCode = 500;
            console.error(err);
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "course_id is required" });
        }
        break;
      case "DELETE /instructor/delete_student":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.course_id &&
          event.queryStringParameters.instructor_email &&
          event.queryStringParameters.user_email
        ) {
          const { course_id, instructor_email, user_email } =
            event.queryStringParameters;

          try {
            // Step 1: Get the user ID from the user email
            const userResult = await sqlConnection`
                  SELECT user_id
                  FROM "Users"
                  WHERE user_email = ${user_email}
                  LIMIT 1;
              `;

            const userId = userResult[0]?.user_id;

            if (!userId) {
              response.statusCode = 404;
              response.body = JSON.stringify({
                error: "User not found",
              });
              break;
            }

            // Step 2: Delete the student from the course enrolments
            const deleteResult = await sqlConnection`
                  DELETE FROM "Enrolments"
                  WHERE course_id = ${course_id}
                    AND user_id = ${userId}  -- Use user_id instead of user_email
                    AND enrolment_type = 'student'
                  RETURNING *;
              `;

            if (deleteResult.length > 0) {
              response.statusCode = 200; // Set status to 200 on successful deletion
              response.body = JSON.stringify(deleteResult[0]);

              // Step 3: Insert into User Engagement Log
              await sqlConnection`
                    INSERT INTO "User_Engagement_Log" (log_id, user_id, course_id, module_id, enrolment_id, timestamp, engagement_type)
                    VALUES (uuid_generate_v4(), ${userId}, ${course_id}, null, null, CURRENT_TIMESTAMP, 'instructor_deleted_student')
                `;
            } else {
              response.statusCode = 404;
              response.body = JSON.stringify({
                error: "Student not found in the course",
              });
            }
          } catch (err) {
            response.statusCode = 500;
            console.error(err);
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "course_id, user_email, and instructor_email are required",
          });
        }
        break;
        case "GET /instructor/view_patients":
          if (
              event.queryStringParameters != null &&
              event.queryStringParameters.simulation_group_id
          ) {
              const { simulation_group_id } = event.queryStringParameters;
      
              try {
                  // Query to get all patients for the given simulation group
                  const simulationPatients = await sqlConnection`
                      SELECT p.patient_id, p.patient_name, p.patient_age, p.patient_gender
                      FROM "patients" p
                      WHERE p.simulation_group_id = ${simulation_group_id}
                      ORDER BY p.patient_name ASC;
                  `;
      
                  response.statusCode = 200;
                  response.body = JSON.stringify(simulationPatients);
              } catch (err) {
                  response.statusCode = 500;
                  console.error(err);
                  response.body = JSON.stringify({ error: "Internal server error" });
              }
          } else {
              response.statusCode = 400;
              response.body = JSON.stringify({ error: "simulation_group_id is required" });
          }
          break;
      case "DELETE /instructor/delete_module":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.module_id
        ) {
          const moduleId = event.queryStringParameters.module_id;

          try {
            // Delete the module from the Course_Modules table
            await sqlConnection`
                DELETE FROM "Course_Modules"
                WHERE module_id = ${moduleId};
              `;

            response.statusCode = 200;
            response.body = JSON.stringify({
              message: "Module deleted successfully",
            });
          } catch (err) {
            response.statusCode = 500;
            console.error(err);
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "module_id is required" });
        }
        break;
      case "GET /instructor/get_prompt":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.course_id
        ) {
          try {
            const { course_id } = event.queryStringParameters;

            // Retrieve the system prompt from the Courses table
            const coursePrompt = await sqlConnection`
                    SELECT system_prompt 
                    FROM "Courses"
                    WHERE course_id = ${course_id};
                  `;

            if (coursePrompt.length > 0) {
              response.statusCode = 200;
              response.body = JSON.stringify(coursePrompt[0]);
            } else {
              response.statusCode = 404;
              response.body = JSON.stringify({ error: "Course not found" });
            }
          } catch (err) {
            response.statusCode = 500;
            console.error(err);
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = "course_id is missing";
        }
        break;
      case "GET /instructor/view_student_messages":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.student_email &&
          event.queryStringParameters.course_id
        ) {
          const studentEmail = event.queryStringParameters.student_email;
          const courseId = event.queryStringParameters.course_id;

          try {
            // Step 1: Get the user ID from the user email
            const userResult = await sqlConnection`
                  SELECT user_id
                  FROM "Users"
                  WHERE user_email = ${studentEmail}
                  LIMIT 1;
              `;

            const userId = userResult[0]?.user_id;

            if (!userId) {
              response.statusCode = 404;
              response.body = JSON.stringify({
                error: "User not found",
              });
              break;
            }

            // Step 2: Query to get the student's messages for a specific course
            const messages = await sqlConnection`
                  SELECT m.message_content, m.time_sent, m.student_sent
                  FROM "Messages" m
                  JOIN "Sessions" s ON m.session_id = s.session_id
                  JOIN "Student_Modules" sm ON s.student_module_id = sm.student_module_id
                  JOIN "Enrolments" e ON sm.enrolment_id = e.enrolment_id
                  WHERE e.user_id = ${userId}  -- Use user_id instead of user_email
                  AND e.course_id = ${courseId}
                  ORDER BY m.time_sent;
              `;

            response.statusCode = 200;
            response.body = JSON.stringify(messages);
          } catch (err) {
            response.statusCode = 500;
            console.error(err);
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "student_email and course_id are required",
          });
        }
        break;
      case "PUT /instructor/generate_access_code":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.course_id
        ) {
          const courseId = event.queryStringParameters.course_id;

          try {
            const newAccessCode = generateAccessCode();

            // Update the access code in the Courses table
            const updatedCourse = await sqlConnection`
              UPDATE "Courses"
              SET course_access_code = ${newAccessCode}
              WHERE course_id = ${courseId}
              RETURNING *;
            `;

            response.statusCode = 200;
            response.body = JSON.stringify({
              message: "Access code generated successfully",
              access_code: newAccessCode,
            });
          } catch (err) {
            response.statusCode = 500;
            console.error(err);
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "course_id is required" });
        }
        break;
      case "GET /instructor/get_access_code":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.course_id
        ) {
          const courseId = event.queryStringParameters.course_id;

          try {
            // Query to get the access code
            const accessCode = await sqlConnection`
        SELECT course_access_code
        FROM "Courses"
        WHERE course_id = ${courseId};
      `;

            response.statusCode = 200;
            response.body = JSON.stringify(accessCode[0]);
          } catch (err) {
            response.statusCode = 500;
            console.error(err);
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "course_id is required" });
        }
        break;
      case "GET /instructor/previous_prompts":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.course_id &&
          event.queryStringParameters.instructor_email
        ) {
          try {
            const { course_id, instructor_email } = event.queryStringParameters;

            // Query to get all previous prompts for the given course and instructor
            const previousPrompts = await sqlConnection`
                    SELECT timestamp, engagement_details AS previous_prompt
                    FROM "User_Engagement_Log"
                    WHERE course_id = ${course_id}
                      AND engagement_type = 'instructor_updated_prompt'
                    ORDER BY timestamp DESC;
                  `;

            response.body = JSON.stringify(previousPrompts);
          } catch (err) {
            response.statusCode = 500;
            console.log(err);
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body =
            "course_id or instructor_email query parameter is required";
        }
        break;

      default:
        throw new Error(`Unsupported route: "${pathData}"`);
    }
  } catch (error) {
    response.statusCode = 400;
    response.body = JSON.stringify(error.message);
  }
  console.log(response);

  return response;
};
