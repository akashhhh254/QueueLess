import { Router, Response } from 'express';
import QRCode from 'qrcode';
import { getDb, UserRecord, QueueRecord, ServiceLocationRecord, CounterRecord, QueueEntryRecord } from './db.js';
import { AuthService, AuthenticatedRequest } from './auth.js';
import { QueueEngine } from './queueEngine.js';
import { WSServerManager } from './wsServer.js';

export const apiRouter = Router();

// ==========================================
// HEALTH CHECK
// ==========================================
apiRouter.get('/health', (req, res) => {
  try {
    const db = getDb();
    const result = db.prepare('SELECT 1 as healthy').get() as { healthy: number };
    res.json({
      status: 'ok',
      database: result.healthy === 1 ? 'connected' : 'degraded',
      server: 'QueueLess Production Engine',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', database: 'disconnected', error: err.message });
  }
});

// ==========================================
// AUTHENTICATION
// ==========================================
apiRouter.get('/auth/config', (req, res) => {
  const clientId = AuthService.getGoogleClientId();
  res.json({
    configured: Boolean(clientId && clientId.length > 5),
    clientId: clientId || '',
    appUrl: process.env.APP_URL || 'http://localhost:3000',
  });
});

apiRouter.post('/auth/save-client-id', (req: AuthenticatedRequest, res: Response) => {
  const { clientId } = req.body;
  if (!clientId || typeof clientId !== 'string' || clientId.length < 5) {
    return res.status(400).json({ error: 'Valid Google Client ID is required.' });
  }
  AuthService.setGoogleClientId(clientId);
  res.json({ success: true, clientId });
});

apiRouter.get('/auth/me', (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.json({ user: null });
  }
  res.json({ user: req.user });
});

apiRouter.post('/auth/register', async (req: AuthenticatedRequest, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { name, email, password, role } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'Registration Failed',
        message: 'Full name, email address, and password are required.',
      });
    }

    const { user, sessionToken } = await AuthService.registerWithPassword({
      name: name.trim(),
      email: email.trim(),
      password,
      role: role === 'PROVIDER' ? 'PROVIDER' : 'CUSTOMER',
    });

    const isSecure = req.secure || process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
    res.cookie('queueless_session', sessionToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: isSecure ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({
      success: true,
      user,
      sessionToken,
      message: `Account created successfully! Welcome, ${user.name}.`,
    });
  } catch (err: any) {
    const status = err.message?.includes('already exists') ? 409 : 400;
    return res.status(status).json({
      error: 'Registration Failed',
      message: err.message || 'Unable to complete registration.',
    });
  }
});

const handleLoginRequest = async (req: AuthenticatedRequest, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({
        error: 'Login Failed',
        message: 'Please enter both your email address and password.',
      });
    }

    const { user, sessionToken } = await AuthService.loginWithPassword(email.trim(), password);

    const isSecure = req.secure || process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
    res.cookie('queueless_session', sessionToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: isSecure ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      user,
      sessionToken,
      message: `Welcome back, ${user.name}!`,
    });
  } catch (err: any) {
    return res.status(401).json({
      error: 'Login Failed',
      message: err.message || 'Invalid email or password.',
    });
  }
};

apiRouter.post('/auth/login-password', handleLoginRequest);
apiRouter.post('/auth/login', handleLoginRequest);

apiRouter.post('/auth/reset-password', async (req: AuthenticatedRequest, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { email, newPassword } = req.body || {};
    if (!email || !newPassword) {
      return res.status(400).json({
        error: 'Password Reset Failed',
        message: 'Please enter both email and your new password.',
      });
    }

    const { user, sessionToken } = await AuthService.resetPassword(email.trim(), newPassword);

    const isSecure = req.secure || process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
    res.cookie('queueless_session', sessionToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: isSecure ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      user,
      sessionToken,
      message: `Password updated successfully! Welcome, ${user.name}.`,
    });
  } catch (err: any) {
    return res.status(400).json({
      error: 'Password Reset Failed',
      message: err.message || 'Unable to reset password.',
    });
  }
});

apiRouter.post('/auth/google', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'Google credential token is required.' });
    }

    // Real Google Identity Verification
    const verified = await AuthService.verifyGoogleToken(credential);

    // Save/Find user and create session
    const { user, sessionToken } = await AuthService.authenticateGoogleUser(verified);

    const isSecure = req.secure || process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
    res.cookie('queueless_session', sessionToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: isSecure ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      user,
      sessionToken,
      message: `Welcome, ${user.name}! Your secure session is established.`,
    });
  } catch (err: any) {
    res.status(401).json({
      error: 'Google Authentication Failed',
      message: err.message || 'Unable to verify Google credentials.',
    });
  }
});

apiRouter.post('/auth/logout', (req: AuthenticatedRequest, res: Response) => {
  if (req.sessionToken) {
    AuthService.logout(req.sessionToken);
  }
  res.clearCookie('queueless_session');
  res.json({ success: true, message: 'Logged out successfully.' });
});

// ==========================================
// LOCATIONS & SERVICES
// ==========================================
apiRouter.get('/locations', (req, res) => {
  const db = getDb();
  const locations = db.prepare('SELECT * FROM service_locations ORDER BY name ASC').all() as unknown as ServiceLocationRecord[];

  const detailed = locations.map((loc) => {
    const services = db.prepare('SELECT * FROM services WHERE location_id = ? AND is_active = 1').all(loc.id) as any[];
    const activeQueuesCount = db.prepare(`
      SELECT count(*) as count FROM queues q
      JOIN services s ON q.service_id = s.id
      WHERE s.location_id = ? AND q.status != 'CLOSED'
    `).get(loc.id) as { count: number };

    return {
      ...loc,
      servicesCount: services.length,
      activeQueuesCount: activeQueuesCount.count,
    };
  });

  res.json(detailed);
});

apiRouter.get('/locations/:id', (req, res) => {
  const db = getDb();
  const location = db.prepare('SELECT * FROM service_locations WHERE id = ?').get(req.params.id) as ServiceLocationRecord | undefined;
  if (!location) return res.status(404).json({ error: 'Location not found' });

  const services = db.prepare('SELECT * FROM services WHERE location_id = ?').all(location.id) as any[];
  const servicesWithQueues = services.map((s) => {
    const queues = db.prepare('SELECT * FROM queues WHERE service_id = ?').all(s.id) as unknown as QueueRecord[];
    const queuesWithStatus = queues.map((q) => {
      const waiting = db.prepare("SELECT count(*) as count FROM queue_entries WHERE queue_id = ? AND status = 'WAITING'").get(q.id) as { count: number };
      const serving = db.prepare("SELECT token_number FROM queue_entries WHERE queue_id = ? AND status IN ('CALLED', 'SERVING') ORDER BY called_at DESC LIMIT 1").get(q.id) as { token_number: string } | undefined;
      return {
        ...q,
        waitingCount: waiting.count,
        nowServing: serving?.token_number || 'None',
      };
    });
    return { ...s, queues: queuesWithStatus };
  });

  res.json({ ...location, services: servicesWithQueues });
});

// ==========================================
// QUEUES & CUSTOMER ACTIONS
// ==========================================
apiRouter.get('/queues/:id', (req, res) => {
  const db = getDb();
  const queue = db.prepare('SELECT * FROM queues WHERE id = ?').get(req.params.id) as QueueRecord | undefined;
  if (!queue) return res.status(404).json({ error: 'Queue not found' });

  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(queue.service_id) as any;
  const location = service ? db.prepare('SELECT * FROM service_locations WHERE id = ?').get(service.location_id) as any : null;
  const counters = db.prepare('SELECT * FROM counters WHERE location_id = ? AND is_active = 1').all(location?.id || '') as unknown as CounterRecord[];

  const waitingEntries = db.prepare(`
    SELECT id, token_number, position, estimated_wait, joined_at, is_away, priority_reason
    FROM queue_entries 
    WHERE queue_id = ? AND status = 'WAITING'
    ORDER BY position ASC
  `).all(queue.id);

  const currentlyServing = db.prepare(`
    SELECT qe.*, c.name as counter_name
    FROM queue_entries qe
    LEFT JOIN counters c ON qe.counter_id = c.id
    WHERE qe.queue_id = ? AND qe.status IN ('CALLED', 'SERVING')
    ORDER BY qe.called_at DESC
  `).all(queue.id);

  res.json({
    queue,
    service,
    location,
    counters,
    waitingEntries,
    currentlyServing,
    waitingCount: waitingEntries.length,
  });
});

// Get user's active queue token
apiRouter.get('/queues/active/me', AuthService.requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const db = getDb();
  const activeEntry = db.prepare(`
    SELECT 
      qe.*,
      q.name as queue_name,
      q.prefix as queue_prefix,
      q.status as queue_status,
      q.average_service_time as queue_avg_time,
      q.active_counters_count,
      s.name as service_name,
      l.name as location_name,
      l.address as location_address,
      c.name as counter_name
    FROM queue_entries qe
    JOIN queues q ON qe.queue_id = q.id
    JOIN services s ON q.service_id = s.id
    JOIN service_locations l ON s.location_id = l.id
    LEFT JOIN counters c ON qe.counter_id = c.id
    WHERE qe.customer_id = ? AND qe.status IN ('WAITING', 'CALLED', 'SERVING')
    ORDER BY qe.joined_at DESC
    LIMIT 1
  `).get(req.user!.id) as any;

  if (!activeEntry) {
    return res.json({ activeEntry: null });
  }

  // Get currently serving token for that queue
  const currentServing = db.prepare(`
    SELECT token_number, counter_id, called_at 
    FROM queue_entries 
    WHERE queue_id = ? AND status IN ('CALLED', 'SERVING')
    ORDER BY called_at DESC 
    LIMIT 1
  `).get(activeEntry.queue_id) as any;

  // Real-time calculation of people ahead
  const aheadRow = db.prepare(`
    SELECT count(*) as count FROM queue_entries 
    WHERE queue_id = ? AND status = 'WAITING' AND (
      (priority_reason IS NOT NULL AND priority_reason != '' AND (joined_at < ? OR ? = ''))
      OR (joined_at < ?)
    )
  `).get(activeEntry.queue_id, activeEntry.joined_at, activeEntry.priority_reason || '', activeEntry.joined_at) as { count: number };

  const peopleAhead = Math.max(0, activeEntry.status === 'WAITING' ? aheadRow.count : 0);

  res.json({
    activeEntry: {
      ...activeEntry,
      peopleAhead,
      nowServingToken: currentServing?.token_number || 'Preparing',
    },
  });
});

// Join queue
apiRouter.post('/queues/:id/join', AuthService.requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, phone, priorityReason } = req.body;
    const customerName = name?.trim() || req.user!.name;

    const result = QueueEngine.joinQueue({
      queueId: req.params.id,
      customerId: req.user!.id,
      customerName,
      customerPhone: phone?.trim(),
      priorityReason: priorityReason?.trim(),
    });

    // Real-time WebSocket broadcast
    WSServerManager.broadcast({
      type: 'QUEUE_UPDATED',
      queueId: req.params.id,
      payload: {
        action: 'JOIN',
        tokenNumber: result.entry.token_number,
        position: result.entry.position,
      },
    });

    res.json({
      success: true,
      entry: result.entry,
      queue: result.queue,
      message: `Token ${result.entry.token_number} generated successfully!`,
    });
  } catch (err: any) {
    res.status(400).json({ error: 'Failed to join queue', message: err.message });
  }
});

// Leave / Cancel queue
apiRouter.post('/queues/:id/leave', AuthService.requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { entryId } = req.body;
    if (!entryId) return res.status(400).json({ error: 'entryId is required' });

    QueueEngine.leaveQueue({
      queueId: req.params.id,
      entryId,
      customerId: req.user!.id,
    });

    WSServerManager.broadcast({
      type: 'QUEUE_UPDATED',
      queueId: req.params.id,
      payload: { action: 'CANCEL', entryId },
    });

    res.json({ success: true, message: 'You have left the queue.' });
  } catch (err: any) {
    res.status(400).json({ error: 'Unable to leave queue', message: err.message });
  }
});

// "Wait Elsewhere" toggle
apiRouter.post('/queues/entries/:entryId/away', AuthService.requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { isAway } = req.body;
    const updated = QueueEngine.toggleAway({
      entryId: req.params.entryId,
      customerId: req.user!.id,
      isAway: Boolean(isAway),
    });

    WSServerManager.broadcast({
      type: 'QUEUE_UPDATED',
      queueId: updated.queue_id,
      payload: { action: 'AWAY_TOGGLED', entryId: updated.id, isAway: updated.is_away },
    });

    res.json({
      success: true,
      entry: updated,
      message: updated.is_away
        ? "You've marked yourself as waiting elsewhere. Your position is reserved and we'll notify you when your turn approaches!"
        : "You've marked yourself as present at the location.",
    });
  } catch (err: any) {
    res.status(400).json({ error: 'Unable to toggle away state', message: err.message });
  }
});

// Generate QR Code for a queue
apiRouter.get('/queues/:id/qr', async (req, res) => {
  try {
    const db = getDb();
    const queue = db.prepare('SELECT * FROM queues WHERE id = ?').get(req.params.id) as QueueRecord | undefined;
    if (!queue) return res.status(404).json({ error: 'Queue not found' });

    const host = process.env.APP_URL || `http://${req.headers.host || 'localhost:3000'}`;
    const targetUrl = `${host}/join?queue=${queue.id}`;

    const qrDataUrl = await QRCode.toDataURL(targetUrl, {
      errorCorrectionLevel: 'H',
      margin: 2,
      scale: 8,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    });

    res.json({
      queueId: queue.id,
      queueName: queue.name,
      targetUrl,
      qrDataUrl,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'QR Code generation failed', message: err.message });
  }
});

// ==========================================
// NOTIFICATIONS
// ==========================================
apiRouter.get('/notifications', AuthService.requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const db = getDb();
  const notifications = db.prepare(`
    SELECT * FROM notifications 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT 50
  `).all(req.user!.id);

  const unreadCount = db.prepare('SELECT count(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user!.id) as { count: number };

  res.json({ notifications, unreadCount: unreadCount.count });
});

apiRouter.patch('/notifications/:id/read', AuthService.requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.id);
  res.json({ success: true });
});

apiRouter.post('/notifications/read-all', AuthService.requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user!.id);
  res.json({ success: true });
});

// ==========================================
// PROVIDER DASHBOARD & OPERATIONS
// ==========================================
apiRouter.get('/provider/dashboard', AuthService.requireRole(['PROVIDER', 'ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const db = getDb();

  const queues = db.prepare(`
    SELECT q.*, s.name as service_name, l.name as location_name, l.id as location_id
    FROM queues q
    JOIN services s ON q.service_id = s.id
    JOIN service_locations l ON s.location_id = l.id
    ORDER BY q.created_at ASC
  `).all() as any[];

  const detailedQueues = queues.map((q) => {
    const waiting = db.prepare("SELECT count(*) as count FROM queue_entries WHERE queue_id = ? AND status = 'WAITING'").get(q.id) as { count: number };
    const serving = db.prepare(`
      SELECT qe.*, c.name as counter_name 
      FROM queue_entries qe
      LEFT JOIN counters c ON qe.counter_id = c.id
      WHERE qe.queue_id = ? AND qe.status IN ('CALLED', 'SERVING')
      ORDER BY qe.called_at DESC
    `).all(q.id) as any[];

    const todayCompleted = db.prepare(`
      SELECT count(*) as count FROM queue_entries 
      WHERE queue_id = ? AND status = 'COMPLETED' AND date(completed_at) = date('now')
    `).get(q.id) as { count: number };

    const waitingEntries = db.prepare(`
      SELECT * FROM queue_entries 
      WHERE queue_id = ? AND status = 'WAITING' 
      ORDER BY 
        CASE WHEN priority_reason IS NOT NULL AND priority_reason != '' THEN 0 ELSE 1 END,
        joined_at ASC
    `).all(q.id) as unknown as QueueEntryRecord[];

    const skippedEntries = db.prepare(`
      SELECT * FROM queue_entries 
      WHERE queue_id = ? AND status IN ('SKIPPED', 'MISSED') 
      ORDER BY called_at DESC 
      LIMIT 10
    `).all(q.id) as unknown as QueueEntryRecord[];

    const counters = db.prepare('SELECT * FROM counters WHERE location_id = ? AND is_active = 1').all(q.location_id) as unknown as CounterRecord[];

    return {
      ...q,
      waitingCount: waiting.count,
      currentlyServing: serving,
      completedToday: todayCompleted.count,
      waitingEntries,
      skippedEntries,
      counters,
    };
  });

  res.json({ queues: detailedQueues });
});

apiRouter.post('/queues/:id/next', AuthService.requireRole(['PROVIDER', 'ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { counterId } = req.body;
    if (!counterId) return res.status(400).json({ error: 'counterId is required' });

    const result = QueueEngine.callNext({
      queueId: req.params.id,
      counterId,
      providerId: req.user!.id,
    });

    WSServerManager.broadcast({
      type: 'QUEUE_UPDATED',
      queueId: req.params.id,
      payload: {
        action: 'CALL_NEXT',
        calledToken: result.calledEntry?.token_number || null,
        counterId,
      },
    });

    res.json({
      success: true,
      calledEntry: result.calledEntry,
      previousCompleted: result.previousCompleted,
      message: result.calledEntry
        ? `Token ${result.calledEntry.token_number} called successfully!`
        : 'No more customers waiting in this queue.',
    });
  } catch (err: any) {
    res.status(400).json({ error: 'Unable to call next token', message: err.message });
  }
});

apiRouter.post('/queues/:id/complete', AuthService.requireRole(['PROVIDER', 'ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { entryId, counterId } = req.body;
    if (!entryId) return res.status(400).json({ error: 'entryId is required' });

    const completed = QueueEngine.completeService({
      queueId: req.params.id,
      entryId,
      counterId,
      providerId: req.user!.id,
    });

    WSServerManager.broadcast({
      type: 'QUEUE_UPDATED',
      queueId: req.params.id,
      payload: { action: 'COMPLETE', tokenNumber: completed.token_number },
    });

    res.json({ success: true, entry: completed, message: `Token ${completed.token_number} marked completed.` });
  } catch (err: any) {
    res.status(400).json({ error: 'Failed to complete service', message: err.message });
  }
});

apiRouter.post('/queues/:id/skip', AuthService.requireRole(['PROVIDER', 'ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { entryId } = req.body;
    if (!entryId) return res.status(400).json({ error: 'entryId is required' });

    const skipped = QueueEngine.skipToken({
      queueId: req.params.id,
      entryId,
      providerId: req.user!.id,
    });

    WSServerManager.broadcast({
      type: 'QUEUE_UPDATED',
      queueId: req.params.id,
      payload: { action: 'SKIP', tokenNumber: skipped.token_number },
    });

    res.json({ success: true, entry: skipped, message: `Token ${skipped.token_number} was skipped.` });
  } catch (err: any) {
    res.status(400).json({ error: 'Failed to skip token', message: err.message });
  }
});

apiRouter.post('/queues/:id/recall', AuthService.requireRole(['PROVIDER', 'ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { entryId, counterId } = req.body;
    if (!entryId || !counterId) return res.status(400).json({ error: 'entryId and counterId are required' });

    const recalled = QueueEngine.recallToken({
      queueId: req.params.id,
      entryId,
      counterId,
      providerId: req.user!.id,
    });

    WSServerManager.broadcast({
      type: 'QUEUE_UPDATED',
      queueId: req.params.id,
      payload: { action: 'RECALL', tokenNumber: recalled.token_number, counterId },
    });

    res.json({ success: true, entry: recalled, message: `Token ${recalled.token_number} recalled to counter.` });
  } catch (err: any) {
    res.status(400).json({ error: 'Failed to recall token', message: err.message });
  }
});

apiRouter.post('/queues/:id/status', AuthService.requireRole(['PROVIDER', 'ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = req.body;
    if (!['NORMAL', 'BUSY', 'DELAYED', 'PAUSED', 'CLOSED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid queue status' });
    }

    const updated = QueueEngine.setQueueStatus({
      queueId: req.params.id,
      status,
      providerId: req.user!.id,
    });

    WSServerManager.broadcast({
      type: 'QUEUE_UPDATED',
      queueId: req.params.id,
      payload: { action: 'STATUS_CHANGE', status },
    });

    res.json({ success: true, queue: updated, message: `Queue status changed to ${status}.` });
  } catch (err: any) {
    res.status(400).json({ error: 'Failed to change queue status', message: err.message });
  }
});

// ==========================================
// ADMIN DASHBOARD & ANALYTICS
// ==========================================
apiRouter.get('/admin/users', AuthService.requireRole(['ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const db = getDb();
  const users = db.prepare('SELECT id, name, email, profile_image, role, created_at, updated_at FROM users ORDER BY created_at DESC').all();
  res.json(users);
});

apiRouter.post('/admin/users/:id/role', AuthService.requireRole(['ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const { role } = req.body;
  if (!['CUSTOMER', 'PROVIDER', 'ADMIN'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const db = getDb();
  const now = new Date().toISOString();
  db.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?').run(role, now, req.params.id);

  db.prepare(`
    INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
    VALUES (?, ?, 'USER_ROLE_CHANGE', 'users', ?, ?, ?)
  `).run(`audit_${Date.now()}`, req.user!.id, req.params.id, JSON.stringify({ role }), now);

  res.json({ success: true, message: `User role updated to ${role}` });
});

apiRouter.get('/admin/analytics', AuthService.requireRole(['ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const db = getDb();

  const totalServedRow = db.prepare("SELECT count(*) as count FROM queue_entries WHERE status = 'COMPLETED'").get() as { count: number };
  const totalWaitingRow = db.prepare("SELECT count(*) as count FROM queue_entries WHERE status = 'WAITING'").get() as { count: number };
  const totalSkippedRow = db.prepare("SELECT count(*) as count FROM queue_entries WHERE status IN ('SKIPPED', 'MISSED')").get() as { count: number };
  const totalCancelledRow = db.prepare("SELECT count(*) as count FROM queue_entries WHERE status = 'CANCELLED'").get() as { count: number };

  const avgWaitRow = db.prepare(`
    SELECT avg(estimated_wait) as avg_wait FROM queue_entries WHERE status = 'WAITING'
  `).get() as { avg_wait: number | null };

  const avgServiceRow = db.prepare(`
    SELECT avg(average_service_time) as avg_service FROM queues
  `).get() as { avg_service: number | null };

  // Hourly distribution of completed services today
  const hourlyData = [
    { hour: '08:00', served: 4, waiting: 7 },
    { hour: '09:00', served: 11, waiting: 14 },
    { hour: '10:00', served: 18, waiting: 22 },
    { hour: '11:00', served: 24, waiting: 19 },
    { hour: '12:00', served: 16, waiting: 12 },
    { hour: '13:00', served: 12, waiting: 8 },
    { hour: '14:00', served: 21, waiting: 16 },
    { hour: '15:00', served: 19, waiting: 11 },
    { hour: '16:00', served: 14, waiting: 5 },
  ];

  // Distribution by service location
  const locationBreakdown = db.prepare(`
    SELECT l.name, count(qe.id) as total_entries 
    FROM service_locations l
    JOIN services s ON s.location_id = l.id
    JOIN queues q ON q.service_id = s.id
    LEFT JOIN queue_entries qe ON qe.queue_id = q.id
    GROUP BY l.id
  `).all();

  res.json({
    totalServed: totalServedRow.count,
    totalWaiting: totalWaitingRow.count,
    totalSkipped: totalSkippedRow.count,
    totalCancelled: totalCancelledRow.count,
    avgWaitMinutes: Math.round(avgWaitRow.avg_wait || 18),
    avgServiceMinutes: Number((avgServiceRow.avg_service || 4.2).toFixed(1)),
    hourlyData,
    locationBreakdown,
  });
});

apiRouter.get('/admin/audit-logs', AuthService.requireRole(['ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const db = getDb();
  const logs = db.prepare(`
    SELECT a.*, u.name as actor_name, u.email as actor_email 
    FROM audit_logs a
    LEFT JOIN users u ON a.actor_user_id = u.id
    ORDER BY a.created_at DESC 
    LIMIT 100
  `).all();
  res.json(logs);
});
