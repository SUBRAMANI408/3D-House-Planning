import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ templates: 0, modes: 0, preview: 0 });

  useEffect(() => {
    // Animate stats on load
    const timer = setTimeout(() => {
      setStats({ templates: 5, modes: 3, preview: 1 });
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{
      backgroundColor: 'var(--bg-base)',
      minHeight: '100vh',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)',
      overflowX: 'hidden'
    }}>
      <style>{`
        @keyframes bgGradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes float {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(2deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
        @keyframes pulseGlow {
          0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
          70% { box-shadow: 0 0 0 15px rgba(99, 102, 241, 0); }
          100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
        }
        .mode-card {
          transition: all var(--transition-normal);
        }
        .mode-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 40px -10px rgba(99,102,241,0.2);
          border-color: var(--accent-primary);
        }
        .mode-card-icon {
          transition: all var(--transition-normal);
        }
        .mode-card:hover .mode-card-icon {
          transform: scale(1.1);
        }
        .btn-primary {
          background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
          transition: opacity 0.2s ease, transform 0.2s ease;
        }
        .btn-primary:hover {
          opacity: 0.9;
          transform: scale(1.02);
        }
        .btn-ghost {
          border: 1px solid var(--border-default);
          background: transparent;
          transition: background 0.2s ease;
        }
        .btn-ghost:hover {
          background: var(--bg-elevated);
        }
      `}</style>

      {/* Hero Section */}
      <section style={{
        position: 'relative',
        padding: '120px 20px 80px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        background: 'radial-gradient(circle at 50% -20%, rgba(99,102,241,0.15) 0%, transparent 70%)'
      }}>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(3rem, 6vw, 5rem)',
          fontWeight: 800,
          lineHeight: 1.1,
          marginBottom: '24px',
          background: 'linear-gradient(to right, #fff, #94a3b8)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          maxWidth: '800px'
        }}>
          Design Your <br />
          <span style={{
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>Dream Building</span>
        </h1>
        <p style={{
          fontSize: '1.25rem',
          color: 'var(--text-secondary)',
          marginBottom: '40px',
          maxWidth: '600px'
        }}>
          AI-powered 3D architecture for everyone. From simple floor plans to full 3D interactive models in seconds.
        </p>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button 
            className="btn-primary"
            onClick={() => navigate('/templates')}
            style={{
              padding: '16px 32px',
              borderRadius: 'var(--radius-lg)',
              color: '#fff',
              border: 'none',
              fontSize: '1.1rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            Browse Templates
          </button>
          <button 
            className="btn-ghost"
            onClick={() => navigate('/editor/new')}
            style={{
              padding: '16px 32px',
              borderRadius: 'var(--radius-lg)',
              color: 'var(--text-primary)',
              fontSize: '1.1rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            Start from Scratch
          </button>
        </div>

        {/* Floating Wireframe Animation */}
        <div style={{
          marginTop: '80px',
          animation: 'float 6s ease-in-out infinite',
          position: 'relative'
        }}>
          <svg width="300" height="200" viewBox="0 0 300 200" style={{
            filter: 'drop-shadow(0 0 20px rgba(99,102,241,0.3))'
          }}>
            <path d="M150 20 L280 80 L150 140 L20 80 Z" fill="rgba(99,102,241,0.1)" stroke="var(--accent-primary)" strokeWidth="2"/>
            <path d="M20 80 L20 140 L150 200 L280 140 L280 80" fill="none" stroke="var(--accent-primary)" strokeWidth="2"/>
            <path d="M150 140 L150 200" fill="none" stroke="var(--accent-primary)" strokeWidth="2"/>
            {/* Grid lines */}
            <path d="M52 65 L150 110 L248 65" fill="none" stroke="var(--accent-secondary)" strokeWidth="1" strokeDasharray="4 4" opacity="0.5"/>
            <path d="M85 50 L150 80 L215 50" fill="none" stroke="var(--accent-secondary)" strokeWidth="1" strokeDasharray="4 4" opacity="0.5"/>
          </svg>
          <div style={{
            position: 'absolute',
            bottom: '-20px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '200px',
            height: '20px',
            background: 'radial-gradient(ellipse, rgba(99,102,241,0.2) 0%, transparent 70%)',
            filter: 'blur(10px)'
          }} />
        </div>
      </section>

      {/* Mode Selection Cards */}
      <section style={{
        padding: '80px 20px',
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '24px'
      }}>
        {/* Card 1: Drawing Mode */}
        <div className="mode-card" style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '32px',
          border: '1px solid var(--border-default)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div className="mode-card-icon" style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(99,102,241,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
            marginBottom: '24px',
            border: '1px solid rgba(99,102,241,0.2)'
          }}>✏️</div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '12px' }}>Engineering Drawing Mode</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.6 }}>
            Draw precise 2D floor plans with CAD-like tools, then auto-convert to 3D instantly.
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', color: 'var(--text-muted)', flex: 1 }}>
            <li style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: 'var(--accent-primary)' }}>✓</span> Grid snapping</li>
            <li style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: 'var(--accent-primary)' }}>✓</span> Multi-floor support</li>
            <li style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: 'var(--accent-primary)' }}>✓</span> Auto 3D conversion</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: 'var(--accent-primary)' }}>✓</span> DXF export</li>
          </ul>
          <button 
            className="btn-ghost"
            onClick={() => navigate('/editor/new?mode=drawing')}
            style={{ padding: '12px', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', cursor: 'pointer', width: '100%', fontWeight: 500 }}
          >
            Start Drawing
          </button>
        </div>

        {/* Card 2: AI Builder */}
        <div className="mode-card" style={{
          background: 'linear-gradient(180deg, var(--bg-card) 0%, rgba(139,92,246,0.05) 100%)',
          borderRadius: 'var(--radius-lg)',
          padding: '32px',
          border: '1px solid var(--border-default)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute', top: '24px', right: '24px',
            background: 'rgba(139,92,246,0.1)', color: 'var(--accent-secondary)',
            padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600,
            border: '1px solid rgba(139,92,246,0.2)'
          }}>AI Powered</div>
          <div className="mode-card-icon" style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '32px', marginBottom: '24px', border: '1px solid rgba(139,92,246,0.2)'
          }}>🤖</div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '12px' }}>AI House Builder</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.6 }}>
            Answer a few questions and watch AI design your building automatically.
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', color: 'var(--text-muted)', flex: 1 }}>
            <li style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: 'var(--accent-secondary)' }}>✓</span> Smart Q&A wizard</li>
            <li style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: 'var(--accent-secondary)' }}>✓</span> Constraint solver</li>
            <li style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: 'var(--accent-secondary)' }}>✓</span> Auto furniture placement</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: 'var(--accent-secondary)' }}>✓</span> Multiple layouts</li>
          </ul>
          <button 
            className="btn-primary"
            onClick={() => navigate('/editor/new?mode=ai')}
            style={{ padding: '12px', borderRadius: 'var(--radius-md)', color: '#fff', border: 'none', cursor: 'pointer', width: '100%', fontWeight: 600 }}
          >
            Build with AI
          </button>
        </div>

        {/* Card 3: Templates */}
        <div className="mode-card" style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '32px',
          border: '1px solid var(--border-default)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}>
          <div className="mode-card-icon" style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'rgba(56,189,248,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '32px', marginBottom: '24px', border: '1px solid rgba(56,189,248,0.2)'
          }}>📐</div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '12px' }}>Template Mode</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.6 }}>
            Start from a professionally designed template and customize it to your needs.
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', color: 'var(--text-muted)', flex: 1 }}>
            <li style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: '#38bdf8' }}>✓</span> 5+ Initial templates</li>
            <li style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: '#38bdf8' }}>✓</span> Filter by type</li>
            <li style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: '#38bdf8' }}>✓</span> Instant preview</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: '#38bdf8' }}>✓</span> Full customization</li>
          </ul>
          <button 
            className="btn-ghost"
            onClick={() => navigate('/templates')}
            style={{ padding: '12px', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', cursor: 'pointer', width: '100%', fontWeight: 500 }}
          >
            Browse Templates
          </button>
        </div>
      </section>

      {/* Stats Strip */}
      <section style={{
        padding: '60px 20px',
        borderTop: '1px solid var(--border-subtle)',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-elevated)',
        display: 'flex',
        justifyContent: 'center',
        gap: 'clamp(2rem, 8vw, 6rem)',
        flexWrap: 'wrap'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--accent-primary)', transition: 'all 1s' }}>
            {stats.templates}+
          </div>
          <div style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Templates</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--accent-secondary)', transition: 'all 1s' }}>
            {stats.modes}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Creation Modes</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: '#38bdf8', transition: 'all 1s' }}>
            {stats.preview}ms
          </div>
          <div style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Real-time 3D Preview</div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '40px 20px',
        textAlign: 'center',
        color: 'var(--text-muted)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px'
      }}>
        <div style={{ fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>3D House Planning</div>
        <div style={{ fontSize: '0.9rem' }}>Built with Three.js + React</div>
      </footer>
    </div>
  );
};

export default Home;
