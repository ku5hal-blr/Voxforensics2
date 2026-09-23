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
 * ============================================================ */

export async function getUserScanHistory(
  userId: string
): Promise<ScanRecord[]> {
  if (!userId?.trim()) {
    return [];
  }

  const scansRef = collection(db, 'users', userId.trim(), 'scans');

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

    const records: ScanRecord[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();

      return {
        id: data.id || docSnap.id,
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
      };
    });

    // Ensure newest first order regardless of server timestamp resolution state
    records.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return records;
  } catch (error) {
    console.error('Failed to load user scan history from Firestore:', error);
    return [];
  }
}

/* ============================================================
 * SAVE USER SCAN TO HISTORY
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
}

/* ============================================================
 * CLEAR USER SCAN HISTORY
 * ============================================================ */

export async function clearUserScanHistory(
  userId: string
): Promise<void> {
  if (!userId?.trim()) {
    return;
  }

  const scansRef = collection(db, 'users', userId.trim(), 'scans');
  const snapshot = await getDocs(scansRef);

  if (snapshot.empty) {
    return;
  }

  const deletePromises = snapshot.docs.map((docSnap) =>
    deleteDoc(docSnap.ref)
  );

  await Promise.all(deletePromises);
}
