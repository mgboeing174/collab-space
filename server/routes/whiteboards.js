import express from 'express';
import crypto from 'crypto';
import Whiteboard from '../models/Whiteboard.js';
import { logActivity } from '../db/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireWorkspaceMember, requireWhiteboardAccess } from '../middleware/permissions.js';

const router = express.Router();
router.use(authenticateToken);

// Get whiteboards in workspace
router.get('/workspace/:workspaceId', requireWorkspaceMember(), async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const whiteboards = await Whiteboard.find({ workspaceId })
      .populate('createdBy', 'name')
      .populate('projectId', 'name')
      .sort({ updatedAt: -1 });

    const formatted = whiteboards.map((w) => ({
      id: w._id.toString(),
      workspace_id: w.workspaceId.toString(),
      project_id: w.projectId ? w.projectId._id.toString() : null,
      project_name: w.projectId ? w.projectId.name : null,
      title: w.title,
      version: w.version,
      creator_name: w.createdBy ? w.createdBy.name : 'Author',
      created_at: w.createdAt.toISOString(),
      updated_at: w.updatedAt.toISOString()
    }));

    res.json({ whiteboards: formatted });
  } catch (err) {
    console.error('Fetch whiteboards error:', err);
    res.status(500).json({ error: 'Failed to fetch whiteboards.' });
  }
});

// Create whiteboard
router.post('/', requireWorkspaceMember(), async (req, res) => {
  try {
    const { workspaceId, projectId, title = 'Untitled Whiteboard' } = req.body;
    if (!workspaceId) {
      return res.status(400).json({ error: 'Workspace ID is required.' });
    }

    const whiteboard = await Whiteboard.create({
      workspaceId,
      projectId: projectId || null,
      title: title.trim(),
      shareCode: crypto.randomBytes(6).toString('hex'),
      canvasData: [],
      version: 1,
      createdBy: req.user.id
    });

    await logActivity({
      workspaceId,
      userId: req.user.id,
      userName: req.user.name,
      action: 'whiteboard_created',
      entityType: 'whiteboard',
      entityId: whiteboard._id,
      entityTitle: title.trim(),
      details: 'Created collaborative whiteboard'
    });

    res.status(201).json({
      whiteboard: {
        id: whiteboard._id.toString(),
        workspace_id: workspaceId,
        project_id: projectId || null,
        title: whiteboard.title,
        version: whiteboard.version,
        created_by: req.user.id,
        created_at: whiteboard.createdAt.toISOString(),
        updated_at: whiteboard.updatedAt.toISOString()
      }
    });
  } catch (err) {
    console.error('Create whiteboard error:', err);
    res.status(500).json({ error: 'Failed to create whiteboard.' });
  }
});

// Get single whiteboard
router.get('/:id', requireWhiteboardAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const whiteboard = await Whiteboard.findById(id)
      .populate('createdBy', 'name')
      .populate('projectId', 'name');

    if (!whiteboard.shareCode) {
      whiteboard.shareCode = crypto.randomBytes(6).toString('hex');
      await whiteboard.save();
    }

    res.json({
      whiteboard: {
        id: whiteboard._id.toString(),
        workspace_id: whiteboard.workspaceId.toString(),
        project_id: whiteboard.projectId ? whiteboard.projectId._id.toString() : null,
        project_name: whiteboard.projectId ? whiteboard.projectId.name : null,
        title: whiteboard.title,
        share_code: whiteboard.shareCode,
        version: whiteboard.version,
        created_by: whiteboard.createdBy ? whiteboard.createdBy._id.toString() : null,
        creator_name: whiteboard.createdBy ? whiteboard.createdBy.name : 'Author',
        canvasElements: whiteboard.canvasData || [],
        created_at: whiteboard.createdAt.toISOString(),
        updated_at: whiteboard.updatedAt.toISOString()
      },
      currentUserRole: req.workspaceMember.role
    });
  } catch (err) {
    console.error('Get whiteboard error:', err);
    res.status(500).json({ error: 'Failed to fetch whiteboard.' });
  }
});

// Update whiteboard (canvas data and/or title)
router.put('/:id', requireWhiteboardAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, canvasElements } = req.body;

    const whiteboard = req.whiteboard;
    if (title) whiteboard.title = title.trim();
    if (canvasElements !== undefined) whiteboard.canvasData = canvasElements;
    whiteboard.version = (whiteboard.version || 0) + 1;
    await whiteboard.save();

    res.json({ message: 'Whiteboard saved.', version: whiteboard.version });
  } catch (err) {
    console.error('Update whiteboard error:', err);
    res.status(500).json({ error: 'Failed to update whiteboard.' });
  }
});

// Delete whiteboard
router.delete('/:id', requireWhiteboardAccess, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.workspaceMember.role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot delete whiteboards.' });
    }

    await Whiteboard.findByIdAndDelete(id);

    await logActivity({
      workspaceId: req.whiteboard.workspaceId,
      userId: req.user.id,
      userName: req.user.name,
      action: 'whiteboard_deleted',
      entityType: 'whiteboard',
      entityId: id,
      entityTitle: req.whiteboard.title,
      details: 'Deleted whiteboard'
    });

    res.json({ message: 'Whiteboard deleted successfully.' });
  } catch (err) {
    console.error('Delete whiteboard error:', err);
    res.status(500).json({ error: 'Failed to delete whiteboard.' });
  }
});

// Regenerate whiteboard share code
router.post('/:id/share-code', requireWhiteboardAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const whiteboard = req.whiteboard;
    whiteboard.shareCode = crypto.randomBytes(6).toString('hex');
    await whiteboard.save();
    res.json({ shareCode: whiteboard.shareCode });
  } catch (err) {
    console.error('Regenerate whiteboard share code error:', err);
    res.status(500).json({ error: 'Failed to regenerate share code.' });
  }
});

// Join whiteboard directly by 12-char share code
router.post('/join/:shareCode', async (req, res) => {
  try {
    const { shareCode } = req.params;
    if (!shareCode) {
      return res.status(400).json({ error: 'Share code is required.' });
    }

    const whiteboard = await Whiteboard.findOne({ shareCode: shareCode.trim() });
    if (!whiteboard) {
      return res.status(404).json({ error: 'Invalid share code or whiteboard not found.' });
    }

    const isCollaborator = (whiteboard.collaborators || []).some(
      (c) => c.userId?.toString() === req.user.id
    );

    if (!isCollaborator && whiteboard.createdBy.toString() !== req.user.id) {
      whiteboard.collaborators.push({
        userId: req.user.id,
        role: 'editor',
        joinedAt: new Date()
      });
      await whiteboard.save();
    }

    res.json({
      type: 'whiteboard',
      whiteboardId: whiteboard._id.toString(),
      workspaceId: whiteboard.workspaceId.toString(),
      title: whiteboard.title
    });
  } catch (err) {
    console.error('Join whiteboard error:', err);
    res.status(500).json({ error: 'Failed to join whiteboard.' });
  }
});

export default router;
