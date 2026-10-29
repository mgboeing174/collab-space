import React from 'react';
import {
  User,
  Sparkles,
  Zap,
  Coffee,
  Code2,
  Terminal,
  Smile,
  Cat,
  Flame,
  Shield,
  Compass,
  Cpu
} from 'lucide-react';

export const AVATAR_ICONS = [
  { id: 'user', label: 'Person', icon: User },
  { id: 'smile', label: 'Smile', icon: Smile },
  { id: 'sparkles', label: 'Sparkles', icon: Sparkles },
  { id: 'zap', label: 'Lightning', icon: Zap },
  { id: 'coffee', label: 'Coffee', icon: Coffee },
  { id: 'code', label: 'Developer', icon: Code2 },
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'cat', label: 'Cat', icon: Cat },
  { id: 'flame', label: 'Flame', icon: Flame },
  { id: 'shield', label: 'Shield', icon: Shield },
  { id: 'compass', label: 'Compass', icon: Compass },
  { id: 'cpu', label: 'Tech', icon: Cpu }
];

export function getAvatarIconComponent(iconId) {
  const found = AVATAR_ICONS.find((item) => item.id === iconId);
  return found ? found.icon : User;
}

export default function Avatar({
  name = 'User',
  color = '#111111',
  icon = 'user',
  size = 30,
  className = '',
  showInitials = false
}) {
  const IconComponent = getAvatarIconComponent(icon);
  const iconSize = Math.max(12, Math.round(size * 0.52));

  const initials = (name || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

  return (
    <div
      className={`inline-flex items-center justify-center select-none text-white ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        borderRadius: '50%',
        backgroundColor: color || '#111111',
        border: '1.5px solid rgba(255, 255, 255, 0.9)',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}
      title={name}
    >
      {showInitials ? (
        <span
          style={{
            fontSize: `${Math.max(10, Math.floor(size * 0.4))}px`,
            fontWeight: 600,
            letterSpacing: '0.02em',
            color: '#ffffff'
          }}
        >
          {initials}
        </span>
      ) : (
        <IconComponent size={iconSize} strokeWidth={2.2} color="#ffffff" />
      )}
    </div>
  );
}
