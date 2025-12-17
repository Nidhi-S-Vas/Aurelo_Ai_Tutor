import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { theme } from "../styles/theme";
import Chatbot from "../components/Chatbot";
import Summary from "../components/Summary";
import Notes from "../components/Notes";
import MCQ from "../components/MCQ";
import Fillups from "../components/Fillups";

export default function Dashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("chatbot");

  const menuItems = [
    { id: "chatbot", label: "💬 Chatbot", component: Chatbot },
    { id: "summary", label: "📝 Summary", component: Summary },
    { id: "notes", label: "📚 Notes", component: Notes },
    { id: "mcq", label: "✅ MCQ Practice", component: MCQ },
    { id: "fillups", label: "✍️ Fill in the Blanks", component: Fillups },
  ];

  const ActiveComponent = menuItems.find((item) => item.id === activeTab)?.component || Chatbot;

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h1 style={styles.logo}>🎓 Aurelo AI</h1>
          <p style={styles.logoSubtitle}>Learning Dashboard</p>
        </div>

        <nav style={styles.nav}>
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                ...styles.navItem,
                ...(activeTab === item.id ? styles.navItemActive : {}),
              }}
              onMouseEnter={(e) => {
                if (activeTab !== item.id) {
                  e.currentTarget.style.backgroundColor = "#f8fafc";
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== item.id) {
                  e.currentTarget.style.backgroundColor = "transparent";
                }
              }}
            >
              <span style={styles.navItemText}>{item.label}</span>
            </button>
          ))}
        </nav>

        <div style={styles.sidebarFooter}>
          <button
            onClick={() => navigate("/documents")}
            style={styles.backButton}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#f8fafc";
              e.currentTarget.style.borderColor = theme.colors.primary;
              e.currentTarget.style.color = theme.colors.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.borderColor = "#e2e8f0";
              e.currentTarget.style.color = theme.colors.text.secondary;
            }}
          >
            ← Back to Documents
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={styles.mainContent}>
        <div style={styles.contentWrapper}>
          <ActiveComponent docId={id} />
        </div>
      </main>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    height: "100vh",
    backgroundColor: "#f7fafc",
    overflow: "hidden",
  },
  sidebar: {
    width: "280px",
    backgroundColor: theme.colors.white,
    borderRight: `1px solid #e2e8f0`,
    display: "flex",
    flexDirection: "column",
    boxShadow: theme.shadows.md,
    zIndex: 10,
  },
  sidebarHeader: {
    padding: theme.spacing.xl,
    borderBottom: `1px solid #e2e8f0`,
    background: theme.colors.gradient.primary,
    color: theme.colors.white,
  },
  logo: {
    margin: 0,
    fontSize: "24px",
    fontWeight: "700",
    marginBottom: theme.spacing.xs,
  },
  logoSubtitle: {
    margin: 0,
    fontSize: "14px",
    opacity: 0.9,
  },
  nav: {
    flex: 1,
    padding: theme.spacing.md,
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing.xs,
    overflowY: "auto",
  },
  navItem: {
    padding: theme.spacing.md,
    border: "none",
    borderRadius: theme.borderRadius.md,
    backgroundColor: "transparent",
    color: theme.colors.text.primary,
    fontSize: "16px",
    fontWeight: "500",
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.3s ease",
    display: "flex",
    alignItems: "center",
  },
  navItemActive: {
    backgroundColor: theme.colors.primary,
    color: theme.colors.white,
    boxShadow: theme.shadows.sm,
    transform: "translateX(4px)",
  },
  navItemText: {
    flex: 1,
  },
  sidebarFooter: {
    padding: theme.spacing.md,
    borderTop: `1px solid #e2e8f0`,
  },
  backButton: {
    width: "100%",
    padding: theme.spacing.md,
    border: `1px solid #e2e8f0`,
    borderRadius: theme.borderRadius.md,
    backgroundColor: "transparent",
    color: theme.colors.text.secondary,
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  mainContent: {
    flex: 1,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#f7fafc",
  },
  contentWrapper: {
    flex: 1,
    padding: theme.spacing.xl,
    overflow: "auto",
  },
};
