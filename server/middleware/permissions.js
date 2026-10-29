import Workspace from '../models/Workspace.js';
import Document from '../models/Document.js';
import Whiteboard from '../models/Whiteboard.js';

export function requireWorkspaceMember(requiredRoles = []) {
  return async (req, res, next) => {
    try {
      const workspaceId = req.params.workspaceId || req.body.workspaceId || req.query.workspaceId || req.headers['x-workspace-id'];

      if (!workspaceId) {
        return res.status(400).json({ error: 'Workspace ID is required.' });
      }

      const workspace = await Workspace.findById(workspaceId);
      if (!workspace) {
        return res.status(404).json({ error: 'Workspace not found.' });
      }

      const membership = workspace.members.find(
        (m) => m.userId.toString() === req.user.id
      );

      if (!membership) {
        return res.status(403).json({ error: 'You do not have access to this workspace.' });
      }

      if (requiredRoles.length > 0 && !requiredRoles.includes(membership.role)) {
        return res.status(403).json({ error: `Insufficient permissions. Required role: ${requiredRoles.join(' or ')}` });
      }

      req.workspace = workspace;
      req.workspaceMember = {
        workspaceId: workspace._id.toString(),
        role: membership.role,
        workspaceName: workspace.name,
        isOwner: membership.role === 'owner'
      };

      next();
    } catch (err) {
      console.error('requireWorkspaceMember error:', err);
      return res.status(500).json({ error: 'Authorization check failed.' });
    }
  };
}

export async function requireDocumentAccess(req, res, next) {
  try {
    const documentId = req.params.id || req.params.documentId || req.body.documentId;

    if (!documentId) {
      return res.status(400).json({ error: 'Document ID is required.' });
    }

    const doc = await Document.findById(documentId);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    const workspace = await Workspace.findById(doc.workspaceId);
    if (!workspace) {
      return res.status(403).json({ error: 'Associated workspace not found.' });
    }

    const membership = workspace.members.find(
      (m) => m.userId.toString() === req.user.id
    );

    // Also check direct document collaborator
    const directCollab = (doc.collaborators || []).find(
      (c) => c.userId?.toString() === req.user.id
    );

    if (!membership && !directCollab && doc.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ error: 'You do not have access to this document.' });
    }

    req.document = doc;
    req.workspaceMember = {
      workspaceId: doc.workspaceId.toString(),
      role: membership ? membership.role : (directCollab?.role || 'editor'),
      isOwner: membership ? membership.role === 'owner' : false,
      isDirectCollaborator: !membership && !!directCollab
    };

    next();
  } catch (err) {
    console.error('requireDocumentAccess error:', err);
    return res.status(500).json({ error: 'Document access check failed.' });
  }
}

export async function requireWhiteboardAccess(req, res, next) {
  try {
    const whiteboardId = req.params.id || req.params.whiteboardId || req.body.whiteboardId;

    if (!whiteboardId) {
      return res.status(400).json({ error: 'Whiteboard ID is required.' });
    }

    const whiteboard = await Whiteboard.findById(whiteboardId);
    if (!whiteboard) {
      return res.status(404).json({ error: 'Whiteboard not found.' });
    }

    const workspace = await Workspace.findById(whiteboard.workspaceId);
    if (!workspace) {
      return res.status(403).json({ error: 'Associated workspace not found.' });
    }

    const membership = workspace.members.find(
      (m) => m.userId.toString() === req.user.id
    );

    const directCollab = (whiteboard.collaborators || []).find(
      (c) => c.userId?.toString() === req.user.id
    );

    if (!membership && !directCollab && whiteboard.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ error: 'You do not have access to this whiteboard.' });
    }

    req.whiteboard = whiteboard;
    req.workspaceMember = {
      workspaceId: whiteboard.workspaceId.toString(),
      role: membership ? membership.role : (directCollab?.role || 'editor'),
      isOwner: membership ? membership.role === 'owner' : false,
      isDirectCollaborator: !membership && !!directCollab
    };

    next();
  } catch (err) {
    console.error('requireWhiteboardAccess error:', err);
    return res.status(500).json({ error: 'Whiteboard access check failed.' });
  }
}
