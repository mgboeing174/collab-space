import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Layers, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    try {
      setLoading(true);
      await login(email, password);
      navigate('/workspaces');
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#fafafa',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
    >
      <div style={{ width: '100%', maxWidth: '380px' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              backgroundColor: '#111111',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              marginBottom: '16px'
            }}
          >
            <Layers size={22} />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.03em', color: '#111111' }}>
            CollabSpace
          </h1>
          <p style={{ fontSize: '13.5px', color: '#666666', marginTop: '6px' }}>
            A real-time workspace for documents, whiteboards, and teams
          </p>
        </div>

        {/* Form Card */}
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e0e0e0',
            borderRadius: '12px',
            padding: '28px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.04)'
          }}
        >
          {error && (
            <div
              style={{
                padding: '10px 12px',
                backgroundColor: '#f5f5f5',
                border: '1px solid #d4d4d4',
                borderRadius: '6px',
                fontSize: '13px',
                color: '#111111',
                marginBottom: '16px'
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#111111', marginBottom: '6px' }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                autoFocus
                style={{ width: '100%', height: '38px', fontSize: '14px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#111111', marginBottom: '6px' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{ width: '100%', height: '38px', fontSize: '14px' }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', height: '38px', marginTop: '4px' }}
            >
              <span>{loading ? 'Signing in...' : 'Sign In'}</span>
              <ArrowRight size={14} />
            </button>
          </form>

          {/* Quick Demo Credentials Info */}
          <div
            style={{
              marginTop: '20px',
              padding: '10px 12px',
              backgroundColor: '#fafafa',
              border: '1px solid #eeeeee',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#666666'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#333333', marginBottom: '4px' }}>
              <ShieldCheck size={14} />
              <span>New to CollabSpace?</span>
            </div>
            Sign up below to automatically receive an initial workspace, starter templates, and an interactive whiteboard.
          </div>
        </div>

        {/* Footer Link */}
        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: '#666666' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ fontWeight: 600, color: '#111111', textDecoration: 'underline' }}>
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}
