import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, getAuthToken, setAuthToken } from '../utils/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const token = getAuthToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await api.get('/auth/me');
        setUser(res.user);
      } catch (err) {
        console.error('Failed to restore session:', err);
        setAuthToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    loadUser();

    const handleUnauthorized = () => {
      setUser(null);
    };
    window.addEventListener('collabspace_unauthorized', handleUnauthorized);
    return () => window.removeEventListener('collabspace_unauthorized', handleUnauthorized);
  }, []);

  const login = async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    setAuthToken(data.token);
    setUser(data.user);
    return data;
  };

  const register = async (name, email, password) => {
    const data = await api.post('/auth/register', { name, email, password });
    setAuthToken(data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    setAuthToken(null);
    setUser(null);
  };

  const updateProfile = async (profileData) => {
    const data = await api.put('/auth/profile', profileData);
    setUser(data.user);
    return data.user;
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
