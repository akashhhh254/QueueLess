import { getDb, QueueRecord, QueueEntryRecord, NotificationRecord } from './db.js';
import crypto from 'node:crypto';

export interface QueueStateSummary {
  queue: QueueRecord;
  currentlyServing: QueueEntryRecord | null;
  waitingCount: number;
  estimatedWaitMinutes: number;
  activeCounters: number;
  recentCompletedToday: number;
}

export class QueueEngine {
  /**
   * Recalculates waiting positions and dynamic wait times for all waiting entries in a queue.
   */
  static recalculateQueue(queueId: string) {
    const db = getDb();
    const queue = db.prepare('SELECT * FROM queues WHERE id = ?').get(queueId) as QueueRecord | undefined;
    if (!queue) return;

    const waitingEntries = db.prepare(`
      SELECT * FROM queue_entries 
      WHERE queue_id = ? AND status = 'WAITING' 
      ORDER BY 
        CASE WHEN priority_reason IS NOT NULL AND priority_reason != '' THEN 0 ELSE 1 END,
        joined_at ASC
    `).all(queueId) as unknown as QueueEntryRecord[];

    const activeCounters = Math.max(1, queue.active_counters_count);
    const avgServiceTime = Math.max(1, queue.average_service_time);

    let statusMultiplier = 1.0;
    if (queue.status === 'DELAYED') statusMultiplier = 1.45;
    else if (queue.status === 'BUSY') statusMultiplier = 1.2;
    else if (queue.status === 'PAUSED') statusMultiplier = 2.0;

    const updateStmt = db.prepare(`
      UPDATE queue_entries 
      SET position = ?, estimated_wait = ? 
      WHERE id = ?
    `);

    waitingEntries.forEach((entry, idx) => {
      const position = idx + 1;
      const peopleAhead = idx;
      const dynamicWait = Math.max(
        1,
        Math.round(((peopleAhead * avgServiceTime) / activeCounters) * statusMultiplier)
      );

      updateStmt.run(position, dynamicWait, entry.id);

      // Check if turn is approaching (2 or fewer people ahead) and trigger notification if not sent
      if (peopleAhead <= 2 && peopleAhead >= 1) {
        const existingApproaching = db.prepare(`
          SELECT id FROM notifications 
          WHERE user_id = ? AND queue_entry_id = ? AND type = 'TURN_APPROACHING'
        `).get(entry.customer_id, entry.id);

        if (!existingApproaching) {
          this.createNotification({
            userId: entry.customer_id,
            queueEntryId: entry.id,
            type: 'TURN_APPROACHING',
            title: 'Your Turn is Approaching!',
            message: `Only ${peopleAhead} ${peopleAhead === 1 ? 'person is' : 'people are'} ahead of token ${entry.token_number}. Please make your way toward the counter area.`,
          });
        }
      }
    });
  }

  /**
   * Generates a new token and joins the queue safely.
   */
  static joinQueue(params: {
    queueId: string;
    customerId: string;
    customerName: string;
    customerPhone?: string;
    priorityReason?: string;
  }): { entry: QueueEntryRecord; queue: QueueRecord } {
    const db = getDb();

    const queue = db.prepare('SELECT * FROM queues WHERE id = ?').get(params.queueId) as QueueRecord | undefined;
    if (!queue) {
      throw new Error('Selected queue was not found.');
    }
    if (queue.status === 'CLOSED') {
      throw new Error('This queue is currently closed for new entries.');
    }

    // Check for existing active token
    const existing = db.prepare(`
      SELECT * FROM queue_entries 
      WHERE queue_id = ? AND customer_id = ? AND status IN ('WAITING', 'CALLED', 'SERVING')
    `).get(params.queueId, params.customerId) as QueueEntryRecord | undefined;

    if (existing) {
      throw new Error(`You already have an active token (${existing.token_number}) in this queue.`);
    }

    const nextSequence = (queue.current_token_number || 0) + 1;
    const tokenNumber = `${queue.prefix}${String(nextSequence).padStart(3, '0')}`;
    const now = new Date().toISOString();
    const entryId = `qe_${crypto.randomUUID().slice(0, 8)}`;

    // Update queue's sequence
    db.prepare(`
      UPDATE queues 
      SET current_token_number = ?, updated_at = ? 
      WHERE id = ?
    `).run(nextSequence, now, queue.id);

    // Count currently waiting
    const waitingCountRow = db.prepare(`
      SELECT count(*) as count FROM queue_entries 
      WHERE queue_id = ? AND status = 'WAITING'
    `).get(queue.id) as { count: number };
    const peopleAhead = waitingCountRow.count;
    const position = peopleAhead + 1;

    const activeCounters = Math.max(1, queue.active_counters_count);
    const estimatedWait = Math.max(1, Math.round((peopleAhead * queue.average_service_time) / activeCounters));

    db.prepare(`
      INSERT INTO queue_entries (
        id, queue_id, customer_id, customer_name, customer_phone,
        token_number, raw_sequence, status, is_away, position,
        estimated_wait, joined_at, priority_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'WAITING', 0, ?, ?, ?, ?)
    `).run(
      entryId,
      queue.id,
      params.customerId,
      params.customerName,
      params.customerPhone || null,
      tokenNumber,
      nextSequence,
      position,
      estimatedWait,
      now,
      params.priorityReason || null
    );

    // Notifications and audit
    this.createNotification({
      userId: params.customerId,
      queueEntryId: entryId,
      type: 'QUEUE_JOINED',
      title: `Token ${tokenNumber} Confirmed`,
      message: `You've joined ${queue.name}. Current position: #${position} (~${estimatedWait} min estimated wait). Your turn is reserved.`,
    });

    this.createQueueEvent(queue.id, entryId, 'CUSTOMER_JOINED', `Token ${tokenNumber} joined at position ${position}`);
    this.createAuditLog(params.customerId, 'QUEUE_JOIN', 'queue_entries', entryId, { tokenNumber, position, estimatedWait });

    this.recalculateQueue(queue.id);

    const updatedEntry = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(entryId) as unknown as QueueEntryRecord;
    const updatedQueue = db.prepare('SELECT * FROM queues WHERE id = ?').get(queue.id) as unknown as QueueRecord;

    return { entry: updatedEntry, queue: updatedQueue };
  }

  /**
   * Calls the next waiting token to a specific counter.
   */
  static callNext(params: {
    queueId: string;
    counterId: string;
    providerId: string;
  }): { calledEntry: QueueEntryRecord | null; previousCompleted: QueueEntryRecord | null } {
    const db = getDb();
    const now = new Date().toISOString();

    const queue = db.prepare('SELECT * FROM queues WHERE id = ?').get(params.queueId) as QueueRecord | undefined;
    if (!queue) throw new Error('Queue not found');

    const counter = db.prepare('SELECT * FROM counters WHERE id = ?').get(params.counterId) as any;
    if (!counter) throw new Error('Counter not found');

    let previousCompleted: QueueEntryRecord | null = null;

    // If counter currently has a SERVING entry, auto-complete it
    if (counter.current_queue_entry_id) {
      const currentEntry = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(counter.current_queue_entry_id) as QueueEntryRecord | undefined;
      if (currentEntry && (currentEntry.status === 'CALLED' || currentEntry.status === 'SERVING')) {
        db.prepare(`
          UPDATE queue_entries 
          SET status = 'COMPLETED', completed_at = ? 
          WHERE id = ?
        `).run(now, currentEntry.id);

        this.updateAverageServiceTime(queue.id, currentEntry, now);
        this.createQueueEvent(queue.id, currentEntry.id, 'SERVICE_COMPLETED', `Token ${currentEntry.token_number} completed at ${counter.name}`);
        this.createAuditLog(params.providerId, 'SERVICE_COMPLETE', 'queue_entries', currentEntry.id, { counter: counter.name });

        this.createNotification({
          userId: currentEntry.customer_id,
          queueEntryId: currentEntry.id,
          type: 'QUEUE_COMPLETED',
          title: 'Service Completed',
          message: `Your service for token ${currentEntry.token_number} at ${counter.name} has concluded. Thank you for using QueueLess!`,
        });

        previousCompleted = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(currentEntry.id) as unknown as QueueEntryRecord;
      }
    }

    // Select the next WAITING entry (priority first, then joined_at)
    const nextEntry = db.prepare(`
      SELECT * FROM queue_entries 
      WHERE queue_id = ? AND status = 'WAITING' 
      ORDER BY 
        CASE WHEN priority_reason IS NOT NULL AND priority_reason != '' THEN 0 ELSE 1 END,
        joined_at ASC 
      LIMIT 1
    `).get(params.queueId) as QueueEntryRecord | undefined;

    if (!nextEntry) {
      // Clear counter active entry
      db.prepare('UPDATE counters SET current_queue_entry_id = NULL WHERE id = ?').run(params.counterId);
      return { calledEntry: null, previousCompleted };
    }

    // Move to CALLED
    db.prepare(`
      UPDATE queue_entries 
      SET status = 'CALLED', called_at = ?, served_at = ?, counter_id = ?, position = 0, estimated_wait = 0 
      WHERE id = ?
    `).run(now, now, params.counterId, nextEntry.id);

    // Link to counter
    db.prepare(`
      UPDATE counters 
      SET current_queue_entry_id = ?, assigned_provider_id = ? 
      WHERE id = ?
    `).run(nextEntry.id, params.providerId, params.counterId);

    // Notify the customer
    this.createNotification({
      userId: nextEntry.customer_id,
      queueEntryId: nextEntry.id,
      type: 'YOUR_TURN',
      title: `IT'S YOUR TURN — Token ${nextEntry.token_number}!`,
      message: `Please proceed immediately to ${counter.name}. Your service is starting now.`,
    });

    this.createQueueEvent(queue.id, nextEntry.id, 'TOKEN_CALLED', `Token ${nextEntry.token_number} called to ${counter.name}`);
    this.createAuditLog(params.providerId, 'TOKEN_CALL', 'queue_entries', nextEntry.id, { counter: counter.name, token: nextEntry.token_number });

    this.recalculateQueue(queue.id);

    const calledEntry = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(nextEntry.id) as unknown as QueueEntryRecord;
    return { calledEntry, previousCompleted };
  }

  /**
   * Completes service for a specific entry.
   */
  static completeService(params: {
    queueId: string;
    entryId: string;
    counterId?: string;
    providerId: string;
  }): QueueEntryRecord {
    const db = getDb();
    const now = new Date().toISOString();

    const entry = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(params.entryId) as QueueEntryRecord | undefined;
    if (!entry) throw new Error('Queue entry not found');

    db.prepare(`
      UPDATE queue_entries 
      SET status = 'COMPLETED', completed_at = ? 
      WHERE id = ?
    `).run(now, entry.id);

    // Clear counter if assigned
    if (params.counterId) {
      db.prepare(`
        UPDATE counters 
        SET current_queue_entry_id = NULL 
        WHERE id = ? AND current_queue_entry_id = ?
      `).run(params.counterId, entry.id);
    } else {
      db.prepare(`
        UPDATE counters 
        SET current_queue_entry_id = NULL 
        WHERE current_queue_entry_id = ?
      `).run(entry.id);
    }

    this.updateAverageServiceTime(params.queueId, entry, now);

    this.createNotification({
      userId: entry.customer_id,
      queueEntryId: entry.id,
      type: 'QUEUE_COMPLETED',
      title: 'Service Completed',
      message: `Your visit for token ${entry.token_number} is completed. Thank you!`,
    });

    this.createQueueEvent(params.queueId, entry.id, 'SERVICE_COMPLETED', `Token ${entry.token_number} completed`);
    this.createAuditLog(params.providerId, 'SERVICE_COMPLETE', 'queue_entries', entry.id, { token: entry.token_number });

    this.recalculateQueue(params.queueId);

    return db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(entry.id) as unknown as QueueEntryRecord;
  }

  /**
   * Skips a token if the customer is not present.
   */
  static skipToken(params: {
    queueId: string;
    entryId: string;
    providerId: string;
  }): QueueEntryRecord {
    const db = getDb();
    const entry = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(params.entryId) as QueueEntryRecord | undefined;
    if (!entry) throw new Error('Entry not found');

    db.prepare(`
      UPDATE queue_entries 
      SET status = 'SKIPPED' 
      WHERE id = ?
    `).run(entry.id);

    db.prepare('UPDATE counters SET current_queue_entry_id = NULL WHERE current_queue_entry_id = ?').run(entry.id);

    this.createNotification({
      userId: entry.customer_id,
      queueEntryId: entry.id,
      type: 'QUEUE_UPDATED',
      title: `Token ${entry.token_number} Skipped`,
      message: `Your token was called but you were not present at the counter. Contact staff or request a recall.`,
    });

    this.createQueueEvent(params.queueId, entry.id, 'TOKEN_SKIPPED', `Token ${entry.token_number} was skipped`);
    this.createAuditLog(params.providerId, 'TOKEN_SKIP', 'queue_entries', entry.id, { token: entry.token_number });

    this.recalculateQueue(params.queueId);

    return db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(entry.id) as unknown as QueueEntryRecord;
  }

  /**
   * Marks a token as MISSED if customer failed to appear.
   */
  static markMissed(params: {
    queueId: string;
    entryId: string;
    providerId: string;
  }): QueueEntryRecord {
    const db = getDb();
    const now = new Date().toISOString();
    const entry = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(params.entryId) as QueueEntryRecord | undefined;
    if (!entry) throw new Error('Entry not found');

    db.prepare(`
      UPDATE queue_entries 
      SET status = 'MISSED', missed_at = ? 
      WHERE id = ?
    `).run(now, entry.id);

    db.prepare('UPDATE counters SET current_queue_entry_id = NULL WHERE current_queue_entry_id = ?').run(entry.id);

    this.createQueueEvent(params.queueId, entry.id, 'TOKEN_MISSED', `Token ${entry.token_number} marked missed`);
    this.createAuditLog(params.providerId, 'TOKEN_MISSED', 'queue_entries', entry.id, { token: entry.token_number });

    this.recalculateQueue(params.queueId);

    return db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(entry.id) as unknown as QueueEntryRecord;
  }

  /**
   * Recalls a previously skipped or missed token.
   */
  static recallToken(params: {
    queueId: string;
    entryId: string;
    counterId: string;
    providerId: string;
  }): QueueEntryRecord {
    const db = getDb();
    const now = new Date().toISOString();
    const entry = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(params.entryId) as QueueEntryRecord | undefined;
    if (!entry) throw new Error('Entry not found');

    const counter = db.prepare('SELECT * FROM counters WHERE id = ?').get(params.counterId) as any;
    if (!counter) throw new Error('Counter not found');

    db.prepare(`
      UPDATE queue_entries 
      SET status = 'CALLED', called_at = ?, served_at = ?, counter_id = ?, position = 0, estimated_wait = 0 
      WHERE id = ?
    `).run(now, now, params.counterId, entry.id);

    db.prepare(`
      UPDATE counters 
      SET current_queue_entry_id = ?, assigned_provider_id = ? 
      WHERE id = ?
    `).run(entry.id, params.providerId, params.counterId);

    this.createNotification({
      userId: entry.customer_id,
      queueEntryId: entry.id,
      type: 'YOUR_TURN',
      title: `RECALLED: Token ${entry.token_number}!`,
      message: `Your token has been recalled to ${counter.name}. Please proceed to the counter immediately.`,
    });

    this.createQueueEvent(params.queueId, entry.id, 'TOKEN_RECALLED', `Token ${entry.token_number} recalled to ${counter.name}`);
    this.createAuditLog(params.providerId, 'TOKEN_RECALL', 'queue_entries', entry.id, { token: entry.token_number, counter: counter.name });

    this.recalculateQueue(params.queueId);

    return db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(entry.id) as unknown as QueueEntryRecord;
  }

  /**
   * Allows customer to leave/cancel their queue spot.
   */
  static leaveQueue(params: {
    queueId: string;
    entryId: string;
    customerId: string;
  }): void {
    const db = getDb();
    const entry = db.prepare(`
      SELECT * FROM queue_entries 
      WHERE id = ? AND customer_id = ?
    `).get(params.entryId, params.customerId) as QueueEntryRecord | undefined;

    if (!entry) throw new Error('Queue entry not found or unauthorized.');

    db.prepare(`
      UPDATE queue_entries 
      SET status = 'CANCELLED' 
      WHERE id = ?
    `).run(entry.id);

    this.createQueueEvent(params.queueId, entry.id, 'CUSTOMER_CANCELLED', `Token ${entry.token_number} was cancelled by user`);
    this.createAuditLog(params.customerId, 'QUEUE_CANCEL', 'queue_entries', entry.id, { token: entry.token_number });

    this.recalculateQueue(params.queueId);
  }

  /**
   * "Wait Elsewhere" feature: Toggles away state so providers know customer stepped away.
   */
  static toggleAway(params: {
    entryId: string;
    customerId: string;
    isAway: boolean;
  }): QueueEntryRecord {
    const db = getDb();
    const entry = db.prepare(`
      SELECT * FROM queue_entries 
      WHERE id = ? AND customer_id = ?
    `).get(params.entryId, params.customerId) as QueueEntryRecord | undefined;

    if (!entry) throw new Error('Queue entry not found or unauthorized.');

    db.prepare(`
      UPDATE queue_entries 
      SET is_away = ? 
      WHERE id = ?
    `).run(params.isAway ? 1 : 0, entry.id);

    this.createAuditLog(params.customerId, 'TOGGLE_AWAY', 'queue_entries', entry.id, { isAway: params.isAway });

    return db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(entry.id) as unknown as QueueEntryRecord;
  }

  /**
   * Changes queue state (NORMAL, BUSY, DELAYED, PAUSED, CLOSED).
   */
  static setQueueStatus(params: {
    queueId: string;
    status: 'NORMAL' | 'BUSY' | 'DELAYED' | 'PAUSED' | 'CLOSED';
    providerId: string;
  }): QueueRecord {
    const db = getDb();
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE queues 
      SET status = ?, updated_at = ? 
      WHERE id = ?
    `).run(params.status, now, params.queueId);

    const queue = db.prepare('SELECT * FROM queues WHERE id = ?').get(params.queueId) as unknown as QueueRecord;

    // Notify waiting customers if delayed or paused
    if (params.status === 'DELAYED' || params.status === 'PAUSED') {
      const waiting = db.prepare(`
        SELECT customer_id, id, token_number FROM queue_entries 
        WHERE queue_id = ? AND status = 'WAITING'
      `).all(params.queueId) as unknown as { customer_id: string; id: string; token_number: string }[];

      for (const w of waiting) {
        this.createNotification({
          userId: w.customer_id,
          queueEntryId: w.id,
          type: 'QUEUE_DELAYED',
          title: `Queue Status: ${params.status}`,
          message: `The queue service speed has been adjusted to ${params.status}. Waiting times have been automatically recalculated.`,
        });
      }
    } else if (params.status === 'NORMAL') {
      const waiting = db.prepare(`
        SELECT customer_id, id FROM queue_entries 
        WHERE queue_id = ? AND status = 'WAITING'
      `).all(params.queueId) as unknown as { customer_id: string; id: string }[];

      for (const w of waiting) {
        this.createNotification({
          userId: w.customer_id,
          queueEntryId: w.id,
          type: 'SERVICE_RESUMED',
          title: 'Queue Service Resumed',
          message: 'The queue is running at normal operation pace.',
        });
      }
    }

    this.createQueueEvent(params.queueId, null, `QUEUE_STATUS_${params.status}`, `Status updated by provider`);
    this.createAuditLog(params.providerId, 'SET_QUEUE_STATUS', 'queues', params.queueId, { status: params.status });

    this.recalculateQueue(params.queueId);

    return queue;
  }

  /**
   * Exponential moving average update of average service time.
   */
  private static updateAverageServiceTime(queueId: string, entry: QueueEntryRecord, completionTime: string) {
    const db = getDb();
    const startTimeStr = entry.served_at || entry.called_at || entry.joined_at;
    if (!startTimeStr) return;

    const start = new Date(startTimeStr).getTime();
    const end = new Date(completionTime).getTime();
    const durationMinutes = Math.max(1, Math.min(60, (end - start) / 60000));

    const queue = db.prepare('SELECT average_service_time FROM queues WHERE id = ?').get(queueId) as { average_service_time: number } | undefined;
    if (!queue) return;

    // Exponential smoothing with alpha = 0.25
    const currentAvg = queue.average_service_time || 4.0;
    const updatedAvg = Number((currentAvg * 0.75 + durationMinutes * 0.25).toFixed(1));

    db.prepare('UPDATE queues SET average_service_time = ? WHERE id = ?').run(updatedAvg, queueId);
  }

  private static createNotification(params: {
    userId: string;
    queueEntryId?: string | null;
    type: 'QUEUE_JOINED' | 'QUEUE_UPDATED' | 'TURN_APPROACHING' | 'YOUR_TURN' | 'QUEUE_DELAYED' | 'SERVICE_RESUMED' | 'QUEUE_COMPLETED';
    title: string;
    message: string;
  }) {
    const db = getDb();
    const id = `notif_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO notifications (id, user_id, queue_entry_id, type, title, message, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `).run(id, params.userId, params.queueEntryId || null, params.type, params.title, params.message, now);
  }

  private static createQueueEvent(queueId: string, queueEntryId: string | null, eventType: string, details: string) {
    const db = getDb();
    const id = `qev_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO queue_events (id, queue_id, queue_entry_id, event_type, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, queueId, queueEntryId, eventType, details, now);
  }

  private static createAuditLog(actorId: string | null, action: string, entityType: string, entityId: string, metadata: any) {
    const db = getDb();
    const id = `audit_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, actorId, action, entityType, entityId, JSON.stringify(metadata), now);
  }
}
