import db from '../db/database.js';

export function requireWorkspaceMember(requiredRoles = []) {
  return (req, res, next) => {
    const workspaceId = req.params.workspaceId || req.body.workspaceId || req.query.workspaceId || req.headers['x-workspace-id'];

    if (!workspaceId) {
      return res.status(400).json({ error: 'Workspace ID is required.' });
    }

    const stmt = db.prepare(`
      SELECT wm.role, wm.workspace_id, w.name as workspace_name, w.owner_id
      FROM workspace_members wm
      JOIN workspaces w ON w.id = wm.workspace_id
      WHERE wm.workspace_id = ? AND wm.user_id = ?
    `);
    const membership = stmt.get(workspaceId, req.user.id);

    if (!membership) {
      return res.status(403).json({ error: 'You do not have access to this workspace.' });
    }

    if (requiredRoles.length > 0 && !requiredRoles.includes(membership.role)) {
      return res.status(403).json({ error: `Insufficient permissions. Required role: ${requiredRoles.join(' or ')}` });
    }

    req.workspaceMember = {
      workspaceId: membership.workspace_id,
      role: membership.role,
      workspaceName: membership.workspace_name,
      isOwner: membership.role === 'owner'
    };

    next();
  };
}

export function requireDocumentAccess(req, res, next) {
  const documentId = req.params.id || req.params.documentId || req.body.documentId;

  if (!documentId) {
    return res.status(400).json({ error: 'Document ID is required.' });
  }

  const docStmt = db.prepare(`
    SELECT d.*, wm.role as member_role
    FROM documents d
    JOIN workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = ?
    WHERE d.id = ?
  `);
  const doc = docStmt.get(req.user.id, documentId);

  if (!doc) {
    return res.status(403).json({ error: 'Document not found or you lack permission to view it.' });
  }

  req.document = doc;
  req.workspaceMember = {
    workspaceId: doc.workspace_id,
    role: doc.member_role,
    isOwner: doc.member_role === 'owner'
  };

  next();
}

export function requireWhiteboardAccess(req, res, next) {
  const whiteboardId = req.params.id || req.params.whiteboardId || req.body.whiteboardId;

  if (!whiteboardId) {
    return res.status(400).json({ error: 'Whiteboard ID is required.' });
  }

  const wbStmt = db.prepare(`
    SELECT w.*, wm.role as member_role
    FROM whiteboards w
    JOIN workspace_members wm ON wm.workspace_id = w.workspace_id AND wm.user_id = ?
    WHERE w.id = ?
  `);
  const whiteboard = wbStmt.get(req.user.id, whiteboardId);

  if (!whiteboard) {
    return res.status(403).json({ error: 'Whiteboard not found or you lack permission to view it.' });
  }

  req.whiteboard = whiteboard;
  req.workspaceMember = {
    workspaceId: whiteboard.workspace_id,
    role: whiteboard.member_role,
    isOwner: whiteboard.member_role === 'owner'
  };

  next();
}
