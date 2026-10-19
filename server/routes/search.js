import express from 'express';
import db from '../db/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireWorkspaceMember } from '../middleware/permissions.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/workspace/:workspaceId', requireWorkspaceMember(), (req, res) => {
  try {
    const { workspaceId } = req.params;
    const query = (req.query.q || '').trim();

    if (!query) {
      return res.json({ documents: [], sections: [], whiteboards: [] });
    }

    const searchPattern = `%${query}%`;

    // Search documents
    const docStmt = db.prepare(`
      SELECT d.id, d.title, d.template_type, d.updated_at, u.name as creator_name
      FROM documents d
      JOIN users u ON u.id = d.created_by
      WHERE d.workspace_id = ? AND d.title LIKE ?
      ORDER BY d.updated_at DESC
      LIMIT 10
    `);
    const documents = docStmt.all(workspaceId, searchPattern);

    // Search inside document sections
    const sectionStmt = db.prepare(`
      SELECT s.id as section_id, s.document_id, s.title as section_title, s.content,
             d.title as document_title
      FROM document_sections s
      JOIN documents d ON d.id = s.document_id
      WHERE d.workspace_id = ? AND (s.title LIKE ? OR s.content LIKE ?)
      LIMIT 15
    `);
    const sections = sectionStmt.all(workspaceId, searchPattern, searchPattern);

    // Search whiteboards
    const wbStmt = db.prepare(`
      SELECT w.id, w.title, w.updated_at, u.name as creator_name
      FROM whiteboards w
      JOIN users u ON u.id = w.created_by
      WHERE w.workspace_id = ? AND w.title LIKE ?
      ORDER BY w.updated_at DESC
      LIMIT 10
    `);
    const whiteboards = wbStmt.all(workspaceId, searchPattern);

    res.json({
      query,
      documents,
      sections,
      whiteboards
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed.' });
  }
});

export default router;
