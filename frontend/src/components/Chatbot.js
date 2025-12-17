import React, { useState } from "react";
import { theme } from "../styles/theme";
import api from "../services/api";

export default function Chatbot({ docId }) {
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchingInternetIndex, setSearchingInternetIndex] = useState(null);

  const sendChat = async () => {
    if (!chatInput.trim() || isLoading) return;

    const userMsg = chatInput;
    setChatMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setChatInput("");
    setIsLoading(true);

    try {
      const response = await api.post("/chat", {
        question: userMsg,
        doc_id: docId,
      });

      setChatMessages((prev) => [
        ...prev, 
        { 
          role: "ai", 
          text: response.data.answer,
          offerInternetSearch: response.data.offer_internet_search || false,
          question: userMsg  // Store question for internet search
        }
      ]);
    } catch (e) {
      console.error(e);
      setChatMessages((prev) => [
        ...prev,
        { role: "ai", text: "Sorry, I couldn't process your request. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInternetSearch = async (question, messageIndex) => {
    setSearchingInternetIndex(messageIndex);
    try {
      const response = await api.post("/chat/search-internet", {
        question: question,
      });

      // Update the specific AI message with the internet search result
      setChatMessages((prev) => {
        const updated = [...prev];
        if (updated[messageIndex] && updated[messageIndex].role === "ai") {
          updated[messageIndex] = {
            role: "ai",
            text: response.data.answer,
            source: "internet"
          };
        }
        return updated;
      });
    } catch (e) {
      console.error(e);
      setChatMessages((prev) => [
        ...prev,
        { role: "ai", text: "Sorry, I couldn't fetch results from the internet. Please try again." },
      ]);
    } finally {
      setSearchingInternetIndex(null);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>💬 AI Chatbot</h2>
        <p style={styles.subtitle}>Ask anything about your document</p>
      </div>

      <div style={styles.messagesContainer}>
        {chatMessages.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>🤖</div>
            <p style={styles.emptyText}>
              Start a conversation! Ask questions about your document.
            </p>
          </div>
        ) : (
          chatMessages.map((msg, i) => (
            <div
              key={i}
              style={{
                ...styles.message,
                ...(msg.role === "user" ? styles.userMessage : styles.aiMessage),
              }}
            >
              <div style={styles.messageHeader}>
                <span style={styles.messageRole}>
                  {msg.role === "user" ? "👤 You" : "🤖 AI Tutor"}
                </span>
                {msg.source === "internet" && (
                  <span style={styles.sourceBadge}>🌐 Internet</span>
                )}
              </div>
              <div style={styles.messageText}>{msg.text}</div>
              {msg.offerInternetSearch && !msg.source && (
                <div style={styles.internetSearchContainer}>
                  <button
                    onClick={() => handleInternetSearch(msg.question, i)}
                    disabled={searchingInternetIndex !== null}
                    style={{
                      ...styles.internetSearchButton,
                      ...(searchingInternetIndex === i ? styles.internetSearchButtonLoading : {}),
                      ...(searchingInternetIndex !== null && searchingInternetIndex !== i ? styles.internetSearchButtonDisabled : {})
                    }}
                  >
                    {searchingInternetIndex === i ? "Searching..." : "🌐 Should I fetch the result from internet?"}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div style={{ ...styles.message, ...styles.aiMessage }}>
            <div style={styles.messageHeader}>
              <span style={styles.messageRole}>🤖 AI Tutor</span>
            </div>
            <div style={styles.loadingDots}>
              <span style={styles.loadingDot}></span>
              <span style={{...styles.loadingDot, animationDelay: '0.2s'}}></span>
              <span style={{...styles.loadingDot, animationDelay: '0.4s'}}></span>
            </div>
          </div>
        )}
      </div>

      <div style={styles.inputContainer}>
        <textarea
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your question here... (Press Enter to send)"
          style={styles.input}
          rows="3"
          disabled={isLoading}
        />
        <button
          onClick={sendChat}
          disabled={isLoading || !chatInput.trim()}
          style={{
            ...styles.sendButton,
            ...(isLoading || !chatInput.trim() ? styles.sendButtonDisabled : {}),
          }}
        >
          {isLoading ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "calc(100vh - 120px)",
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    boxShadow: theme.shadows.lg,
    overflow: "hidden",
  },
  header: {
    padding: theme.spacing.xl,
    borderBottom: `1px solid #e2e8f0`,
    backgroundColor: "#f8fafc",
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
  messagesContainer: {
    flex: 1,
    overflowY: "auto",
    padding: theme.spacing.lg,
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing.md,
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
  },
  message: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    maxWidth: "80%",
    wordWrap: "break-word",
  },
  userMessage: {
    alignSelf: "flex-end",
    backgroundColor: theme.colors.primary,
    color: theme.colors.white,
    borderBottomRightRadius: "4px",
  },
  aiMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#f1f5f9",
    color: theme.colors.text.primary,
    borderBottomLeftRadius: "4px",
  },
  messageHeader: {
    marginBottom: theme.spacing.xs,
  },
  messageRole: {
    fontSize: "12px",
    fontWeight: "600",
    opacity: 0.9,
  },
  messageText: {
    fontSize: "15px",
    lineHeight: "1.6",
    whiteSpace: "pre-wrap",
  },
  loadingDots: {
    display: "flex",
    gap: "4px",
    padding: "8px 0",
  },
  loadingDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    backgroundColor: theme.colors.text.muted,
    animation: "bounce 1.4s infinite ease-in-out both",
  },
  inputContainer: {
    padding: theme.spacing.lg,
    borderTop: `1px solid #e2e8f0`,
    backgroundColor: "#f8fafc",
    display: "flex",
    gap: theme.spacing.md,
  },
  input: {
    flex: 1,
    padding: theme.spacing.md,
    border: `1px solid #e2e8f0`,
    borderRadius: theme.borderRadius.md,
    fontSize: "15px",
    fontFamily: "inherit",
    resize: "vertical",
    outline: "none",
    transition: "border-color 0.3s ease",
  },
  sendButton: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: theme.colors.primary,
    color: theme.colors.white,
    border: "none",
    borderRadius: theme.borderRadius.md,
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.3s ease",
    alignSelf: "flex-end",
  },
  sendButtonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  sourceBadge: {
    fontSize: "10px",
    fontWeight: "500",
    opacity: 0.8,
    marginLeft: theme.spacing.xs,
    padding: "2px 6px",
    backgroundColor: "rgba(59, 130, 246, 0.2)",
    borderRadius: "4px",
  },
  internetSearchContainer: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTop: "1px solid #e2e8f0",
  },
  internetSearchButton: {
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    backgroundColor: theme.colors.primary,
    color: theme.colors.white,
    border: "none",
    borderRadius: theme.borderRadius.md,
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.3s ease",
    width: "100%",
  },
  internetSearchButtonLoading: {
    opacity: 0.7,
    cursor: "wait",
  },
  internetSearchButtonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
};

