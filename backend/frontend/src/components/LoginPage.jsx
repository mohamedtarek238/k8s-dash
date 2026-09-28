import { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Moon,
  ShieldCheck,
  Sun,
  User,
  Zap
} from 'lucide-react';
import { api } from '../api';

export function LoginPage({ onLoginSuccess, dark, onToggleTheme }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedUsername = username.trim();

    if (!trimmedUsername || !password) {
      setError('Please provide both your username and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { user } = await api.auth.login(trimmedUsername, password);
      if (onLoginSuccess) {
        onLoginSuccess(user);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Invalid username or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`login-page-wrapper ${dark ? 'dark' : 'light'}`}>
      <div className="login-backdrop-glow" />

      <div className="login-card-container">
        <div className="login-card">
          <div className="login-card-topbar">
            <div className="login-kicker">
              <KeyRound size={14} />
              <span>SECURE ACCESS</span>
            </div>
            {onToggleTheme && (
              <button
                type="button"
                className="theme-button subtle icon-only"
                onClick={onToggleTheme}
                title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {dark ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            )}
          </div>

          <div className="login-brand-header">
            <div className="login-brand-logo">
              <Zap size={26} />
            </div>
            <div className="login-title-group">
              <h1>Kubernetes Console</h1>
              <p>Sign in to manage and monitor your Kubernetes clusters</p>
            </div>
          </div>

          {error && (
            <div className="login-error-banner" role="alert">
              <AlertCircle size={18} className="login-error-icon" />
              <span>{error}</span>
            </div>
          )}

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="login-form-group">
              <label htmlFor="login-username">Username</label>
              <div className="login-input-wrapper">
                <User size={18} className="login-input-icon" />
                <input
                  id="login-username"
                  type="text"
                  className="login-input"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (error) setError(null);
                  }}
                  autoFocus
                  disabled={loading}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="login-form-group">
              <label htmlFor="login-password">Password</label>
              <div className="login-input-wrapper">
                <Lock size={18} className="login-input-icon" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="login-input"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  disabled={loading}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="login-submit-btn"
              disabled={loading || !username.trim() || !password}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="login-footer-info">
            <div className="login-roles-info">
              <ShieldCheck size={15} />
              <span>Supports <strong>admin</strong> and <strong>viewer</strong> roles</span>
            </div>
            <div className="login-helper-note">
              To create or manage users, execute <code>npm run create-user</code> in the backend CLI.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
