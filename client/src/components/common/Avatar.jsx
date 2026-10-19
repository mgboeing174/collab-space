import React from 'react';

export default function Avatar({ name = 'User', color = '#111111', size = 30, className = '' }) {
  const initials = (name || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join('');

  return (
    <div
      className={`inline-flex items-center justify-center font-medium select-none text-white ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        borderRadius: '50%',
        backgroundColor: color || '#111111',
        fontSize: `${Math.max(10, Math.floor(size * 0.4))}px`,
        letterSpacing: '0.02em',
        border: '1.5px solid rgba(255,255,255,0.9)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}
      title={name}
    >
      {initials}
    </div>
  );
}
