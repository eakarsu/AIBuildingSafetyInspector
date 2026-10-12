import React, { useRef, useState } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const demoLoginEnabled = process.env.NODE_ENV !== 'production' && process.env.REACT_APP_ENABLE_DEMO_CREDENTIAL_AUTOFILL === 'true';
const demoCredentials = {
  email: process.env.REACT_APP_DEMO_EMAIL || '',
  password: process.env.REACT_APP_DEMO_PASSWORD || ''
};

export default function Login({ onLogin }) {
  const demoLoginLock = useRef(false);
  const [demoLoginBusy, setDemoLoginBusy] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e, loginCredentials) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API}/api/auth/login`, {
        email: loginCredentials?.email ?? email,
        password: loginCredentials?.password ?? password
      });
      onLogin(res.data.token, res.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (event) => {
    if (demoLoginLock.current) return;
    demoLoginLock.current = true;
    setDemoLoginBusy(true);
    setEmail(demoCredentials.email);
    setPassword(demoCredentials.password);
    try {
      await handleSubmit(event, demoCredentials);
    } finally {
      demoLoginLock.current = false;
      setDemoLoginBusy(false);
    }
  };

  const demoLoginAvailable = demoLoginEnabled && Boolean(demoCredentials.email && demoCredentials.password);

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-logo">
          <div className="logo-icon">🏗️</div>
          <h1>AI Building Safety Inspector</h1>
          <p>Construction Safety Management Platform</p>
        </div>
        {error && <div className="login-error">{error}</div>}
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email" required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required />
          </div>
          <button
            type="button"
            className="auto-fill-btn"
            onClick={handleDemoLogin}
            disabled={loading || demoLoginBusy || !demoLoginAvailable}
            aria-label="Log In as Demo"
            title={demoLoginAvailable ? 'Sign in with the configured local demo account' : 'Local demo login is not configured'}
          >
            {demoLoginBusy ? 'Signing in as Demo...' : 'Log In as Demo'}
          </button>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
