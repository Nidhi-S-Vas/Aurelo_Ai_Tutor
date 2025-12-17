import React, { useState, useEffect } from "react";
import { theme } from "../styles/theme";
import api from "../services/api";

export default function Summary({ docId }) {
  const [summary, setSummary] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Load existing summary when component mounts
  useEffect(() => {
    const fetchExistingSummary = async () => {
      try {
        const response = await api.get(`/docs/${docId}/summary`);
        if (response.data.summary && response.data.summary.trim()) {
          setSummary(response.data.summary);
        }
      } catch (e) {
        // No summary exists yet, ignore error
      }
    };
    if (docId) {
      fetchExistingSummary();
    }
  }, [docId]);

  const loadSummary = async () => {
    try {
      setIsLoading(true);
      
      // First, try to fetch existing summary from database
      try {
        const existingResponse = await api.get(`/docs/${docId}/summary`);
        if (existingResponse.data.summary && existingResponse.data.summary.trim()) {
          // Summary already exists, use it (no need to regenerate)
          setSummary(existingResponse.data.summary);
          setIsLoading(false);
          return; // Exit early, don't regenerate
        }
      } catch (e) {
        // No summary exists yet, continue to generate
      }

      // Only generate if summary doesn't exist
      await api.post("/summary", { doc_id: docId });

      // Fetch the newly generated summary
      const response = await api.get(`/docs/${docId}/summary`);
      setSummary(response.data.summary || "");
    } catch (e) {
      console.error(e);
      alert("Failed to load summary.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>📝 Document Summary</h2>
          <p style={styles.subtitle}>
            Get a comprehensive summary of your document
          </p>
        </div>
        <button
          onClick={loadSummary}
          disabled={isLoading}
          style={{
            ...styles.generateButton,
            ...(isLoading ? styles.generateButtonDisabled : {}),
          }}
        >
          {isLoading ? "Generating..." : "✨ Generate Summary"}
        </button>
      </div>

      <div style={styles.content}>
        {isLoading ? (
          <div style={styles.loadingState}>
            <div style={styles.spinner}></div>
            <p style={styles.loadingText}>Generating summary...</p>
          </div>
        ) : summary ? (
          <div style={styles.summaryBox}>
            <div style={styles.summaryText}>{summary}</div>
          </div>
        ) : (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📄</div>
            <p style={styles.emptyText}>
              Click "Generate Summary" to create a summary of your document
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    boxShadow: theme.shadows.lg,
    overflow: "hidden",
    height: "calc(100vh - 120px)",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    padding: theme.spacing.xl,
    borderBottom: `1px solid #e2e8f0`,
    backgroundColor: "#f8fafc",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing.md,
  },
  title: {
    margin: 0,
    fontSize: "24px",
    fontWeight: "700",
    color: theme.colors.text.primary,
  },
  subtitle: {
    margin: `${theme.spacing.xs} 0 0 0`,
    fontSize: "14px",
    color: theme.colors.text.secondary,
  },
  generateButton: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: theme.colors.primary,
    color: theme.colors.white,
    border: "none",
    borderRadius: theme.borderRadius.md,
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.3s ease",
    boxShadow: theme.shadows.sm,
  },
  generateButtonDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  content: {
    flex: 1,
    padding: theme.spacing.xl,
    overflowY: "auto",
  },
  loadingState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  spinner: {
    width: "48px",
    height: "48px",
    border: `4px solid #e2e8f0`,
    borderTop: `4px solid ${theme.colors.primary}`,
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  loadingText: {
    marginTop: theme.spacing.lg,
    fontSize: "16px",
    color: theme.colors.text.secondary,
  },
  summaryBox: {
    backgroundColor: "#f8fafc",
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.xl,
    border: `1px solid #e2e8f0`,
  },
  summaryText: {
    fontSize: "16px",
    lineHeight: "1.8",
    color: theme.colors.text.primary,
    whiteSpace: "pre-wrap",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    color: theme.colors.text.muted,
  },
  emptyIcon: {
    fontSize: "64px",
    marginBottom: theme.spacing.md,
  },
  emptyText: {
    fontSize: "16px",
    textAlign: "center",
    maxWidth: "400px",
  },
};

