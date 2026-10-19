import express from 'express';
import crypto from 'crypto';
import db, { logActivity } from '../db/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireWorkspaceMember, requireDocumentAccess } from '../middleware/permissions.js';
import { DOCUMENT_TEMPLATES } from '../db/templates.js';

const router = express.Router();
router.use(authenticateToken);

// Helper to clean up expired section locks (older than 60s)
function cleanExpiredLocks(documentId) {
  try {
    const cutoff = new Date(Date.now() - 60000).toISOString();
    const updateStmt = db.prepare(`
      UPDATE document_sections
      SET locked_by = NULL, locked_by_name = NULL, locked_at = NULL, lock_heartbeat = NULL
      WHERE document_id = ? AND locked_at IS NOT NULL AND (lock_heartbeat < ? OR lock_heartbeat IS NULL)
    `);
    updateStmt.run(documentId, cutoff);
  } catch (err) {
    console.error('Error cleaning expired locks:', err);
  }
}

// Get all documents in a workspace
router.get('/workspace/:workspaceId', requireWorkspaceMember(), (req, res) => {
  try {
    const { workspaceId } = req.params;
    const stmt = db.prepare(`
      SELECT 
        d.id, 
        d.workspace_id, 
        d.project_id, 
        d.title, 
        d.template_type, 
        d.version, 
        d.created_by, 
        d.created_at, 
        d.updated_at,
        u.name as creator_name,
        p.name as project_name,
        (SELECT COUNT(*) FROM document_sections WHERE document_id = d.id) as section_count
      FROM documents d
      JOIN users u ON u.id = d.created_by
      LEFT JOIN projects p ON p.id = d.project_id
      WHERE d.workspace_id = ?
      ORDER BY d.updated_at DESC
    `);
    const documents = stmt.all(workspaceId);
    res.json({ documents });
  } catch (err) {
    console.error('Fetch documents error:', err);
    res.status(500).json({ error: 'Failed to fetch documents.' });
  }
});

// Create a new document (from template or custom)
router.post('/', requireWorkspaceMember(), (req, res) => {
  try {
    const { workspaceId, projectId, title, templateType = 'custom', customSections } = req.body;

    if (!workspaceId) {
      return res.status(400).json({ error: 'Workspace ID is required.' });
    }

    const docTitle = (title && title.trim()) || 'Untitled Document';
    const docId = crypto.randomUUID();
    const now = new Date().toISOString();

    const insertDoc = db.prepare(`
      INSERT INTO documents (id, workspace_id, project_id, title, template_type, version, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
    `);
    insertDoc.run(docId, workspaceId, projectId || null, docTitle, templateType, req.user.id, now, now);

    // Determine sections to insert
    const template = DOCUMENT_TEMPLATES[templateType] || DOCUMENT_TEMPLATES['custom'];
    const sectionsToInsert = Array.isArray(customSections) && customSections.length > 0
      ? customSections
      : template.sections;

    const insertSection = db.prepare(`
      INSERT INTO document_sections (id, document_id, section_key, title, content, order_index, assigned_to, assigned_name, version, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);

    sectionsToInsert.forEach((sec, idx) => {
      insertSection.run(
        crypto.randomUUID(),
        docId,
        sec.key || `sec-${idx}`,
        sec.title || `Section ${idx + 1}`,
        sec.content || '',
        idx,
        null,
        null,
        now
      );
    });

    // Create initial version snapshot
    const initialSections = db.prepare('SELECT * FROM document_sections WHERE document_id = ? ORDER BY order_index ASC').all(docId);
    db.prepare(`
      INSERT INTO document_versions (id, document_id, version_number, title, sections_snapshot, created_by, created_by_name, summary, created_at)
      VALUES (?, ?, 1, ?, ?, ?, ?, 'Initial template creation', ?)
    `).run(crypto.randomUUID(), docId, docTitle, JSON.stringify(initialSections), req.user.id, req.user.name, now);

    logActivity({
      workspaceId,
      userId: req.user.id,
      userName: req.user.name,
      action: 'document_created',
      entityType: 'document',
      entityId: docId,
      entityTitle: docTitle,
      details: `Created document using template "${template.name || templateType}"`
    });

    res.status(201).json({
      document: {
        id: docId,
        workspace_id: workspaceId,
        project_id: projectId || null,
        title: docTitle,
        template_type: templateType,
        version: 1,
        created_by: req.user.id,
        created_at: now,
        updated_at: now
      }
    });
  } catch (err) {
    console.error('Create document error:', err);
    res.status(500).json({ error: 'Failed to create document.' });
  }
});

// Get a single document with all its sections and clean lock statuses
router.get('/:id', requireDocumentAccess, (req, res) => {
  try {
    const { id } = req.params;
    cleanExpiredLocks(id);

    const docStmt = db.prepare(`
      SELECT d.*, u.name as creator_name, p.name as project_name
      FROM documents d
      JOIN users u ON u.id = d.created_by
      LEFT JOIN projects p ON p.id = d.project_id
      WHERE d.id = ?
    `);
    const doc = docStmt.get(id);

    const sectionsStmt = db.prepare(`
      SELECT s.*, 
             u_assign.name as assigned_user_name, u_assign.avatar_color as assigned_avatar_color,
             u_lock.name as locked_user_name, u_lock.avatar_color as locked_avatar_color
      FROM document_sections s
      LEFT JOIN users u_assign ON u_assign.id = s.assigned_to
      LEFT JOIN users u_lock ON u_lock.id = s.locked_by
      WHERE s.document_id = ?
      ORDER BY s.order_index ASC
    `);
    const sections = sectionsStmt.all(id);

    // Get workspace members for section assignment dropdown
    const membersStmt = db.prepare(`
      SELECT u.id, u.name, u.email, u.avatar_color, wm.role
      FROM workspace_members wm
      JOIN users u ON u.id = wm.user_id
      WHERE wm.workspace_id = ?
      ORDER BY u.name ASC
    `);
    const workspaceMembers = membersStmt.all(doc.workspace_id);

    res.json({
      document: doc,
      sections,
      workspaceMembers,
      currentUserRole: req.workspaceMember.role
    });
  } catch (err) {
    console.error('Get document details error:', err);
    res.status(500).json({ error: 'Failed to fetch document.' });
  }
});

// Update document metadata (title, project_id)
router.put('/:id', requireDocumentAccess, (req, res) => {
  try {
    const { id } = req.params;
    const { title, projectId } = req.body;
    const now = new Date().toISOString();

    const updateStmt = db.prepare(`
      UPDATE documents
      SET title = COALESCE(?, title),
          project_id = ?,
          updated_at = ?
      WHERE id = ?
    `);
    updateStmt.run(title ? title.trim() : null, projectId !== undefined ? projectId : null, now, id);

    logActivity({
      workspaceId: req.document.workspace_id,
      userId: req.user.id,
      userName: req.user.name,
      action: 'document_updated',
      entityType: 'document',
      entityId: id,
      entityTitle: title ? title.trim() : req.document.title,
      details: 'Updated document settings'
    });

    res.json({ message: 'Document updated successfully.' });
  } catch (err) {
    console.error('Update document error:', err);
    res.status(500).json({ error: 'Failed to update document.' });
  }
});

// Delete document
router.delete('/:id', requireDocumentAccess, (req, res) => {
  try {
    const { id } = req.params;

    if (req.workspaceMember.role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot delete documents.' });
    }

    db.prepare('DELETE FROM documents WHERE id = ?').run(id);

    logActivity({
      workspaceId: req.document.workspace_id,
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

// Add a new section to document
router.post('/:id/sections', requireDocumentAccess, (req, res) => {
  try {
    const { id } = req.params;
    const { title = 'New Section', content = '', assignedTo = null } = req.body;

    const countStmt = db.prepare('SELECT COUNT(*) as count FROM document_sections WHERE document_id = ?');
    const { count } = countStmt.get(id);

    const sectionId = crypto.randomUUID();
    const sectionKey = `section-${Date.now()}`;
    const now = new Date().toISOString();

    let assignedName = null;
    if (assignedTo) {
      const u = db.prepare('SELECT name FROM users WHERE id = ?').get(assignedTo);
      assignedName = u ? u.name : null;
    }

    const insertStmt = db.prepare(`
      INSERT INTO document_sections (id, document_id, section_key, title, content, order_index, assigned_to, assigned_name, version, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);
    insertStmt.run(sectionId, id, sectionKey, title.trim(), content, count, assignedTo, assignedName, now);

    // Update document updated_at
    db.prepare('UPDATE documents SET updated_at = ? WHERE id = ?').run(now, id);

    logActivity({
      workspaceId: req.document.workspace_id,
      userId: req.user.id,
      userName: req.user.name,
      action: 'section_created',
      entityType: 'section',
      entityId: sectionId,
      entityTitle: title.trim(),
      details: `Added new section to "${req.document.title}"`
    });

    const newSection = db.prepare('SELECT * FROM document_sections WHERE id = ?').get(sectionId);
    res.status(201).json({ section: newSection });
  } catch (err) {
    console.error('Add section error:', err);
    res.status(500).json({ error: 'Failed to add section.' });
  }
});

// Update a section (with optimistic version checking and lock validation)
router.put('/:id/sections/:sectionId', requireDocumentAccess, (req, res) => {
  try {
    const { id, sectionId } = req.params;
    const { title, content, expectedVersion, force = false } = req.body;
    cleanExpiredLocks(id);

    const currentSection = db.prepare('SELECT * FROM document_sections WHERE id = ? AND document_id = ?').get(sectionId, id);
    if (!currentSection) {
      return res.status(404).json({ error: 'Section not found.' });
    }

    // Lock validation: if locked by someone else, check lock
    if (currentSection.locked_by && currentSection.locked_by !== req.user.id) {
      return res.status(423).json({
        error: `This section is currently being edited by ${currentSection.locked_by_name || 'another collaborator'}.`,
        lockedBy: currentSection.locked_by,
        lockedByName: currentSection.locked_by_name
      });
    }

    // Optimistic version check to prevent overwrite collisions
    if (!force && expectedVersion !== undefined && currentSection.version !== expectedVersion) {
      return res.status(409).json({
        error: 'Section was modified by another collaborator. Please refresh or merge changes.',
        serverVersion: currentSection.version,
        serverContent: currentSection.content,
        serverTitle: currentSection.title
      });
    }

    const nextVersion = currentSection.version + 1;
    const now = new Date().toISOString();

    const updateStmt = db.prepare(`
      UPDATE document_sections
      SET title = COALESCE(?, title),
          content = COALESCE(?, content),
          version = ?,
          updated_at = ?
      WHERE id = ?
    `);
    updateStmt.run(title !== undefined ? title : null, content !== undefined ? content : null, nextVersion, now, sectionId);

    // Update document timestamp
    db.prepare('UPDATE documents SET updated_at = ? WHERE id = ?').run(now, id);

    const updated = db.prepare('SELECT * FROM document_sections WHERE id = ?').get(sectionId);

    res.json({
      section: updated,
      message: 'Section saved successfully.'
    });
  } catch (err) {
    console.error('Update section error:', err);
    res.status(500).json({ error: 'Failed to update section.' });
  }
});

// Delete a section
router.delete('/:id/sections/:sectionId', requireDocumentAccess, (req, res) => {
  try {
    const { id, sectionId } = req.params;

    const current = db.prepare('SELECT title FROM document_sections WHERE id = ? AND document_id = ?').get(sectionId, id);
    if (!current) {
      return res.status(404).json({ error: 'Section not found.' });
    }

    db.prepare('DELETE FROM document_sections WHERE id = ?').run(sectionId);

    // Reorder remaining sections
    const remaining = db.prepare('SELECT id FROM document_sections WHERE document_id = ? ORDER BY order_index ASC').all(id);
    const updateOrder = db.prepare('UPDATE document_sections SET order_index = ? WHERE id = ?');
    remaining.forEach((s, idx) => updateOrder.run(idx, s.id));

    const now = new Date().toISOString();
    db.prepare('UPDATE documents SET updated_at = ? WHERE id = ?').run(now, id);

    logActivity({
      workspaceId: req.document.workspace_id,
      userId: req.user.id,
      userName: req.user.name,
      action: 'section_deleted',
      entityType: 'section',
      entityId: sectionId,
      entityTitle: current.title,
      details: `Removed section from "${req.document.title}"`
    });

    res.json({ message: 'Section removed.' });
  } catch (err) {
    console.error('Delete section error:', err);
    res.status(500).json({ error: 'Failed to delete section.' });
  }
});

// Reorder sections
router.put('/:id/reorder-sections', requireDocumentAccess, (req, res) => {
  try {
    const { id } = req.params;
    const { sectionIds } = req.body; // Array of section IDs in new order

    if (!Array.isArray(sectionIds)) {
      return res.status(400).json({ error: 'sectionIds array is required.' });
    }

    const updateOrder = db.prepare('UPDATE document_sections SET order_index = ? WHERE id = ? AND document_id = ?');
    sectionIds.forEach((secId, idx) => {
      updateOrder.run(idx, secId, id);
    });

    const now = new Date().toISOString();
    db.prepare('UPDATE documents SET updated_at = ? WHERE id = ?').run(now, id);

    res.json({ message: 'Sections reordered successfully.' });
  } catch (err) {
    console.error('Reorder sections error:', err);
    res.status(500).json({ error: 'Failed to reorder sections.' });
  }
});

// Assign / Reassign section to collaborator
router.post('/:id/sections/:sectionId/assign', requireDocumentAccess, (req, res) => {
  try {
    const { id, sectionId } = req.params;
    const { assignedTo } = req.body; // User ID or null to unassign

    let assignedName = null;
    if (assignedTo) {
      const user = db.prepare('SELECT name FROM users WHERE id = ?').get(assignedTo);
      if (!user) {
        return res.status(404).json({ error: 'Assigned user does not exist.' });
      }
      assignedName = user.name;
    }

    const updateStmt = db.prepare(`
      UPDATE document_sections
      SET assigned_to = ?, assigned_name = ?
      WHERE id = ? AND document_id = ?
    `);
    updateStmt.run(assignedTo || null, assignedName, sectionId, id);

    const section = db.prepare('SELECT * FROM document_sections WHERE id = ?').get(sectionId);

    logActivity({
      workspaceId: req.document.workspace_id,
      userId: req.user.id,
      userName: req.user.name,
      action: 'section_assigned',
      entityType: 'section',
      entityId: sectionId,
      entityTitle: section.title,
      details: assignedTo ? `Assigned section to ${assignedName}` : 'Unassigned section'
    });

    res.json({ section, message: 'Assignment updated.' });
  } catch (err) {
    console.error('Assign section error:', err);
    res.status(500).json({ error: 'Failed to assign section.' });
  }
});

// Lock section for editing
router.post('/:id/sections/:sectionId/lock', requireDocumentAccess, (req, res) => {
  try {
    const { id, sectionId } = req.params;
    cleanExpiredLocks(id);

    const section = db.prepare('SELECT * FROM document_sections WHERE id = ? AND document_id = ?').get(sectionId, id);
    if (!section) {
      return res.status(404).json({ error: 'Section not found.' });
    }

    // If locked by someone else and not expired
    if (section.locked_by && section.locked_by !== req.user.id) {
      return res.status(423).json({
        error: `Section is currently locked by ${section.locked_by_name || 'another collaborator'}.`,
        lockedBy: section.locked_by,
        lockedByName: section.locked_by_name
      });
    }

    const now = new Date().toISOString();
    const updateStmt = db.prepare(`
      UPDATE document_sections
      SET locked_by = ?, locked_by_name = ?, locked_at = ?, lock_heartbeat = ?
      WHERE id = ?
    `);
    updateStmt.run(req.user.id, req.user.name, now, now, sectionId);

    res.json({
      message: 'Lock acquired.',
      sectionId,
      lockedBy: req.user.id,
      lockedByName: req.user.name,
      lockedAt: now
    });
  } catch (err) {
    console.error('Acquire lock error:', err);
    res.status(500).json({ error: 'Failed to acquire section lock.' });
  }
});

// Heartbeat lock to keep active
router.post('/:id/sections/:sectionId/heartbeat', requireDocumentAccess, (req, res) => {
  try {
    const { id, sectionId } = req.params;
    const now = new Date().toISOString();
    const updateStmt = db.prepare(`
      UPDATE document_sections
      SET lock_heartbeat = ?
      WHERE id = ? AND document_id = ? AND locked_by = ?
    `);
    updateStmt.run(now, sectionId, id, req.user.id);
    res.json({ success: true, timestamp: now });
  } catch (err) {
    res.status(500).json({ error: 'Heartbeat failed.' });
  }
});

// Release section lock
router.post('/:id/sections/:sectionId/unlock', requireDocumentAccess, (req, res) => {
  try {
    const { id, sectionId } = req.params;

    const updateStmt = db.prepare(`
      UPDATE document_sections
      SET locked_by = NULL, locked_by_name = NULL, locked_at = NULL, lock_heartbeat = NULL
      WHERE id = ? AND document_id = ? AND (locked_by = ? OR ? IN ('owner', 'admin'))
    `);
    updateStmt.run(sectionId, id, req.user.id, req.workspaceMember.role);

    res.json({ message: 'Lock released.', sectionId });
  } catch (err) {
    console.error('Release lock error:', err);
    res.status(500).json({ error: 'Failed to release lock.' });
  }
});

// Get document version history
router.get('/:id/versions', requireDocumentAccess, (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare(`
      SELECT id, document_id, version_number, title, created_by, created_by_name, summary, created_at
      FROM document_versions
      WHERE document_id = ?
      ORDER BY version_number DESC
    `);
    const versions = stmt.all(id);
    res.json({ versions });
  } catch (err) {
    console.error('Fetch versions error:', err);
    res.status(500).json({ error: 'Failed to fetch version history.' });
  }
});

// Create a snapshot version
router.post('/:id/versions', requireDocumentAccess, (req, res) => {
  try {
    const { id } = req.params;
    const { summary = 'Manual snapshot' } = req.body;

    const sections = db.prepare('SELECT * FROM document_sections WHERE document_id = ? ORDER BY order_index ASC').all(id);
    const latestVersion = db.prepare('SELECT MAX(version_number) as max_v FROM document_versions WHERE document_id = ?').get(id);
    const nextVersionNum = (latestVersion?.max_v || 0) + 1;
    const now = new Date().toISOString();

    const insertVersion = db.prepare(`
      INSERT INTO document_versions (id, document_id, version_number, title, sections_snapshot, created_by, created_by_name, summary, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const versionId = crypto.randomUUID();
    insertVersion.run(versionId, id, nextVersionNum, req.document.title, JSON.stringify(sections), req.user.id, req.user.name, summary.trim(), now);

    logActivity({
      workspaceId: req.document.workspace_id,
      userId: req.user.id,
      userName: req.user.name,
      action: 'version_created',
      entityType: 'document',
      entityId: id,
      entityTitle: req.document.title,
      details: `Created version ${nextVersionNum}: ${summary}`
    });

    res.status(201).json({
      message: 'Version snapshot created.',
      version: {
        id: versionId,
        version_number: nextVersionNum,
        created_at: now,
        created_by_name: req.user.name,
        summary
      }
    });
  } catch (err) {
    console.error('Create version error:', err);
    res.status(500).json({ error: 'Failed to create version snapshot.' });
  }
});

// Restore a previous version
router.post('/:id/versions/:versionId/restore', requireDocumentAccess, (req, res) => {
  try {
    const { id, versionId } = req.params;

    if (req.workspaceMember.role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot restore versions.' });
    }

    const version = db.prepare('SELECT * FROM document_versions WHERE id = ? AND document_id = ?').get(versionId, id);
    if (!version) {
      return res.status(404).json({ error: 'Version record not found.' });
    }

    let snapshotSections = [];
    try {
      snapshotSections = JSON.parse(version.sections_snapshot);
    } catch (parseErr) {
      return res.status(500).json({ error: 'Corrupt snapshot data.' });
    }

    // Save a backup of current before restoring
    const currentSections = db.prepare('SELECT * FROM document_sections WHERE document_id = ? ORDER BY order_index ASC').all(id);
    const latestVersion = db.prepare('SELECT MAX(version_number) as max_v FROM document_versions WHERE document_id = ?').get(id);
    const backupVersionNum = (latestVersion?.max_v || 0) + 1;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO document_versions (id, document_id, version_number, title, sections_snapshot, created_by, created_by_name, summary, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      id,
      backupVersionNum,
      req.document.title,
      JSON.stringify(currentSections),
      req.user.id,
      req.user.name,
      `Auto-backup before restoring Version ${version.version_number}`,
      now
    );

    // Delete current sections
    db.prepare('DELETE FROM document_sections WHERE document_id = ?').run(id);

    // Reinsert snapshot sections
    const insertSection = db.prepare(`
      INSERT INTO document_sections (id, document_id, section_key, title, content, order_index, assigned_to, assigned_name, version, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);

    snapshotSections.forEach((s, idx) => {
      insertSection.run(
        crypto.randomUUID(),
        id,
        s.section_key || `sec-${idx}`,
        s.title,
        s.content,
        idx,
        s.assigned_to || null,
        s.assigned_name || null,
        now
      );
    });

    db.prepare('UPDATE documents SET updated_at = ? WHERE id = ?').run(now, id);

    logActivity({
      workspaceId: req.document.workspace_id,
      userId: req.user.id,
      userName: req.user.name,
      action: 'version_restored',
      entityType: 'document',
      entityId: id,
      entityTitle: req.document.title,
      details: `Restored to version ${version.version_number}`
    });

    const restoredSections = db.prepare('SELECT * FROM document_sections WHERE document_id = ? ORDER BY order_index ASC').all(id);

    res.json({
      message: `Successfully restored to Version ${version.version_number}.`,
      sections: restoredSections
    });
  } catch (err) {
    console.error('Restore version error:', err);
    res.status(500).json({ error: 'Failed to restore document version.' });
  }
});

export default router;
