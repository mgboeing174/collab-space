import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'collabspace.db');
const db = new DatabaseSync(DB_PATH);

// Enable WAL mode and foreign keys for performance and data integrity
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      avatar_color TEXT DEFAULT '#222222',
      bio TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      invite_code TEXT UNIQUE NOT NULL,
      owner_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workspace_members (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT CHECK(role IN ('owner', 'admin', 'member', 'viewer')) NOT NULL DEFAULT 'member',
      joined_at TEXT NOT NULL,
      UNIQUE(workspace_id, user_id),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      project_id TEXT,
      title TEXT NOT NULL,
      template_type TEXT NOT NULL DEFAULT 'custom',
      version INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS document_sections (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      section_key TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      order_index INTEGER NOT NULL DEFAULT 0,
      assigned_to TEXT,
      assigned_name TEXT,
      locked_by TEXT,
      locked_by_name TEXT,
      locked_at TEXT,
      lock_heartbeat TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (locked_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS document_versions (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      sections_snapshot TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_by_name TEXT NOT NULL,
      summary TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS whiteboards (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      project_id TEXT,
      title TEXT NOT NULL,
      canvas_data TEXT NOT NULL DEFAULT '[]',
      version INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS whiteboard_versions (
      id TEXT PRIMARY KEY,
      whiteboard_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      canvas_snapshot TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_by_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (whiteboard_id) REFERENCES whiteboards(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      entity_title TEXT NOT NULL,
      details TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS invitations (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      email TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      invited_by TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (invited_by) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_members_workspace ON workspace_members(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_members_user ON workspace_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_docs_workspace ON documents(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_sections_doc ON document_sections(document_id);
    CREATE INDEX IF NOT EXISTS idx_whiteboards_workspace ON whiteboards(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_activities_workspace ON activities(workspace_id, created_at DESC);
  `);

  console.log('Database initialized successfully with all tables and indexes.');
}

// Activity helper function
export function logActivity({ workspaceId, userId, userName, action, entityType, entityId, entityTitle, details = '' }) {
  try {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO activities (id, workspace_id, user_id, user_name, action, entity_type, entity_id, entity_title, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, workspaceId, userId, userName, action, entityType, entityId, entityTitle, details, createdAt);
    return { id, workspaceId, userId, userName, action, entityType, entityId, entityTitle, details, createdAt };
  } catch (err) {
    console.error('Error logging activity:', err);
    return null;
  }
}

export default db;
