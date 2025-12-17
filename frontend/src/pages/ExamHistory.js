// Exam History Page
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function ExamHistory() {
  const { docId } = useParams();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ exam_type: '', difficulty: '' });
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    loadHistory();
  }, [docId, filter]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (docId) params.append('doc_id', docId);
      if (filter.exam_type) params.append('exam_type', filter.exam_type);
      
      const response = await api.get(`/exam-results?${params.toString()}`);
      setResults(response.data.results || []);
    } catch (error) {
      console.error('Failed to load exam history:', error);
      alert('Failed to load exam history.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    try {
      const date = new Date(dateString);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return dateString;
      }
      // Format with timezone awareness
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short',
      });
    } catch {
      return dateString;
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return '#28a745';
    if (score >= 60) return '#ffc107';
    return '#dc3545';
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => navigate(-1)} style={styles.backButton}>
          ← Back
        </button>
        <h1 style={styles.title}>Exam History</h1>
      </div>

      <div style={styles.filters}>
        <select
          value={filter.exam_type}
          onChange={(e) => setFilter({ ...filter, exam_type: e.target.value })}
          style={styles.select}
        >
          <option value="">All Exam Types</option>
          <option value="mcq">MCQ</option>
          <option value="fillups">Fill-ups</option>
        </select>
      </div>

      {loading ? (
        <div style={styles.loading}>Loading exam history...</div>
      ) : results.length === 0 ? (
        <div style={styles.empty}>
          <p>No exam attempts yet. Start practicing to see your results here!</p>
        </div>
      ) : (
        <div style={styles.resultsGrid}>
          {results.map((result) => (
            <div key={result._id} style={styles.resultCard}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>
                  {result.exam_type.toUpperCase()} - {result.difficulty}
                </h3>
                <span style={styles.date}>{formatDate(result.created_at)}</span>
              </div>
              
              <div style={styles.cardBody}>
                <p style={styles.filename}>{result.doc_filename}</p>
                
                <div style={styles.scoreSection}>
                  <div
                    style={{
                      ...styles.scoreCircle,
                      borderColor: getScoreColor(result.score.score_percent),
                    }}
                  >
                    <div style={styles.scorePercent}>
                      {result.score.score_percent}%
                    </div>
                  </div>
                  
                  <div style={styles.scoreDetails}>
                    <p><strong>Total:</strong> {result.score.total}</p>
                    <p style={{ color: '#28a745' }}>
                      <strong>Correct:</strong> {result.score.correct}
                    </p>
                    <p style={{ color: '#dc3545' }}>
                      <strong>Wrong:</strong> {result.score.wrong}
                    </p>
                    <p style={{ color: '#ffc107' }}>
                      <strong>Not Answered:</strong> {result.score.not_answered}
                    </p>
                  </div>
                </div>

                {result.tips && result.tips.length > 0 && (
                  <div style={styles.tipsSection}>
                    <h4 style={styles.tipsTitle}>💡 Tips</h4>
                    <ul style={styles.tipsList}>
                      {result.tips.slice(0, 3).map((tip, idx) => (
                        <li key={idx} style={styles.tipItem}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f7fafc',
    padding: '40px 20px',
  },
  header: {
    maxWidth: '1200px',
    margin: '0 auto 30px',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  backButton: {
    padding: '10px 20px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    transition: 'all 0.3s ease',
  },
  title: {
    margin: 0,
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#1a202c',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  filters: {
    maxWidth: '1200px',
    margin: '0 auto 30px',
  },
  select: {
    padding: '12px 16px',
    fontSize: '16px',
    borderRadius: '8px',
    border: '2px solid #e2e8f0',
    backgroundColor: 'white',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  loading: {
    textAlign: 'center',
    padding: '60px',
    color: '#6c757d',
    fontSize: '18px',
  },
  empty: {
    maxWidth: '1200px',
    margin: '0 auto',
    textAlign: 'center',
    padding: '80px 40px',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
  },
  resultsGrid: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
    gap: '24px',
  },
  resultCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    overflow: 'hidden',
    transition: 'all 0.3s ease',
    border: '1px solid #e2e8f0',
  },
  cardHeader: {
    padding: '20px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
    color: 'white',
  },
  date: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  cardBody: {
    padding: '24px',
  },
  filename: {
    margin: '0 0 20px 0',
    color: '#4a5568',
    fontSize: '14px',
    fontWeight: '500',
  },
  scoreSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  scoreCircle: {
    width: '100px',
    height: '100px',
    borderRadius: '50%',
    border: '4px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    backgroundColor: '#f7fafc',
  },
  scorePercent: {
    fontSize: '28px',
    fontWeight: 'bold',
  },
  scoreDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    fontSize: '14px',
  },
  tipsSection: {
    marginTop: '20px',
    padding: '16px',
    backgroundColor: '#f7fafc',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
  },
  tipsTitle: {
    margin: '0 0 12px 0',
    fontSize: '16px',
    color: '#28a745',
    fontWeight: '600',
  },
  tipsList: {
    margin: 0,
    paddingLeft: '20px',
  },
  tipItem: {
    fontSize: '13px',
    marginBottom: '8px',
    lineHeight: '1.6',
    color: '#4a5568',
  },
};

