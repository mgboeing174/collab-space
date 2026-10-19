import jwt from 'jsonwebtoken';
import db from '../db/database.js';
import { JWT_SECRET } from '../middleware/auth.js';

// Map of active sockets: socketId -> { userId, userName, avatarColor, activeRooms: Set }
const connectedUsers = new Map();

// Map of room presence: roomKey -> Map(socketId -> { userId, userName, avatarColor, cursor, lastActive })
const roomPresence = new Map();

export function setupSockets(io) {
  // Socket authentication middleware
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err || !decoded) {
          return next(new Error('Invalid token'));
        }

        const userStmt = db.prepare('SELECT id, name, email, avatar_color FROM users WHERE id = ?');
        const user = userStmt.get(decoded.id);

        if (!user) {
          return next(new Error('User not found'));
        }

        socket.user = {
          id: user.id,
          name: user.name,
          email: user.email,
          avatarColor: user.avatar_color
        };
        next();
      });
    } catch (e) {
      next(new Error('Socket authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    connectedUsers.set(socket.id, {
      ...user,
      socketId: socket.id,
      activeRooms: new Set()
    });

    // ==========================================
    // WORKSPACE PRESENCE & NOTIFICATIONS
    // ==========================================
    socket.on('join_workspace', ({ workspaceId }) => {
      if (!workspaceId) return;

      // Verify workspace membership
      const checkStmt = db.prepare('SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?');
      const membership = checkStmt.get(workspaceId, user.id);
      if (!membership) {
        socket.emit('error', { message: 'Unauthorized workspace access' });
        return;
      }

      const roomKey = `workspace:${workspaceId}`;
      socket.join(roomKey);
      connectedUsers.get(socket.id)?.activeRooms.add(roomKey);

      if (!roomPresence.has(roomKey)) {
        roomPresence.set(roomKey, new Map());
      }
      roomPresence.get(roomKey).set(socket.id, {
        userId: user.id,
        userName: user.name,
        avatarColor: user.avatarColor,
        joinedAt: Date.now()
      });

      // Broadcast updated workspace presence list
      const onlineMembers = Array.from(roomPresence.get(roomKey).values());
      io.to(roomKey).emit('workspace_presence_update', { workspaceId, onlineMembers });
    });

    socket.on('leave_workspace', ({ workspaceId }) => {
      const roomKey = `workspace:${workspaceId}`;
      socket.leave(roomKey);
      connectedUsers.get(socket.id)?.activeRooms.delete(roomKey);

      if (roomPresence.has(roomKey)) {
        roomPresence.get(roomKey).delete(socket.id);
        const onlineMembers = Array.from(roomPresence.get(roomKey).values());
        io.to(roomKey).emit('workspace_presence_update', { workspaceId, onlineMembers });
      }
    });

    // ==========================================
    // DOCUMENT COLLABORATION & SECTION LOCKING
    // ==========================================
    socket.on('join_document', ({ documentId }) => {
      if (!documentId) return;

      const roomKey = `doc:${documentId}`;
      socket.join(roomKey);
      connectedUsers.get(socket.id)?.activeRooms.add(roomKey);

      if (!roomPresence.has(roomKey)) {
        roomPresence.set(roomKey, new Map());
      }
      roomPresence.get(roomKey).set(socket.id, {
        userId: user.id,
        userName: user.name,
        avatarColor: user.avatarColor,
        cursor: null,
        activeSectionId: null
      });

      const docUsers = Array.from(roomPresence.get(roomKey).values());
      io.to(roomKey).emit('document_presence_update', { documentId, activeUsers: docUsers });
    });

    socket.on('leave_document', ({ documentId }) => {
      handleLeaveDocument(socket, documentId);
    });

    // Live cursor movement inside document
    socket.on('document_cursor_move', ({ documentId, cursor, activeSectionId }) => {
      const roomKey = `doc:${documentId}`;
      const room = roomPresence.get(roomKey);
      if (room && room.has(socket.id)) {
        const uData = room.get(socket.id);
        uData.cursor = cursor;
        uData.activeSectionId = activeSectionId;
      }
      socket.to(roomKey).emit('document_cursor_update', {
        userId: user.id,
        userName: user.name,
        avatarColor: user.avatarColor,
        activeSectionId,
        cursor
      });
    });

    // Acquire lock on section
    socket.on('claim_section_lock', ({ documentId, sectionId }) => {
      try {
        const cutoff = new Date(Date.now() - 60000).toISOString();
        const sec = db.prepare('SELECT * FROM document_sections WHERE id = ? AND document_id = ?').get(sectionId, documentId);

        if (!sec) {
          socket.emit('lock_error', { sectionId, message: 'Section not found' });
          return;
        }

        // Check if locked by someone else and lock is still fresh (<60s)
        if (sec.locked_by && sec.locked_by !== user.id && sec.locked_at && sec.lock_heartbeat > cutoff) {
          socket.emit('lock_rejected', {
            sectionId,
            message: `Locked by ${sec.locked_by_name || 'another editor'}`,
            lockedBy: sec.locked_by,
            lockedByName: sec.locked_by_name
          });
          return;
        }

        const now = new Date().toISOString();
        db.prepare(`
          UPDATE document_sections
          SET locked_by = ?, locked_by_name = ?, locked_at = ?, lock_heartbeat = ?
          WHERE id = ?
        `).run(user.id, user.name, now, now, sectionId);

        const roomKey = `doc:${documentId}`;
        io.to(roomKey).emit('section_lock_acquired', {
          documentId,
          sectionId,
          lockedBy: user.id,
          lockedByName: user.name,
          avatarColor: user.avatarColor,
          lockedAt: now
        });
      } catch (err) {
        console.error('Error claiming section lock:', err);
      }
    });

    // Heartbeat lock to prevent expiration
    socket.on('heartbeat_section_lock', ({ documentId, sectionId }) => {
      try {
        const now = new Date().toISOString();
        db.prepare(`
          UPDATE document_sections
          SET lock_heartbeat = ?
          WHERE id = ? AND locked_by = ?
        `).run(now, sectionId, user.id);
      } catch (e) {}
    });

    // Release lock on section
    socket.on('release_section_lock', ({ documentId, sectionId }) => {
      try {
        db.prepare(`
          UPDATE document_sections
          SET locked_by = NULL, locked_by_name = NULL, locked_at = NULL, lock_heartbeat = NULL
          WHERE id = ? AND document_id = ? AND locked_by = ?
        `).run(sectionId, documentId, user.id);

        const roomKey = `doc:${documentId}`;
        io.to(roomKey).emit('section_lock_released', {
          documentId,
          sectionId,
          releasedBy: user.id
        });
      } catch (err) {
        console.error('Error releasing section lock:', err);
      }
    });

    // Real-time section content update broadcast
    socket.on('section_content_update', ({ documentId, sectionId, content, title, version }) => {
      try {
        const sec = db.prepare('SELECT version, locked_by FROM document_sections WHERE id = ?').get(sectionId);
        if (!sec) return;

        // If locked by someone else, ignore
        if (sec.locked_by && sec.locked_by !== user.id) {
          return;
        }

        const nextVersion = (sec.version || 0) + 1;
        const now = new Date().toISOString();

        db.prepare(`
          UPDATE document_sections
          SET content = COALESCE(?, content),
              title = COALESCE(?, title),
              version = ?,
              updated_at = ?
          WHERE id = ?
        `).run(content !== undefined ? content : null, title !== undefined ? title : null, nextVersion, now, sectionId);

        db.prepare('UPDATE documents SET updated_at = ? WHERE id = ?').run(now, documentId);

        const roomKey = `doc:${documentId}`;
        // Broadcast change to other users in the document room
        socket.to(roomKey).emit('section_updated', {
          documentId,
          sectionId,
          content,
          title,
          version: nextVersion,
          updatedBy: user.id,
          updatedByName: user.name,
          updatedAt: now
        });

        // Acknowledge back to sender with confirmed version
        socket.emit('section_saved_ack', {
          sectionId,
          version: nextVersion,
          timestamp: now
        });
      } catch (err) {
        console.error('Error in section_content_update:', err);
      }
    });

    // Reorder sections broadcast
    socket.on('sections_reordered', ({ documentId, sectionIds }) => {
      const roomKey = `doc:${documentId}`;
      socket.to(roomKey).emit('sections_order_updated', { documentId, sectionIds });
    });

    // Section assignment broadcast
    socket.on('section_assigned', ({ documentId, sectionId, assignedTo, assignedName }) => {
      const roomKey = `doc:${documentId}`;
      io.to(roomKey).emit('section_assignment_updated', {
        documentId,
        sectionId,
        assignedTo,
        assignedName
      });
    });

    // ==========================================
    // WHITEBOARD COLLABORATION & LIVE CURSORS
    // ==========================================
    socket.on('join_whiteboard', ({ whiteboardId }) => {
      if (!whiteboardId) return;

      const roomKey = `board:${whiteboardId}`;
      socket.join(roomKey);
      connectedUsers.get(socket.id)?.activeRooms.add(roomKey);

      if (!roomPresence.has(roomKey)) {
        roomPresence.set(roomKey, new Map());
      }
      roomPresence.get(roomKey).set(socket.id, {
        userId: user.id,
        userName: user.name,
        avatarColor: user.avatarColor,
        cursor: null
      });

      const wbUsers = Array.from(roomPresence.get(roomKey).values());
      io.to(roomKey).emit('whiteboard_presence_update', { whiteboardId, activeUsers: wbUsers });
    });

    socket.on('leave_whiteboard', ({ whiteboardId }) => {
      const roomKey = `board:${whiteboardId}`;
      socket.leave(roomKey);
      connectedUsers.get(socket.id)?.activeRooms.delete(roomKey);

      if (roomPresence.has(roomKey)) {
        roomPresence.get(roomKey).delete(socket.id);
        const wbUsers = Array.from(roomPresence.get(roomKey).values());
        io.to(roomKey).emit('whiteboard_presence_update', { whiteboardId, activeUsers: wbUsers });
      }
    });

    // Real-time whiteboard cursor
    socket.on('whiteboard_cursor_move', ({ whiteboardId, x, y }) => {
      const roomKey = `board:${whiteboardId}`;
      socket.to(roomKey).emit('whiteboard_cursor_update', {
        userId: user.id,
        userName: user.name,
        avatarColor: user.avatarColor,
        x,
        y
      });
    });

    // Real-time whiteboard element actions
    socket.on('whiteboard_element_add', ({ whiteboardId, element }) => {
      const roomKey = `board:${whiteboardId}`;
      socket.to(roomKey).emit('whiteboard_element_added', { whiteboardId, element });
    });

    socket.on('whiteboard_element_update', ({ whiteboardId, element }) => {
      const roomKey = `board:${whiteboardId}`;
      socket.to(roomKey).emit('whiteboard_element_updated', { whiteboardId, element });
    });

    socket.on('whiteboard_element_delete', ({ whiteboardId, elementId }) => {
      const roomKey = `board:${whiteboardId}`;
      socket.to(roomKey).emit('whiteboard_element_deleted', { whiteboardId, elementId });
    });

    socket.on('whiteboard_elements_bulk_sync', ({ whiteboardId, elements }) => {
      try {
        const dataStr = JSON.stringify(elements);
        const now = new Date().toISOString();
        db.prepare('UPDATE whiteboards SET canvas_data = ?, updated_at = ? WHERE id = ?').run(dataStr, now, whiteboardId);

        const roomKey = `board:${whiteboardId}`;
        socket.to(roomKey).emit('whiteboard_synced', { whiteboardId, elements });
      } catch (err) {
        console.error('Error saving whiteboard sync:', err);
      }
    });

    // ==========================================
    // DISCONNECTION CLEANUP & SAFE LOCK RELEASE
    // ==========================================
    socket.on('disconnect', () => {
      const userMeta = connectedUsers.get(socket.id);
      if (userMeta) {
        // Automatically release any locks held by this user in database
        try {
          const lockedSections = db.prepare('SELECT id, document_id FROM document_sections WHERE locked_by = ?').all(user.id);
          if (lockedSections.length > 0) {
            db.prepare(`
              UPDATE document_sections
              SET locked_by = NULL, locked_by_name = NULL, locked_at = NULL, lock_heartbeat = NULL
              WHERE locked_by = ?
            `).run(user.id);

            lockedSections.forEach(sec => {
              io.to(`doc:${sec.document_id}`).emit('section_lock_released', {
                documentId: sec.document_id,
                sectionId: sec.id,
                releasedBy: user.id,
                reason: 'disconnect'
              });
            });
          }
        } catch (e) {
          console.error('Error releasing disconnect locks:', e);
        }

        // Clean up room presence for all rooms this socket was in
        for (const roomKey of userMeta.activeRooms) {
          if (roomPresence.has(roomKey)) {
            roomPresence.get(roomKey).delete(socket.id);
            const remaining = Array.from(roomPresence.get(roomKey).values());

            if (roomKey.startsWith('workspace:')) {
              const wsId = roomKey.replace('workspace:', '');
              io.to(roomKey).emit('workspace_presence_update', { workspaceId: wsId, onlineMembers: remaining });
            } else if (roomKey.startsWith('doc:')) {
              const docId = roomKey.replace('doc:', '');
              io.to(roomKey).emit('document_presence_update', { documentId: docId, activeUsers: remaining });
            } else if (roomKey.startsWith('board:')) {
              const wbId = roomKey.replace('board:', '');
              io.to(roomKey).emit('whiteboard_presence_update', { whiteboardId: wbId, activeUsers: remaining });
            }
          }
        }

        connectedUsers.delete(socket.id);
      }
    });
  });
}

function handleLeaveDocument(socket, documentId) {
  const roomKey = `doc:${documentId}`;
  socket.leave(roomKey);
  connectedUsers.get(socket.id)?.activeRooms.delete(roomKey);

  if (roomPresence.has(roomKey)) {
    roomPresence.get(roomKey).delete(socket.id);
    const docUsers = Array.from(roomPresence.get(roomKey).values());
    socket.to(roomKey).emit('document_presence_update', { documentId, activeUsers: docUsers });
  }

  // Release locks held by user in this document
  try {
    const user = socket.user;
    if (user) {
      db.prepare(`
        UPDATE document_sections
        SET locked_by = NULL, locked_by_name = NULL, locked_at = NULL, lock_heartbeat = NULL
        WHERE document_id = ? AND locked_by = ?
      `).run(documentId, user.id);

      socket.to(roomKey).emit('section_lock_released', {
        documentId,
        releasedBy: user.id
      });
    }
  } catch (e) {}
}
