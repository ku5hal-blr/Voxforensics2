import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';

import { db } from '../firebase';
import type { AnalysisResult, ScanRecord } from '../utils/analysis';

/* ============================================================
 * GET USER SCAN HISTORY
 * ============================================================
 * Retrieves scans strictly belonging to the specified user UID.
 * Results are ordered newest first and cached in a user-isolated
 * localStorage key: voxforensics_scan_history_<uid>
 * ============================================================ */

export async function getUserScanHistory(
  userId: string
): Promise<ScanRecord[]> {
  if (!userId?.trim()) {
    return [];
  }

  const cleanUserId = userId.trim();
  const scansRef = collection(db, 'users', cleanUserId, 'scans');

  try {
    let snapshot;

    try {
      const q = query(scansRef, orderBy('createdAt', 'desc'));
      snapshot = await getDocs(q);
    } catch (orderError) {
      console.warn(
        'Ordering by createdAt failed, falling back to unordered fetch:',
        orderError
      );
      snapshot = await getDocs(scansRef);
    }

    const records: ScanRecord[] = [];
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();

      // Safety check: ignore any record explicitly bound to a different userId
      if (data.userId && data.userId !== cleanUserId) {
        continue;
      }

      records.push({
        id: data.id || docSnap.id,
        userId: data.userId || cleanUserId,
        filename: data.filename || 'Unknown audio',
        timestamp:
          typeof data.timestamp === 'string'
            ? data.timestamp
            : data.createdAt?.toDate
              ? data.createdAt.toDate().toISOString()
              : new Date().toISOString(),
        duration:
          typeof data.duration === 'number' && Number.isFinite(data.duration)
            ? data.duration
            : 0,
        result: {
          ...data.result,
          isDeepfake:
            data.result?.isDeepfake ??
            data.result?.verdict === 'AI-Generated',
        } as AnalysisResult,
      });
    }

    // Ensure newest first order regardless of server timestamp resolution state
    records.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Synchronize to user-scoped localStorage cache
    try {
      localStorage.setItem(
        `voxforensics_scan_history_${cleanUserId}`,
        JSON.stringify(records)
      );
    } catch {
      // Ignore localStorage errors
    }

    return records;
  } catch (error) {
    console.error('Failed to load user scan history from Firestore:', error);

    // Fall back to user-scoped localStorage cache if offline or network error
    try {
      const cached = localStorage.getItem(
        `voxforensics_scan_history_${cleanUserId}`
      );
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (rec: ScanRecord) => !rec.userId || rec.userId === cleanUserId
          );
        }
      }
    } catch {
      // Ignore
    }

    return [];
  }
}

/* ============================================================
 * SAVE USER SCAN TO HISTORY
 * ============================================================
 * Persists a new scan record into Firestore users/{userId}/scans/{scanId}.
 * The record explicitly includes userId to enforce user ownership.
 * ============================================================ */

export async function saveUserScanToHistory(
  userId: string,
  filename: string,
  result: AnalysisResult,
  duration: number
): Promise<void> {
  if (!userId?.trim()) {
    throw new Error('User ID is required to save scan history.');
  }

  const cleanUserId = userId.trim();
  const scanId =
    result?.id ||
    `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const scanDocRef = doc(db, 'users', cleanUserId, 'scans', scanId);

  const timestamp =
    typeof result?.timestamp === 'number'
      ? new Date(result.timestamp).toISOString()
      : new Date().toISOString();

  const safeDuration =
    Number.isFinite(duration) && duration >= 0 ? duration : 0;

  const recordData = {
    id: scanId,
    userId: cleanUserId,
    filename: filename || 'Unknown audio',
    timestamp,
    duration: safeDuration,
    result: {
      ...result,
      isDeepfake:
        result.isDeepfake ??
        result.verdict === 'AI-Generated',
    },
    createdAt: serverTimestamp(),
  };

  await setDoc(scanDocRef, recordData, { merge: true });

  // Update user-scoped localStorage cache
  try {
    const cacheKey = `voxforensics_scan_history_${cleanUserId}`;
    const existing: ScanRecord[] = JSON.parse(
      localStorage.getItem(cacheKey) || '[]'
    );
    const updated = [
      {
        id: scanId,
        userId: cleanUserId,
        filename: filename || 'Unknown audio',
        timestamp,
        duration: safeDuration,
        result: {
          ...result,
          isDeepfake:
            result.isDeepfake ??
            result.verdict === 'AI-Generated',
        },
      } as ScanRecord,
      ...existing.filter((s) => s.id !== scanId),
    ].slice(0, 100);

    localStorage.setItem(cacheKey, JSON.stringify(updated));
  } catch {
    // Ignore localStorage write error
  }
}

/* ============================================================
 * CLEAR USER SCAN HISTORY
 * ============================================================
 * Deletes all scan documents from users/{userId}/scans and clears
 * the user-scoped localStorage cache.
 * ============================================================ */

export async function clearUserScanHistory(
  userId: string
): Promise<void> {
  if (!userId?.trim()) {
    return;
  }

  const cleanUserId = userId.trim();
  const scansRef = collection(db, 'users', cleanUserId, 'scans');
  const snapshot = await getDocs(scansRef);

  if (!snapshot.empty) {
    const deletePromises = snapshot.docs.map((docSnap) =>
      deleteDoc(docSnap.ref)
    );
    await Promise.all(deletePromises);
  }

  // Clear user-scoped localStorage cache
  try {
    localStorage.removeItem(`voxforensics_scan_history_${cleanUserId}`);
  } catch {
    // Ignore
  }
}
