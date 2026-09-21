import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ToastContainer } from './components/ui/Toast';

import Home from './pages/Home';
import Templates from './pages/Templates';

// Lazy load the 3D editor for better initial load performance
const EditorShell = lazy(() =>
  import('./components/editor/EditorShell').then((m) => ({ default: m.EditorShell }))
);

const EditorLoader = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      width: '100vw',
      backgroundColor: 'var(--bg-base)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)',
      flexDirection: 'column',
      gap: '1rem',
    }}
  >
    <div
      style={{
        width: '44px',
        height: '44px',
        border: '3px solid var(--border-default)',
        borderTopColor: 'var(--accent-primary)',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }}
    />
    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading 3D Editor…</span>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/templates" element={<Templates />} />
        <Route
          path="/editor/new"
          element={
            <Suspense fallback={<EditorLoader />}>
              <EditorShell />
            </Suspense>
          }
        />
        <Route
          path="/editor/:projectId"
          element={
            <Suspense fallback={<EditorLoader />}>
              <EditorShell />
            </Suspense>
          }
        />
      </Routes>
      <ToastContainer />
    </>
  );
}
