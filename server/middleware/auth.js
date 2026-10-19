import jwt from 'jsonwebtoken';
import db from '../db/database.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'collabspace-dev-secret-key-3.14159';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please sign in.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired authentication token.' });
    }

    // Verify user exists in database
    const stmt = db.prepare('SELECT id, email, name, avatar_color, bio FROM users WHERE id = ?');
    const user = stmt.get(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'User account not found.' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarColor: user.avatar_color,
      bio: user.bio
    };

    next();
  });
}
