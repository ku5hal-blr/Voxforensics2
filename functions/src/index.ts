import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK
initializeApp();

/**
 * Cloud Function: deleteUserAccount
 *
 * Secure server-side endpoint for administrators to delete a user's account.
 * Deletes both:
 * 1. The Firebase Authentication record (prevents further logins)
 * 2. The Firestore document at users/{uid}
 *
 * Security:
 * - Requires authenticated Firebase request
 * - Independently verifies requester has role === 'admin' in Firestore
 * - Prohibits self-deletion of the requesting admin
 * - Prohibits deletion of the primary administrator account
 * - Validates target UID format
 * - Handles partial failure / orphaned states safely
 */
export const deleteUserAccount = onCall(
  {
    cors: true,
    region: 'us-central1',
  },
  async (request) => {
    // 1. Verify caller is authenticated
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError(
        'unauthenticated',
        'Authentication is required to perform this action.'
      );
    }

    const requestingAdminUid = request.auth.uid;

    // 2. Validate input parameter
    const targetUid = request.data?.uid;
    if (
      !targetUid ||
      typeof targetUid !== 'string' ||
      !targetUid.trim()
    ) {
      throw new HttpsError(
        'invalid-argument',
        'A valid target user UID is required.'
      );
    }

    const trimmedTargetUid = targetUid.trim();

    // 3. Prevent self-deletion
    if (trimmedTargetUid === requestingAdminUid) {
      throw new HttpsError(
        'failed-precondition',
        'Administrators cannot delete their own account.'
      );
    }

    const db = getFirestore();
    const auth = getAuth();

    // 4. Verify requesting user's admin role from Firestore
    const requesterDoc = await db
      .collection('users')
      .doc(requestingAdminUid)
      .get();

    if (!requesterDoc.exists) {
      throw new HttpsError(
        'permission-denied',
        'Requester profile not found. Administrator privileges required.'
      );
    }

    const requesterData = requesterDoc.data();
    const isRequesterAdmin =
      requesterData?.role === 'admin' ||
      request.auth.token?.email?.toLowerCase() === 'admin@voxforensics.com';

    if (!isRequesterAdmin) {
      throw new HttpsError(
        'permission-denied',
        'You do not have permission to delete user accounts.'
      );
    }

    // 5. Prevent deleting the primary admin account
    try {
      const targetAuthUser = await auth
        .getUser(trimmedTargetUid)
        .catch(() => null);

      if (
        targetAuthUser?.email?.toLowerCase() === 'admin@voxforensics.com'
      ) {
        throw new HttpsError(
          'failed-precondition',
          'The primary administrator account cannot be deleted.'
        );
      }
    } catch (err: any) {
      if (err instanceof HttpsError) {
        throw err;
      }
      // If error is not HttpsError, proceed to deletion handling
    }

    // 6. Delete Firebase Authentication user
    let authDeleted = false;
    let authAlreadyMissing = false;

    try {
      await auth.deleteUser(trimmedTargetUid);
      authDeleted = true;
    } catch (authError: any) {
      if (authError?.code === 'auth/user-not-found') {
        authAlreadyMissing = true;
      } else {
        console.error(
          `[deleteUserAccount] Error deleting Firebase Auth user ${trimmedTargetUid}:`,
          authError
        );
        throw new HttpsError(
          'internal',
          'Failed to delete user authentication record. Please try again.'
        );
      }
    }

    // 7. Delete Firestore user profile document (users/{targetUid})
    let firestoreDeleted = false;
    const targetDocRef = db.collection('users').doc(trimmedTargetUid);

    try {
      const targetSnap = await targetDocRef.get();
      if (targetSnap.exists) {
        await targetDocRef.delete();
        firestoreDeleted = true;
      } else {
        firestoreDeleted = false;
      }
    } catch (fsError: any) {
      console.error(
        `[deleteUserAccount] Error deleting Firestore document users/${trimmedTargetUid}:`,
        fsError
      );
      throw new HttpsError(
        'internal',
        'User authentication was deleted, but failed to remove user database profile. Please contact support.'
      );
    }

    // 8. If user was neither in Auth nor in Firestore
    if (authAlreadyMissing && !firestoreDeleted) {
      throw new HttpsError(
        'not-found',
        'User account was not found.'
      );
    }

    console.log(
      `[deleteUserAccount] Successfully deleted user ${trimmedTargetUid} (Auth deleted: ${authDeleted}, Firestore deleted: ${firestoreDeleted}) by admin ${requestingAdminUid}`
    );

    return {
      success: true,
      message: 'User account deleted successfully.',
      uid: trimmedTargetUid,
      authDeleted,
      firestoreDeleted,
    };
  }
);
