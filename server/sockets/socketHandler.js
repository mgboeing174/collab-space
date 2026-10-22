import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import Document from '../models/Document.js';
import Whiteboard from '../models/Whiteboard.js';
import { JWT_SECRET } from '../middleware/auth.js';

const connectedUsers = new Map();
const roomPresence = new Map();

export function setupSockets(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      jwt.verify(token, JWT_SECRET, async (err, decoded) => {
        if (err || !decoded) {
          return next(new Error('Invalid token'));
        }

        const user = await User.findById(decoded.id);
        if (!user) {
          return next(new Error('User not found'));
        }

        socket.user = {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          avatarColor: user.avatarColor
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

    // WORKSPACE PRESENCE
    socket.on('join_workspace', async ({ workspaceId }) => {
      if (!workspaceId) return;

      const workspace = await Workspace.findById(workspaceId);
      if (!workspace || !workspace.members.some((m) => m.userId.toString() === user.id)) {
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

    // DOCUMENT COLLABORATION
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

    socket.on('document_cursor_move', ({ documentId, cursor, activeSectionId }) => {
      const roomKey = `doc:${documentId}`;
      socket.to(roomKey).emit('document_cursor_update', {
        userId: user.id,
        userName: user.name,
        avatarColor: user.avatarColor,
        activeSectionId,
        cursor
      });
    });

    // Acquire lock on section
    socket.on('claim_section_lock', async ({ documentId, sectionId }) => {
      try {
        const cutoff = new Date(Date.now() - 60000);
        const doc = await Document.findById(documentId);
        if (!doc) return;

        const sec = doc.sections.id(sectionId);
        if (!sec) return;

        // If locked by someone else and still fresh
        if (sec.lockedBy && sec.lockedBy.toString() !== user.id && sec.lockedAt && sec.lockHeartbeat > cutoff) {
          socket.emit('lock_rejected', {
            sectionId,
            message: `Locked by ${sec.lockedByName || 'another editor'}`,
            lockedBy: sec.lockedBy.toString(),
            lockedByName: sec.lockedByName
          });
          return;
        }

        const now = new Date();
        sec.lockedBy = user.id;
        sec.lockedByName = user.name;
        sec.lockedAt = now;
        sec.lockHeartbeat = now;
        await doc.save();

        const roomKey = `doc:${documentId}`;
        io.to(roomKey).emit('section_lock_acquired', {
          documentId,
          sectionId,
          lockedBy: user.id,
          lockedByName: user.name,
          avatarColor: user.avatarColor,
          lockedAt: now.toISOString()
        });
      } catch (err) {
        console.error('Error claiming section lock:', err);
      }
    });

    // Heartbeat lock
    socket.on('heartbeat_section_lock', async ({ documentId, sectionId }) => {
      try {
        await Document.updateOne(
          { _id: documentId, 'sections._id': sectionId, 'sections.lockedBy': user.id },
          { $set: { 'sections.$.lockHeartbeat': new Date() } }
        );
      } catch (e) {}
    });

    // Release lock on section
    socket.on('release_section_lock', async ({ documentId, sectionId }) => {
      try {
        await Document.updateOne(
          { _id: documentId, 'sections._id': sectionId, 'sections.lockedBy': user.id },
          {
            $set: {
              'sections.$.lockedBy': null,
              'sections.$.lockedByName': null,
              'sections.$.lockedAt': null,
              'sections.$.lockHeartbeat': null
            }
          }
        );

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
    socket.on('section_content_update', async ({ documentId, sectionId, content, title, version }) => {
      try {
        const doc = await Document.findById(documentId);
        if (!doc) return;

        const sec = doc.sections.id(sectionId);
        if (!sec) return;

        if (sec.lockedBy && sec.lockedBy.toString() !== user.id) {
          return;
        }

        if (content !== undefined) sec.content = content;
        if (title !== undefined) sec.title = title;
        sec.version = (sec.version || 0) + 1;
        sec.updatedAt = new Date();
        await doc.save();

        const roomKey = `doc:${documentId}`;
        socket.to(roomKey).emit('section_updated', {
          documentId,
          sectionId,
          content,
          title,
          version: sec.version,
          updatedBy: user.id,
          updatedByName: user.name,
          updatedAt: sec.updatedAt.toISOString()
        });

        socket.emit('section_saved_ack', {
          sectionId,
          version: sec.version,
          timestamp: sec.updatedAt.toISOString()
        });
      } catch (err) {
        console.error('Error in section_content_update:', err);
      }
    });

    // Reorder broadcast
    socket.on('sections_reordered', ({ documentId, sectionIds }) => {
      const roomKey = `doc:${documentId}`;
      socket.to(roomKey).emit('sections_order_updated', { documentId, sectionIds });
    });

    // Assignment broadcast
    socket.on('section_assigned', ({ documentId, sectionId, assignedTo, assignedName }) => {
      const roomKey = `doc:${documentId}`;
      io.to(roomKey).emit('section_assignment_updated', {
        documentId,
        sectionId,
        assignedTo,
        assignedName
      });
    });

    // WHITEBOARD COLLABORATION
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

    socket.on('whiteboard_element_add', ({ whiteboardId, element }) => {
      const roomKey = `board:${whiteboardId}`;
      socket.to(roomKey).emit('whiteboard_element_added', { whiteboardId, element });
    });

    socket.on('whiteboard_element_live_draw', ({ whiteboardId, element }) => {
      const roomKey = `board:${whiteboardId}`;
      socket.to(roomKey).emit('whiteboard_element_live_drawing', { whiteboardId, element });
    });

    socket.on('whiteboard_element_update', ({ whiteboardId, element }) => {
      const roomKey = `board:${whiteboardId}`;
      socket.to(roomKey).emit('whiteboard_element_updated', { whiteboardId, element });
    });

    socket.on('whiteboard_element_delete', ({ whiteboardId, elementId }) => {
      const roomKey = `board:${whiteboardId}`;
      socket.to(roomKey).emit('whiteboard_element_deleted', { whiteboardId, elementId });
    });

    socket.on('whiteboard_elements_bulk_sync', async ({ whiteboardId, elements }) => {
      try {
        await Whiteboard.findByIdAndUpdate(whiteboardId, {
          canvasData: elements,
          $inc: { version: 1 }
        });

        const roomKey = `board:${whiteboardId}`;
        socket.to(roomKey).emit('whiteboard_synced', { whiteboardId, elements });
      } catch (err) {
        console.error('Error saving whiteboard sync:', err);
      }
    });

    // DISCONNECTION CLEANUP
    socket.on('disconnect', async () => {
      const userMeta = connectedUsers.get(socket.id);
      if (userMeta) {
        try {
          // Release any active locks in documents
          const lockedDocs = await Document.find({ 'sections.lockedBy': user.id });
          if (lockedDocs.length > 0) {
            await Document.updateMany(
              { 'sections.lockedBy': user.id },
              {
                $set: {
                  'sections.$[elem].lockedBy': null,
                  'sections.$[elem].lockedByName': null,
                  'sections.$[elem].lockedAt': null,
                  'sections.$[elem].lockHeartbeat': null
                }
              },
              { arrayFilters: [{ 'elem.lockedBy': user.id }] }
            );

            lockedDocs.forEach((d) => {
              io.to(`doc:${d._id.toString()}`).emit('section_lock_released', {
                documentId: d._id.toString(),
                releasedBy: user.id,
                reason: 'disconnect'
              });
            });
          }
        } catch (e) {
          console.error('Error releasing disconnect locks:', e);
        }

        // Clean up presence
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

async function handleLeaveDocument(socket, documentId) {
  const roomKey = `doc:${documentId}`;
  socket.leave(roomKey);
  connectedUsers.get(socket.id)?.activeRooms.delete(roomKey);

  if (roomPresence.has(roomKey)) {
    roomPresence.get(roomKey).delete(socket.id);
    const docUsers = Array.from(roomPresence.get(roomKey).values());
    socket.to(roomKey).emit('document_presence_update', { documentId, activeUsers: docUsers });
  }

  try {
    const user = socket.user;
    if (user) {
      await Document.updateOne(
        { _id: documentId, 'sections.lockedBy': user.id },
        {
          $set: {
            'sections.$[elem].lockedBy': null,
            'sections.$[elem].lockedByName': null,
            'sections.$[elem].lockedAt': null,
            'sections.$[elem].lockHeartbeat': null
          }
        },
        { arrayFilters: [{ 'elem.lockedBy': user.id }] }
      );

      socket.to(roomKey).emit('section_lock_released', {
        documentId,
        releasedBy: user.id
      });
    }
  } catch (e) {}
}
