import React, { useState, useEffect } from "react";
import { theme } from "../styles/theme";
import api from "../services/api";

export default function Fillups({ docId }) {
  const [fillups, setFillups] = useState(null);
  const [fillLevel, setFillLevel] = useState("easy");
  const [fillNum, setFillNum] = useState(10);
  const [fillIndex, setFillIndex] = useState(0);
  const [fillUserAnswers, setFillUserAnswers] = useState({});
  const [fillFeedback, setFillFeedback] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [unlockedLevels, setUnlockedLevels] = useState(["easy"]); // Track unlocked levels
  const [scorePercentage, setScorePercentage] = useState(null); // Track current batch score
  const [showSuccessMessage, setShowSuccessMessage] = useState(false); // Show success message

  // Load difficulty levels from backend when component mounts or docId changes
  useEffect(() => {
    const loadDifficultyLevels = async () => {
      try {
        const response = await api.get(`/docs/${docId}/current-difficulty`, {
          params: { exam_type: "fillups" }
        });
        const { current_difficulty, highest_achieved_level } = response.data;
        
        // Set current level
        setFillLevel(current_difficulty || "easy");
        
        // Set unlocked levels based on highest achieved level
        const levelOrder = ["easy", "medium", "hard"];
        const highestIndex = levelOrder.indexOf(highest_achieved_level || "easy");
        const unlocked = levelOrder.slice(0, highestIndex + 1);
        setUnlockedLevels(unlocked);
      } catch (e) {
        console.error("Failed to load difficulty levels:", e);
        // Keep default values on error
      }
    };
    
    if (docId) {
      loadDifficultyLevels();
    }
  }, [docId]);

  const generateFillups = async () => {
    try {
      setIsLoading(true);
      setFillups(null);
      setFillIndex(0);
      setFillUserAnswers({});
      setFillFeedback(null);

      await api.post("/fillups", {
        doc_id: docId,
        difficulty: fillLevel,
        num: fillNum,
      });

      const response = await api.get(`/docs/${docId}/fillups`);
      setFillups(response.data || {});
    } catch (e) {
      console.error(e);
      alert("Failed to generate fillups.");
    } finally {
      setIsLoading(false);
    }
  };

  const currentFillSet =
    fillups && fillups[fillLevel]
      ? fillups[fillLevel].slice(fillIndex, fillIndex + 5)
      : [];

  const submitFillups = async () => {
    if (!fillups || !fillups[fillLevel]) return;

    const fb = [];
    const batchIds = currentFillSet.map((q) => q.id);
    const answers = {};

    currentFillSet.forEach((q) => {
      const rawUser = (fillUserAnswers[q.id] || "").trim();
      const user = rawUser.toLowerCase();
      const correct = (q.answer || "").trim().toLowerCase();

      if (rawUser) {
        answers[q.id] = rawUser;
      }

      fb.push({
        id: q.id,
        question: q.text,
        user: rawUser,
        correct: q.answer,
        result: user === correct ? "correct" : "wrong",
      });
    });

    // Calculate score percentage
    const totalQuestions = fb.length;
    const correctAnswers = fb.filter((item) => item.result === "correct").length;
    const scorePercent = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
    setScorePercentage(scorePercent);

    setFillFeedback(fb);

    // Check if user passed (>= 50%) and unlock next level
    if (scorePercent >= 50) {
      const levelOrder = ["easy", "medium", "hard"];
      const currentLevelIndex = levelOrder.indexOf(fillLevel);
      
      if (currentLevelIndex < levelOrder.length - 1) {
        // Not on hard level, unlock next level
        const nextLevel = levelOrder[currentLevelIndex + 1];
        if (!unlockedLevels.includes(nextLevel)) {
          setUnlockedLevels([...unlockedLevels, nextLevel]);
        }
      } else if (fillLevel === "hard") {
        // Completed hard level with >= 50%
        setShowSuccessMessage(true);
      }
    }

    try {
      const response = await api.post("/fillups/save-progress", {
        doc_id: docId,
        difficulty: fillLevel,
        batch_ids: batchIds,
        answers,
      });
      
      // Reload difficulty levels after saving progress to get latest highest achieved level
      try {
        const difficultyResponse = await api.get(`/docs/${docId}/current-difficulty`, {
          params: { exam_type: "fillups" }
        });
        const { current_difficulty, highest_achieved_level } = difficultyResponse.data;
        
        // Update unlocked levels based on highest achieved level
        const levelOrder = ["easy", "medium", "hard"];
        const highestIndex = levelOrder.indexOf(highest_achieved_level || "easy");
        const unlocked = levelOrder.slice(0, highestIndex + 1);
        setUnlockedLevels(unlocked);
        
        // Update current level if it changed
        if (current_difficulty) {
          setFillLevel(current_difficulty);
        }
      } catch (e) {
        console.error("Failed to reload difficulty levels:", e);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const nextFill = () => {
    setFillFeedback(null);
    setScorePercentage(null);
    setShowSuccessMessage(false);
    if (!fillups || !fillups[fillLevel]) return;

    const total = fillups[fillLevel].length;
    if (fillIndex + 5 < total) {
      setFillIndex(fillIndex + 5);
      setFillUserAnswers({});
    } else {
      // Completed all questions in this level
      if (fillLevel !== "hard" && unlockedLevels.includes(["easy", "medium", "hard"][["easy", "medium", "hard"].indexOf(fillLevel) + 1])) {
        alert("You've completed all questions for this level. You can now select the next level from the dropdown!");
      } else if (fillLevel === "hard") {
        alert("Congratulations! You've completed all difficulty levels!");
      } else {
        alert("You have completed all questions for this difficulty level. Keep practicing to unlock the next level!");
      }
    }
  };

  const getDifficultyColor = (level) => {
    switch (level) {
      case "easy":
        return "#28a745";
      case "medium":
        return "#ffc107";
      case "hard":
        return "#dc3545";
      default:
        return theme.colors.primary;
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>✍️ Fill in the Blanks</h2>
          <p style={styles.subtitle}>Complete the sentences to test your understanding</p>
        </div>
        <div style={styles.controls}>
          <div style={styles.controlGroup}>
            <label style={styles.label}>Difficulty:</label>
            <select
              value={fillLevel}
              onChange={(e) => {
                setFillLevel(e.target.value);
                setFillIndex(0);
                setFillFeedback(null);
                setScorePercentage(null);
                setShowSuccessMessage(false);
                setFillUserAnswers({});
              }}
              style={{
                ...styles.select,
                borderColor: getDifficultyColor(fillLevel),
              }}
            >
              <option value="easy" disabled={!unlockedLevels.includes("easy")}>
                Easy {unlockedLevels.includes("easy") ? "" : "(Locked)"}
              </option>
              <option value="medium" disabled={!unlockedLevels.includes("medium")}>
                Medium {unlockedLevels.includes("medium") ? "" : "(Locked)"}
              </option>
              <option value="hard" disabled={!unlockedLevels.includes("hard")}>
                Hard {unlockedLevels.includes("hard") ? "" : "(Locked)"}
              </option>
            </select>
          </div>
          <div style={styles.controlGroup}>
            <label style={styles.label}>Questions: <b>{fillNum}</b></label>
            <input
              type="range"
              min={5}
              max={20}
              value={fillNum}
              onChange={(e) => setFillNum(parseInt(e.target.value, 10))}
              style={styles.slider}
            />
          </div>
          <button
            onClick={generateFillups}
            disabled={isLoading}
            style={{
              ...styles.generateButton,
              ...(isLoading ? styles.generateButtonDisabled : {}),
            }}
          >
            {isLoading ? "Generating..." : "✨ Generate Questions"}
          </button>
        </div>
      </div>

      <div style={styles.content}>
        {isLoading ? (
          <div style={styles.loadingState}>
            <div style={styles.spinner}></div>
            <p style={styles.loadingText}>Generating fill-in-the-blanks...</p>
          </div>
        ) : currentFillSet.length > 0 ? (
          <>
            <div style={styles.questionsContainer}>
              {currentFillSet.map((q, idx) => (
                <div key={q.id} style={styles.questionCard}>
                  <div style={styles.questionHeader}>
                    <span style={styles.questionNumber}>Question {fillIndex + idx + 1}</span>
                  </div>
                  <div style={styles.fillupContainer}>
                    <p style={styles.questionText}>{q.text}</p>
                    <input
                      type="text"
                      value={fillUserAnswers[q.id] || ""}
                      onChange={(e) =>
                        setFillUserAnswers({
                          ...fillUserAnswers,
                          [q.id]: e.target.value,
                        })
                      }
                      placeholder="Type your answer here..."
                      style={styles.fillupInput}
                      disabled={!!fillFeedback}
                    />
                  </div>
                </div>
              ))}
            </div>

            {!fillFeedback ? (
              <div style={styles.actionBar}>
                <button onClick={submitFillups} style={styles.submitButton}>
                  Submit Answers
                </button>
              </div>
            ) : (
              <div style={styles.feedbackContainer}>
                <h3 style={styles.feedbackTitle}>Results & Feedback</h3>
                
                {/* Score Display */}
                {scorePercentage !== null && (
                  <div style={{
                    ...styles.scoreDisplay,
                    ...(scorePercentage >= 50 ? styles.scorePass : styles.scoreFail),
                  }}>
                    <h4 style={styles.scoreTitle}>
                      Your Score: {scorePercentage.toFixed(1)}%
                    </h4>
                    {scorePercentage >= 50 ? (
                      <p style={styles.scoreMessage}>
                        ✅ Congratulations! You passed! {fillLevel !== "hard" ? "You can now progress to the next level." : "You have successfully completed learning the PDF!"}
                      </p>
                    ) : (
                      <p style={styles.scoreMessage}>
                        ❌ You need to score at least 50% to pass. Keep practicing on this level!
                      </p>
                    )}
                  </div>
                )}

                {/* Success Message for Hard Level Completion */}
                {showSuccessMessage && (
                  <div style={styles.successBanner}>
                    <h3 style={styles.successTitle}>🎉 Congratulations! 🎉</h3>
                    <p style={styles.successMessage}>
                      You have successfully completed learning the PDF with a score of {scorePercentage.toFixed(1)}%!
                      You've mastered all difficulty levels.
                    </p>
                  </div>
                )}

                {fillFeedback.map((fb) => (
                  <div
                    key={fb.id}
                    style={{
                      ...styles.feedbackCard,
                      ...(fb.result === "correct"
                        ? styles.feedbackCorrect
                        : styles.feedbackWrong),
                    }}
                  >
                    <div style={styles.feedbackHeader}>
                      <span style={styles.feedbackResult}>
                        {fb.result === "correct" ? "✅ Correct" : "❌ Incorrect"}
                      </span>
                    </div>
                    <p style={styles.feedbackQuestion}>{fb.question}</p>
                    <div style={styles.feedbackAnswers}>
                      <p style={styles.feedbackAnswer}>
                        <strong>Your answer:</strong> {fb.user || "(empty)"}
                      </p>
                      <p style={styles.feedbackAnswer}>
                        <strong>Correct answer:</strong> {fb.correct}
                      </p>
                    </div>
                  </div>
                ))}
                
                {/* Action buttons */}
                <div style={styles.actionBar}>
                  {scorePercentage !== null && scorePercentage >= 50 && fillLevel === "hard" && (
                    <div style={styles.completionMessage}>
                      <p style={styles.completionText}>
                        🎊 You've completed all levels! Great job!
                      </p>
                    </div>
                  )}
                  {fillLevel !== "hard" || (scorePercentage !== null && scorePercentage < 50) ? (
                    <button onClick={nextFill} style={styles.nextButton}>
                      {fillIndex + 5 < (fillups[fillLevel]?.length || 0) ? "Next 5 Questions →" : "Continue"}
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📝</div>
            <p style={styles.emptyText}>
              Configure difficulty and number of questions, then click "Generate Questions"
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
  },
  title: {
    margin: `0 0 ${theme.spacing.xs} 0`,
    fontSize: "24px",
    fontWeight: "700",
    color: theme.colors.text.primary,
  },
  subtitle: {
    margin: 0,
    fontSize: "14px",
    color: theme.colors.text.secondary,
  },
  controls: {
    display: "flex",
    gap: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    flexWrap: "wrap",
    alignItems: "flex-end",
  },
  controlGroup: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing.xs,
  },
  label: {
    fontSize: "14px",
    fontWeight: "600",
    color: theme.colors.text.primary,
  },
  select: {
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    border: `2px solid #e2e8f0`,
    borderRadius: theme.borderRadius.md,
    fontSize: "14px",
    outline: "none",
    cursor: "pointer",
    transition: "border-color 0.3s ease",
  },
  slider: {
    width: "150px",
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
  questionsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing.lg,
  },
  questionCard: {
    backgroundColor: "#f8fafc",
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.xl,
    border: `1px solid #e2e8f0`,
  },
  questionHeader: {
    marginBottom: theme.spacing.md,
  },
  questionNumber: {
    fontSize: "14px",
    fontWeight: "600",
    color: theme.colors.primary,
    backgroundColor: theme.colors.white,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
  },
  fillupContainer: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing.md,
  },
  questionText: {
    fontSize: "18px",
    fontWeight: "600",
    color: theme.colors.text.primary,
    lineHeight: "1.6",
  },
  fillupInput: {
    padding: theme.spacing.md,
    border: `2px solid #e2e8f0`,
    borderRadius: theme.borderRadius.md,
    fontSize: "16px",
    outline: "none",
    transition: "border-color 0.3s ease",
    fontFamily: "inherit",
  },
  actionBar: {
    marginTop: theme.spacing.xl,
    display: "flex",
    justifyContent: "center",
  },
  submitButton: {
    padding: `${theme.spacing.md} ${theme.spacing.xxl}`,
    backgroundColor: theme.colors.success,
    color: theme.colors.white,
    border: "none",
    borderRadius: theme.borderRadius.md,
    fontSize: "18px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.3s ease",
    boxShadow: theme.shadows.md,
  },
  nextButton: {
    padding: `${theme.spacing.md} ${theme.spacing.xxl}`,
    backgroundColor: theme.colors.primary,
    color: theme.colors.white,
    border: "none",
    borderRadius: theme.borderRadius.md,
    fontSize: "18px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.3s ease",
    boxShadow: theme.shadows.md,
  },
  feedbackContainer: {
    marginTop: theme.spacing.xl,
  },
  feedbackTitle: {
    fontSize: "20px",
    fontWeight: "700",
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.lg,
  },
  feedbackCard: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    border: `2px solid`,
  },
  feedbackCorrect: {
    backgroundColor: "#d4edda",
    borderColor: theme.colors.success,
  },
  feedbackWrong: {
    backgroundColor: "#f8d7da",
    borderColor: theme.colors.danger,
  },
  feedbackHeader: {
    marginBottom: theme.spacing.sm,
  },
  feedbackResult: {
    fontSize: "16px",
    fontWeight: "700",
  },
  feedbackQuestion: {
    fontSize: "16px",
    fontWeight: "600",
    margin: `${theme.spacing.sm} 0`,
    lineHeight: "1.6",
  },
  feedbackAnswers: {
    marginTop: theme.spacing.sm,
  },
  feedbackAnswer: {
    fontSize: "15px",
    lineHeight: "1.8",
    margin: `${theme.spacing.xs} 0`,
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
  scoreDisplay: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
    border: `2px solid`,
  },
  scorePass: {
    backgroundColor: "#d4edda",
    borderColor: theme.colors.success,
  },
  scoreFail: {
    backgroundColor: "#f8d7da",
    borderColor: theme.colors.danger,
  },
  scoreTitle: {
    margin: `0 0 ${theme.spacing.sm} 0`,
    fontSize: "20px",
    fontWeight: "700",
  },
  scoreMessage: {
    margin: 0,
    fontSize: "16px",
    lineHeight: "1.6",
  },
  successBanner: {
    backgroundColor: "#d1ecf1",
    border: `2px solid ${theme.colors.info}`,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
    textAlign: "center",
  },
  successTitle: {
    margin: `0 0 ${theme.spacing.md} 0`,
    fontSize: "24px",
    fontWeight: "700",
    color: theme.colors.info,
  },
  successMessage: {
    margin: 0,
    fontSize: "18px",
    lineHeight: "1.8",
    color: theme.colors.text.primary,
  },
  completionMessage: {
    marginBottom: theme.spacing.md,
    textAlign: "center",
  },
  completionText: {
    fontSize: "18px",
    fontWeight: "600",
    color: theme.colors.success,
    margin: 0,
  },
};

