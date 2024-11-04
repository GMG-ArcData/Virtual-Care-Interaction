import React from "react";
import PropTypes from "prop-types";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { dracula } from "react-syntax-highlighter/dist/cjs/styles/prism";

const AIMessage = ({ message, profilePicture }) => {
  const renderCodeBlock = (code, language) => {
    return (
      <SyntaxHighlighter
        language={language.toLowerCase()}
        style={dracula}
        customStyle={{
          fontSize: "0.85em",
        }}
      >
        {code}
      </SyntaxHighlighter>
    );
  };

  return (
    <div className="ml-16 mb-6 mr-16">
      <div className="flex flex-row flex-start">
        
        <div
          className="w-10 h-10 rounded-full bg-gray-300 flex-shrink-0"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={profilePicture || "/default-profile.png"} 
            alt="Patient profile"
            className="w-full h-full rounded-full"
          />
        </div>
        <div
          className="text-start ml-4 text-black"
          style={{ maxWidth: "61vw", width: "61vw", wordWrap: "break-word" }}
        >
          {message.split("```").map((part, index) => {
            if (index % 2 === 1) {
              const [language, ...codeLines] = part.split("\n");
              const code = codeLines.join("\n");
              return renderCodeBlock(code, language.trim());
            }
            return part;
          })}
        </div>
      </div>
    </div>
  );
};

AIMessage.propTypes = {
  message: PropTypes.string.isRequired,
  profilePicture: PropTypes.string, 
};

export default AIMessage;
