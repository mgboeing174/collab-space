import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Save, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import Avatar from '../components/common/Avatar.jsx';

const GRAYSCALE_AVATARS = [
  '#111111', '#242424', '#383838', '#4c4c4c', '#606060', '#747474'
];

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarColor, setAvatarColor] = useState(user?.avatarColor || '#111111');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setSaving(true);
      await updateProfile({ name: name.trim(), bio: bio.trim(), avatarColor });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to update profile:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '640px', margin: '40px auto', padding: '0 24px 60px' }}>
      <button
        onClick={() => navigate(-1)}
        className="btn btn-secondary btn-sm"
        style={{ marginBottom: '20px' }}
      >
        <ArrowLeft size={13} />
        <span>Back</span>
      </button>

      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.02em', color: '#111111' }}>
          Account Profile
        </h1>
        <p style={{ fontSize: '13.5px', color: '#666666', marginTop: '4px' }}>
          Manage your personal details and collaborator presence
        </p>
      </div>

      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          padding: '28px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <Avatar name={name || user?.name} color={avatarColor} size={52} />
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#111111' }}>{user?.email}</div>
            <div style={{ fontSize: '12px', color: '#888888' }}>Member since 2026</div>
          </div>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#111111', marginBottom: '6px' }}>
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{ width: '100%', height: '36px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#111111', marginBottom: '6px' }}>
              Bio / Role
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="e.g. Lead Product Designer, Full-Stack Engineer"
              rows={2}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#111111', marginBottom: '8px' }}>
              Avatar Color Shade
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {GRAYSCALE_AVATARS.map((color) => (
                <div
                  key={color}
                  onClick={() => setAvatarColor(color)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: color,
                    border: avatarColor === color ? '2.5px solid #000000' : '2px solid transparent',
                    boxShadow: avatarColor === color ? '0 0 0 2px #ffffff inset' : 'none',
                    cursor: 'pointer'
                  }}
                />
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
            <button type="submit" disabled={saving || !name.trim()} className="btn btn-primary">
              <Save size={14} />
              <span>{saving ? 'Saving...' : 'Save Profile'}</span>
            </button>
            {saved && (
              <span style={{ fontSize: '12.5px', color: '#111111', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Check size={14} /> Profile updated
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
