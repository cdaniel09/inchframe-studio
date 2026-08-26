import 'server-only';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type { ChatGPTUser } from '@/app/chatgpt-auth';

export type StudioProject = {
  id:string; owner_id:string; owner_email:string; title:string; project_type:string; status:string;
  brief:string; audience:string; platforms:string; due_date:string|null; aspect_ratios:string; style_notes:string;
  budget_range:string; accepted_at:string|null; declined_at:string|null; access_code_hash:string|null;
  access_code_expires_at:string|null; advanced_unlocked_at:string|null; advanced_brief:string; must_have:string;
  avoid_notes:string; reference_links:string; audio_notes:string; requested_creator:string; created_at:string; updated_at:string;
};
export type StudioAsset = {id:string;project_id:string;uploaded_by_id:string;uploaded_by_email:string;kind:string;object_key:string;filename:string;mime_type:string;byte_size:number;label:string;version:number;status:string;created_at:string};
export type StudioComment = {id:string;project_id:string;asset_id:string|null;author_id:string;author_email:string;body:string;created_at:string};
export type StudioAccount = {id:string;email:string;display_name:string;password_hash:string;role:'client';email_verified_at:string|null;verification_token_hash:string|null;verification_expires_at:string|null;created_at:string};
export type CreatorSample={id:string;creator_id:string;title:string;url:string;sort_order:number};
export type CreatorProfile={id:string;user_id:string;owner_email:string;display_name:string;slug:string;headline:string;bio:string;specialties:string;location:string;rate_unit:'project'|'day'|'hour';rate_min:number;rate_max:number;availability:string;inchframe_email:string;pro_confirmed:number;pro_verified:number;identity_verified:number;tax_verified:number;status:'pending'|'approved'|'declined';avatar_object_key:string;avatar_mime_type:string;created_at:string;updated_at:string;reviewed_at:string|null;samples:CreatorSample[]};

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

function columns(table:'users'|'projects'|'creator_profiles') {
  return new Set((database().prepare(`PRAGMA table_info(${table})`).all() as unknown as {name:string}[]).map(column=>column.name));
}

function addColumn(table:'users'|'projects'|'creator_profiles', existing:Set<string>, name:string, definition:string) {
  if(existing.has(name)) return false;
  database().exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  existing.add(name);
  return true;
}

function verificationExemptEmails() {
  return new Set(['admin@inchframe.com',process.env.ADMIN_EMAIL,...(process.env.VERIFIED_EMAIL_ALLOWLIST||'').split(',')]
    .map(value=>value?.trim().toLowerCase()).filter((value):value is string=>Boolean(value)));
}

export function isEmailVerificationExempt(email:string) {
  return verificationExemptEmails().has(email.trim().toLowerCase());
}

export async function ensureSchema() {
  if (globalForStudio.inchframeSchemaReady) return;
  const db=database();
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'client' CHECK(role = 'client'),
      email_verified_at TEXT, verification_token_hash TEXT, verification_expires_at TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, owner_email TEXT NOT NULL, title TEXT NOT NULL,
      project_type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'inquiry_received', brief TEXT NOT NULL,
      audience TEXT NOT NULL DEFAULT '', platforms TEXT NOT NULL DEFAULT '', due_date TEXT,
      aspect_ratios TEXT NOT NULL DEFAULT '[]', style_notes TEXT NOT NULL DEFAULT '', budget_range TEXT NOT NULL DEFAULT '',
      accepted_at TEXT, declined_at TEXT, access_code_hash TEXT, access_code_expires_at TEXT, advanced_unlocked_at TEXT,
      advanced_brief TEXT NOT NULL DEFAULT '', must_have TEXT NOT NULL DEFAULT '', avoid_notes TEXT NOT NULL DEFAULT '',
      reference_links TEXT NOT NULL DEFAULT '', audio_notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
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
      body TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS decisions (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, asset_id TEXT NOT NULL, author_id TEXT NOT NULL,
      author_email TEXT NOT NULL, decision TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE, FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS request_limits (
      key TEXT PRIMARY KEY, action TEXT NOT NULL, window_started INTEGER NOT NULL, request_count INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, email TEXT NOT NULL, display_name TEXT NOT NULL,
      full_name TEXT, role TEXT NOT NULL CHECK(role IN ('admin','client')), expires_at TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS schema_migrations (
      key TEXT PRIMARY KEY, applied_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS creator_profiles (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, owner_email TEXT NOT NULL, display_name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE COLLATE NOCASE, headline TEXT NOT NULL, bio TEXT NOT NULL, specialties TEXT NOT NULL,
      location TEXT NOT NULL, rate_unit TEXT NOT NULL CHECK(rate_unit IN ('project','day','hour')),
      rate_min INTEGER NOT NULL, rate_max INTEGER NOT NULL, availability TEXT NOT NULL, inchframe_email TEXT NOT NULL,
      pro_confirmed INTEGER NOT NULL DEFAULT 0, pro_verified INTEGER NOT NULL DEFAULT 0, identity_verified INTEGER NOT NULL DEFAULT 0, tax_verified INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','declined')),
      creator_invite_hash TEXT UNIQUE,
      avatar_object_key TEXT NOT NULL, avatar_mime_type TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, reviewed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS creator_samples (
      id TEXT PRIMARY KEY, creator_id TEXT NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL, sort_order INTEGER NOT NULL,
      FOREIGN KEY(creator_id) REFERENCES creator_profiles(id) ON DELETE CASCADE, UNIQUE(creator_id,sort_order)
    );
  `);

  const userColumns=columns('users');
  addColumn('users',userColumns,'email_verified_at','TEXT');
  addColumn('users',userColumns,'verification_token_hash','TEXT');
  addColumn('users',userColumns,'verification_expires_at','TEXT');

  const projectColumns=columns('projects');
  addColumn('projects',projectColumns,'accepted_at','TEXT');
  addColumn('projects',projectColumns,'declined_at','TEXT');
  addColumn('projects',projectColumns,'access_code_hash','TEXT');
  addColumn('projects',projectColumns,'access_code_expires_at','TEXT');
  const addedUnlock=addColumn('projects',projectColumns,'advanced_unlocked_at','TEXT');
  addColumn('projects',projectColumns,'advanced_brief',"TEXT NOT NULL DEFAULT ''");
  addColumn('projects',projectColumns,'must_have',"TEXT NOT NULL DEFAULT ''");
  addColumn('projects',projectColumns,'avoid_notes',"TEXT NOT NULL DEFAULT ''");
  addColumn('projects',projectColumns,'reference_links',"TEXT NOT NULL DEFAULT ''");
  addColumn('projects',projectColumns,'audio_notes',"TEXT NOT NULL DEFAULT ''");
  addColumn('projects',projectColumns,'requested_creator',"TEXT NOT NULL DEFAULT ''");
  if(addedUnlock) db.prepare('UPDATE projects SET advanced_unlocked_at=created_at WHERE advanced_unlocked_at IS NULL').run();

  const creatorColumns=columns('creator_profiles');
  addColumn('creator_profiles',creatorColumns,'creator_invite_hash','TEXT');
  addColumn('creator_profiles',creatorColumns,'pro_verified','INTEGER NOT NULL DEFAULT 0');
  addColumn('creator_profiles',creatorColumns,'identity_verified','INTEGER NOT NULL DEFAULT 0');
  addColumn('creator_profiles',creatorColumns,'tax_verified','INTEGER NOT NULL DEFAULT 0');

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token_hash) WHERE verification_token_hash IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_projects_owner_updated ON projects(owner_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_assets_project_created ON assets(project_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_comments_project_asset ON comments(project_id, asset_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_decisions_asset_created ON decisions(asset_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_creator_profiles_status_updated ON creator_profiles(status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_creator_samples_creator_sort ON creator_samples(creator_id, sort_order);
    PRAGMA optimize;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_profiles_invite_hash ON creator_profiles(creator_invite_hash) WHERE creator_invite_hash IS NOT NULL;
  `);

  const verificationMigration='require-existing-client-verification-v1';
  const alreadyApplied=db.prepare('SELECT 1 FROM schema_migrations WHERE key=?').get(verificationMigration);
  if(!alreadyApplied) {
    const now=new Date().toISOString();
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('UPDATE users SET email_verified_at=NULL,verification_token_hash=NULL,verification_expires_at=NULL').run();
      for(const email of verificationExemptEmails()) {
        db.prepare('UPDATE users SET email_verified_at=? WHERE email=? COLLATE NOCASE').run(now,email);
      }
      db.prepare('INSERT INTO schema_migrations (key,applied_at) VALUES (?,?)').run(verificationMigration,now);
      db.exec('COMMIT');
    } catch(error) {db.exec('ROLLBACK');throw error;}
  }
  globalForStudio.inchframeSchemaReady = true;
}

export function isStudioAdmin(user: ChatGPTUser | string) {
  if (typeof user !== 'string') return user.role === 'admin';
  const configured = [process.env.ADMIN_EMAIL, ...(process.env.STUDIO_ADMIN_EMAILS || '').split(',')]
    .map(value => value?.trim().toLowerCase()).filter(Boolean);
  return configured.includes(user.toLowerCase());
}

export async function createStudioSessionRecord(tokenHash:string,user:ChatGPTUser,expiresAt:string) {
  await ensureSchema();
  const db=database(),now=new Date().toISOString();
  db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(now);
  db.prepare('INSERT INTO sessions (token_hash,user_id,email,display_name,full_name,role,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(tokenHash,user.userId,user.email,user.displayName,user.fullName,user.role,expiresAt,now);
}

export async function findStudioSession(tokenHash:string):Promise<ChatGPTUser|null> {
  await ensureSchema();
  const now=new Date().toISOString();
  const row=database().prepare('SELECT user_id,email,display_name,full_name,role FROM sessions WHERE token_hash=? AND expires_at>?').get(tokenHash,now) as {user_id:string;email:string;display_name:string;full_name:string|null;role:'admin'|'client'}|undefined;
  if(!row) return null;
  return {userId:row.user_id,email:row.email,displayName:row.display_name,fullName:row.full_name,role:row.role};
}

export async function deleteStudioSession(tokenHash:string) {
  await ensureSchema();
  database().prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash);
}

function withCreatorSamples(profile:Omit<CreatorProfile,'samples'>&{creator_invite_hash?:string}):CreatorProfile {
  const samples=database().prepare('SELECT * FROM creator_samples WHERE creator_id=? ORDER BY sort_order').all(profile.id) as unknown as CreatorSample[];
  const publicProfile={...profile};delete publicProfile.creator_invite_hash;return {...publicProfile,samples};
}

function creatorSlug(value:string){const normalized=value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,54);return normalized||'creator';}

export async function saveCreatorApplication(user:ChatGPTUser,input:{displayName:string;headline:string;bio:string;specialties:string;location:string;rateUnit:'project'|'day'|'hour';rateMin:number;rateMax:number;availability:string;inchframeEmail:string;creatorInviteHash?:string;samples:{title:string;url:string}[];avatarKey?:string;avatarMime?:string}) {
  await ensureSchema();
  const db=database(),now=new Date().toISOString();
  const existing=db.prepare('SELECT * FROM creator_profiles WHERE user_id=?').get(user.userId) as Omit<CreatorProfile,'samples'>|undefined;
  if(!existing&&!input.avatarKey)throw new Error('A profile icon is required.');
  if(!existing&&!input.creatorInviteHash)throw new Error('A Pro Creator invite key is required.');
  const id=existing?.id||crypto.randomUUID();
  let slug=existing?.slug||creatorSlug(input.displayName);
  if(!existing){const collision=db.prepare('SELECT 1 FROM creator_profiles WHERE slug=? COLLATE NOCASE').get(slug);if(collision)slug=`${slug.slice(0,45)}-${id.slice(0,8)}`;}
  const avatarKey=input.avatarKey||existing?.avatar_object_key||'';
  const avatarMime=input.avatarMime||existing?.avatar_mime_type||'';
  db.exec('BEGIN IMMEDIATE');
  try {
    if(existing)db.prepare(`UPDATE creator_profiles SET owner_email=?,display_name=?,headline=?,bio=?,specialties=?,location=?,rate_unit=?,rate_min=?,rate_max=?,availability=?,inchframe_email=?,pro_confirmed=1,status='pending',avatar_object_key=?,avatar_mime_type=?,updated_at=?,reviewed_at=NULL WHERE id=?`).run(user.email,input.displayName,input.headline,input.bio,input.specialties,input.location,input.rateUnit,input.rateMin,input.rateMax,input.availability,input.inchframeEmail,avatarKey,avatarMime,now,id);
    else db.prepare(`INSERT INTO creator_profiles (id,user_id,owner_email,display_name,slug,headline,bio,specialties,location,rate_unit,rate_min,rate_max,availability,inchframe_email,creator_invite_hash,pro_confirmed,status,avatar_object_key,avatar_mime_type,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,'pending',?,?,?,?)`).run(id,user.userId,user.email,input.displayName,slug,input.headline,input.bio,input.specialties,input.location,input.rateUnit,input.rateMin,input.rateMax,input.availability,input.inchframeEmail,input.creatorInviteHash||'',avatarKey,avatarMime,now,now);
    db.prepare('DELETE FROM creator_samples WHERE creator_id=?').run(id);
    const insert=db.prepare('INSERT INTO creator_samples (id,creator_id,title,url,sort_order) VALUES (?,?,?,?,?)');
    input.samples.slice(0,5).forEach((sample,index)=>insert.run(crypto.randomUUID(),id,sample.title,sample.url,index));
    db.exec('COMMIT');
  } catch(error){db.exec('ROLLBACK');throw error;}
  return {id,slug,oldAvatarKey:existing?.avatar_object_key||null};
}

export async function getCreatorApplicationForUser(user:ChatGPTUser) {
  await ensureSchema();
  const profile=database().prepare('SELECT * FROM creator_profiles WHERE user_id=?').get(user.userId) as Omit<CreatorProfile,'samples'>|undefined;
  return profile?withCreatorSamples(profile):null;
}

export async function listCreatorApplications(user:ChatGPTUser) {
  await ensureSchema();
  const rows=(isStudioAdmin(user)?database().prepare('SELECT * FROM creator_profiles ORDER BY updated_at DESC').all():database().prepare('SELECT * FROM creator_profiles WHERE user_id=? ORDER BY updated_at DESC').all(user.userId)) as unknown as Omit<CreatorProfile,'samples'>[];
  return rows.map(withCreatorSamples);
}

export async function getCreatorApplicationById(id:string) {
  await ensureSchema();
  const profile=database().prepare('SELECT * FROM creator_profiles WHERE id=?').get(id) as Omit<CreatorProfile,'samples'>|undefined;
  return profile?withCreatorSamples(profile):null;
}

export async function reviewCreatorApplication(id:string,status:'approved'|'declined',verification:{proVerified:boolean;identityVerified:boolean;taxVerified:boolean}) {
  await ensureSchema();
  const now=new Date().toISOString();
  database().prepare('UPDATE creator_profiles SET status=?,pro_verified=?,identity_verified=?,tax_verified=?,reviewed_at=?,updated_at=? WHERE id=?').run(status,verification.proVerified?1:0,verification.identityVerified?1:0,verification.taxVerified?1:0,now,now,id);
}

export async function listPublicCreators() {
  await ensureSchema();
  const rows=database().prepare(`SELECT * FROM creator_profiles WHERE status='approved' ORDER BY display_name COLLATE NOCASE`).all() as unknown as Omit<CreatorProfile,'samples'>[];
  return rows.map(withCreatorSamples);
}

export async function getPublicCreatorBySlug(slug:string) {
  await ensureSchema();
  const profile=database().prepare(`SELECT * FROM creator_profiles WHERE slug=? COLLATE NOCASE AND status='approved'`).get(slug) as Omit<CreatorProfile,'samples'>|undefined;
  return profile?withCreatorSamples(profile):null;
}

export async function getCreatorIconForViewer(id:string,user:ChatGPTUser|null) {
  await ensureSchema();
  const profile=database().prepare('SELECT user_id,status,avatar_object_key,avatar_mime_type FROM creator_profiles WHERE id=?').get(id) as {user_id:string;status:string;avatar_object_key:string;avatar_mime_type:string}|undefined;
  if(!profile)return null;
  const publicIcon=profile.status==='approved';
  if(!publicIcon&&(!user||(profile.user_id!==user.userId&&!isStudioAdmin(user))))return null;
  return {objectKey:profile.avatar_object_key,mimeType:profile.avatar_mime_type,public:publicIcon};
}

export async function checkRateLimit(action:string,identifier:string,limit:number,windowMs:number) {
  await ensureSchema();
  const key=createHash('sha256').update(`${action}:${identifier}`).digest('hex');
  const now=Date.now();
  const db=database();
  const row=db.prepare('SELECT window_started,request_count FROM request_limits WHERE key=?').get(key) as {window_started:number;request_count:number}|undefined;
  if(!row || now-row.window_started>=windowMs) {
    db.prepare('INSERT INTO request_limits (key,action,window_started,request_count) VALUES (?,?,?,1) ON CONFLICT(key) DO UPDATE SET action=excluded.action,window_started=excluded.window_started,request_count=1').run(key,action,now);
    return true;
  }
  if(row.request_count>=limit) return false;
  db.prepare('UPDATE request_limits SET request_count=request_count+1 WHERE key=?').run(key);
  return true;
}

export async function createStudioAccount(input:{email:string;displayName:string;passwordHash:string;verificationTokenHash:string;verificationExpiresAt:string}) {
  await ensureSchema();
  const id=crypto.randomUUID(), now=new Date().toISOString();
  database().prepare(`INSERT INTO users (id,email,display_name,password_hash,role,email_verified_at,verification_token_hash,verification_expires_at,created_at) VALUES (?,?,?,?, 'client',NULL,?,?,?)`)
    .run(id,input.email.trim().toLowerCase(),input.displayName.trim(),input.passwordHash,input.verificationTokenHash,input.verificationExpiresAt,now);
  return id;
}

export async function findStudioAccount(email:string) {
  await ensureSchema();
  return (database().prepare('SELECT * FROM users WHERE email=? COLLATE NOCASE').get(email.trim().toLowerCase()) as StudioAccount|undefined) ?? null;
}

export async function refreshVerificationToken(email:string,tokenHash:string,expiresAt:string) {
  await ensureSchema();
  database().prepare('UPDATE users SET verification_token_hash=?,verification_expires_at=? WHERE email=? COLLATE NOCASE AND email_verified_at IS NULL').run(tokenHash,expiresAt,email.trim().toLowerCase());
}

export async function verifyStudioAccount(tokenHash:string) {
  await ensureSchema();
  const now=new Date().toISOString(), db=database();
  const account=db.prepare('SELECT * FROM users WHERE verification_token_hash=? AND verification_expires_at>? AND email_verified_at IS NULL').get(tokenHash,now) as StudioAccount|undefined;
  if(!account) return null;
  db.prepare('UPDATE users SET email_verified_at=?,verification_token_hash=NULL,verification_expires_at=NULL WHERE id=?').run(now,account.id);
  return {...account,email_verified_at:now,verification_token_hash:null,verification_expires_at:null};
}

export async function createProject(user:ChatGPTUser,input:{title:string;projectType:string;brief:string;audience:string;platforms:string;dueDate:string|null;budgetRange:string;requestedCreator?:string}) {
  await ensureSchema();
  const id=crypto.randomUUID(),now=new Date().toISOString();
  database().prepare(`INSERT INTO projects (id,owner_id,owner_email,title,project_type,status,brief,audience,platforms,due_date,aspect_ratios,style_notes,budget_range,requested_creator,created_at,updated_at) VALUES (?,?,?,?,?,'inquiry_received',?,?,?,?, '[]','',?,?,?,?)`)
    .run(id,user.userId,user.email,input.title,input.projectType,input.brief,input.audience,input.platforms,input.dueDate,input.budgetRange,input.requestedCreator||'',now,now);
  return id;
}

export async function listProjects(user:ChatGPTUser) {
  await ensureSchema();
  const rows=isStudioAdmin(user)?database().prepare('SELECT * FROM projects ORDER BY updated_at DESC').all():database().prepare('SELECT * FROM projects WHERE owner_id=? ORDER BY updated_at DESC').all(user.userId);
  return rows as unknown as StudioProject[];
}

export async function getProjectForUser(projectId:string,user:ChatGPTUser) {
  await ensureSchema();
  const project=database().prepare('SELECT * FROM projects WHERE id=?').get(projectId) as StudioProject|undefined;
  return project && (project.owner_id===user.userId || isStudioAdmin(user)) ? project : null;
}

export async function getProjectBundle(projectId:string,user:ChatGPTUser) {
  const project=await getProjectForUser(projectId,user);
  if(!project)return null;
  const assets=database().prepare('SELECT * FROM assets WHERE project_id=? ORDER BY created_at DESC').all(projectId) as unknown as StudioAsset[];
  const comments=database().prepare('SELECT * FROM comments WHERE project_id=? ORDER BY created_at ASC').all(projectId) as unknown as StudioComment[];
  return {project,assets,comments};
}

export async function acceptProject(projectId:string,accessCodeHash:string,expiresAt:string) {
  await ensureSchema();
  const now=new Date().toISOString();
  database().prepare(`UPDATE projects SET status='accepted_pending_access',accepted_at=?,declined_at=NULL,access_code_hash=?,access_code_expires_at=?,updated_at=? WHERE id=?`).run(now,accessCodeHash,expiresAt,now,projectId);
}

export async function markProjectEmailFailed(projectId:string) {
  await ensureSchema();
  database().prepare(`UPDATE projects SET status='accepted_email_failed',updated_at=? WHERE id=?`).run(new Date().toISOString(),projectId);
}

export async function declineProject(projectId:string) {
  await ensureSchema();
  const now=new Date().toISOString();
  database().prepare(`UPDATE projects SET status='declined',declined_at=?,access_code_hash=NULL,access_code_expires_at=NULL,updated_at=? WHERE id=?`).run(now,now,projectId);
}

export async function unlockProject(projectId:string,user:ChatGPTUser,accessCodeHash:string) {
  await ensureSchema();
  const now=new Date().toISOString();
  const result=database().prepare(`UPDATE projects SET status='advanced_intake',advanced_unlocked_at=?,access_code_hash=NULL,access_code_expires_at=NULL,updated_at=? WHERE id=? AND owner_id=? AND access_code_hash=? AND access_code_expires_at>? AND advanced_unlocked_at IS NULL`).run(now,now,projectId,user.userId,accessCodeHash,now);
  return result.changes===1;
}

export async function saveAdvancedIntake(projectId:string,user:ChatGPTUser,input:{advancedBrief:string;mustHave:string;avoidNotes:string;referenceLinks:string;audioNotes:string;aspectRatios:string[];styleNotes:string}) {
  await ensureSchema();
  const now=new Date().toISOString();
  const result=database().prepare(`UPDATE projects SET advanced_brief=?,must_have=?,avoid_notes=?,reference_links=?,audio_notes=?,aspect_ratios=?,style_notes=?,status='production_ready',updated_at=? WHERE id=? AND owner_id=? AND advanced_unlocked_at IS NOT NULL`).run(input.advancedBrief,input.mustHave,input.avoidNotes,input.referenceLinks,input.audioNotes,JSON.stringify(input.aspectRatios),input.styleNotes,now,projectId,user.userId);
  return result.changes===1;
}

export async function addAsset(user:ChatGPTUser,projectId:string,input:{kind:string;objectKey:string;filename:string;mimeType:string;byteSize:number;label:string}) {
  await ensureSchema();
  const id=crypto.randomUUID(),now=new Date().toISOString();
  const v=database().prepare('SELECT COALESCE(MAX(version),0) max_version FROM assets WHERE project_id=? AND kind=?').get(projectId,input.kind) as {max_version:number};
  const status=['seed','audio'].includes(input.kind)?'uploaded':'in_review';
  database().prepare('INSERT INTO assets (id,project_id,uploaded_by_id,uploaded_by_email,kind,object_key,filename,mime_type,byte_size,label,version,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(id,projectId,user.userId,user.email,input.kind,input.objectKey,input.filename,input.mimeType,input.byteSize,input.label,(v?.max_version??0)+1,status,now);
  if(['seed','audio'].includes(input.kind)) database().prepare('UPDATE projects SET updated_at=? WHERE id=?').run(now,projectId);
  else database().prepare('UPDATE projects SET updated_at=?,status=? WHERE id=?').run(now,'client_review',projectId);
  return id;
}

export async function getAssetForUser(assetId:string,user:ChatGPTUser) {
  await ensureSchema();
  return (database().prepare('SELECT a.* FROM assets a JOIN projects p ON p.id=a.project_id WHERE a.id=? AND (p.owner_id=? OR ?=1)').get(assetId,user.userId,isStudioAdmin(user)?1:0) as StudioAsset|undefined) ?? null;
}

export async function addComment(user:ChatGPTUser,projectId:string,assetId:string|null,body:string) {
  await ensureSchema();
  const now=new Date().toISOString();
  database().prepare('INSERT INTO comments (id,project_id,asset_id,author_id,author_email,body,created_at) VALUES (?,?,?,?,?,?,?)').run(crypto.randomUUID(),projectId,assetId,user.userId,user.email,body,now);
  database().prepare('UPDATE projects SET updated_at=? WHERE id=?').run(now,projectId);
}

export async function recordDecision(user:ChatGPTUser,projectId:string,assetId:string,decision:'approved'|'changes_requested',note:string) {
  await ensureSchema();
  const now=new Date().toISOString(),db=database();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT INTO decisions (id,project_id,asset_id,author_id,author_email,decision,note,created_at) VALUES (?,?,?,?,?,?,?,?)').run(crypto.randomUUID(),projectId,assetId,user.userId,user.email,decision,note,now);
    db.prepare('UPDATE assets SET status=? WHERE id=? AND project_id=?').run(decision,assetId,projectId);
    db.prepare('UPDATE projects SET updated_at=?,status=? WHERE id=?').run(now,decision==='approved'?'approval_recorded':'revisions_requested',projectId);
    db.exec('COMMIT');
  } catch(error) {db.exec('ROLLBACK');throw error;}
}
