import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'collabspace-dev-secret-key-3.14159';

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please sign in.' });
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err || !decoded) {
      return res.status(403).json({ error: 'Invalid or expired authentication token.' });
    }

    try {
      const user = await User.findById(decoded.id);
      if (!user) {
        return res.status(401).json({ error: 'User account not found.' });
      }

      req.user = {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        avatarColor: user.avatarColor,
        bio: user.bio || ''
      };

      next();
    } catch (dbErr) {
      return res.status(500).json({ error: 'Authentication database error' });
    }
  });
}
