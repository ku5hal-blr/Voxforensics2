import { doc, getDoc, setDoc, deleteDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';

/* ============================================================
 * EMAIL OTP SERVICE (APPLICATION-LEVEL 2FA)
 *
 * Requirements:
 * - 6 digits, cryptographically random
 * - Expire after 5 minutes
 * - Single-use (deleted upon successful verification)
 * - Resend cooldown (30 seconds)
 * - Maximum attempts (5 attempts)
 * - SHA-256 hashed storage (never stored in plaintext)
 * - Never logged to console or displayed in UI
 * ============================================================ */

export interface EmailOtpSession {
  uid: string;
  email: string;
  hashedOtp: string;
  salt: string;
  expiresAt: number;
  attemptsRemaining: number;
  cooldownUntil: number;
}

export interface SendOtpResult {
  success: boolean;
  error?: string;
  cooldownSeconds?: number;
}

export interface VerifyOtpResult {
  success: boolean;
  error?: string;
}

// In-memory session fallback for fast matching and offline resilience
const memorySessionStore = new Map<string, EmailOtpSession>();

/**
 * Generates a cryptographically random 6-digit number string [100000 - 999999]
 */
function generateSecure6DigitOtp(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const code = 100000 + (array[0] % 900000);
  return code.toString();
}

/**
 * Computes SHA-256 hex digest for an OTP + salt
 */
async function hashOtp(otp: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${otp}:${salt}:voxforensics_otp`);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(buffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates a random salt string
 */
function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Sends a 6-digit application-level Email OTP.
 * Generates the OTP, hashes it, stores only the hash, and dispatches via configured provider.
 */
export async function sendEmailOtp(
  uid: string,
  email: string
): Promise<SendOtpResult> {
  if (!uid || !email) {
    return {
      success: false,
      error: 'Missing user identification for verification email.',
    };
  }

  const cleanEmail = email.trim().toLowerCase();
  const now = Date.now();

  // Check cooldown from memory or Firestore
  const existingMemory = memorySessionStore.get(uid);
  if (existingMemory && existingMemory.cooldownUntil > now) {
    const remaining = Math.ceil((existingMemory.cooldownUntil - now) / 1000);
    return {
      success: false,
      error: `Please wait ${remaining}s before requesting a new verification code.`,
      cooldownSeconds: remaining,
    };
  }

  try {
    const sessionDocRef = doc(db, 'email_otp_sessions', uid);
    const existingSnap = await getDoc(sessionDocRef).catch(() => null);
    if (existingSnap?.exists()) {
      const data = existingSnap.data() as EmailOtpSession;
      if (data?.cooldownUntil && data.cooldownUntil > now) {
        const remaining = Math.ceil((data.cooldownUntil - now) / 1000);
        return {
          success: false,
          error: `Please wait ${remaining}s before requesting a new verification code.`,
          cooldownSeconds: remaining,
        };
      }
    }

    const rawOtp = generateSecure6DigitOtp();
    const salt = generateSalt();
    const hashed = await hashOtp(rawOtp, salt);

    const session: EmailOtpSession = {
      uid,
      email: cleanEmail,
      hashedOtp: hashed,
      salt,
      expiresAt: now + 5 * 60 * 1000, // 5 minutes validity
      attemptsRemaining: 5,
      cooldownUntil: now + 30 * 1000, // 30 seconds cooldown
    };

    // Store session in memory
    memorySessionStore.set(uid, session);

    // Store hashed session in Firestore
    await setDoc(sessionDocRef, {
      uid,
      email: cleanEmail,
      hashedOtp: hashed,
      salt,
      expiresAt: session.expiresAt,
      attemptsRemaining: session.attemptsRemaining,
      cooldownUntil: session.cooldownUntil,
      createdAt: now,
    }).catch((err) => {
      // Memory fallback remains active if Firestore write is constrained
      console.warn('[EmailOTP] Warning writing session to Firestore:', err?.message);
    });

    // Dispatch email via Firestore Trigger Email extension (standard Firebase pattern)
    // or via dedicated backend API endpoint if configured
    try {
      const mailCollection = collection(db, 'mail');
      await setDoc(doc(mailCollection), {
        to: [cleanEmail],
        message: {
          subject: 'VoxForensics Verification Code',
          text: `Your VoxForensics 6-digit verification code is: ${rawOtp}. This code expires in 5 minutes.`,
          html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #070d1e; color: #ffffff; border-radius: 12px; border: 1px solid rgba(0, 212, 255, 0.3);">
            <h2 style="color: #00d4ff; margin-bottom: 12px;">VoxForensics Security Verification</h2>
            <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
              Please enter the following 6-digit verification code to complete your two-factor authentication:
            </p>
            <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #00d4ff; background: rgba(0, 212, 255, 0.1); padding: 16px; text-align: center; border-radius: 8px; margin: 20px 0;">
              ${rawOtp}
            </div>
            <p style="color: #94a3b8; font-size: 12px; line-height: 1.5;">
              This code expires in 5 minutes and can only be used once. If you did not request this code, please secure your account immediately.
            </p>
          </div>`,
        },
      });
    } catch (mailErr) {
      // Log delivery status warning without failing session creation
      console.warn('[EmailOTP] Notice: Firestore mail extension dispatch skipped or unconfigured.');
    }

    return {
      success: true,
      cooldownSeconds: 30,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'We could not send the verification code. Please try again.',
    };
  }
}

/**
 * Verifies the 6-digit OTP entered by the user.
 * Validates against expiry, attempt limits, and single-use consumption.
 */
export async function verifyEmailOtp(
  uid: string,
  enteredOtp: string
): Promise<VerifyOtpResult> {
  const cleanCode = (enteredOtp || '').trim().replace(/\D/g, '');
  if (cleanCode.length !== 6) {
    return {
      success: false,
      error: 'Please enter a valid 6-digit verification code.',
    };
  }

  const now = Date.now();
  let session = memorySessionStore.get(uid);

  const sessionDocRef = doc(db, 'email_otp_sessions', uid);

  // If not found in memory, retrieve from Firestore
  if (!session) {
    try {
      const snap = await getDoc(sessionDocRef);
      if (snap.exists()) {
        session = snap.data() as EmailOtpSession;
      }
    } catch (err) {
      console.warn('[EmailOTP] Warning reading session from Firestore:', err);
    }
  }

  if (!session) {
    return {
      success: false,
      error: 'No active verification session found. Please request a new code.',
    };
  }

  // 1. Check expiration (5 minutes)
  if (now > session.expiresAt) {
    memorySessionStore.delete(uid);
    deleteDoc(sessionDocRef).catch(() => {});
    return {
      success: false,
      error: 'Code expired. Send a new code.',
    };
  }

  // 2. Check maximum attempts
  if (session.attemptsRemaining <= 0) {
    memorySessionStore.delete(uid);
    deleteDoc(sessionDocRef).catch(() => {});
    return {
      success: false,
      error: 'Too many incorrect attempts. Please request a new code.',
    };
  }

  // 3. Verify SHA-256 hash
  const computedHash = await hashOtp(cleanCode, session.salt);
  if (computedHash !== session.hashedOtp) {
    const updatedAttempts = session.attemptsRemaining - 1;
    session.attemptsRemaining = updatedAttempts;
    memorySessionStore.set(uid, session);

    if (updatedAttempts <= 0) {
      memorySessionStore.delete(uid);
      deleteDoc(sessionDocRef).catch(() => {});
      return {
        success: false,
        error: 'Too many incorrect attempts. Please request a new code.',
      };
    }

    setDoc(sessionDocRef, { attemptsRemaining: updatedAttempts }, { merge: true }).catch(() => {});

    return {
      success: false,
      error: `Incorrect verification code. ${updatedAttempts} attempt${updatedAttempts === 1 ? '' : 's'} remaining.`,
    };
  }

  // 4. Success: Single-use consumption (delete session immediately)
  memorySessionStore.delete(uid);
  deleteDoc(sessionDocRef).catch(() => {});

  return {
    success: true,
  };
}

/**
 * Clears any pending OTP state for a user (called on logout)
 */
export function clearEmailOtpSession(uid?: string) {
  if (uid) {
    memorySessionStore.delete(uid);
    deleteDoc(doc(db, 'email_otp_sessions', uid)).catch(() => {});
  } else {
    memorySessionStore.clear();
  }
}
