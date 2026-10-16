import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('German CBT app crashed:', error, info);
  }

  clearBrowserData = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (error) {
      console.warn('Could not clear browser storage:', error);
    }
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <main className="fallback-screen">
          <section className="fallback-card">
            <h1>App loading problem found</h1>
            <p>The page did not load because the browser reported this error:</p>
            <pre>{String(this.state.error?.message || this.state.error)}</pre>
            <p>Click the button below once. It clears old saved test data and reloads the app.</p>
            <button onClick={this.clearBrowserData}>Clear saved data and reload</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  document.body.innerHTML = '<div style="font-family:Arial;padding:24px"><h1>Root element missing</h1><p>Please use the included index.html file.</p></div>';
} else {
  createRoot(rootElement).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
