import 'server-only';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { ChatGPTUser } from '@/app/chatgpt-auth';

export type StudioProject = {id:string;owner_id:string;owner_email:string;title:string;project_type:string;status:string;brief:string;audience:string;platforms:string;due_date:string|null;aspect_ratios:string;style_notes:string;budget_range:string;created_at:string;updated_at:string};
export type StudioAsset = {id:string;project_id:string;uploaded_by_id:string;uploaded_by_email:string;kind:string;object_key:string;filename:string;mime_type:string;byte_size:number;label:string;version:number;status:string;created_at:string};
export type StudioComment = {id:string;project_id:string;asset_id:string|null;author_id:string;author_email:string;body:string;created_at:string};
export type StudioAccount = {id:string;email:string;display_name:string;password_hash:string;role:'client';created_at:string};

const globalForStudio = globalThis as typeof globalThis & {inchframeStudioDb?: DatabaseSync; inchframeSchemaReady?: boolean};

function databasePath() {
  const configured = process.env.DATABASE_PATH;
  if (configured) return path.resolve(/* turbopackIgnore: true */ configured);
  return path.join(process.cwd(), 'data', 'inchframe-studio.sqlite');
}

function database() {
  if (globalForStudio.inchframeStudioDb) return globalForStudio.inchframeStudioDb;
  const filename = databasePath();
  mkdirSync(path.dirname(filename), {recursive: true});
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  globalForStudio.inchframeStudioDb = db;
  return db;
}

export async function ensureSchema() {
  if (globalForStudio.inchframeSchemaReady) return;
  database().exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'client' CHECK(role = 'client'),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, owner_email TEXT NOT NULL,
      title TEXT NOT NULL, project_type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'intake_received',
      brief TEXT NOT NULL, audience TEXT NOT NULL DEFAULT '', platforms TEXT NOT NULL DEFAULT '', due_date TEXT,
      aspect_ratios TEXT NOT NULL DEFAULT '[]', style_notes TEXT NOT NULL DEFAULT '', budget_range TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, uploaded_by_id TEXT NOT NULL, uploaded_by_email TEXT NOT NULL,
      kind TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE, filename TEXT NOT NULL, mime_type TEXT NOT NULL,
      byte_size INTEGER NOT NULL, label TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'uploaded', created_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, asset_id TEXT, author_id TEXT NOT NULL, author_email TEXT NOT NULL,
      body TEXT NOT NULL, created_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS decisions (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, asset_id TEXT NOT NULL, author_id TEXT NOT NULL,
      author_email TEXT NOT NULL, decision TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_projects_owner_updated ON projects(owner_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_assets_project_created ON assets(project_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_comments_project_asset ON comments(project_id, asset_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_decisions_asset_created ON decisions(asset_id, created_at DESC);
    PRAGMA optimize;
  `);
  globalForStudio.inchframeSchemaReady = true;
}

export function isStudioAdmin(user: ChatGPTUser | string) {
  if (typeof user !== 'string') return user.role === 'admin';
  const configured = [process.env.ADMIN_EMAIL, ...(process.env.STUDIO_ADMIN_EMAILS || '').split(',')]
    .map(value => value?.trim().toLowerCase()).filter(Boolean);
  return configured.includes(user.toLowerCase());
}

export async function createStudioAccount(input: {email:string; displayName:string; passwordHash:string}) {
  await ensureSchema();
  const id = crypto.randomUUID();
  database().prepare('INSERT INTO users (id,email,display_name,password_hash,role,created_at) VALUES (?,?,?,?,\'client\',?)')
    .run(id, input.email.trim().toLowerCase(), input.displayName.trim(), input.passwordHash, new Date().toISOString());
  return id;
}

export async function findStudioAccount(email: string) {
  await ensureSchema();
  return (database().prepare('SELECT * FROM users WHERE email=? COLLATE NOCASE').get(email.trim().toLowerCase()) as StudioAccount | undefined) ?? null;
}

export async function createProject(user:ChatGPTUser,input:{title:string;projectType:string;brief:string;audience:string;platforms:string;dueDate:string|null;aspectRatios:string[];styleNotes:string;budgetRange:string}) {
  await ensureSchema();
  const id=crypto.randomUUID(),now=new Date().toISOString();
  database().prepare(`INSERT INTO projects (id,owner_id,owner_email,title,project_type,status,brief,audience,platforms,due_date,aspect_ratios,style_notes,budget_range,created_at,updated_at) VALUES (?,?,?,?,?,'intake_received',?,?,?,?,?,?,?,?,?)`)
    .run(id,user.userId,user.email,input.title,input.projectType,input.brief,input.audience,input.platforms,input.dueDate,JSON.stringify(input.aspectRatios),input.styleNotes,input.budgetRange,now,now);
  return id;
}

export async function listProjects(user:ChatGPTUser) {
  await ensureSchema();
  const rows = isStudioAdmin(user)
    ? database().prepare('SELECT * FROM projects ORDER BY updated_at DESC').all()
    : database().prepare('SELECT * FROM projects WHERE owner_id=? ORDER BY updated_at DESC').all(user.userId);
  return rows as unknown as StudioProject[];
}

export async function getProjectForUser(projectId:string,user:ChatGPTUser) {
  await ensureSchema();
  const project=database().prepare('SELECT * FROM projects WHERE id=?').get(projectId) as StudioProject | undefined;
  return project && (project.owner_id===user.userId || isStudioAdmin(user)) ? project : null;
}

export async function getProjectBundle(projectId:string,user:ChatGPTUser) {
  const project=await getProjectForUser(projectId,user);
  if(!project)return null;
  const assets=database().prepare('SELECT * FROM assets WHERE project_id=? ORDER BY created_at DESC').all(projectId) as unknown as StudioAsset[];
  const comments=database().prepare('SELECT * FROM comments WHERE project_id=? ORDER BY created_at ASC').all(projectId) as unknown as StudioComment[];
  return {project,assets,comments};
}

export async function addAsset(user:ChatGPTUser,projectId:string,input:{kind:string;objectKey:string;filename:string;mimeType:string;byteSize:number;label:string}) {
  await ensureSchema();
  const id=crypto.randomUUID(),now=new Date().toISOString();
  const v=database().prepare('SELECT COALESCE(MAX(version),0) max_version FROM assets WHERE project_id=? AND kind=?').get(projectId,input.kind) as {max_version:number};
  const status=input.kind==='seed'?'uploaded':'in_review';
  database().prepare('INSERT INTO assets (id,project_id,uploaded_by_id,uploaded_by_email,kind,object_key,filename,mime_type,byte_size,label,version,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(id,projectId,user.userId,user.email,input.kind,input.objectKey,input.filename,input.mimeType,input.byteSize,input.label,(v?.max_version??0)+1,status,now);
  database().prepare('UPDATE projects SET updated_at=?,status=? WHERE id=?').run(now,input.kind==='seed'?'intake_received':'client_review',projectId);
  return id;
}

export async function getAssetForUser(assetId:string,user:ChatGPTUser) {
  await ensureSchema();
  return (database().prepare('SELECT a.* FROM assets a JOIN projects p ON p.id=a.project_id WHERE a.id=? AND (p.owner_id=? OR ?=1)')
    .get(assetId,user.userId,isStudioAdmin(user)?1:0) as StudioAsset | undefined) ?? null;
}

export async function addComment(user:ChatGPTUser,projectId:string,assetId:string|null,body:string) {
  await ensureSchema();
  const now=new Date().toISOString();
  database().prepare('INSERT INTO comments (id,project_id,asset_id,author_id,author_email,body,created_at) VALUES (?,?,?,?,?,?,?)')
    .run(crypto.randomUUID(),projectId,assetId,user.userId,user.email,body,now);
  database().prepare('UPDATE projects SET updated_at=? WHERE id=?').run(now,projectId);
}

export async function recordDecision(user:ChatGPTUser,projectId:string,assetId:string,decision:'approved'|'changes_requested',note:string) {
  await ensureSchema();
  const now=new Date().toISOString(), db=database();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT INTO decisions (id,project_id,asset_id,author_id,author_email,decision,note,created_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(crypto.randomUUID(),projectId,assetId,user.userId,user.email,decision,note,now);
    db.prepare('UPDATE assets SET status=? WHERE id=? AND project_id=?').run(decision,assetId,projectId);
    db.prepare('UPDATE projects SET updated_at=?,status=? WHERE id=?').run(now,decision==='approved'?'approval_recorded':'revisions_requested',projectId);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
