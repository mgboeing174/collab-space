import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db, { logActivity } from '../db/database.js';
import { JWT_SECRET, authenticateToken } from '../middleware/auth.js';
import { DOCUMENT_TEMPLATES } from '../db/templates.js';

const router = express.Router();

const AVATAR_PALETTE = [
  '#111111', '#242424', '#383838', '#4c4c4c', '#606060', '#747474'
];

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const emailClean = email.toLowerCase().trim();

    // Check if user exists
    const checkStmt = db.prepare('SELECT id FROM users WHERE email = ?');
    const existing = checkStmt.get(emailClean);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const userId = crypto.randomUUID();
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const avatarColor = AVATAR_PALETTE[Math.floor(Math.random() * AVATAR_PALETTE.length)];
    const now = new Date().toISOString();

    const insertUser = db.prepare(`
      INSERT INTO users (id, email, password_hash, name, avatar_color, bio, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, '', ?, ?)
    `);
    insertUser.run(userId, emailClean, passwordHash, name.trim(), avatarColor, now, now);

    // Create a default initial workspace for new user
    const workspaceId = crypto.randomUUID();
    const inviteCode = crypto.randomBytes(6).toString('hex');
    const insertWorkspace = db.prepare(`
      INSERT INTO workspaces (id, name, description, invite_code, owner_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertWorkspace.run(workspaceId, `${name.trim()}'s Workspace`, 'Personal workspace for real-time collaboration', inviteCode, userId, now, now);

    const insertMember = db.prepare(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
      VALUES (?, ?, ?, 'owner', ?)
    `);
    insertMember.run(crypto.randomUUID(), workspaceId, userId, now);

    // Create an initial starter document from "Meeting Notes" template
    const docId = crypto.randomUUID();
    const template = DOCUMENT_TEMPLATES['meeting-notes'];
    const insertDoc = db.prepare(`
      INSERT INTO documents (id, workspace_id, project_id, title, template_type, version, created_by, created_at, updated_at)
      VALUES (?, ?, NULL, ?, 'meeting-notes', 1, ?, ?, ?)
    `);
    insertDoc.run(docId, workspaceId, 'Welcome & Sprint Planning Sync', userId, now, now);

    const insertSection = db.prepare(`
      INSERT INTO document_sections (id, document_id, section_key, title, content, order_index, assigned_to, assigned_name, version, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);

    template.sections.forEach((s, idx) => {
      insertSection.run(
        crypto.randomUUID(),
        docId,
        s.key,
        s.title,
        s.content,
        idx,
        idx === 0 ? userId : null,
        idx === 0 ? name.trim() : null,
        now
      );
    });

    // Create an initial whiteboard
    const wbId = crypto.randomUUID();
    const insertWb = db.prepare(`
      INSERT INTO whiteboards (id, workspace_id, project_id, title, canvas_data, version, created_by, created_at, updated_at)
      VALUES (?, ?, NULL, ?, ?, 1, ?, ?, ?)
    `);
    
    // Seed initial whiteboard with a welcome note & shapes
    const initialWbData = JSON.stringify([
      {
        id: crypto.randomUUID(),
        type: 'sticky',
        x: 100,
        y: 100,
        width: 220,
        height: 180,
        text: 'Welcome to CollabSpace Whiteboard!\n\n• Brainstorm in real time\n• Add shapes, arrows, notes\n• Zero lag, grayscale design',
        color: '#f4f4f4',
        textColor: '#111111',
        strokeColor: '#333333'
      },
      {
        id: crypto.randomUUID(),
        type: 'rectangle',
        x: 380,
        y: 100,
        width: 200,
        height: 120,
        text: 'Client App (React)',
        fillColor: '#ffffff',
        strokeColor: '#111111',
        strokeWidth: 2
      },
      {
        id: crypto.randomUUID(),
        type: 'arrow',
        startX: 580,
        startY: 160,
        endX: 660,
        endY: 160,
        strokeColor: '#111111',
        strokeWidth: 2
      },
      {
        id: crypto.randomUUID(),
        type: 'rectangle',
        x: 660,
        y: 100,
        width: 200,
        height: 120,
        text: 'Real-Time Sync (Socket.IO)',
        fillColor: '#242424',
        strokeColor: '#000000',
        textColor: '#ffffff',
        strokeWidth: 2
      }
    ]);
    insertWb.run(wbId, workspaceId, 'Architecture & Ideas Board', initialWbData, userId, now, now);

    logActivity({
      workspaceId,
      userId,
      userName: name.trim(),
      action: 'workspace_created',
      entityType: 'workspace',
      entityId: workspaceId,
      entityTitle: `${name.trim()}'s Workspace`,
      details: 'Created initial workspace and starter documents'
    });

    const token = jwt.sign(
      { id: userId, email: emailClean, name: name.trim() },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: userId,
        email: emailClean,
        name: name.trim(),
        avatarColor,
        bio: ''
      },
      defaultWorkspaceId: workspaceId
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const emailClean = email.toLowerCase().trim();
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const user = stmt.get(emailClean);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarColor: user.avatar_color,
        bio: user.bio || ''
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to authenticate. Please try again.' });
  }
});

router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

router.put('/profile', authenticateToken, (req, res) => {
  try {
    const { name, bio, avatarColor } = req.body;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      UPDATE users
      SET name = COALESCE(?, name),
          bio = COALESCE(?, bio),
          avatar_color = COALESCE(?, avatar_color),
          updated_at = ?
      WHERE id = ?
    `);
    stmt.run(name ? name.trim() : null, bio !== undefined ? bio.trim() : null, avatarColor || null, now, req.user.id);

    const updated = db.prepare('SELECT id, email, name, avatar_color, bio FROM users WHERE id = ?').get(req.user.id);

    res.json({
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        avatarColor: updated.avatar_color,
        bio: updated.bio
      }
    });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

export default router;
