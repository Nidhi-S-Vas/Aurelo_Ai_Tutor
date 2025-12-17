// Documents List Page
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function DocumentsList() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/documents');
      setDocuments(response.data.documents || []);
    } catch (error) {
      console.error('Failed to load documents:', error);
      alert('Failed to load documents. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div style={styles.container}>
      {/* Navigation Bar */}
      <nav style={styles.navbar}>
        <div style={styles.navContent}>
          <div style={styles.logo}>
            <h2 style={styles.logoText}>🎓 Aurelo AI Tutor</h2>
          </div>
          <div style={styles.navActions}>
            <span style={styles.welcome}>Welcome, <strong>{user?.username}</strong></span>
            <button onClick={logout} style={styles.logoutButton}>
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div style={styles.content}>
        <h1 style={styles.pageTitle}>My Documents</h1>
        <div style={styles.actionButtons}>
          <button
            onClick={() => navigate('/upload')}
            style={styles.uploadButton}
          >
            + Upload New PDF
          </button>
          <button
            onClick={() => navigate('/exam-history')}
            style={styles.historyButton}
          >
            📊 View Exam History
          </button>
        </div>

        {loading ? (
          <div style={styles.loading}>Loading documents...</div>
        ) : documents.length === 0 ? (
          <div style={styles.empty}>
            <p>No documents yet. Upload your first PDF to get started!</p>
            <button
              onClick={() => navigate('/upload')}
              style={styles.uploadButton}
            >
              Upload PDF
            </button>
          </div>
        ) : (
          <div style={styles.documentsGrid}>
            {documents.map((doc) => (
              <div
                key={doc.doc_id}
                style={styles.documentCard}
                onClick={() => navigate(`/dashboard/${doc.doc_id}`)}
              >
                <h3 style={styles.documentTitle}>{doc.filename}</h3>
                <p style={styles.documentMeta}>
                  Pages: {doc.pages_count || 'N/A'}
                </p>
                <p style={styles.documentDate}>
                  {formatDate(doc.created_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f7fafc',
  },
  navbar: {
    backgroundColor: 'white',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    position: 'sticky',
    top: 0,
    zIndex: 1000,
  },
  navContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px 40px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
  },
  logoText: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 'bold',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  navActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  welcome: {
    color: '#4a5568',
    fontSize: '14px',
  },
  logoutButton: {
    padding: '10px 20px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    transition: 'all 0.3s ease',
  },
  content: {
    padding: '40px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  pageTitle: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#1a202c',
    marginBottom: '30px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  actionButtons: {
    display: 'flex',
    gap: '15px',
    marginBottom: '30px',
    flexWrap: 'wrap',
  },
  uploadButton: {
    padding: '14px 28px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
    transition: 'all 0.3s ease',
  },
  historyButton: {
    padding: '14px 28px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(40, 167, 69, 0.3)',
    transition: 'all 0.3s ease',
  },
  loading: {
    textAlign: 'center',
    padding: '60px',
    color: '#6c757d',
    fontSize: '18px',
  },
  empty: {
    textAlign: 'center',
    padding: '80px 40px',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
  },
  documentsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '24px',
  },
  documentCard: {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    border: '1px solid #e2e8f0',
  },
  documentCardHover: {
    transform: 'translateY(-4px)',
    boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
  },
  documentTitle: {
    margin: '0 0 12px 0',
    color: '#1a202c',
    fontSize: '20px',
    fontWeight: '600',
  },
  documentMeta: {
    margin: '8px 0',
    color: '#4a5568',
    fontSize: '14px',
  },
  documentDate: {
    margin: '8px 0',
    color: '#9ca3af',
    fontSize: '12px',
  },
};

