import React, { useState, useEffect } from "react";
import { theme } from "../styles/theme";
import api from "../services/api";

export default function MCQ({ docId }) {
  const [mcq, setMcq] = useState(null);
  const [mcqLevel, setMcqLevel] = useState("easy");
  const [mcqNum, setMcqNum] = useState(10);
  const [mcqIndex, setMcqIndex] = useState(0);
  const [mcqAnswers, setMcqAnswers] = useState({});
  const [mcqFeedback, setMcqFeedback] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [unlockedLevels, setUnlockedLevels] = useState(["easy"]); // Track unlocked levels
  const [scorePercentage, setScorePercentage] = useState(null); // Track current batch score
  const [showSuccessMessage, setShowSuccessMessage] = useState(false); // Show success message

  // Load difficulty levels from backend when component mounts or docId changes
  useEffect(() => {
    const loadDifficultyLevels = async () => {
      try {
        const response = await api.get(`/docs/${docId}/current-difficulty`, {
          params: { exam_type: "mcq" }
        });
        const { current_difficulty, highest_achieved_level } = response.data;
        
        // Set current level
        setMcqLevel(current_difficulty || "easy");
        
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

  const generateMcq = async () => {
    try {
      setIsLoading(true);
      setMcq(null);
      setMcqIndex(0);
      setMcqAnswers({});
      setMcqFeedback(null);

      await api.post("/mcq", {
        doc_id: docId,
        difficulty: mcqLevel,
        num: mcqNum,
      });

      const response = await api.get(`/docs/${docId}/mcq`);
      setMcq(response.data || {});
    } catch (e) {
      console.error(e);
      alert("Failed to generate MCQs.");
    } finally {
      setIsLoading(false);
    }
  };

  const currentMCQSet =
    mcq && mcq[mcqLevel]
      ? mcq[mcqLevel].slice(mcqIndex, mcqIndex + 5)
      : [];

  const submitMCQ = async () => {
    if (!mcq || !mcq[mcqLevel]) return;

    const feedback = [];
    const batchIds = currentMCQSet.map((q) => q.id);
    const answers = {};

    currentMCQSet.forEach((q) => {
      const userAnswer = mcqAnswers[q.id];
      const correct = q.answer;

      if (userAnswer) {
        answers[q.id] = userAnswer;
      }

      if (!userAnswer) {
        feedback.push({ id: q.id, result: "not answered" });
      } else if (userAnswer === correct) {
        feedback.push({
          id: q.id,
          result: "correct",
          explanation: q.explanation,
          correct,
        });
      } else {
        feedback.push({
          id: q.id,
          result: "wrong",
          explanation: q.explanation,
          correct,
        });
      }
    });

    // Calculate score percentage
    const totalQuestions = feedback.length;
    const correctAnswers = feedback.filter((fb) => fb.result === "correct").length;
    const scorePercent = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
    setScorePercentage(scorePercent);

    setMcqFeedback(feedback);

    // Check if user passed (>= 50%) and unlock next level
    if (scorePercent >= 50) {
      const levelOrder = ["easy", "medium", "hard"];
      const currentLevelIndex = levelOrder.indexOf(mcqLevel);
      
      if (currentLevelIndex < levelOrder.length - 1) {
        // Not on hard level, unlock next level
        const nextLevel = levelOrder[currentLevelIndex + 1];
        if (!unlockedLevels.includes(nextLevel)) {
          setUnlockedLevels([...unlockedLevels, nextLevel]);
        }
      } else if (mcqLevel === "hard") {
        // Completed hard level with >= 50%
        setShowSuccessMessage(true);
      }
    }

    try {
      const response = await api.post("/mcq/save-progress", {
        doc_id: docId,
        difficulty: mcqLevel,
        batch_ids: batchIds,
        answers,
      });
      
      // Reload difficulty levels after saving progress to get latest highest achieved level
      try {
        const difficultyResponse = await api.get(`/docs/${docId}/current-difficulty`, {
          params: { exam_type: "mcq" }
        });
        const { current_difficulty, highest_achieved_level } = difficultyResponse.data;
        
        // Update unlocked levels based on highest achieved level
        const levelOrder = ["easy", "medium", "hard"];
        const highestIndex = levelOrder.indexOf(highest_achieved_level || "easy");
        const unlocked = levelOrder.slice(0, highestIndex + 1);
        setUnlockedLevels(unlocked);
        
        // Update current level if it changed
        if (current_difficulty) {
          setMcqLevel(current_difficulty);
        }
      } catch (e) {
        console.error("Failed to reload difficulty levels:", e);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const nextMCQ = () => {
    setMcqFeedback(null);
    setScorePercentage(null);
    setShowSuccessMessage(false);
    if (!mcq || !mcq[mcqLevel]) return;

    const total = mcq[mcqLevel].length;
    if (mcqIndex + 5 < total) {
      setMcqIndex(mcqIndex + 5);
      setMcqAnswers({});
    } else {
      // Completed all questions in this level
      if (mcqLevel !== "hard" && unlockedLevels.includes(["easy", "medium", "hard"][["easy", "medium", "hard"].indexOf(mcqLevel) + 1])) {
        alert("You've completed all MCQs for this level. You can now select the next level from the dropdown!");
      } else if (mcqLevel === "hard") {
        alert("Congratulations! You've completed all difficulty levels!");
      } else {
        alert("You have completed all MCQs for this difficulty level. Keep practicing to unlock the next level!");
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
          <h2 style={styles.title}>✅ MCQ Practice</h2>
          <p style={styles.subtitle}>Test your knowledge with multiple choice questions</p>
        </div>
        <div style={styles.controls}>
          <div style={styles.controlGroup}>
            <label style={styles.label}>Difficulty:</label>
            <select
              value={mcqLevel}
              onChange={(e) => {
                setMcqLevel(e.target.value);
                setMcqIndex(0);
                setMcqFeedback(null);
                setScorePercentage(null);
                setShowSuccessMessage(false);
                setMcqAnswers({});
              }}
              style={{
                ...styles.select,
                borderColor: getDifficultyColor(mcqLevel),
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
            <label style={styles.label}>Questions: <b>{mcqNum}</b></label>
            <input
              type="range"
              min={5}
              max={20}
              value={mcqNum}
              onChange={(e) => setMcqNum(parseInt(e.target.value, 10))}
              style={styles.slider}
            />
          </div>
          <button
            onClick={generateMcq}
            disabled={isLoading}
            style={{
              ...styles.generateButton,
              ...(isLoading ? styles.generateButtonDisabled : {}),
            }}
          >
            {isLoading ? "Generating..." : "✨ Generate MCQs"}
          </button>
        </div>
      </div>

      <div style={styles.content}>
        {isLoading ? (
          <div style={styles.loadingState}>
            <div style={styles.spinner}></div>
            <p style={styles.loadingText}>Generating MCQs...</p>
          </div>
        ) : currentMCQSet.length > 0 ? (
          <>
            <div style={styles.questionsContainer}>
              {currentMCQSet.map((q, idx) => (
                <div key={q.id} style={styles.questionCard}>
                  <div style={styles.questionHeader}>
                    <span style={styles.questionNumber}>Question {mcqIndex + idx + 1}</span>
                  </div>
                  <p style={styles.questionText}>{q.question}</p>
                  <div style={styles.optionsContainer}>
                    {q.options.map((op) => (
                      <label
                        key={op}
                        style={{
                          ...styles.option,
                          ...(mcqAnswers[q.id] === op
                            ? styles.optionSelected
                            : {}),
                        }}
                      >
                        <input
                          type="radio"
                          name={q.id}
                          value={op}
                          checked={mcqAnswers[q.id] === op}
                          onChange={() =>
                            setMcqAnswers({ ...mcqAnswers, [q.id]: op })
                          }
                          style={styles.radio}
                        />
                        <span>{op}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {!mcqFeedback ? (
              <div style={styles.actionBar}>
                <button onClick={submitMCQ} style={styles.submitButton}>
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
                        ✅ Congratulations! You passed! {mcqLevel !== "hard" ? "You can now progress to the next level." : "You have successfully completed learning the PDF!"}
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

                {mcqFeedback.map((fb) => (
                  <div
                    key={fb.id}
                    style={{
                      ...styles.feedbackCard,
                      ...(fb.result === "correct"
                        ? styles.feedbackCorrect
                        : fb.result === "wrong"
                        ? styles.feedbackWrong
                        : styles.feedbackNotAnswered),
                    }}
                  >
                    <div style={styles.feedbackHeader}>
                      <span style={styles.feedbackResult}>
                        {fb.result === "correct" ? "✅ Correct" : 
                         fb.result === "wrong" ? "❌ Incorrect" : 
                         "⏭️ Not Answered"}
                      </span>
                    </div>
                    {fb.correct && (
                      <p style={styles.feedbackCorrectAnswer}>
                        Correct Answer: {fb.correct}
                      </p>
                    )}
                    {fb.explanation && (
                      <p style={styles.feedbackExplanation}>
                        <strong>Explanation:</strong> {fb.explanation}
                      </p>
                    )}
                  </div>
                ))}
                
                {/* Action buttons */}
                <div style={styles.actionBar}>
                  {scorePercentage !== null && scorePercentage >= 50 && mcqLevel === "hard" && (
                    <div style={styles.completionMessage}>
                      <p style={styles.completionText}>
                        🎊 You've completed all levels! Great job!
                      </p>
                    </div>
                  )}
                  {mcqLevel !== "hard" || (scorePercentage !== null && scorePercentage < 50) ? (
                    <button onClick={nextMCQ} style={styles.nextButton}>
                      {mcqIndex + 5 < (mcq[mcqLevel]?.length || 0) ? "Next 5 Questions →" : "Continue"}
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
              Configure difficulty and number of questions, then click "Generate MCQs"
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
  questionText: {
    fontSize: "18px",
    fontWeight: "600",
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
    lineHeight: "1.6",
  },
  optionsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing.sm,
  },
  option: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    border: `2px solid #e2e8f0`,
    cursor: "pointer",
    transition: "all 0.3s ease",
    backgroundColor: theme.colors.white,
  },
  optionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: "#f0f4ff",
  },
  radio: {
    width: "20px",
    height: "20px",
    cursor: "pointer",
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
  feedbackNotAnswered: {
    backgroundColor: "#fff3cd",
    borderColor: theme.colors.warning,
  },
  feedbackHeader: {
    marginBottom: theme.spacing.sm,
  },
  feedbackResult: {
    fontSize: "16px",
    fontWeight: "700",
  },
  feedbackCorrectAnswer: {
    fontSize: "15px",
    margin: `${theme.spacing.xs} 0`,
    fontWeight: "600",
  },
  feedbackExplanation: {
    fontSize: "15px",
    lineHeight: "1.6",
    marginTop: theme.spacing.sm,
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

