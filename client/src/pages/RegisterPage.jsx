import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Layers, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !email.trim() || !password) {
      setError('All fields are required.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    try {
      setLoading(true);
      await register(name.trim(), email.trim(), password);
      const pendingInvite = sessionStorage.getItem('collabspace_pending_invite');
      if (pendingInvite) {
        sessionStorage.removeItem('collabspace_pending_invite');
        navigate(`/join/${pendingInvite}`);
      } else {
        navigate('/workspaces');
      }
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
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
            Get started with CollabSpace
          </h1>
          <p style={{ fontSize: '13.5px', color: '#666666', marginTop: '6px' }}>
            Collaborate on documents and whiteboards in real time
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
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Morgan"
                required
                autoFocus
                style={{ width: '100%', height: '38px', fontSize: '14px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#111111', marginBottom: '6px' }}>
                Work Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@company.com"
                required
                style={{ width: '100%', height: '38px', fontSize: '14px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#111111', marginBottom: '6px' }}>
                Password (min. 6 characters)
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
              <span>{loading ? 'Creating account...' : 'Create Account'}</span>
              <ArrowRight size={14} />
            </button>
          </form>
        </div>

        {/* Footer Link */}
        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: '#666666' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ fontWeight: 600, color: '#111111', textDecoration: 'underline' }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
