import express from 'express';
import crypto from 'crypto';
import Document from '../models/Document.js';
import DocumentVersion from '../models/DocumentVersion.js';
import Workspace from '../models/Workspace.js';
import User from '../models/User.js';
import { logActivity } from '../db/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireWorkspaceMember, requireDocumentAccess } from '../middleware/permissions.js';
import { DOCUMENT_TEMPLATES } from '../db/templates.js';

const router = express.Router();
router.use(authenticateToken);

// Helper to clean expired section locks (>60s)
async function cleanExpiredLocks(documentId) {
  try {
    const cutoff = new Date(Date.now() - 60000);
    const doc = await Document.findById(documentId);
    if (!doc || !doc.sections) return;

    let modified = false;
    for (const sec of doc.sections) {
      if (sec.lockedAt && (!sec.lockHeartbeat || sec.lockHeartbeat < cutoff)) {
        sec.lockedBy = null;
        sec.lockedByName = null;
        sec.lockedAt = null;
        sec.lockHeartbeat = null;
        modified = true;
      }
    }

    if (modified) {
      await doc.save();
    }
  } catch (err) {
    console.error('Error cleaning expired locks:', err);
  }
}

// Get all documents in workspace
router.get('/workspace/:workspaceId', requireWorkspaceMember(), async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const documents = await Document.find({ workspaceId })
      .populate('createdBy', 'name')
      .populate('projectId', 'name')
      .sort({ updatedAt: -1 });

    const formatted = documents.map((d) => ({
      id: d._id.toString(),
      workspace_id: d.workspaceId.toString(),
      project_id: d.projectId ? d.projectId._id.toString() : null,
      project_name: d.projectId ? d.projectId.name : null,
      title: d.title,
      template_type: d.templateType,
      version: d.version,
      created_by: d.createdBy ? d.createdBy._id.toString() : null,
      creator_name: d.createdBy ? d.createdBy.name : 'Author',
      section_count: d.sections.length,
      created_at: d.createdAt.toISOString(),
      updated_at: d.updatedAt.toISOString()
    }));

    res.json({ documents: formatted });
  } catch (err) {
    console.error('Fetch documents error:', err);
    res.status(500).json({ error: 'Failed to fetch documents.' });
  }
});

// Create a new document
router.post('/', requireWorkspaceMember(), async (req, res) => {
  try {
    const { workspaceId, projectId, title, templateType = 'custom', customSections } = req.body;
    const docTitle = (title && title.trim()) || 'Untitled Document';

    const template = DOCUMENT_TEMPLATES[templateType] || DOCUMENT_TEMPLATES['custom'];
    const sectionsToInsert = Array.isArray(customSections) && customSections.length > 0
      ? customSections.map((s, idx) => ({
          sectionKey: s.key || `sec-${idx}`,
          title: s.title || `Section ${idx + 1}`,
          content: s.content || '',
          orderIndex: idx,
          version: 1
        }))
      : template.sections.map((s, idx) => ({
          sectionKey: s.key,
          title: s.title,
          content: s.content,
          orderIndex: idx,
          version: 1
        }));

    const doc = await Document.create({
      workspaceId,
      projectId: projectId || null,
      title: docTitle,
      templateType,
      shareCode: crypto.randomBytes(6).toString('hex'),
      version: 1,
      createdBy: req.user.id,
      sections: sectionsToInsert
    });

    // Create initial version snapshot
    await DocumentVersion.create({
      documentId: doc._id,
      versionNumber: 1,
      title: docTitle,
      sectionsSnapshot: doc.sections,
      createdBy: req.user.id,
      createdByName: req.user.name,
      summary: 'Initial template creation'
    });

    await logActivity({
      workspaceId,
      userId: req.user.id,
      userName: req.user.name,
      action: 'document_created',
      entityType: 'document',
      entityId: doc._id,
      entityTitle: docTitle,
      details: `Created document using template "${template.name || templateType}"`
    });

    res.status(201).json({
      document: {
        id: doc._id.toString(),
        workspace_id: doc.workspaceId.toString(),
        project_id: doc.projectId ? doc.projectId.toString() : null,
        title: doc.title,
        template_type: doc.templateType,
        share_code: doc.shareCode,
        version: doc.version,
        created_by: doc.createdBy.toString(),
        created_at: doc.createdAt.toISOString(),
        updated_at: doc.updatedAt.toISOString()
      }
    });
  } catch (err) {
    console.error('Create document error:', err);
    res.status(500).json({ error: 'Failed to create document.' });
  }
});

// Get a single document with all sections
router.get('/:id', requireDocumentAccess, async (req, res) => {
  try {
    const { id } = req.params;
    await cleanExpiredLocks(id);

    const doc = await Document.findById(id)
      .populate('createdBy', 'name')
      .populate('projectId', 'name');

    if (!doc.shareCode) {
      doc.shareCode = crypto.randomBytes(6).toString('hex');
      await doc.save();
    }

    // Get workspace members
    const workspace = await Workspace.findById(doc.workspaceId).populate('members.userId', 'name email avatarColor avatarIcon');
    const workspaceMembers = workspace.members.map((m) => ({
      id: m.userId?._id?.toString() || m.userId?.toString(),
      name: m.userId?.name || 'User',
      email: m.userId?.email || '',
      avatar_color: m.userId?.avatarColor || '#111111',
      avatar_icon: m.userId?.avatarIcon || 'user',
      role: m.role
    }));

    // Format sections
    const formattedSections = doc.sections
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((s) => ({
        id: s._id.toString(),
        document_id: doc._id.toString(),
        section_key: s.sectionKey,
        title: s.title,
        content: s.content,
        order_index: s.orderIndex,
        assigned_to: s.assignedTo ? s.assignedTo.toString() : null,
        assigned_name: s.assignedName,
        locked_by: s.lockedBy ? s.lockedBy.toString() : null,
        locked_by_name: s.lockedByName,
        locked_at: s.lockedAt ? s.lockedAt.toISOString() : null,
        version: s.version,
        updated_at: s.updatedAt ? s.updatedAt.toISOString() : doc.updatedAt.toISOString()
      }));

    res.json({
      document: {
        id: doc._id.toString(),
        workspace_id: doc.workspaceId.toString(),
        project_id: doc.projectId ? doc.projectId._id.toString() : null,
        project_name: doc.projectId ? doc.projectId.name : null,
        title: doc.title,
        template_type: doc.templateType,
        share_code: doc.shareCode,
        version: doc.version,
        created_by: doc.createdBy ? doc.createdBy._id.toString() : null,
        creator_name: doc.createdBy ? doc.createdBy.name : 'Author',
        created_at: doc.createdAt.toISOString(),
        updated_at: doc.updatedAt.toISOString()
      },
      sections: formattedSections,
      workspaceMembers,
      currentUserRole: req.workspaceMember.role
    });
  } catch (err) {
    console.error('Get document details error:', err);
    res.status(500).json({ error: 'Failed to fetch document.' });
  }
});

// Update document metadata (title, projectId)
router.put('/:id', requireDocumentAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, projectId } = req.body;

    const doc = req.document;
    if (title) doc.title = title.trim();
    if (projectId !== undefined) doc.projectId = projectId || null;
    await doc.save();

    await logActivity({
      workspaceId: doc.workspaceId,
      userId: req.user.id,
      userName: req.user.name,
      action: 'document_updated',
      entityType: 'document',
      entityId: id,
      entityTitle: doc.title,
      details: 'Updated document settings'
    });

    res.json({ message: 'Document updated successfully.' });
  } catch (err) {
    console.error('Update document error:', err);
    res.status(500).json({ error: 'Failed to update document.' });
  }
});

// Delete document
router.delete('/:id', requireDocumentAccess, async (req, res) => {
  try {
    const { id } = req.params;

    if (req.workspaceMember.role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot delete documents.' });
    }

    await Document.findByIdAndDelete(id);
    await DocumentVersion.deleteMany({ documentId: id });

    await logActivity({
      workspaceId: req.document.workspaceId,
      userId: req.user.id,
      userName: req.user.name,
      action: 'document_deleted',
      entityType: 'document',
      entityId: id,
      entityTitle: req.document.title,
      details: 'Deleted document'
    });

    res.json({ message: 'Document deleted successfully.' });
  } catch (err) {
    console.error('Delete document error:', err);
    res.status(500).json({ error: 'Failed to delete document.' });
  }
});

// Add section
router.post('/:id/sections', requireDocumentAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { title = 'New Section', content = '', assignedTo = null } = req.body;

    const doc = req.document;
    let assignedName = null;
    if (assignedTo) {
      const u = await User.findById(assignedTo);
      assignedName = u ? u.name : null;
    }

    // Helper: detect if a section is a footer section
    const isFooter = (s) => {
      const t = (s.title || '').toLowerCase();
      const k = (s.sectionKey || '').toLowerCase();
      return t.includes('footer') || k.includes('footer');
    };

    const isNewFooter = (title || '').toLowerCase().includes('footer');

    // Find if the document already has a footer section
    const existingFooterIdx = doc.sections.findIndex((s) => isFooter(s));

    let insertIndex = doc.sections.length;
    // If a footer already exists and the new section is NOT a footer, insert before the footer!
    if (existingFooterIdx !== -1 && !isNewFooter) {
      insertIndex = existingFooterIdx;
    }

    const newSection = {
      sectionKey: `section-${Date.now()}`,
      title: title.trim(),
      content,
      orderIndex: insertIndex,
      assignedTo: assignedTo || null,
      assignedName,
      version: 1,
      updatedAt: new Date()
    };

    doc.sections.splice(insertIndex, 0, newSection);

    // Re-index orderIndex for all sections so they remain contiguous
    doc.sections.forEach((s, idx) => {
      s.orderIndex = idx;
    });

    await doc.save();

    const added = doc.sections[insertIndex];

    await logActivity({
      workspaceId: doc.workspaceId,
      userId: req.user.id,
      userName: req.user.name,
      action: 'section_created',
      entityType: 'section',
      entityId: added._id,
      entityTitle: added.title,
      details: `Added new section to "${doc.title}"`
    });

    const formattedAdded = {
      id: added._id.toString(),
      document_id: doc._id.toString(),
      section_key: added.sectionKey,
      title: added.title,
      content: added.content,
      order_index: added.orderIndex,
      assigned_to: added.assignedTo ? added.assignedTo.toString() : null,
      assigned_name: added.assignedName,
      locked_by: null,
      locked_by_name: null,
      locked_at: null,
      version: added.version,
      updated_at: added.updatedAt.toISOString()
    };

    // Broadcast newly added section in real-time to all collaborators viewing this document
    if (req.io) {
      req.io.to(`doc:${doc._id.toString()}`).emit('section_added', {
        documentId: doc._id.toString(),
        section: formattedAdded,
        creatorId: req.user.id
      });
    }

    // Broadcast reordered section IDs so all clients update their view immediately
    if (req.io) {
      const sectionIds = doc.sections.map((s) => s._id.toString());
      req.io.to(`doc:${doc._id.toString()}`).emit('sections_order_updated', {
        documentId: doc._id.toString(),
        sectionIds
      });
    }

    res.status(201).json({
      section: formattedAdded,
      sectionIds: doc.sections.map((s) => s._id.toString())
    });
  } catch (err) {
    console.error('Add section error:', err);
    res.status(500).json({ error: 'Failed to add section.' });
  }
});

// Update a section (with optimistic version checking and lock validation)
router.put('/:id/sections/:sectionId', requireDocumentAccess, async (req, res) => {
  try {
    const { id, sectionId } = req.params;
    const { title, content, expectedVersion, force = false } = req.body;
    await cleanExpiredLocks(id);

    const doc = await Document.findById(id);
    const section = doc.sections.id(sectionId);

    if (!section) {
      return res.status(404).json({ error: 'Section not found.' });
    }

    // Lock validation: if locked by another user
    if (section.lockedBy && section.lockedBy.toString() !== req.user.id) {
      return res.status(423).json({
        error: `This section is currently being edited by ${section.lockedByName || 'another collaborator'}.`,
        lockedBy: section.lockedBy.toString(),
        lockedByName: section.lockedByName
      });
    }

    // Optimistic version check:
    // If the client's version is behind because of a prior save by the same locked user,
    // or if force is true, allow update and advance version.
    if (!force && expectedVersion !== undefined && section.version > expectedVersion && section.lockedBy?.toString() !== req.user.id) {
      return res.status(409).json({
        error: 'Section was modified by another collaborator. Please refresh or merge changes.',
        serverVersion: section.version,
        serverContent: section.content,
        serverTitle: section.title
      });
    }

    if (title !== undefined) section.title = title;
    if (content !== undefined) section.content = content;
    section.version = (section.version || 0) + 1;
    section.updatedAt = new Date();

    await doc.save();

    res.json({
      section: {
        id: section._id.toString(),
        document_id: doc._id.toString(),
        section_key: section.sectionKey,
        title: section.title,
        content: section.content,
        order_index: section.orderIndex,
        assigned_to: section.assignedTo ? section.assignedTo.toString() : null,
        assigned_name: section.assignedName,
        locked_by: section.lockedBy ? section.lockedBy.toString() : null,
        locked_by_name: section.lockedByName,
        version: section.version,
        updated_at: section.updatedAt.toISOString()
      },
      message: 'Section saved successfully.'
    });
  } catch (err) {
    console.error('Update section error:', err);
    res.status(500).json({ error: 'Failed to update section.' });
  }
});

// Delete a section
router.delete('/:id/sections/:sectionId', requireDocumentAccess, async (req, res) => {
  try {
    const { id, sectionId } = req.params;
    const doc = req.document;

    const section = doc.sections.id(sectionId);
    if (!section) {
      return res.status(404).json({ error: 'Section not found.' });
    }

    const title = section.title;
    doc.sections.pull(sectionId);

    // Reindex remaining sections
    doc.sections.forEach((s, idx) => {
      s.orderIndex = idx;
    });

    await doc.save();

    await logActivity({
      workspaceId: doc.workspaceId,
      userId: req.user.id,
      userName: req.user.name,
      action: 'section_deleted',
      entityType: 'section',
      entityId: sectionId,
      entityTitle: title,
      details: `Removed section from "${doc.title}"`
    });

    // Broadcast deleted section in real-time
    if (req.io) {
      req.io.to(`doc:${doc._id.toString()}`).emit('section_deleted', {
        documentId: doc._id.toString(),
        sectionId
      });
    }

    res.json({ message: 'Section removed.' });
  } catch (err) {
    console.error('Delete section error:', err);
    res.status(500).json({ error: 'Failed to delete section.' });
  }
});

// Reorder sections
router.put('/:id/reorder-sections', requireDocumentAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { sectionIds } = req.body;

    if (!Array.isArray(sectionIds)) {
      return res.status(400).json({ error: 'sectionIds array is required.' });
    }

    const doc = req.document;
    const sectionMap = new Map(doc.sections.map((s) => [s._id.toString(), s]));

    const reordered = [];
    sectionIds.forEach((secId, idx) => {
      const s = sectionMap.get(secId);
      if (s) {
        s.orderIndex = idx;
        reordered.push(s);
      }
    });

    doc.sections = reordered;
    await doc.save();

    res.json({ message: 'Sections reordered successfully.' });
  } catch (err) {
    console.error('Reorder sections error:', err);
    res.status(500).json({ error: 'Failed to reorder sections.' });
  }
});

// Assign section
router.post('/:id/sections/:sectionId/assign', requireDocumentAccess, async (req, res) => {
  try {
    const { id, sectionId } = req.params;
    const { assignedTo } = req.body;

    let assignedName = null;
    if (assignedTo) {
      const user = await User.findById(assignedTo);
      if (!user) {
        return res.status(404).json({ error: 'Assigned user does not exist.' });
      }
      assignedName = user.name;
    }

    const doc = req.document;
    const section = doc.sections.id(sectionId);
    if (!section) {
      return res.status(404).json({ error: 'Section not found.' });
    }

    section.assignedTo = assignedTo || null;
    section.assignedName = assignedName;
    await doc.save();

    await logActivity({
      workspaceId: doc.workspaceId,
      userId: req.user.id,
      userName: req.user.name,
      action: 'section_assigned',
      entityType: 'section',
      entityId: sectionId,
      entityTitle: section.title,
      details: assignedTo ? `Assigned section to ${assignedName}` : 'Unassigned section'
    });

    res.json({
      section: {
        id: section._id.toString(),
        assigned_to: section.assignedTo ? section.assignedTo.toString() : null,
        assigned_name: section.assignedName
      },
      message: 'Assignment updated.'
    });
  } catch (err) {
    console.error('Assign section error:', err);
    res.status(500).json({ error: 'Failed to assign section.' });
  }
});

// Lock section for editing
router.post('/:id/sections/:sectionId/lock', requireDocumentAccess, async (req, res) => {
  try {
    const { id, sectionId } = req.params;
    await cleanExpiredLocks(id);

    const doc = await Document.findById(id);
    const section = doc.sections.id(sectionId);

    if (!section) {
      return res.status(404).json({ error: 'Section not found.' });
    }

    if (section.lockedBy && section.lockedBy.toString() !== req.user.id) {
      return res.status(423).json({
        error: `Section is currently locked by ${section.lockedByName || 'another collaborator'}.`,
        lockedBy: section.lockedBy.toString(),
        lockedByName: section.lockedByName
      });
    }

    const now = new Date();
    section.lockedBy = req.user.id;
    section.lockedByName = req.user.name;
    section.lockedAt = now;
    section.lockHeartbeat = now;
    await doc.save();

    res.json({
      message: 'Lock acquired.',
      sectionId,
      lockedBy: req.user.id,
      lockedByName: req.user.name,
      lockedAt: now.toISOString()
    });
  } catch (err) {
    console.error('Acquire lock error:', err);
    res.status(500).json({ error: 'Failed to acquire section lock.' });
  }
});

// Release section lock
router.post('/:id/sections/:sectionId/unlock', requireDocumentAccess, async (req, res) => {
  try {
    const { id, sectionId } = req.params;
    const doc = req.document;
    const section = doc.sections.id(sectionId);

    if (section && (section.lockedBy?.toString() === req.user.id || ['owner', 'admin'].includes(req.workspaceMember.role))) {
      section.lockedBy = null;
      section.lockedByName = null;
      section.lockedAt = null;
      section.lockHeartbeat = null;
      await doc.save();
    }

    res.json({ message: 'Lock released.', sectionId });
  } catch (err) {
    console.error('Release lock error:', err);
    res.status(500).json({ error: 'Failed to release lock.' });
  }
});

// Version history list
router.get('/:id/versions', requireDocumentAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const versions = await DocumentVersion.find({ documentId: id }).sort({ versionNumber: -1 });

    const formatted = versions.map((v) => ({
      id: v._id.toString(),
      document_id: v.documentId.toString(),
      version_number: v.versionNumber,
      title: v.title,
      created_by: v.createdBy.toString(),
      created_by_name: v.createdByName,
      summary: v.summary,
      created_at: v.createdAt.toISOString()
    }));

    res.json({ versions: formatted });
  } catch (err) {
    console.error('Fetch versions error:', err);
    res.status(500).json({ error: 'Failed to fetch version history.' });
  }
});

// Create manual snapshot version
router.post('/:id/versions', requireDocumentAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { summary = 'Manual snapshot' } = req.body;
    const doc = req.document;

    const latest = await DocumentVersion.findOne({ documentId: id }).sort({ versionNumber: -1 });
    const nextVersionNum = (latest?.versionNumber || 0) + 1;

    const version = await DocumentVersion.create({
      documentId: id,
      versionNumber: nextVersionNum,
      title: doc.title,
      sectionsSnapshot: doc.sections,
      createdBy: req.user.id,
      createdByName: req.user.name,
      summary: summary.trim()
    });

    await logActivity({
      workspaceId: doc.workspaceId,
      userId: req.user.id,
      userName: req.user.name,
      action: 'version_created',
      entityType: 'document',
      entityId: id,
      entityTitle: doc.title,
      details: `Created version ${nextVersionNum}: ${summary}`
    });

    res.status(201).json({
      message: 'Version snapshot created.',
      version: {
        id: version._id.toString(),
        version_number: nextVersionNum,
        created_at: version.createdAt.toISOString(),
        created_by_name: req.user.name,
        summary
      }
    });
  } catch (err) {
    console.error('Create version error:', err);
    res.status(500).json({ error: 'Failed to create version snapshot.' });
  }
});

// Restore previous version
router.post('/:id/versions/:versionId/restore', requireDocumentAccess, async (req, res) => {
  try {
    const { id, versionId } = req.params;

    if (req.workspaceMember.role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot restore versions.' });
    }

    const versionToRestore = await DocumentVersion.findOne({ _id: versionId, documentId: id });
    if (!versionToRestore) {
      return res.status(404).json({ error: 'Version record not found.' });
    }

    const doc = req.document;

    // Save auto-backup of current state
    const latest = await DocumentVersion.findOne({ documentId: id }).sort({ versionNumber: -1 });
    const backupVersionNum = (latest?.versionNumber || 0) + 1;

    await DocumentVersion.create({
      documentId: id,
      versionNumber: backupVersionNum,
      title: doc.title,
      sectionsSnapshot: doc.sections,
      createdBy: req.user.id,
      createdByName: req.user.name,
      summary: `Auto-backup before restoring Version ${versionToRestore.versionNumber}`
    });

    // Replace current sections with snapshot sections
    doc.sections = versionToRestore.sectionsSnapshot.map((s, idx) => ({
      sectionKey: s.sectionKey || s.section_key || `sec-${idx}`,
      title: s.title,
      content: s.content,
      orderIndex: idx,
      assignedTo: s.assignedTo || null,
      assignedName: s.assignedName || null,
      version: 1,
      updatedAt: new Date()
    }));

    await doc.save();

    await logActivity({
      workspaceId: doc.workspaceId,
      userId: req.user.id,
      userName: req.user.name,
      action: 'version_restored',
      entityType: 'document',
      entityId: id,
      entityTitle: doc.title,
      details: `Restored to version ${versionToRestore.versionNumber}`
    });

    const formattedSections = doc.sections.map((s) => ({
      id: s._id.toString(),
      document_id: doc._id.toString(),
      section_key: s.sectionKey,
      title: s.title,
      content: s.content,
      order_index: s.orderIndex,
      assigned_to: s.assignedTo ? s.assignedTo.toString() : null,
      assigned_name: s.assignedName,
      locked_by: null,
      locked_by_name: null,
      version: s.version,
      updated_at: s.updatedAt.toISOString()
    }));

    res.json({
      message: `Successfully restored to Version ${versionToRestore.versionNumber}.`,
      sections: formattedSections
    });
  } catch (err) {
    console.error('Restore version error:', err);
    res.status(500).json({ error: 'Failed to restore document version.' });
  }
});

// Regenerate document share code
router.post('/:id/share-code', requireDocumentAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const doc = req.document;
    doc.shareCode = crypto.randomBytes(6).toString('hex');
    await doc.save();
    res.json({ shareCode: doc.shareCode });
  } catch (err) {
    console.error('Regenerate document share code error:', err);
    res.status(500).json({ error: 'Failed to regenerate share code.' });
  }
});

// Join document directly by 12-char share code
router.post('/join/:shareCode', async (req, res) => {
  try {
    const { shareCode } = req.params;
    if (!shareCode) {
      return res.status(400).json({ error: 'Share code is required.' });
    }

    const doc = await Document.findOne({ shareCode: shareCode.trim() });
    if (!doc) {
      return res.status(404).json({ error: 'Invalid share code or document not found.' });
    }

    const isCollaborator = (doc.collaborators || []).some(
      (c) => c.userId?.toString() === req.user.id
    );

    if (!isCollaborator && doc.createdBy.toString() !== req.user.id) {
      doc.collaborators.push({
        userId: req.user.id,
        role: 'editor',
        joinedAt: new Date()
      });
      await doc.save();
    }

    res.json({
      type: 'document',
      documentId: doc._id.toString(),
      workspaceId: doc.workspaceId.toString(),
      title: doc.title
    });
  } catch (err) {
    console.error('Join document error:', err);
    res.status(500).json({ error: 'Failed to join document.' });
  }
});

export default router;
