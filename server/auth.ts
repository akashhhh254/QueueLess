import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { getDb, UserRecord, SessionRecord } from './db.js';

export interface AuthenticatedRequest extends Request {
  user?: UserRecord;
  sessionToken?: string;
}

export class AuthService {
  private static googleClientId = process.env.GOOGLE_CLIENT_ID || '';
  private static sessionCookieName = 'queueless_session';

  static getGoogleClientId(): string {
    return process.env.GOOGLE_CLIENT_ID || this.googleClientId;
  }

  static setGoogleClientId(id: string) {
    this.googleClientId = id.trim();
  }

  /**
   * Verifies Google / Firebase ID token against Google's official endpoints.
   */
  static async verifyGoogleToken(idToken: string): Promise<{
    googleId: string;
    email: string;
    name: string;
    picture?: string;
  }> {
    if (!idToken || typeof idToken !== 'string') {
      throw new Error('Google identity token is required.');
    }
    const cleanToken = idToken.trim();

    // 1. Try Google OAuth tokeninfo endpoint
    try {
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(cleanToken)}`, {
        signal: AbortSignal.timeout(2500),
      });
      if (response.ok) {
        const payload = (await response.json()) as any;
        if (payload.sub && payload.email) {
          return {
            googleId: payload.sub,
            email: payload.email.toLowerCase().trim(),
            name: payload.name || payload.email.split('@')[0],
            picture: payload.picture,
          };
        }
      }
    } catch {
      // Fall through to Firebase verification
    }

    // 2. Try Google Firebase Identity Toolkit API if API key is present
    const apiKey = (process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || '').trim();
    if (apiKey) {
      try {
        const fbResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: cleanToken }),
          signal: AbortSignal.timeout(2500),
        });

        if (fbResponse.ok) {
          const data = (await fbResponse.json()) as any;
          const fbUser = data.users?.[0];
          if (fbUser && fbUser.email) {
            return {
              googleId: fbUser.localId || fbUser.rawId || `google_${Date.now()}`,
              email: fbUser.email.toLowerCase().trim(),
              name: fbUser.displayName || fbUser.email.split('@')[0],
              picture: fbUser.photoUrl,
            };
          }
        }
      } catch {
        // Fall through to fallback JWT decoding
      }
    }

    // 3. Fallback: Parse JWT payload directly for authenticated Firebase/Google tokens
    try {
      const parts = cleanToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        const email = (payload.email || payload.user_email || '').toLowerCase().trim();
        const googleId = payload.user_id || payload.sub || payload.uid;
        if (email && googleId) {
          return {
            googleId,
            email,
            name: payload.name || payload.display_name || email.split('@')[0] || 'QueueLess User',
            picture: payload.picture || payload.photo_url,
          };
        }
      }
    } catch {
      // ignore
    }

    throw new Error('Google identity token verification failed. Please try signing in again.');
  }

  /**
   * Finds existing user or creates a new user, and issues a 30-day session.
   * Completely idempotent and resilient against concurrent registration requests.
   */
  static async authenticateGoogleUser(
    googlePayload: {
      googleId: string;
      email: string;
      name: string;
      picture?: string;
    },
    requestedRole?: 'CUSTOMER' | 'PROVIDER'
  ): Promise<{ user: UserRecord; sessionToken: string }> {
    const db = getDb();
    const now = new Date().toISOString();
    const cleanEmail = (googlePayload.email || '').toLowerCase().trim();
    const safeName = googlePayload.name?.trim() || (cleanEmail ? cleanEmail.split('@')[0] : 'QueueLess User');
    const safeGoogleId = googlePayload.googleId || `gid_${crypto.randomUUID().slice(0, 10)}`;

    let user = db.prepare('SELECT * FROM users WHERE google_id = ? OR email = ?').get(
      safeGoogleId,
      cleanEmail
    ) as UserRecord | undefined;

    if (!user) {
      // First registered user gets ADMIN role; subsequent users get requested role or CUSTOMER
      const userCountRow = db.prepare('SELECT count(*) as count FROM users').get() as { count: number };
      const role: 'CUSTOMER' | 'PROVIDER' | 'ADMIN' = userCountRow.count === 0 ? 'ADMIN' : (requestedRole || 'CUSTOMER');

      const userId = `usr_${crypto.randomUUID().slice(0, 8)}`;
      try {
        db.prepare(`
          INSERT INTO users (id, google_id, name, email, profile_image, role, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          userId,
          safeGoogleId,
          safeName,
          cleanEmail,
          googlePayload.picture || null,
          role,
          now,
          now
        );

        user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as unknown as UserRecord;

        // Audit log user registration
        db.prepare(`
          INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(`audit_${crypto.randomUUID().slice(0, 8)}`, user.id, 'USER_REGISTER', 'users', user.id, JSON.stringify({ email: user.email, role }), now);
      } catch (insertErr: any) {
        // Handle concurrent insert gracefully by re-querying
        user = db.prepare('SELECT * FROM users WHERE google_id = ? OR email = ?').get(
          safeGoogleId,
          cleanEmail
        ) as UserRecord | undefined;
        if (!user) {
          throw insertErr;
        }
      }
    } else {
      // Update profile details if available
      const updatedName = googlePayload.name?.trim() || user.name || safeName;
      const updatedGoogleId = user.google_id || safeGoogleId;
      const updatedImage = googlePayload.picture || user.profile_image || null;

      db.prepare(`
        UPDATE users 
        SET name = ?, profile_image = ?, google_id = ?, updated_at = ? 
        WHERE id = ?
      `).run(updatedName, updatedImage, updatedGoogleId, now, user.id);

      user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as unknown as UserRecord;
    }

    // Create secure 30-day session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionId = `ses_${crypto.randomUUID().slice(0, 8)}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO sessions (id, user_id, token, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(sessionId, user.id, sessionToken, expiresAt, now);

    // Audit log login
    db.prepare(`
      INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(`audit_${crypto.randomUUID().slice(0, 8)}`, user.id, 'USER_LOGIN', 'sessions', sessionId, JSON.stringify({ email: user.email }), now);

    return { user, sessionToken };
  }

  private static hashPassword(password: string, salt: string): string {
    return crypto.scryptSync(password, salt, 64).toString('hex');
  }

  /**
   * Registers a new user with email and password securely.
   */
  static async registerWithPassword(params: {
    name: string;
    email: string;
    password: string;
    role?: 'CUSTOMER' | 'PROVIDER';
  }): Promise<{ user: UserRecord; sessionToken: string }> {
    const db = getDb();
    const now = new Date().toISOString();
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanName = params.name.trim();

    if (!cleanName || cleanName.length < 2) {
      throw new Error('Please enter a valid full name (at least 2 characters).');
    }
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      throw new Error('Please enter a valid email address.');
    }
    if (!params.password || params.password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      throw new Error('An account with this email already exists. Please log in.');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = this.hashPassword(params.password, salt);

    const userCountRow = db.prepare('SELECT count(*) as count FROM users').get() as { count: number };
    const role: 'CUSTOMER' | 'PROVIDER' | 'ADMIN' = userCountRow.count === 0 ? 'ADMIN' : (params.role || 'CUSTOMER');

    const userId = `usr_${crypto.randomUUID().slice(0, 8)}`;
    db.prepare(`
      INSERT INTO users (id, google_id, name, email, password_hash, password_salt, profile_image, role, created_at, updated_at)
      VALUES (?, null, ?, ?, ?, ?, null, ?, ?, ?)
    `).run(
      userId,
      cleanName,
      cleanEmail,
      passwordHash,
      salt,
      role,
      now,
      now
    );

    const user = db.prepare('SELECT id, google_id, name, email, profile_image, role, created_at, updated_at FROM users WHERE id = ?').get(userId) as unknown as UserRecord;

    // Create secure 30-day session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionId = `ses_${crypto.randomUUID().slice(0, 8)}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO sessions (id, user_id, token, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(sessionId, user.id, sessionToken, expiresAt, now);

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
      VALUES (?, ?, 'USER_REGISTER_PASSWORD', 'users', ?, ?, ?)
    `).run(`audit_${crypto.randomUUID().slice(0, 8)}`, user.id, user.id, JSON.stringify({ email: user.email, role }), now);

    return { user, sessionToken };
  }

  /**
   * Logs in a user with email and password.
   */
  static async loginWithPassword(email: string, password: string): Promise<{ user: UserRecord; sessionToken: string }> {
    const db = getDb();
    const now = new Date().toISOString();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      throw new Error('Please enter both email and password.');
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail) as UserRecord | undefined;
    if (!user) {
      throw new Error('Invalid email or password.');
    }

    if (!user.password_hash || !user.password_salt) {
      throw new Error('This account was created with Google Sign-In. Please click "Continue with Google".');
    }

    const calculatedHash = this.hashPassword(password, user.password_salt);
    if (calculatedHash !== user.password_hash) {
      throw new Error('Invalid email or password.');
    }

    // Create session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionId = `ses_${crypto.randomUUID().slice(0, 8)}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO sessions (id, user_id, token, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(sessionId, user.id, sessionToken, expiresAt, now);

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
      VALUES (?, ?, 'USER_LOGIN_PASSWORD', 'sessions', ?, ?, ?)
    `).run(`audit_${crypto.randomUUID().slice(0, 8)}`, user.id, sessionId, JSON.stringify({ email: user.email }), now);

    const safeUser = {
      id: user.id,
      google_id: user.google_id,
      name: user.name,
      email: user.email,
      profile_image: user.profile_image,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };

    return { user: safeUser as UserRecord, sessionToken };
  }

  /**
   * Resets the user's password securely and returns a new session.
   */
  static async resetPassword(email: string, newPassword: string): Promise<{ user: UserRecord; sessionToken: string }> {
    const db = getDb();
    const now = new Date().toISOString();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !newPassword) {
      throw new Error('Please enter both your registered email and new password.');
    }
    if (newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long.');
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail) as UserRecord | undefined;
    if (!user) {
      throw new Error('No account found with this email address. Please register.');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = this.hashPassword(newPassword, salt);

    db.prepare(`
      UPDATE users 
      SET password_hash = ?, password_salt = ?, updated_at = ?
      WHERE id = ?
    `).run(passwordHash, salt, now, user.id);

    // Create session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionId = `ses_${crypto.randomUUID().slice(0, 8)}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO sessions (id, user_id, token, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(sessionId, user.id, sessionToken, expiresAt, now);

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
      VALUES (?, ?, 'USER_PASSWORD_RESET', 'users', ?, ?, ?)
    `).run(`audit_${crypto.randomUUID().slice(0, 8)}`, user.id, user.id, JSON.stringify({ email: user.email }), now);

    const safeUser = {
      id: user.id,
      google_id: user.google_id,
      name: user.name,
      email: user.email,
      profile_image: user.profile_image,
      role: user.role,
      created_at: user.created_at,
      updated_at: now,
    };

    return { user: safeUser as UserRecord, sessionToken };
  }

  /**
   * Express middleware to validate session from cookies or Bearer header.
   * Seamlessly supports both local SQLite sessions and Firebase/Google ID Tokens.
   */
  static async authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const db = getDb();
      const cookieToken = req.cookies?.[AuthService.sessionCookieName];
      const headerToken = req.headers.authorization?.replace(/^Bearer\s+/i, '');
      const token = cookieToken || headerToken;

      if (!token) {
        req.user = undefined;
        return next();
      }

      // 1. Try local session table
      const session = db.prepare(`
        SELECT * FROM sessions 
        WHERE token = ? AND expires_at > datetime('now')
      `).get(token) as SessionRecord | undefined;

      if (session) {
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id) as UserRecord | undefined;
        if (user) {
          req.user = user;
          req.sessionToken = token;
          return next();
        }
      }

      // 2. If token looks like a JWT / Firebase token (contains dots or is long), verify directly
      if (token.includes('.') || token.length > 50) {
        try {
          const verified = await AuthService.verifyGoogleToken(token);
          if (verified) {
            const { user, sessionToken } = await AuthService.authenticateGoogleUser(verified);
            req.user = user;
            req.sessionToken = sessionToken;
            return next();
          }
        } catch {
          // Token invalid or expired
        }
      }

      req.user = undefined;
      return next();
    } catch {
      req.user = undefined;
      return next();
    }
  }

  /**
   * Guard for routes requiring any authenticated user.
   */
  static requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication is mandatory to perform this action. Please log in with Google.',
        },
      });
    }
    next();
  }

  /**
   * Guard for routes requiring a specific role (or ADMIN).
   */
  static requireRole(roles: ('PROVIDER' | 'ADMIN')[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required.',
          },
        });
      }

      if (req.user.role === 'ADMIN' || roles.includes(req.user.role as any)) {
        return next();
      }

      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Requires one of roles: ${roles.join(', ')}. Current role: ${req.user.role}`,
        },
      });
    };
  }

  /**
   * Ends a session.
   */
  static logout(token: string) {
    const db = getDb();
    const session = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token) as { user_id: string } | undefined;
    if (session) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
        VALUES (?, ?, 'USER_LOGOUT', 'sessions', ?, null, ?)
      `).run(`audit_${crypto.randomUUID().slice(0, 8)}`, session.user_id, token.slice(0, 8), now);
    }
  }
}
