import React, { useState, useEffect } from "react";
import { theme } from "../styles/theme";
import api from "../services/api";

export default function Notes({ docId }) {
  const [notes, setNotes] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load existing notes when component mounts
  useEffect(() => {
    const fetchExistingNotes = async () => {
      try {
        const response = await api.get(`/docs/${docId}/notes`);
        if (response.data.notes && response.data.notes.sections && response.data.notes.sections.length > 0) {
          setNotes(response.data.notes);
        }
      } catch (e) {
        // No notes exist yet, ignore error
      }
    };
    if (docId) {
      fetchExistingNotes();
    }
  }, [docId]);

  const loadNotes = async () => {
    try {
      setIsLoading(true);
      
      // First, try to fetch existing notes from database
      try {
        const existingResponse = await api.get(`/docs/${docId}/notes`);
        if (existingResponse.data.notes && existingResponse.data.notes.sections && existingResponse.data.notes.sections.length > 0) {
          // Notes already exist, use them (no need to regenerate)
          setNotes(existingResponse.data.notes);
          setIsLoading(false);
          return; // Exit early, don't regenerate
        }
      } catch (e) {
        // No notes exist yet, continue to generate
      }

      // Only generate if notes don't exist
      await api.post("/notes", { doc_id: docId });

      // Fetch the newly generated notes
      const response = await api.get(`/docs/${docId}/notes`);
      setNotes(response.data.notes || null);
    } catch (e) {
      console.error(e);
      alert("Failed to load notes.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>📚 Study Notes</h2>
          <p style={styles.subtitle}>
            Organized notes by headings for easy studying
          </p>
        </div>
        <button
          onClick={loadNotes}
          disabled={isLoading}
          style={{
            ...styles.generateButton,
            ...(isLoading ? styles.generateButtonDisabled : {}),
          }}
        >
          {isLoading ? "Generating..." : "✨ Generate Notes"}
        </button>
      </div>

      <div style={styles.content}>
        {isLoading ? (
          <div style={styles.loadingState}>
            <div style={styles.spinner}></div>
            <p style={styles.loadingText}>Generating notes...</p>
          </div>
        ) : notes && notes.sections && notes.sections.length > 0 ? (
          <div style={styles.notesContainer}>
            {notes.sections.map((sec, idx) => (
              <div key={idx} style={styles.section}>
                <div style={styles.sectionHeader}>
                  <h3 style={styles.sectionTitle}>{sec.heading}</h3>
                </div>
                {sec.explanation && (
                  <div style={styles.explanation}>{sec.explanation}</div>
                )}
                {sec.points && sec.points.length > 0 && (
                  <div style={styles.pointsContainer}>
                    <h4 style={styles.pointsTitle}>Key Points:</h4>
                    <ul style={styles.pointsList}>
                      {sec.points.map((point, i) => (
                        <li key={i} style={styles.point}>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📝</div>
            <p style={styles.emptyText}>
              Click "Generate Notes" to create organized notes for your document
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
  notesContainer: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing.xl,
  },
  section: {
    backgroundColor: "#f8fafc",
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.xl,
    border: `1px solid #e2e8f0`,
    transition: "box-shadow 0.3s ease",
  },
  sectionHeader: {
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    margin: 0,
    fontSize: "20px",
    fontWeight: "700",
    color: theme.colors.primary,
    borderBottom: `2px solid ${theme.colors.primary}`,
    paddingBottom: theme.spacing.xs,
  },
  explanation: {
    fontSize: "16px",
    lineHeight: "1.8",
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
    whiteSpace: "pre-wrap",
  },
  pointsContainer: {
    marginTop: theme.spacing.md,
  },
  pointsTitle: {
    margin: `0 0 ${theme.spacing.sm} 0`,
    fontSize: "18px",
    fontWeight: "600",
    color: theme.colors.text.primary,
  },
  pointsList: {
    margin: 0,
    paddingLeft: theme.spacing.xl,
  },
  point: {
    fontSize: "15px",
    lineHeight: "1.8",
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
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

