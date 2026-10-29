import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import Document from '../models/Document.js';
import Whiteboard from '../models/Whiteboard.js';
import { logActivity } from '../db/database.js';
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

    const existing = await User.findOne({ email: emailClean });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const avatarColor = AVATAR_PALETTE[Math.floor(Math.random() * AVATAR_PALETTE.length)];

    const user = await User.create({
      name: name.trim(),
      email: emailClean,
      passwordHash,
      avatarColor,
      avatarIcon: 'user',
      bio: ''
    });

    const inviteCode = crypto.randomBytes(6).toString('hex');
    const workspace = await Workspace.create({
      name: `${name.trim()}'s Workspace`,
      description: 'Personal workspace for real-time collaboration',
      inviteCode,
      ownerId: user._id,
      members: [
        {
          userId: user._id,
          role: 'owner',
          joinedAt: new Date()
        }
      ]
    });

    // Create starter document with template
    const template = DOCUMENT_TEMPLATES['meeting-notes'];
    const sectionsToInsert = template.sections.map((s, idx) => ({
      sectionKey: s.key,
      title: s.title,
      content: s.content,
      orderIndex: idx,
      assignedTo: idx === 0 ? user._id : null,
      assignedName: idx === 0 ? name.trim() : null,
      version: 1
    }));

    await Document.create({
      workspaceId: workspace._id,
      title: 'Welcome & Sprint Planning Sync',
      templateType: 'meeting-notes',
      version: 1,
      createdBy: user._id,
      sections: sectionsToInsert
    });

    // Create starter whiteboard
    const initialWbData = [
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
        text: 'MongoDB + Socket.IO',
        fillColor: '#242424',
        strokeColor: '#000000',
        textColor: '#ffffff',
        strokeWidth: 2
      }
    ];

    await Whiteboard.create({
      workspaceId: workspace._id,
      title: 'Architecture & Ideas Board',
      canvasData: initialWbData,
      version: 1,
      createdBy: user._id
    });

    await logActivity({
      workspaceId: workspace._id,
      userId: user._id,
      userName: user.name,
      action: 'workspace_created',
      entityType: 'workspace',
      entityId: workspace._id,
      entityTitle: workspace.name,
      details: 'Created initial workspace and starter documents'
    });

    const token = jwt.sign(
      { id: user._id.toString(), email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        avatarColor: user.avatarColor,
        bio: user.bio
      },
      defaultWorkspaceId: workspace._id.toString()
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
    const user = await User.findOne({ email: emailClean });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user._id.toString(), email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        avatarColor: user.avatarColor,
        avatarIcon: user.avatarIcon || 'user',
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

router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, bio, avatarColor, avatarIcon } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (name) user.name = name.trim();
    if (bio !== undefined) user.bio = bio.trim();
    if (avatarColor) user.avatarColor = avatarColor;
    if (avatarIcon) user.avatarIcon = avatarIcon;

    await user.save();

    res.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        avatarColor: user.avatarColor,
        avatarIcon: user.avatarIcon || 'user',
        bio: user.bio
      }
    });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

export default router;
