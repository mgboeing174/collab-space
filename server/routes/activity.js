import express from 'express';
import db from '../db/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireWorkspaceMember } from '../middleware/permissions.js';

const router = express.Router();
router.use(authenticateToken);

// Get recent activity for workspace
router.get('/workspace/:workspaceId', requireWorkspaceMember(), (req, res) => {
  try {
    const { workspaceId } = req.params;
    const stmt = db.prepare(`
      SELECT a.*, u.avatar_color
      FROM activities a
      LEFT JOIN users u ON u.id = a.user_id
      WHERE a.workspace_id = ?
      ORDER BY a.created_at DESC
      LIMIT 60
    `);
    const activities = stmt.all(workspaceId);
    res.json({ activities });
  } catch (err) {
    console.error('Fetch activities error:', err);
    res.status(500).json({ error: 'Failed to fetch activity log.' });
  }
});

export default router;
