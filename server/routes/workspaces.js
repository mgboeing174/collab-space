import express from 'express';
import crypto from 'crypto';
import Workspace from '../models/Workspace.js';
import Project from '../models/Project.js';
import Document from '../models/Document.js';
import Whiteboard from '../models/Whiteboard.js';
import User from '../models/User.js';
import { logActivity } from '../db/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireWorkspaceMember } from '../middleware/permissions.js';

const router = express.Router();
router.use(authenticateToken);

// Get all workspaces user belongs to
router.get('/', async (req, res) => {
  try {
    const workspaces = await Workspace.find({ 'members.userId': req.user.id }).sort({ updatedAt: -1 });

    const formatted = await Promise.all(
      workspaces.map(async (w) => {
        const myMember = w.members.find((m) => m.userId.toString() === req.user.id);
        const docCount = await Document.countDocuments({ workspaceId: w._id });
        const whiteboardCount = await Whiteboard.countDocuments({ workspaceId: w._id });

        return {
          id: w._id.toString(),
          name: w.name,
          description: w.description,
          invite_code: w.inviteCode,
          owner_id: w.ownerId.toString(),
          created_at: w.createdAt.toISOString(),
          updated_at: w.updatedAt.toISOString(),
          my_role: myMember ? myMember.role : 'member',
          member_count: w.members.length,
          doc_count: docCount,
          whiteboard_count: whiteboardCount
        };
      })
    );

    res.json({ workspaces: formatted });
  } catch (err) {
    console.error('Fetch workspaces error:', err);
    res.status(500).json({ error: 'Failed to fetch workspaces.' });
  }
});

// Create a new workspace
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Workspace name is required.' });
    }

    const inviteCode = crypto.randomBytes(6).toString('hex');
    const workspace = await Workspace.create({
      name: name.trim(),
      description: (description || '').trim(),
      inviteCode,
      ownerId: req.user.id,
      members: [
        {
          userId: req.user.id,
          role: 'owner',
          joinedAt: new Date()
        }
      ]
    });

    await logActivity({
      workspaceId: workspace._id,
      userId: req.user.id,
      userName: req.user.name,
      action: 'workspace_created',
      entityType: 'workspace',
      entityId: workspace._id,
      entityTitle: name.trim(),
      details: 'Created new workspace'
    });

    res.status(201).json({
      workspace: {
        id: workspace._id.toString(),
        name: workspace.name,
        description: workspace.description,
        invite_code: workspace.inviteCode,
        owner_id: req.user.id,
        my_role: 'owner',
        created_at: workspace.createdAt.toISOString(),
        updated_at: workspace.updatedAt.toISOString(),
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
router.post('/join/:inviteCode', async (req, res) => {
  try {
    const { inviteCode } = req.params;
    if (!inviteCode) {
      return res.status(400).json({ error: 'Invite code is required.' });
    }

    const workspace = await Workspace.findOne({ inviteCode: inviteCode.trim() });
    if (!workspace) {
      return res.status(404).json({ error: 'Invalid invitation code or workspace does not exist.' });
    }

    const existingMember = workspace.members.find((m) => m.userId.toString() === req.user.id);
    if (existingMember) {
      return res.json({
        message: 'You are already a member of this workspace.',
        workspaceId: workspace._id.toString(),
        role: existingMember.role
      });
    }

    workspace.members.push({
      userId: req.user.id,
      role: 'member',
      joinedAt: new Date()
    });
    await workspace.save();

    await logActivity({
      workspaceId: workspace._id,
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
      workspaceId: workspace._id.toString(),
      name: workspace.name,
      role: 'member'
    });
  } catch (err) {
    console.error('Join workspace error:', err);
    res.status(500).json({ error: 'Failed to join workspace.' });
  }
});

// Get workspace details
router.get('/:workspaceId', requireWorkspaceMember(), async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const workspace = await Workspace.findById(workspaceId).populate('members.userId', 'name email avatarColor bio');

    const projects = await Project.find({ workspaceId }).sort({ createdAt: 1 });
    const documents = await Document.find({ workspaceId }).populate('createdBy', 'name').sort({ updatedAt: -1 });
    const whiteboards = await Whiteboard.find({ workspaceId }).populate('createdBy', 'name').sort({ updatedAt: -1 });

    const formattedMembers = workspace.members.map((m) => ({
      membership_id: m._id.toString(),
      user_id: m.userId?._id?.toString() || m.userId?.toString(),
      name: m.userId?.name || 'User',
      email: m.userId?.email || '',
      avatar_color: m.userId?.avatarColor || '#111111',
      bio: m.userId?.bio || '',
      role: m.role,
      joined_at: m.joinedAt.toISOString()
    }));

    const formattedDocs = documents.map((d) => ({
      id: d._id.toString(),
      workspace_id: d.workspaceId.toString(),
      project_id: d.projectId ? d.projectId.toString() : null,
      title: d.title,
      template_type: d.templateType,
      version: d.version,
      creator_name: d.createdBy?.name || 'Author',
      section_count: d.sections?.length || 0,
      created_at: d.createdAt.toISOString(),
      updated_at: d.updatedAt.toISOString()
    }));

    const formattedWhiteboards = whiteboards.map((w) => ({
      id: w._id.toString(),
      workspace_id: w.workspaceId.toString(),
      project_id: w.projectId ? w.projectId.toString() : null,
      title: w.title,
      version: w.version,
      creator_name: w.createdBy?.name || 'Author',
      created_at: w.createdAt.toISOString(),
      updated_at: w.updatedAt.toISOString()
    }));

    const formattedProjects = projects.map((p) => ({
      id: p._id.toString(),
      workspace_id: p.workspaceId.toString(),
      name: p.name,
      description: p.description,
      doc_count: formattedDocs.filter((d) => d.project_id === p._id.toString()).length
    }));

    res.json({
      workspace: {
        id: workspace._id.toString(),
        name: workspace.name,
        description: workspace.description,
        invite_code: workspace.inviteCode,
        owner_id: workspace.ownerId.toString(),
        myRole: req.workspaceMember.role
      },
      members: formattedMembers,
      projects: formattedProjects,
      documents: formattedDocs,
      whiteboards: formattedWhiteboards
    });
  } catch (err) {
    console.error('Get workspace details error:', err);
    res.status(500).json({ error: 'Failed to retrieve workspace details.' });
  }
});

// Update workspace
router.put('/:workspaceId', requireWorkspaceMember(['owner', 'admin']), async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Workspace name is required.' });
    }

    await Workspace.findByIdAndUpdate(workspaceId, {
      name: name.trim(),
      description: (description || '').trim()
    });

    res.json({ message: 'Workspace updated successfully.' });
  } catch (err) {
    console.error('Update workspace error:', err);
    res.status(500).json({ error: 'Failed to update workspace.' });
  }
});

// Delete workspace
router.delete('/:workspaceId', requireWorkspaceMember(['owner']), async (req, res) => {
  try {
    const { workspaceId } = req.params;
    await Workspace.findByIdAndDelete(workspaceId);
    await Document.deleteMany({ workspaceId });
    await Whiteboard.deleteMany({ workspaceId });
    await Project.deleteMany({ workspaceId });

    res.json({ message: 'Workspace deleted successfully.' });
  } catch (err) {
    console.error('Delete workspace error:', err);
    res.status(500).json({ error: 'Failed to delete workspace.' });
  }
});

// Create project/folder
router.post('/:workspaceId/projects', requireWorkspaceMember(['owner', 'admin', 'member']), async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required.' });
    }

    const project = await Project.create({
      workspaceId,
      name: name.trim(),
      description: (description || '').trim(),
      createdBy: req.user.id
    });

    await logActivity({
      workspaceId,
      userId: req.user.id,
      userName: req.user.name,
      action: 'project_created',
      entityType: 'project',
      entityId: project._id,
      entityTitle: name.trim(),
      details: 'Created folder/project'
    });

    res.status(201).json({
      project: {
        id: project._id.toString(),
        workspace_id: workspaceId,
        name: project.name,
        description: project.description,
        created_by: req.user.id,
        created_at: project.createdAt.toISOString(),
        doc_count: 0
      }
    });
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: 'Failed to create project.' });
  }
});

// Update member role
router.put('/:workspaceId/members/:targetUserId', requireWorkspaceMember(['owner', 'admin']), async (req, res) => {
  try {
    const { workspaceId, targetUserId } = req.params;
    const { role } = req.body;

    if (!['admin', 'member', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role specified.' });
    }

    const workspace = req.workspace;
    if (workspace.ownerId.toString() === targetUserId) {
      return res.status(400).json({ error: 'Cannot modify workspace owner role.' });
    }

    const member = workspace.members.find((m) => m.userId.toString() === targetUserId);
    if (!member) {
      return res.status(404).json({ error: 'Member not found in workspace.' });
    }

    member.role = role;
    await workspace.save();

    res.json({ message: 'Member role updated.' });
  } catch (err) {
    console.error('Update member role error:', err);
    res.status(500).json({ error: 'Failed to update member role.' });
  }
});

// Remove member or leave
router.delete('/:workspaceId/members/:targetUserId', requireWorkspaceMember(), async (req, res) => {
  try {
    const { workspaceId, targetUserId } = req.params;
    const isSelf = req.user.id === targetUserId;
    const workspace = req.workspace;

    if (workspace.ownerId.toString() === targetUserId) {
      return res.status(400).json({ error: 'Workspace owner cannot leave or be removed.' });
    }

    if (!isSelf && !['owner', 'admin'].includes(req.workspaceMember.role)) {
      return res.status(403).json({ error: 'Only owners and admins can remove other members.' });
    }

    workspace.members = workspace.members.filter((m) => m.userId.toString() !== targetUserId);
    await workspace.save();

    // Unassign sections in this workspace
    await Document.updateMany(
      { workspaceId, 'sections.assignedTo': targetUserId },
      {
        $set: {
          'sections.$[elem].assignedTo': null,
          'sections.$[elem].assignedName': null,
          'sections.$[elem].lockedBy': null,
          'sections.$[elem].lockedByName': null,
          'sections.$[elem].lockedAt': null
        }
      },
      { arrayFilters: [{ 'elem.assignedTo': targetUserId }] }
    );

    res.json({ message: isSelf ? 'You have left the workspace.' : 'Member removed.' });
  } catch (err) {
    console.error('Remove member error:', err);
    res.status(500).json({ error: 'Failed to remove member.' });
  }
});

// Regenerate invite link
router.post('/:workspaceId/invite-link', requireWorkspaceMember(['owner', 'admin']), async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const newCode = crypto.randomBytes(6).toString('hex');
    await Workspace.findByIdAndUpdate(workspaceId, { inviteCode: newCode });

    res.json({ inviteCode: newCode });
  } catch (err) {
    console.error('Regenerate invite code error:', err);
    res.status(500).json({ error: 'Failed to update invite code.' });
  }
});

export default router;
