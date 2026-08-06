import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

export default function Login() {
  const { user, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="brand" style={{ padding: 0, marginBottom: 18 }}>
          <div className="brand-mark" style={{ background: 'var(--green-600)', color: '#fff' }}>
            {'♻'}
          </div>
          <div className="brand-text">
            <strong style={{ color: 'var(--ink)' }}>Waste Picker MS</strong>
            <span style={{ color: 'var(--muted)' }}>Administrator Portal</span>
          </div>
        </div>

        <h1>Sign in</h1>
        <p className="sub">
          Manage registrations, communication and reporting for waste pickers across Western Kenya.
        </p>

        {error && <div className="alert error">{error}</div>}

        <div className="field">
          <label>Email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@wastepickers.ke"
            required
          />
        </div>

        <div className="field">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button className="btn" style={{ width: '100%', padding: 12 }} disabled={busy}>
          {busy ? 'Signing in...' : 'Sign in'}
        </button>

        <p style={{ marginTop: 20, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
          INSY 492 Senior Project &middot; University of Eastern Africa, Baraton
        </p>
      </form>

      <p className="login-caption">
        Serving waste pickers across the Lake Victoria basin — Kisumu, Siaya, Busia, Homa Bay,
        Migori, Kakamega, Vihiga, Bungoma, Trans Nzoia and Nandi.
      </p>
    </div>
  );
}
