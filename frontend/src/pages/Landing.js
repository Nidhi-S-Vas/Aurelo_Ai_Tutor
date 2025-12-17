// Landing Page - Modern and Professional
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/documents');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div style={styles.container}>
      {/* Navigation Bar */}
      <nav style={styles.navbar}>
        <div style={styles.navContent}>
          <div style={styles.logo}>
            <h2 style={styles.logoText}>🎓 Aurelo AI Tutor</h2>
          </div>
          <div style={styles.navLinks}>
            <Link to="/login" style={styles.navLink}>Login</Link>
            <Link to="/register" style={styles.primaryButton}>Get Started</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <h1 style={styles.heroTitle}>
            Transform Your Learning with
            <span style={styles.highlight}> AI-Powered Tutoring</span>
          </h1>
          <p style={styles.heroSubtitle}>
            Upload your PDF documents and get instant summaries, notes, practice questions, 
            and personalized study tips powered by advanced AI technology.
          </p>
          <div style={styles.heroButtons}>
            <Link to="/register" style={styles.ctaButton}>
              Start Learning Now
            </Link>
            <Link to="/login" style={styles.secondaryButton}>
              Already have an account?
            </Link>
          </div>
        </div>
        <div style={styles.heroImage}>
          <div style={styles.illustration}>
            📚✨
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section style={styles.features}>
        <h2 style={styles.sectionTitle}>Powerful Features</h2>
        <div style={styles.featuresGrid}>
          <div style={styles.featureCard}>
            <div style={styles.featureIcon}>📄</div>
            <h3 style={styles.featureTitle}>Document Analysis</h3>
            <p style={styles.featureText}>
              Upload PDF documents and extract key information instantly
            </p>
          </div>
          <div style={styles.featureCard}>
            <div style={styles.featureIcon}>📝</div>
            <h3 style={styles.featureTitle}>Smart Summaries</h3>
            <p style={styles.featureText}>
              Get comprehensive summaries tailored to document length
            </p>
          </div>
          <div style={styles.featureCard}>
            <div style={styles.featureIcon}>📚</div>
            <h3 style={styles.featureTitle}>Structured Notes</h3>
            <p style={styles.featureText}>
              Organize content with heading-wise notes and key points
            </p>
          </div>
          <div style={styles.featureCard}>
            <div style={styles.featureIcon}>❓</div>
            <h3 style={styles.featureTitle}>Practice Questions</h3>
            <p style={styles.featureText}>
              Generate MCQs and fill-in-the-blank questions for practice
            </p>
          </div>
          <div style={styles.featureCard}>
            <div style={styles.featureIcon}>💬</div>
            <h3 style={styles.featureTitle}>AI Chat</h3>
            <p style={styles.featureText}>
              Ask questions and get answers based on your documents
            </p>
          </div>
          <div style={styles.featureCard}>
            <div style={styles.featureIcon}>📊</div>
            <h3 style={styles.featureTitle}>Progress Tracking</h3>
            <p style={styles.featureText}>
              Track your exam scores and get personalized study tips
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={styles.ctaSection}>
        <h2 style={styles.ctaTitle}>Ready to Start Learning?</h2>
        <p style={styles.ctaText}>
          Join thousands of students improving their study habits with AI
        </p>
        <Link to="/register" style={styles.ctaButtonLarge}>
          Create Free Account
        </Link>
      </section>

      {/* Footer */}
      <footer style={styles.footer}>
        <p style={styles.footerText}>
          © 2024 Aurelo AI Tutor. Built with ❤️ for better learning.
        </p>
      </footer>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#ffffff',
  },
  navbar: {
    backgroundColor: '#ffffff',
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
  navLinks: {
    display: 'flex',
    gap: '15px',
    alignItems: 'center',
  },
  navLink: {
    color: '#333',
    textDecoration: 'none',
    fontSize: '16px',
    padding: '8px 16px',
    borderRadius: '6px',
    transition: 'all 0.3s',
  },
  primaryButton: {
    backgroundColor: '#667eea',
    color: 'white',
    textDecoration: 'none',
    padding: '10px 24px',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: '500',
    transition: 'all 0.3s',
    display: 'inline-block',
  },
  hero: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '80px 40px',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '60px',
    alignItems: 'center',
  },
  heroContent: {
    animation: 'fadeInUp 0.8s ease-out',
  },
  heroTitle: {
    fontSize: '48px',
    fontWeight: 'bold',
    lineHeight: '1.2',
    marginBottom: '20px',
    color: '#1a202c',
  },
  highlight: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  heroSubtitle: {
    fontSize: '20px',
    color: '#4a5568',
    lineHeight: '1.6',
    marginBottom: '40px',
  },
  heroButtons: {
    display: 'flex',
    gap: '20px',
    flexWrap: 'wrap',
  },
  ctaButton: {
    backgroundColor: '#667eea',
    color: 'white',
    textDecoration: 'none',
    padding: '16px 32px',
    borderRadius: '8px',
    fontSize: '18px',
    fontWeight: '600',
    transition: 'all 0.3s',
    display: 'inline-block',
    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    color: '#667eea',
    textDecoration: 'none',
    padding: '16px 32px',
    borderRadius: '8px',
    fontSize: '18px',
    fontWeight: '600',
    border: '2px solid #667eea',
    transition: 'all 0.3s',
    display: 'inline-block',
  },
  heroImage: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  illustration: {
    fontSize: '200px',
    opacity: 0.8,
  },
  features: {
    backgroundColor: '#f7fafc',
    padding: '80px 40px',
  },
  sectionTitle: {
    textAlign: 'center',
    fontSize: '36px',
    fontWeight: 'bold',
    marginBottom: '60px',
    color: '#1a202c',
  },
  featuresGrid: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '30px',
  },
  featureCard: {
    backgroundColor: 'white',
    padding: '40px 30px',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    textAlign: 'center',
    transition: 'all 0.3s',
  },
  featureIcon: {
    fontSize: '48px',
    marginBottom: '20px',
  },
  featureTitle: {
    fontSize: '24px',
    fontWeight: '600',
    marginBottom: '15px',
    color: '#1a202c',
  },
  featureText: {
    fontSize: '16px',
    color: '#4a5568',
    lineHeight: '1.6',
  },
  ctaSection: {
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '80px 40px',
    textAlign: 'center',
    color: 'white',
  },
  ctaTitle: {
    fontSize: '36px',
    fontWeight: 'bold',
    marginBottom: '20px',
  },
  ctaText: {
    fontSize: '20px',
    marginBottom: '40px',
    opacity: 0.9,
  },
  ctaButtonLarge: {
    backgroundColor: 'white',
    color: '#667eea',
    textDecoration: 'none',
    padding: '18px 40px',
    borderRadius: '8px',
    fontSize: '20px',
    fontWeight: '600',
    transition: 'all 0.3s',
    display: 'inline-block',
    boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
  },
  footer: {
    backgroundColor: '#1a202c',
    color: 'white',
    textAlign: 'center',
    padding: '30px',
  },
  footerText: {
    margin: 0,
    fontSize: '14px',
    opacity: 0.8,
  },
};




