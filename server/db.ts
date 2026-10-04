import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const DB_FILE = path.resolve(process.cwd(), 'queueless.db');

export interface UserRecord {
  id: string;
  google_id: string | null;
  name: string;
  email: string;
  password_hash?: string | null;
  password_salt?: string | null;
  profile_image: string | null;
  role: 'CUSTOMER' | 'PROVIDER' | 'ADMIN';
  created_at: string;
  updated_at: string;
}

export interface ServiceLocationRecord {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  type: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceRecord {
  id: string;
  location_id: string;
  name: string;
  description: string | null;
  average_service_time: number;
  is_active: number;
  created_at: string;
}

export interface QueueRecord {
  id: string;
  service_id: string;
  name: string;
  prefix: string;
  current_token_number: number;
  average_service_time: number;
  status: 'NORMAL' | 'BUSY' | 'DELAYED' | 'PAUSED' | 'CLOSED';
  active_counters_count: number;
  created_at: string;
  updated_at: string;
}

export interface CounterRecord {
  id: string;
  location_id: string;
  service_id: string | null;
  name: string;
  counter_number: number;
  assigned_provider_id: string | null;
  current_queue_entry_id: string | null;
  is_active: number;
  created_at: string;
}

export interface QueueEntryRecord {
  id: string;
  queue_id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string | null;
  token_number: string;
  raw_sequence: number;
  status: 'WAITING' | 'CALLED' | 'SERVING' | 'COMPLETED' | 'SKIPPED' | 'MISSED' | 'CANCELLED';
  is_away: number;
  position: number;
  estimated_wait: number;
  joined_at: string;
  called_at: string | null;
  served_at: string | null;
  completed_at: string | null;
  missed_at: string | null;
  counter_id: string | null;
  priority_reason: string | null;
}

export interface NotificationRecord {
  id: string;
  user_id: string;
  queue_entry_id: string | null;
  type: 'QUEUE_JOINED' | 'QUEUE_UPDATED' | 'TURN_APPROACHING' | 'YOUR_TURN' | 'QUEUE_DELAYED' | 'SERVICE_RESUMED' | 'QUEUE_COMPLETED';
  title: string;
  message: string;
  is_read: number;
  created_at: string;
}

export interface QueueEventRecord {
  id: string;
  queue_id: string;
  queue_entry_id: string | null;
  event_type: string;
  details: string | null;
  created_at: string;
}

export interface AuditLogRecord {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: string | null;
  created_at: string;
}

export interface SessionRecord {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  created_at: string;
}

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_FILE);
    dbInstance.exec('PRAGMA foreign_keys = ON;');
    initSchema(dbInstance);
    seedInitialData(dbInstance);
  }
  return dbInstance;
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      google_id TEXT UNIQUE,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      password_salt TEXT,
      profile_image TEXT,
      role TEXT NOT NULL DEFAULT 'CUSTOMER' CHECK(role IN ('CUSTOMER', 'PROVIDER', 'ADMIN')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS service_locations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      type TEXT NOT NULL,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      location_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      average_service_time REAL NOT NULL DEFAULT 4.0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (location_id) REFERENCES service_locations (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS queues (
      id TEXT PRIMARY KEY,
      service_id TEXT NOT NULL,
      name TEXT NOT NULL,
      prefix TEXT NOT NULL DEFAULT 'A',
      current_token_number INTEGER NOT NULL DEFAULT 0,
      average_service_time REAL NOT NULL DEFAULT 4.0,
      status TEXT NOT NULL DEFAULT 'NORMAL' CHECK(status IN ('NORMAL', 'BUSY', 'DELAYED', 'PAUSED', 'CLOSED')),
      active_counters_count INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS counters (
      id TEXT PRIMARY KEY,
      location_id TEXT NOT NULL,
      service_id TEXT,
      name TEXT NOT NULL,
      counter_number INTEGER NOT NULL,
      assigned_provider_id TEXT,
      current_queue_entry_id TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (location_id) REFERENCES service_locations (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS queue_entries (
      id TEXT PRIMARY KEY,
      queue_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT,
      token_number TEXT NOT NULL,
      raw_sequence INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'WAITING' CHECK(status IN ('WAITING', 'CALLED', 'SERVING', 'COMPLETED', 'SKIPPED', 'MISSED', 'CANCELLED')),
      is_away INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      estimated_wait INTEGER NOT NULL DEFAULT 0,
      joined_at TEXT NOT NULL,
      called_at TEXT,
      served_at TEXT,
      completed_at TEXT,
      missed_at TEXT,
      counter_id TEXT,
      priority_reason TEXT,
      FOREIGN KEY (queue_id) REFERENCES queues (id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      queue_entry_id TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS queue_events (
      id TEXT PRIMARY KEY,
      queue_id TEXT NOT NULL,
      queue_entry_id TEXT,
      event_type TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (queue_id) REFERENCES queues (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_queue_entries_status ON queue_entries(queue_id, status);
    CREATE INDEX IF NOT EXISTS idx_queue_entries_customer ON queue_entries(customer_id, status);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
  `);

  try {
    db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT;');
  } catch {}
  try {
    db.exec('ALTER TABLE users ADD COLUMN password_salt TEXT;');
  } catch {}
}

function seedInitialData(db: DatabaseSync) {
  const existingLocations = db.prepare('SELECT count(*) as count FROM service_locations').get() as { count: number };
  if (existingLocations && existingLocations.count > 0) {
    return;
  }

  const now = new Date().toISOString();

  // Seed standard real-world public service locations
  const locations = [
    {
      id: 'loc_hospital_01',
      name: 'City Metropolitan Government Hospital',
      address: '742 Healthcare Boulevard, Medical District',
      city: 'Metro City',
      state: 'CA',
      type: 'HOSPITAL',
      created_by: null,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'loc_bank_01',
      name: 'First Apex National Bank — Central Branch',
      address: '100 Financial Plaza, Suite 100',
      city: 'Metro City',
      state: 'CA',
      type: 'BANK',
      created_by: null,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'loc_gov_01',
      name: 'Department of Motor Vehicles & Public Registry',
      address: '55 Civic Center Way',
      city: 'Metro City',
      state: 'CA',
      type: 'GOVERNMENT_OFFICE',
      created_by: null,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'loc_diagnostic_01',
      name: 'Apex Advanced Diagnostic & Imaging Center',
      address: '320 Laboratory Parkway',
      city: 'Metro City',
      state: 'CA',
      type: 'DIAGNOSTIC_CENTER',
      created_by: null,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'loc_college_01',
      name: 'State University Student Administration Hall',
      address: '1200 University Drive, Administration Complex',
      city: 'Metro City',
      state: 'CA',
      type: 'COLLEGE',
      created_by: null,
      created_at: now,
      updated_at: now,
    },
  ];

  const insertLoc = db.prepare(`
    INSERT INTO service_locations (id, name, address, city, state, type, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const loc of locations) {
    insertLoc.run(loc.id, loc.name, loc.address, loc.city, loc.state, loc.type, loc.created_by, loc.created_at, loc.updated_at);
  }

  // Seed services
  const services = [
    {
      id: 'srv_gen_opd',
      location_id: 'loc_hospital_01',
      name: 'General OPD & Triage',
      description: 'Consultations, routine outpatient evaluation, and initial clinical assessment.',
      average_service_time: 4.5,
      is_active: 1,
      created_at: now,
    },
    {
      id: 'srv_pediatrics',
      location_id: 'loc_hospital_01',
      name: 'Pediatrics Consultation',
      description: 'Infant care, childhood wellness, immunizations and pediatric triage.',
      average_service_time: 5.0,
      is_active: 1,
      created_at: now,
    },
    {
      id: 'srv_bank_cashier',
      location_id: 'loc_bank_01',
      name: 'Cash Deposit & Withdrawal',
      description: 'Teller counter for physical currency handling and draft issuance.',
      average_service_time: 3.0,
      is_active: 1,
      created_at: now,
    },
    {
      id: 'srv_bank_accounts',
      location_id: 'loc_bank_01',
      name: 'New Accounts & Commercial Services',
      description: 'Account opening, business credit consultations, and wire verification.',
      average_service_time: 8.0,
      is_active: 1,
      created_at: now,
    },
    {
      id: 'srv_dmv_licensing',
      location_id: 'loc_gov_01',
      name: 'Driver License & Real ID Renewal',
      description: 'Biometric capture, document verification, and photo processing.',
      average_service_time: 6.0,
      is_active: 1,
      created_at: now,
    },
    {
      id: 'srv_diagnostic_blood',
      location_id: 'loc_diagnostic_01',
      name: 'Pathology & Blood Draw Lab',
      description: 'Fast fasting blood panels, clinical chemistry sample collection.',
      average_service_time: 3.5,
      is_active: 1,
      created_at: now,
    },
    {
      id: 'srv_univ_records',
      location_id: 'loc_college_01',
      name: 'Registrar & Transcript Verification',
      description: 'Graduation clearance, enrollment certification, and tuition accounting.',
      average_service_time: 4.0,
      is_active: 1,
      created_at: now,
    },
  ];

  const insertSrv = db.prepare(`
    INSERT INTO services (id, location_id, name, description, average_service_time, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const srv of services) {
    insertSrv.run(srv.id, srv.location_id, srv.name, srv.description, srv.average_service_time, srv.is_active, srv.created_at);
  }

  // Seed queues
  const queues = [
    {
      id: 'queue_opd_01',
      service_id: 'srv_gen_opd',
      name: 'General OPD Queue',
      prefix: 'A',
      current_token_number: 12,
      average_service_time: 4.0,
      status: 'NORMAL' as const,
      active_counters_count: 3,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'queue_pediatrics_01',
      service_id: 'srv_pediatrics',
      name: 'Pediatrics Clinic Queue',
      prefix: 'P',
      current_token_number: 5,
      average_service_time: 5.0,
      status: 'NORMAL' as const,
      active_counters_count: 2,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'queue_bank_cash_01',
      service_id: 'srv_bank_cashier',
      name: 'Teller Queue',
      prefix: 'C',
      current_token_number: 21,
      average_service_time: 3.0,
      status: 'NORMAL' as const,
      active_counters_count: 2,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'queue_dmv_lic_01',
      service_id: 'srv_dmv_licensing',
      name: 'Real ID & License Queue',
      prefix: 'D',
      current_token_number: 18,
      average_service_time: 6.0,
      status: 'NORMAL' as const,
      active_counters_count: 3,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'queue_diag_lab_01',
      service_id: 'srv_diagnostic_blood',
      name: 'Phlebotomy Queue',
      prefix: 'L',
      current_token_number: 9,
      average_service_time: 3.5,
      status: 'NORMAL' as const,
      active_counters_count: 2,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'queue_univ_reg_01',
      service_id: 'srv_univ_records',
      name: 'Student Services Queue',
      prefix: 'U',
      current_token_number: 14,
      average_service_time: 4.0,
      status: 'NORMAL' as const,
      active_counters_count: 2,
      created_at: now,
      updated_at: now,
    },
  ];

  const insertQueue = db.prepare(`
    INSERT INTO queues (id, service_id, name, prefix, current_token_number, average_service_time, status, active_counters_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const q of queues) {
    insertQueue.run(q.id, q.service_id, q.name, q.prefix, q.current_token_number, q.average_service_time, q.status, q.active_counters_count, q.created_at, q.updated_at);
  }

  // Seed counters for General OPD and other facilities
  const counters = [
    {
      id: 'counter_opd_1',
      location_id: 'loc_hospital_01',
      service_id: 'srv_gen_opd',
      name: 'Counter 1 — Triage Desk A',
      counter_number: 1,
      assigned_provider_id: null,
      current_queue_entry_id: null,
      is_active: 1,
      created_at: now,
    },
    {
      id: 'counter_opd_2',
      location_id: 'loc_hospital_01',
      service_id: 'srv_gen_opd',
      name: 'Counter 2 — Clinical Station B',
      counter_number: 2,
      assigned_provider_id: null,
      current_queue_entry_id: null,
      is_active: 1,
      created_at: now,
    },
    {
      id: 'counter_opd_3',
      location_id: 'loc_hospital_01',
      service_id: 'srv_gen_opd',
      name: 'Counter 3 — Rapid Intake C',
      counter_number: 3,
      assigned_provider_id: null,
      current_queue_entry_id: null,
      is_active: 1,
      created_at: now,
    },
    {
      id: 'counter_bank_1',
      location_id: 'loc_bank_01',
      service_id: 'srv_bank_cashier',
      name: 'Teller Window 1',
      counter_number: 1,
      assigned_provider_id: null,
      current_queue_entry_id: null,
      is_active: 1,
      created_at: now,
    },
    {
      id: 'counter_bank_2',
      location_id: 'loc_bank_01',
      service_id: 'srv_bank_cashier',
      name: 'Teller Window 2',
      counter_number: 2,
      assigned_provider_id: null,
      current_queue_entry_id: null,
      is_active: 1,
      created_at: now,
    },
  ];

  const insertCounter = db.prepare(`
    INSERT INTO counters (id, location_id, service_id, name, counter_number, assigned_provider_id, current_queue_entry_id, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const c of counters) {
    insertCounter.run(c.id, c.location_id, c.service_id, c.name, c.counter_number, c.assigned_provider_id, c.current_queue_entry_id, c.is_active, c.created_at);
  }

  // Record audit log for database bootstrap
  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertAudit.run(
    'audit_init_bootstrap',
    null,
    'SYSTEM_BOOTSTRAP',
    'DATABASE',
    'queueless.db',
    JSON.stringify({ locations: locations.length, services: services.length, queues: queues.length, counters: counters.length }),
    now
  );
}
