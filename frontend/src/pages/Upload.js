import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

export default function Upload() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const nav = useNavigate();
  const { user } = useAuth();

  const uploadPDF = async () => {
    if (!file) {
      setError("Please select a file");
      return;
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError("Please upload a PDF file");
      return;
    }

    const fd = new FormData();
    fd.append("file", file);

    setLoading(true);
    setError("");

    try {
      const response = await api.post("/upload", fd, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.status === "ok") {
        nav(`/dashboard/${response.data.doc_id}`);
      } else {
        setError("Upload failed. Please try again.");
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError(err.response?.data?.detail || "Failed to upload file. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Upload PDF Document</h2>
        <p style={styles.subtitle}>Upload a PDF to generate summaries, notes, and practice questions</p>
        
        {error && (
          <div style={styles.error}>{error}</div>
        )}

        <div style={styles.uploadArea}>
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => {
              setFile(e.target.files[0]);
              setError("");
            }}
            style={styles.fileInput}
          />
          {file && (
            <p style={styles.fileName}>Selected: {file.name}</p>
          )}
        </div>

        <button
          onClick={uploadPDF}
          disabled={!file || loading}
          style={styles.button}
        >
          {loading ? "Processing..." : "Upload PDF"}
        </button>

        <button
          onClick={() => nav("/documents")}
          style={styles.backButton}
        >
          Back to Documents
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#f7fafc",
    padding: "40px 20px",
  },
  nav: {
    maxWidth: "1200px",
    margin: "0 auto 30px",
  },
  backButton: {
    padding: "10px 20px",
    backgroundColor: "#6c757d",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    marginBottom: "20px",
    transition: "all 0.3s ease",
  },
  card: {
    backgroundColor: "white",
    padding: "50px 40px",
    borderRadius: "16px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
    width: "100%",
    maxWidth: "600px",
    margin: "0 auto",
  },
  title: {
    marginBottom: "10px",
    fontSize: "32px",
    fontWeight: "bold",
    color: "#1a202c",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  subtitle: {
    marginBottom: "40px",
    color: "#6c757d",
    fontSize: "16px",
  },
  uploadArea: {
    marginBottom: "30px",
    padding: "40px",
    border: "3px dashed #cbd5e0",
    borderRadius: "12px",
    textAlign: "center",
    backgroundColor: "#f7fafc",
    transition: "all 0.3s ease",
  },
  fileInput: {
    width: "100%",
    padding: "14px",
    marginBottom: "15px",
    border: "2px solid #e2e8f0",
    borderRadius: "8px",
    fontSize: "16px",
    cursor: "pointer",
  },
  fileName: {
    color: "#667eea",
    fontSize: "14px",
    margin: "10px 0",
    fontWeight: "600",
  },
  button: {
    width: "100%",
    padding: "16px",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "18px",
    fontWeight: "600",
    cursor: "pointer",
    marginBottom: "15px",
    boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
    transition: "all 0.3s ease",
  },
  error: {
    backgroundColor: "#fee",
    color: "#c33",
    padding: "16px",
    borderRadius: "8px",
    marginBottom: "20px",
    border: "1px solid #fcc",
    fontSize: "14px",
  },
};
