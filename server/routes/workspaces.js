import express from 'express';
import crypto from 'crypto';
import db, { logActivity } from '../db/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireWorkspaceMember } from '../middleware/permissions.js';

const router = express.Router();
router.use(authenticateToken);

// Get all workspaces the current user belongs to
router.get('/', (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT 
        w.id, 
        w.name, 
        w.description, 
        w.invite_code, 
        w.owner_id, 
        w.created_at, 
        w.updated_at,
        wm.role as my_role,
        wm.joined_at,
        (SELECT COUNT(*) FROM workspace_members WHERE workspace_id = w.id) as member_count,
        (SELECT COUNT(*) FROM documents WHERE workspace_id = w.id) as doc_count,
        (SELECT COUNT(*) FROM whiteboards WHERE workspace_id = w.id) as whiteboard_count
      FROM workspaces w
      JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE wm.user_id = ?
      ORDER BY w.updated_at DESC
    `);
    const workspaces = stmt.all(req.user.id);
    res.json({ workspaces });
  } catch (err) {
    console.error('Fetch workspaces error:', err);
    res.status(500).json({ error: 'Failed to fetch workspaces.' });
  }
});

// Create a new workspace
router.post('/', (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Workspace name is required.' });
    }

    const workspaceId = crypto.randomUUID();
    const inviteCode = crypto.randomBytes(6).toString('hex');
    const now = new Date().toISOString();

    const insertWs = db.prepare(`
      INSERT INTO workspaces (id, name, description, invite_code, owner_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertWs.run(workspaceId, name.trim(), (description || '').trim(), inviteCode, req.user.id, now, now);

    const insertMember = db.prepare(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
      VALUES (?, ?, ?, 'owner', ?)
    `);
    insertMember.run(crypto.randomUUID(), workspaceId, req.user.id, now);

    logActivity({
      workspaceId,
      userId: req.user.id,
      userName: req.user.name,
      action: 'workspace_created',
      entityType: 'workspace',
      entityId: workspaceId,
      entityTitle: name.trim(),
      details: 'Created new workspace'
    });

    res.status(201).json({
      workspace: {
        id: workspaceId,
        name: name.trim(),
        description: (description || '').trim(),
        invite_code: inviteCode,
        owner_id: req.user.id,
        my_role: 'owner',
        created_at: now,
        updated_at: now,
        member_count: 1,
        doc_count: 0,
        whiteboard_count: 0
      }
    });
  } catch (err) {
    console.error('Create workspace error:', err);
    res.status(500).json({ error: 'Failed to create workspace.' });
  }
});

// Join workspace by invite code
router.post('/join/:inviteCode', (req, res) => {
  try {
    const { inviteCode } = req.params;
    if (!inviteCode) {
      return res.status(400).json({ error: 'Invite code is required.' });
    }

    const wsStmt = db.prepare('SELECT id, name, owner_id FROM workspaces WHERE invite_code = ?');
    const workspace = wsStmt.get(inviteCode.trim());

    if (!workspace) {
      return res.status(404).json({ error: 'Invalid invitation code or workspace does not exist.' });
    }

    // Check if already a member
    const checkStmt = db.prepare('SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?');
    const existing = checkStmt.get(workspace.id, req.user.id);

    if (existing) {
      return res.json({
        message: 'You are already a member of this workspace.',
        workspaceId: workspace.id,
        role: existing.role
      });
    }

    const now = new Date().toISOString();
    const insertMember = db.prepare(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
      VALUES (?, ?, ?, 'member', ?)
    `);
    insertMember.run(crypto.randomUUID(), workspace.id, req.user.id, now);

    logActivity({
      workspaceId: workspace.id,
      userId: req.user.id,
      userName: req.user.name,
      action: 'member_joined',
      entityType: 'member',
      entityId: req.user.id,
      entityTitle: req.user.name,
      details: 'Joined workspace via invite code'
    });

    res.json({
      message: 'Successfully joined workspace.',
      workspaceId: workspace.id,
      name: workspace.name,
      role: 'member'
    });
  } catch (err) {
    console.error('Join workspace error:', err);
    res.status(500).json({ error: 'Failed to join workspace.' });
  }
});

// Get workspace details (including projects, documents, whiteboards, members)
router.get('/:workspaceId', requireWorkspaceMember(), (req, res) => {
  try {
    const { workspaceId } = req.params;

    const wsStmt = db.prepare(`
      SELECT w.*, u.name as owner_name, u.email as owner_email
      FROM workspaces w
      JOIN users u ON u.id = w.owner_id
      WHERE w.id = ?
    `);
    const workspace = wsStmt.get(workspaceId);

    const membersStmt = db.prepare(`
      SELECT wm.id as membership_id, wm.role, wm.joined_at, u.id as user_id, u.name, u.email, u.avatar_color, u.bio
      FROM workspace_members wm
      JOIN users u ON u.id = wm.user_id
      WHERE wm.workspace_id = ?
      ORDER BY wm.joined_at ASC
    `);
    const members = membersStmt.all(workspaceId);

    const projectsStmt = db.prepare(`
      SELECT p.*, (SELECT COUNT(*) FROM documents WHERE project_id = p.id) as doc_count
      FROM projects p
      WHERE p.workspace_id = ?
      ORDER BY p.created_at ASC
    `);
    const projects = projectsStmt.all(workspaceId);

    const docsStmt = db.prepare(`
      SELECT d.*, u.name as creator_name,
             (SELECT COUNT(*) FROM document_sections WHERE document_id = d.id) as section_count
      FROM documents d
      JOIN users u ON u.id = d.created_by
      WHERE d.workspace_id = ?
      ORDER BY d.updated_at DESC
    `);
    const documents = docsStmt.all(workspaceId);

    const wbStmt = db.prepare(`
      SELECT w.id, w.workspace_id, w.project_id, w.title, w.version, w.created_by, w.created_at, w.updated_at, u.name as creator_name
      FROM whiteboards w
      JOIN users u ON u.id = w.created_by
      WHERE w.workspace_id = ?
      ORDER BY w.updated_at DESC
    `);
    const whiteboards = wbStmt.all(workspaceId);

    res.json({
      workspace: {
        ...workspace,
        myRole: req.workspaceMember.role
      },
      members,
      projects,
      documents,
      whiteboards
    });
  } catch (err) {
    console.error('Get workspace details error:', err);
    res.status(500).json({ error: 'Failed to retrieve workspace details.' });
  }
});

// Update workspace (admin/owner only)
router.put('/:workspaceId', requireWorkspaceMember(['owner', 'admin']), (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Workspace name is required.' });
    }

    const now = new Date().toISOString();
    const updateStmt = db.prepare(`
      UPDATE workspaces
      SET name = ?, description = ?, updated_at = ?
      WHERE id = ?
    `);
    updateStmt.run(name.trim(), (description || '').trim(), now, workspaceId);

    res.json({ message: 'Workspace updated successfully.' });
  } catch (err) {
    console.error('Update workspace error:', err);
    res.status(500).json({ error: 'Failed to update workspace.' });
  }
});

// Delete workspace (owner only)
router.delete('/:workspaceId', requireWorkspaceMember(['owner']), (req, res) => {
  try {
    const { workspaceId } = req.params;
    const delStmt = db.prepare('DELETE FROM workspaces WHERE id = ?');
    delStmt.run(workspaceId);

    res.json({ message: 'Workspace deleted successfully.' });
  } catch (err) {
    console.error('Delete workspace error:', err);
    res.status(500).json({ error: 'Failed to delete workspace.' });
  }
});

// Create a project/folder within workspace
router.post('/:workspaceId/projects', requireWorkspaceMember(['owner', 'admin', 'member']), (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required.' });
    }

    const projectId = crypto.randomUUID();
    const now = new Date().toISOString();

    const insertProj = db.prepare(`
      INSERT INTO projects (id, workspace_id, name, description, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertProj.run(projectId, workspaceId, name.trim(), (description || '').trim(), req.user.id, now);

    logActivity({
      workspaceId,
      userId: req.user.id,
      userName: req.user.name,
      action: 'project_created',
      entityType: 'project',
      entityId: projectId,
      entityTitle: name.trim(),
      details: 'Created folder/project'
    });

    res.status(201).json({
      project: {
        id: projectId,
        workspace_id: workspaceId,
        name: name.trim(),
        description: (description || '').trim(),
        created_by: req.user.id,
        created_at: now,
        doc_count: 0
      }
    });
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: 'Failed to create project.' });
  }
});

// Update member role (owner or admin)
router.put('/:workspaceId/members/:targetUserId', requireWorkspaceMember(['owner', 'admin']), (req, res) => {
  try {
    const { workspaceId, targetUserId } = req.params;
    const { role } = req.body;

    if (!['admin', 'member', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role specified.' });
    }

    // Owner cannot change their own role here
    const ws = db.prepare('SELECT owner_id FROM workspaces WHERE id = ?').get(workspaceId);
    if (ws.owner_id === targetUserId) {
      return res.status(400).json({ error: 'Cannot modify workspace owner role.' });
    }

    const updateStmt = db.prepare(`
      UPDATE workspace_members
      SET role = ?
      WHERE workspace_id = ? AND user_id = ?
    `);
    updateStmt.run(role, workspaceId, targetUserId);

    res.json({ message: 'Member role updated.' });
  } catch (err) {
    console.error('Update member role error:', err);
    res.status(500).json({ error: 'Failed to update member role.' });
  }
});

// Remove member or leave workspace
router.delete('/:workspaceId/members/:targetUserId', requireWorkspaceMember(), (req, res) => {
  try {
    const { workspaceId, targetUserId } = req.params;
    const isSelf = req.user.id === targetUserId;

    const ws = db.prepare('SELECT owner_id FROM workspaces WHERE id = ?').get(workspaceId);
    if (ws.owner_id === targetUserId) {
      return res.status(400).json({ error: 'Workspace owner cannot leave or be removed.' });
    }

    if (!isSelf && !['owner', 'admin'].includes(req.workspaceMember.role)) {
      return res.status(403).json({ error: 'Only owners and admins can remove other members.' });
    }

    const delStmt = db.prepare('DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?');
    delStmt.run(workspaceId, targetUserId);

    // Also unassign any sections assigned to this user in this workspace
    db.prepare(`
      UPDATE document_sections
      SET assigned_to = NULL, assigned_name = NULL, locked_by = NULL, locked_by_name = NULL, locked_at = NULL
      WHERE assigned_to = ? AND document_id IN (SELECT id FROM documents WHERE workspace_id = ?)
    `).run(targetUserId, workspaceId);

    res.json({ message: isSelf ? 'You have left the workspace.' : 'Member removed.' });
  } catch (err) {
    console.error('Remove member error:', err);
    res.status(500).json({ error: 'Failed to remove member.' });
  }
});

// Generate or regenerate invitation code
router.post('/:workspaceId/invite-link', requireWorkspaceMember(['owner', 'admin']), (req, res) => {
  try {
    const { workspaceId } = req.params;
    const newCode = crypto.randomBytes(6).toString('hex');
    db.prepare('UPDATE workspaces SET invite_code = ? WHERE id = ?').run(newCode, workspaceId);

    res.json({ inviteCode: newCode });
  } catch (err) {
    console.error('Regenerate invite code error:', err);
    res.status(500).json({ error: 'Failed to update invite code.' });
  }
});

export default router;
