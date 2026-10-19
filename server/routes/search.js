import express from 'express';
import Document from '../models/Document.js';
import Whiteboard from '../models/Whiteboard.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireWorkspaceMember } from '../middleware/permissions.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/workspace/:workspaceId', requireWorkspaceMember(), async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const query = (req.query.q || '').trim();

    if (!query) {
      return res.json({ documents: [], sections: [], whiteboards: [] });
    }

    const regex = new RegExp(query, 'i');

    // Search documents by title
    const docs = await Document.find({ workspaceId, title: regex })
      .populate('createdBy', 'name')
      .sort({ updatedAt: -1 })
      .limit(10);

    const formattedDocs = docs.map((d) => ({
      id: d._id.toString(),
      title: d.title,
      template_type: d.templateType,
      updated_at: d.updatedAt.toISOString(),
      creator_name: d.createdBy?.name || 'Author'
    }));

    // Search inside sections
    const docsWithMatchingSections = await Document.find({
      workspaceId,
      $or: [{ 'sections.title': regex }, { 'sections.content': regex }]
    });

    const matchingSections = [];
    docsWithMatchingSections.forEach((d) => {
      d.sections.forEach((s) => {
        if (regex.test(s.title) || regex.test(s.content)) {
          matchingSections.push({
            section_id: s._id.toString(),
            document_id: d._id.toString(),
            section_title: s.title,
            content: s.content,
            document_title: d.title
          });
        }
      });
    });

    // Search whiteboards
    const whiteboards = await Whiteboard.find({ workspaceId, title: regex })
      .populate('createdBy', 'name')
      .sort({ updatedAt: -1 })
      .limit(10);

    const formattedWbs = whiteboards.map((w) => ({
      id: w._id.toString(),
      title: w.title,
      updated_at: w.updatedAt.toISOString(),
      creator_name: w.createdBy?.name || 'Author'
    }));

    res.json({
      query,
      documents: formattedDocs,
      sections: matchingSections.slice(0, 15),
      whiteboards: formattedWbs
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed.' });
  }
});

export default router;
