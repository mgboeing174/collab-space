import express from 'express';
import Activity from '../models/Activity.js';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireWorkspaceMember } from '../middleware/permissions.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/workspace/:workspaceId', requireWorkspaceMember(), async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const activities = await Activity.find({ workspaceId })
      .populate('userId', 'avatarColor avatarIcon')
      .sort({ createdAt: -1 })
      .limit(60);

    const formatted = activities.map((a) => ({
      id: a._id.toString(),
      workspace_id: a.workspaceId.toString(),
      user_id: a.userId?._id?.toString() || a.userId?.toString(),
      user_name: a.userName,
      avatar_color: a.userId?.avatarColor || '#111111',
      avatar_icon: a.userId?.avatarIcon || 'user',
      action: a.action,
      entity_type: a.entityType,
      entity_id: a.entityId,
      entity_title: a.entityTitle,
      details: a.details,
      created_at: a.createdAt.toISOString()
    }));

    res.json({ activities: formatted });
  } catch (err) {
    console.error('Fetch activities error:', err);
    res.status(500).json({ error: 'Failed to fetch activity log.' });
  }
});

export default router;
