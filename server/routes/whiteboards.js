import express from 'express';
import crypto from 'crypto';
import db, { logActivity } from '../db/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireWorkspaceMember, requireWhiteboardAccess } from '../middleware/permissions.js';

const router = express.Router();
router.use(authenticateToken);

// Get whiteboards in workspace
router.get('/workspace/:workspaceId', requireWorkspaceMember(), (req, res) => {
  try {
    const { workspaceId } = req.params;
    const stmt = db.prepare(`
      SELECT w.id, w.workspace_id, w.project_id, w.title, w.version, w.created_by, w.created_at, w.updated_at,
             u.name as creator_name, p.name as project_name
      FROM whiteboards w
      JOIN users u ON u.id = w.created_by
      LEFT JOIN projects p ON p.id = w.project_id
      WHERE w.workspace_id = ?
      ORDER BY w.updated_at DESC
    `);
    const whiteboards = stmt.all(workspaceId);
    res.json({ whiteboards });
  } catch (err) {
    console.error('Fetch whiteboards error:', err);
    res.status(500).json({ error: 'Failed to fetch whiteboards.' });
  }
});

// Create whiteboard
router.post('/', requireWorkspaceMember(), (req, res) => {
  try {
    const { workspaceId, projectId, title = 'Untitled Whiteboard' } = req.body;
    if (!workspaceId) {
      return res.status(400).json({ error: 'Workspace ID is required.' });
    }

    const whiteboardId = crypto.randomUUID();
    const now = new Date().toISOString();
    const initialData = JSON.stringify([]);

    const insertStmt = db.prepare(`
      INSERT INTO whiteboards (id, workspace_id, project_id, title, canvas_data, version, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
    `);
    insertStmt.run(whiteboardId, workspaceId, projectId || null, title.trim(), initialData, req.user.id, now, now);

    logActivity({
      workspaceId,
      userId: req.user.id,
      userName: req.user.name,
      action: 'whiteboard_created',
      entityType: 'whiteboard',
      entityId: whiteboardId,
      entityTitle: title.trim(),
      details: 'Created collaborative whiteboard'
    });

    res.status(201).json({
      whiteboard: {
        id: whiteboardId,
        workspace_id: workspaceId,
        project_id: projectId || null,
        title: title.trim(),
        version: 1,
        created_by: req.user.id,
        created_at: now,
        updated_at: now
      }
    });
  } catch (err) {
    console.error('Create whiteboard error:', err);
    res.status(500).json({ error: 'Failed to create whiteboard.' });
  }
});

// Get single whiteboard
router.get('/:id', requireWhiteboardAccess, (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare(`
      SELECT w.*, u.name as creator_name, p.name as project_name
      FROM whiteboards w
      JOIN users u ON u.id = w.created_by
      LEFT JOIN projects p ON p.id = w.project_id
      WHERE w.id = ?
    `);
    const whiteboard = stmt.get(id);

    let canvasElements = [];
    try {
      canvasElements = JSON.parse(whiteboard.canvas_data || '[]');
    } catch (parseErr) {
      canvasElements = [];
    }

    res.json({
      whiteboard: {
        ...whiteboard,
        canvasElements
      },
      currentUserRole: req.workspaceMember.role
    });
  } catch (err) {
    console.error('Get whiteboard error:', err);
    res.status(500).json({ error: 'Failed to fetch whiteboard.' });
  }
});

// Update whiteboard (canvas data and/or title)
router.put('/:id', requireWhiteboardAccess, (req, res) => {
  try {
    const { id } = req.params;
    const { title, canvasElements } = req.body;
    const now = new Date().toISOString();

    let canvasDataString = undefined;
    if (canvasElements !== undefined) {
      canvasDataString = typeof canvasElements === 'string' ? canvasElements : JSON.stringify(canvasElements);
    }

    const nextVersion = req.whiteboard.version + 1;

    const updateStmt = db.prepare(`
      UPDATE whiteboards
      SET title = COALESCE(?, title),
          canvas_data = COALESCE(?, canvas_data),
          version = ?,
          updated_at = ?
      WHERE id = ?
    `);
    updateStmt.run(title ? title.trim() : null, canvasDataString || null, nextVersion, now, id);

    res.json({ message: 'Whiteboard saved.', version: nextVersion });
  } catch (err) {
    console.error('Update whiteboard error:', err);
    res.status(500).json({ error: 'Failed to update whiteboard.' });
  }
});

// Delete whiteboard
router.delete('/:id', requireWhiteboardAccess, (req, res) => {
  try {
    const { id } = req.params;
    if (req.workspaceMember.role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot delete whiteboards.' });
    }

    db.prepare('DELETE FROM whiteboards WHERE id = ?').run(id);

    logActivity({
      workspaceId: req.whiteboard.workspace_id,
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

// Save whiteboard snapshot version
router.post('/:id/snapshot', requireWhiteboardAccess, (req, res) => {
  try {
    const { id } = req.params;
    const { title = 'Snapshot' } = req.body;

    const latestVersion = db.prepare('SELECT MAX(version_number) as max_v FROM whiteboard_versions WHERE whiteboard_id = ?').get(id);
    const nextVersionNum = (latestVersion?.max_v || 0) + 1;
    const now = new Date().toISOString();

    const insertStmt = db.prepare(`
      INSERT INTO whiteboard_versions (id, whiteboard_id, version_number, title, canvas_snapshot, created_by, created_by_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertStmt.run(crypto.randomUUID(), id, nextVersionNum, title.trim(), req.whiteboard.canvas_data, req.user.id, req.user.name, now);

    res.status(201).json({ message: 'Whiteboard snapshot saved.', version: nextVersionNum });
  } catch (err) {
    console.error('Snapshot error:', err);
    res.status(500).json({ error: 'Failed to create whiteboard snapshot.' });
  }
});

export default router;
