import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import './LoginPage.css';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username || !password) {
      setError('Username and password are required.');
      return;
    }
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Invalid credentials. Try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card" id="login-card">
        <div className="login-card__logo">
          <span className="login-card__logo-icon">S</span>
        </div>
        <h1 className="login-card__title">SETU Registry</h1>
        <p className="login-card__subtitle">Surveillance Equipment Tracking Utility</p>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && (
            <div className="login-form__error" id="login-error">
              {error}
            </div>
          )}
          <div className="login-form__field">
            <label className="login-form__label" htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              autoComplete="username"
              autoFocus
            />
          </div>
          <div className="login-form__field">
            <label className="login-form__label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" disabled={loading} id="btn-login">
            {loading ? 'Logging in...' : 'Log in'}
          </Button>
        </form>

        <p className="login-card__footer">
          Gujarat Police Innovation Challenge 2026
        </p>
      </div>
    </div>
  );
}
