import {
  useState,
  useEffect,
  useRef,
  createContext,
  useContext,
  type ReactNode,
  type FormEvent,
} from 'react';

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  sendEmailVerification,
  type User as FirebaseUser,
} from 'firebase/auth';

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';

import { auth, db } from '../firebase';
import {
  sendEmailOtp,
  verifyEmailOtp,
  clearEmailOtpSession,
} from '../services/emailOtp';

/* ============================================================
 * TYPES
 * ============================================================ */

export interface User {
  id: string;
  email: string;
  name: string;
  phoneNumber: string;
  role: 'user' | 'admin';
  referralCode: string;
  referredBy?: string;
  createdAt: string;
  twoFactorEnabled: boolean;
}

interface AuthContextType {
  user: User | null;
  authLoading: boolean;

  login: (
    email: string,
    password: string
  ) => Promise<boolean>;

  completeLogin: (
    firebaseUser: FirebaseUser,
    mfaVerified?: boolean
  ) => Promise<boolean>;

  register: (
    email: string,
    password: string,
    name: string,
    phoneNumber: string,
    referralCode?: string
  ) => Promise<boolean>;

  logout: () => void;
}

type AuthMode = 'login' | 'register';

type AuthStep =
  | 'credentials'
  | 'verify-email'
  | 'email-otp';

/* ============================================================
 * CONTEXT
 * ============================================================ */

const AuthContext =
  createContext<AuthContextType | undefined>(
    undefined
  );

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used inside AuthProvider'
    );
  }

  return context;
}

/* ============================================================
 * HELPERS
 * ============================================================ */

function generateReferralCode() {
  return (
    'VOX-' +
    Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()
  );
}

function normalizePhoneNumber(
  phone: string
): string {
  const cleaned = phone
    .replace(/[^\d+]/g, '')
    .trim();

  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return '+' + cleaned;
  }

  if (cleaned.length === 10) {
    return '+91' + cleaned;
  }

  return cleaned;
}

function firebaseUserToProfile(
  firebaseUser: FirebaseUser,
  data: any
): User {
  const isAdminAccount =
    data?.role === 'admin' ||
    firebaseUser.email?.toLowerCase() === 'admin@voxforensics.com';

  let createdAtStr = new Date().toISOString();
  if (data?.createdAt) {
    if (typeof data.createdAt.toDate === 'function') {
      createdAtStr = data.createdAt.toDate().toISOString();
    } else if (typeof data.createdAt === 'string') {
      createdAtStr = data.createdAt;
    } else if (data.createdAt instanceof Date) {
      createdAtStr = data.createdAt.toISOString();
    } else if (typeof data.createdAt === 'number') {
      createdAtStr = new Date(data.createdAt).toISOString();
    }
  }

  return {
    id: firebaseUser.uid,

    email:
      firebaseUser.email ||
      data?.email ||
      '',

    name:
      data?.name ||
      data?.username ||
      firebaseUser.displayName ||
      'VoxForensics User',

    phoneNumber:
      data?.phoneNumber ||
      '',

    role:
      isAdminAccount
        ? 'admin'
        : 'user',

    referralCode:
      data?.referralCode ||
      generateReferralCode(),

    referredBy:
      data?.referredBy ||
      undefined,

    createdAt: createdAtStr,

    twoFactorEnabled: Boolean(data?.twoFactorEnabled),
  };
}

/* ============================================================
 * AUTH PROVIDER
 * ============================================================ */

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [currentUser, setCurrentUser] =
    useState<User | null>(null);

  const [authLoading, setAuthLoading] =
    useState(true);

  const mfaJustCompletedRef =
    useRef(false);

  /* ----------------------------------------------------------
   * LOAD FIRESTORE PROFILE
   * ---------------------------------------------------------- */

  async function loadUserProfile(
    firebaseUser: FirebaseUser,
    mfaVerified = false
  ): Promise<User | null> {
    const userRef = doc(
      db,
      'users',
      firebaseUser.uid
    );

    try {
      const snapshot =
        await getDoc(userRef);

      if (snapshot.exists()) {
        const data = snapshot.data();
        const profile = firebaseUserToProfile(
          firebaseUser,
          data
        );

        if (mfaVerified) {
          profile.twoFactorEnabled = true;
        }

        // Ensure admin account always has admin role in Firestore so firestore.rules isAdmin() works
        if (
          firebaseUser.email?.toLowerCase() === 'admin@voxforensics.com' &&
          data?.role !== 'admin'
        ) {
          await setDoc(
            userRef,
            { role: 'admin' },
            { merge: true }
          ).catch((e) => console.warn('Could not update admin role in Firestore:', e));
          profile.role = 'admin';
        }

        return profile;
      }

      const name =
        firebaseUser.displayName?.trim() ||
        'VoxForensics User';

      const referralCode =
        generateReferralCode();

      const isAdminAccount =
        firebaseUser.email?.toLowerCase() === 'admin@voxforensics.com';

      const recoveryProfile = {
        id: firebaseUser.uid,
        uid: firebaseUser.uid,
        username: name,
        name,
        email: firebaseUser.email || '',
        phoneNumber: '',
        role: isAdminAccount ? 'admin' : 'user',
        referralCode,
        referredBy: null,
        createdAt: serverTimestamp(),
        twoFactorEnabled: mfaVerified,
      };

      await setDoc(
        userRef,
        recoveryProfile,
        {
          merge: true,
        }
      );

      return {
        id: firebaseUser.uid,
        email: firebaseUser.email || '',
        name,
        phoneNumber: '',
        role: isAdminAccount ? 'admin' : 'user',
        referralCode,
        referredBy: undefined,
        createdAt: new Date().toISOString(),
        twoFactorEnabled: mfaVerified,
      };
    } catch (error) {
      console.error(
        'Error loading VoxForensics profile:',
        error
      );

      throw error;
    }
  }

  /* ----------------------------------------------------------
   * FIREBASE AUTH STATE (CLEAN ON-STARTUP RESTORATION)
   * ---------------------------------------------------------- */

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (firebaseUser) => {
          try {
            if (!firebaseUser) {
              setCurrentUser(null);
              setAuthLoading(false);
              return;
            }

            const profile =
              await loadUserProfile(
                firebaseUser,
                mfaJustCompletedRef.current
              );

            if (!profile) {
              setCurrentUser(null);
              setAuthLoading(false);
              return;
            }

            /*
             * Admin users authenticated via Firebase are
             * recognized directly using their Firestore profile.
             */
            if (profile.role === 'admin') {
              setCurrentUser(profile);
              setAuthLoading(false);
              return;
            }

            /*
             * Regular users require verified email.
             */
            if (!firebaseUser.emailVerified) {
              setCurrentUser(null);
              setAuthLoading(false);
              return;
            }

            /*
             * If 2FA was completed or profile already has twoFactorEnabled: true,
             * restore the application dashboard session.
             */
            if (mfaJustCompletedRef.current || profile.twoFactorEnabled) {
              setCurrentUser(profile);
              setAuthLoading(false);
              return;
            }

            /*
             * User has not completed application 2FA:
             * Do not auto-log in to dashboard.
             */
            setCurrentUser(null);
          } catch (error) {
            console.error(
              'Auth state error:',
              error
            );

            setCurrentUser(null);
          } finally {
            setAuthLoading(false);
          }
        }
      );

    return unsubscribe;
  }, []);

  /* ----------------------------------------------------------
   * COMPLETE LOGIN
   * ---------------------------------------------------------- */

  async function completeLogin(
    firebaseUser: FirebaseUser,
    mfaVerified = false
  ): Promise<boolean> {
    try {
      if (mfaVerified) {
        mfaJustCompletedRef.current =
          true;
      }

      const profile =
        await loadUserProfile(
          firebaseUser,
          mfaVerified
        );

      if (!profile) {
        return false;
      }

      if (
        profile.role !== 'admin' &&
        !firebaseUser.emailVerified
      ) {
        return false;
      }

      if (mfaVerified) {
        await setDoc(
          doc(
            db,
            'users',
            firebaseUser.uid
          ),
          {
            twoFactorEnabled: true,
          },
          {
            merge: true,
          }
        );

        profile.twoFactorEnabled = true;
      }

      setCurrentUser(profile);

      console.log(
        'VoxForensics login completed successfully.'
      );

      if (mfaVerified) {
        setTimeout(() => {
          mfaJustCompletedRef.current =
            false;
        }, 1500);
      }

      return true;
    } catch (error) {
      console.error(
        'Complete login error:',
        error
      );

      setCurrentUser(null);

      return false;
    }
  }

  /* ----------------------------------------------------------
   * LOGIN
   * ---------------------------------------------------------- */

  async function login(
    email: string,
    password: string
  ): Promise<boolean> {
    try {
      const cred = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      if (!cred.user.emailVerified) {
        const snap = await getDoc(doc(db, 'users', cred.user.uid)).catch(() => null);
        if (
          snap?.data()?.role !== 'admin' &&
          cred.user.email?.toLowerCase() !== 'admin@voxforensics.com'
        ) {
          throw new Error('auth/unverified-email');
        }
      }

      return true;
    } catch (error: any) {
      throw error;
    }
  }

  /* ----------------------------------------------------------
   * REGISTER
   * ---------------------------------------------------------- */

  async function register(
    email: string,
    password: string,
    name: string,
    phoneNumber: string,
    referredBy?: string
  ): Promise<boolean> {
    try {
      const normalizedPhone = phoneNumber.trim()
        ? normalizePhoneNumber(phoneNumber)
        : '';

      const credential =
        await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

      const firebaseUser =
        credential.user;

      await updateProfile(
        firebaseUser,
        {
          displayName:
            name.trim(),
        }
      );

      await sendEmailVerification(
        firebaseUser
      );

      const referralCode =
        generateReferralCode();

      await setDoc(
        doc(
          db,
          'users',
          firebaseUser.uid
        ),
        {
          id: firebaseUser.uid,
          uid: firebaseUser.uid,
          username:
            name.trim(),

          name:
            name.trim(),

          email:
            email.trim(),

          phoneNumber:
            normalizedPhone,

          role: 'user',

          referralCode,

          referredBy:
            referredBy?.trim() ||
            null,

          createdAt:
            serverTimestamp(),

          twoFactorEnabled:
            false,
        }
      );

      setCurrentUser(null);

      return true;
    } catch (error) {
      console.error(
        'Registration error:',
        error
      );

      throw error;
    }
  }

  /* ----------------------------------------------------------
   * LOGOUT
   * ---------------------------------------------------------- */

  function logout() {
    mfaJustCompletedRef.current =
      false;

    signOut(auth).catch((error) => {
      console.error(
        'Logout error:',
        error
      );
    });

    setCurrentUser(null);
  }

  /* ----------------------------------------------------------
   * CONTEXT VALUE
   * ---------------------------------------------------------- */

  const value: AuthContextType = {
    user: currentUser,
    authLoading,
    login,
    completeLogin,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/* ============================================================
 * ERROR MESSAGES
 * ============================================================ */

function getFirebaseErrorMessage(
  error: any
): string {
  const code =
    error?.code || '';

  switch (code) {
    case 'auth/unverified-email':
      return 'Please verify your email address before logging in.';

    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Invalid email or password.';

    case 'auth/user-not-found':
      return 'No account was found with this email.';

    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Please log in below.';

    case 'auth/weak-password':
      return 'Password must be at least 6 characters long.';

    case 'auth/invalid-email':
      return 'Please enter a valid email address.';

    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';

    case 'permission-denied':
      return 'You do not have permission to perform this operation.';

    default:
      return (
        error?.message ||
        'Something went wrong. Please try again.'
      );
  }
}

/* ============================================================
 * AUTH SYSTEM COMPONENT
 * ============================================================ */

export default function AuthSystem() {
  const {
    user,
    authLoading,
    login,
    completeLogin,
    register,
    logout,
  } = useAuth();

  /* ----------------------------------------------------------
   * CLEAN INITIAL STATE (ALWAYS STARTS ON CREDENTIALS/LOGIN)
   * ---------------------------------------------------------- */

  const [mode, setMode] =
    useState<AuthMode>('login');

  const [step, setStep] =
    useState<AuthStep>('credentials');

  const [email, setEmail] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [name, setName] =
    useState('');

  const [phoneNumber, setPhoneNumber] =
    useState('');

  const [referralCode, setReferralCode] =
    useState('');

  const [otp, setOtp] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  const [message, setMessage] =
    useState('');

  const [resendCooldown, setResendCooldown] =
    useState(0);

  const [pendingFirebaseUser, setPendingFirebaseUser] =
    useState<FirebaseUser | null>(null);

  const pendingFirebaseUserRef =
    useRef<FirebaseUser | null>(
      null
    );

  const updatePendingFirebaseUser = (
    firebaseUser: FirebaseUser | null
  ) => {
    pendingFirebaseUserRef.current =
      firebaseUser;

    setPendingFirebaseUser(
      firebaseUser
    );
  };

  /* ----------------------------------------------------------
   * RESEND TIMER
   * ---------------------------------------------------------- */

  useEffect(() => {
    if (resendCooldown <= 0) {
      return;
    }

    const timer =
      window.setInterval(() => {
        setResendCooldown(
          (previous) =>
            previous > 0
              ? previous - 1
              : 0
        );
      }, 1000);

    return () =>
      window.clearInterval(timer);
  }, [resendCooldown]);

  /* ----------------------------------------------------------
   * SIGN OUT FROM ANY AUTH STATE
   * ---------------------------------------------------------- */

  const handleSignOut = async () => {
    setError('');
    setMessage('');
    setOtp('');
    clearEmailOtpSession(pendingFirebaseUser?.uid);
    updatePendingFirebaseUser(null);
    setMode('login');
    setStep('credentials');
    setEmail('');
    setPassword('');

    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Sign out error:', e);
    }

    logout();
  };

  /* ----------------------------------------------------------
   * LOGIN / REGISTER SUBMIT
   * ---------------------------------------------------------- */

  const handleCredentialsSubmit =
    async (
      event: FormEvent
    ) => {
      event.preventDefault();

      setError('');
      setMessage('');

      if (!email.trim()) {
        setError(
          'Please enter your email address.'
        );

        return;
      }

      if (!password) {
        setError(
          'Please enter your password.'
        );

        return;
      }

      if (
        mode === 'register' &&
        !name.trim()
      ) {
        setError(
          'Please enter your full name.'
        );

        return;
      }

      setLoading(true);

      try {
        if (mode === 'register') {
          try {
            await register(
              email,
              password,
              name,
              phoneNumber,
              referralCode
            );

            updatePendingFirebaseUser(
              auth.currentUser
            );

            setStep(
              'verify-email'
            );

            setMessage(
              "We've sent a verification email to your address. Please verify your email to continue."
            );

            return;
          } catch (regErr: any) {
            if (regErr?.code === 'auth/email-already-in-use') {
              setError(
                'An account with this email already exists. Please log in below.'
              );
              setMode('login');
              setStep('credentials');
              setMessage('Please enter your password to log in.');
              return;
            }
            throw regErr;
          }
        }

        /*
         * LOGIN FLOW
         */
        await login(
          email,
          password
        );

        const fbUser = auth.currentUser;
        if (!fbUser) {
          throw new Error('No authenticated user returned.');
        }

        await fbUser.reload();
        const refreshedUser = auth.currentUser || fbUser;

        // Step A: Check email verification
        if (!refreshedUser.emailVerified) {
          updatePendingFirebaseUser(refreshedUser);
          setStep('verify-email');
          setMessage('Please verify your email before continuing.');
          return;
        }

        // Step B: Check admin role
        const snap = await getDoc(doc(db, 'users', refreshedUser.uid)).catch(() => null);
        const userData = snap?.data();
        const isAdmin =
          userData?.role === 'admin' ||
          refreshedUser.email?.toLowerCase() === 'admin@voxforensics.com';

        if (isAdmin) {
          await completeLogin(refreshedUser, true);
          return;
        }

        // Step C: Regular verified user -> Send application-level Email OTP
        updatePendingFirebaseUser(refreshedUser);
        const targetEmail = refreshedUser.email || email;
        const otpRes = await sendEmailOtp(refreshedUser.uid, targetEmail);

        if (!otpRes.success) {
          setError(
            otpRes.error ||
            "We couldn't send the verification code. Please try again."
          );
          return;
        }

        setResendCooldown(otpRes.cooldownSeconds || 30);
        setStep('email-otp');
        setOtp('');
        setMessage(`A 6-digit verification code has been sent to ${targetEmail}.`);
      } catch (authError: any) {
        console.error(
          'Authentication error:',
          authError
        );

        setError(
          getFirebaseErrorMessage(
            authError
          )
        );
      } finally {
        setLoading(false);
      }
    };

  /* ----------------------------------------------------------
   * EMAIL VERIFIED HANDLER
   * ---------------------------------------------------------- */

  const handleEmailVerified =
    async () => {
      setError('');
      setMessage('');

      const firebaseUser =
        auth.currentUser ||
        pendingFirebaseUserRef.current ||
        pendingFirebaseUser;

      if (!firebaseUser) {
        setError(
          'Your registration session has expired. Please log in again.'
        );
        setMode('login');
        setStep('credentials');
        return;
      }

      setLoading(true);

      try {
        await firebaseUser.reload();

        const refreshedUser =
          auth.currentUser ||
          firebaseUser;

        if (
          !refreshedUser?.emailVerified
        ) {
          setError(
            'Your email is not verified yet. Please verify it and try again.'
          );

          return;
        }

        updatePendingFirebaseUser(refreshedUser);
        const targetEmail = refreshedUser.email || email;
        const otpRes = await sendEmailOtp(refreshedUser.uid, targetEmail);

        if (!otpRes.success) {
          setError(
            otpRes.error ||
            "We couldn't send the verification code. Please try again."
          );
          return;
        }

        setResendCooldown(otpRes.cooldownSeconds || 30);
        setStep('email-otp');
        setOtp('');
        setMessage(
          `Email verified! A 6-digit verification code has been sent to ${targetEmail} to complete Two-Factor Authentication.`
        );
      } catch (error: any) {
        setError(
          getFirebaseErrorMessage(
            error
          )
        );
      } finally {
        setLoading(false);
      }
    };

  /* ----------------------------------------------------------
   * RESEND EMAIL VERIFICATION
   * ---------------------------------------------------------- */

  const handleResendEmail =
    async () => {
      setError('');
      setMessage('');

      const firebaseUser =
        auth.currentUser ||
        pendingFirebaseUserRef.current ||
        pendingFirebaseUser;

      if (!firebaseUser) {
        setError(
          'Your registration session has expired. Please log in again.'
        );
        setMode('login');
        setStep('credentials');
        return;
      }

      try {
        await sendEmailVerification(
          firebaseUser
        );

        setMessage(
          'Verification email sent again. Please check your inbox.'
        );
      } catch (error: any) {
        setError(
          getFirebaseErrorMessage(
            error
          )
        );
      }
    };

  /* ----------------------------------------------------------
   * VERIFY EMAIL OTP
   * ---------------------------------------------------------- */

  const handleVerifyEmailOtp =
    async () => {
      setError('');
      setMessage('');

      if (!otp.trim() || otp.trim().length !== 6) {
        setError(
          'Please enter the 6-digit verification code.'
        );
        return;
      }

      const firebaseUser =
        auth.currentUser ||
        pendingFirebaseUserRef.current ||
        pendingFirebaseUser;

      if (!firebaseUser) {
        setError(
          'Verification session not found. Please log in again.'
        );
        setMode('login');
        setStep('credentials');
        return;
      }

      setLoading(true);

      try {
        const verifyRes = await verifyEmailOtp(
          firebaseUser.uid,
          otp
        );

        if (!verifyRes.success) {
          setError(
            verifyRes.error || 'Incorrect verification code.'
          );
          return;
        }

        // Update Firestore twoFactorEnabled ONLY after successful email OTP verification
        await setDoc(
          doc(
            db,
            'users',
            firebaseUser.uid
          ),
          {
            twoFactorEnabled: true,
          },
          {
            merge: true,
          }
        );

        clearEmailOtpSession(firebaseUser.uid);
        setOtp('');
        setResendCooldown(0);
        updatePendingFirebaseUser(null);

        await completeLogin(
          firebaseUser,
          true
        );
      } catch (error: any) {
        console.error(
          'OTP verification error:',
          error
        );

        setError(
          error?.message || 'Verification failed. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    };

  /* ----------------------------------------------------------
   * RESEND EMAIL OTP
   * ---------------------------------------------------------- */

  const handleResendEmailOtp =
    async () => {
      if (resendCooldown > 0) {
        return;
      }

      const firebaseUser =
        auth.currentUser ||
        pendingFirebaseUserRef.current ||
        pendingFirebaseUser;

      if (!firebaseUser) {
        setError('Session expired. Please log in again.');
        setMode('login');
        setStep('credentials');
        return;
      }

      setError('');
      setMessage('');
      setLoading(true);

      try {
        const targetEmail = firebaseUser.email || email;
        const res = await sendEmailOtp(
          firebaseUser.uid,
          targetEmail
        );

        if (!res.success) {
          setError(
            res.error || "We couldn't send the verification code. Please try again."
          );
          return;
        }

        setResendCooldown(res.cooldownSeconds || 30);
        setMessage(`A new 6-digit verification code has been sent to ${targetEmail}.`);
      } catch (error: any) {
        setError(getFirebaseErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };

  /* ----------------------------------------------------------
   * SWITCH LOGIN / REGISTER
   * ---------------------------------------------------------- */

  const switchMode = (
    nextMode: AuthMode
  ) => {
    setMode(nextMode);
    setStep('credentials');
    setError('');
    setMessage('');
    setOtp('');
    updatePendingFirebaseUser(null);
  };

  /* ==========================================================
   * LOGGED-IN CARD (IF RENDERED DIRECTLY)
   * ========================================================== */

  if (user) {
    return (
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          margin: '0 auto',
          padding: '28px',
          boxSizing: 'border-box',
          background: 'rgba(5, 9, 20, 0.96)',
          border: '1px solid rgba(0, 212, 255, 0.55)',
          borderRadius: '16px',
          boxShadow: '0 0 35px rgba(0, 212, 255, 0.10)',
          color: '#ffffff',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '13px',
              color: '#00d4ff',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}
          >
            Welcome back
          </div>

          <h2 style={{ margin: '0 0 8px', fontSize: '25px', color: '#ffffff' }}>
            {user.name}
          </h2>

          <p style={{ margin: '0 0 22px', color: '#9fb0c8', fontSize: '14px' }}>
            {user.email}
          </p>

          <button
            type="button"
            onClick={logout}
            style={{
              width: '100%',
              padding: '13px 18px',
              borderRadius: '10px',
              border: '1px solid rgba(255, 70, 90, 0.3)',
              background: 'rgba(255, 70, 90, 0.12)',
              color: '#ff8595',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  /* ==========================================================
   * MAIN AUTH CONTAINER
   * ========================================================== */

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '460px',
        margin: '0 auto',
        padding: '32px 28px',
        boxSizing: 'border-box',
        background: 'rgba(5, 9, 20, 0.96)',
        border: '1px solid rgba(0, 212, 255, 0.35)',
        borderRadius: '18px',
        boxShadow: '0 0 45px rgba(0, 212, 255, 0.12)',
        color: '#ffffff',
      }}
    >
      {/* BRAND HEADER */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: '26px',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            color: '#00d4ff',
            fontWeight: 800,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            marginBottom: '6px',
          }}
        >
          AI Audio Authenticity
        </div>

        <h2
          style={{
            margin: '0 0 6px',
            fontSize: '28px',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #ffffff 0%, #00d4ff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          VoxForensics
        </h2>

        <p
          style={{
            margin: 0,
            color: '#8c9bb1',
            fontSize: '13px',
          }}
        >
          {mode === 'login'
            ? 'Sign in to access your analysis dashboard'
            : 'Create an account to start detecting deepfakes'}
        </p>
      </div>

      {/* ERROR ALERT */}
      {error && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '10px',
            marginBottom: '18px',
            background: 'rgba(255, 70, 90, 0.12)',
            border: '1px solid rgba(255, 70, 90, 0.35)',
            color: '#ff9ba8',
            fontSize: '13px',
            lineHeight: 1.5,
          }}
        >
          {error}
        </div>
      )}

      {/* INFO MESSAGE */}
      {message && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '10px',
            marginBottom: '18px',
            background: 'rgba(0, 212, 255, 0.10)',
            border: '1px solid rgba(0, 212, 255, 0.30)',
            color: '#9feaff',
            fontSize: '13px',
            lineHeight: 1.5,
          }}
        >
          {message}
        </div>
      )}

      {/* ======================================================
          STEP 1: CREDENTIALS (EMAIL + PASSWORD)
          ====================================================== */}
      {step === 'credentials' && (
        <form onSubmit={handleCredentialsSubmit}>
          {mode === 'register' && (
            <div style={{ marginBottom: '15px' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '7px',
                  fontSize: '13px',
                  color: '#b8c6d9',
                }}
              >
                Full Name
              </label>

              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dr. Jane Doe"
                autoComplete="name"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '13px 14px',
                  borderRadius: '10px',
                  border: '1px solid rgba(0, 212, 255, 0.18)',
                  background: 'rgba(13, 24, 48, 0.85)',
                  color: '#ffffff',
                  outline: 'none',
                  fontSize: '14px',
                }}
              />
            </div>
          )}

          <div style={{ marginBottom: '15px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '7px',
                fontSize: '13px',
                color: '#b8c6d9',
              }}
            >
              Email Address
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="analyst@voxforensics.com"
              autoComplete="email"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '13px 14px',
                borderRadius: '10px',
                border: '1px solid rgba(0, 212, 255, 0.18)',
                background: 'rgba(13, 24, 48, 0.85)',
                color: '#ffffff',
                outline: 'none',
                fontSize: '14px',
              }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '7px',
                fontSize: '13px',
                color: '#b8c6d9',
              }}
            >
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete={
                mode === 'login'
                  ? 'current-password'
                  : 'new-password'
              }
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '13px 14px',
                borderRadius: '10px',
                border: '1px solid rgba(0, 212, 255, 0.18)',
                background: 'rgba(13, 24, 48, 0.85)',
                color: '#ffffff',
                outline: 'none',
                fontSize: '14px',
              }}
            />
          </div>

          {mode === 'register' && (
            <>
              <div style={{ marginBottom: '15px' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '7px',
                    fontSize: '13px',
                    color: '#b8c6d9',
                  }}
                >
                  Phone Number{' '}
                  <span style={{ color: '#65758c' }}>
                    (Optional)
                  </span>
                </label>

                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+91 9876543210"
                  autoComplete="tel"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '13px 14px',
                    borderRadius: '10px',
                    border: '1px solid rgba(0, 212, 255, 0.18)',
                    background: 'rgba(13, 24, 48, 0.85)',
                    color: '#ffffff',
                    outline: 'none',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '7px',
                    fontSize: '13px',
                    color: '#b8c6d9',
                  }}
                >
                  Referral Code{' '}
                  <span style={{ color: '#65758c' }}>
                    (Optional)
                  </span>
                </label>

                <input
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  placeholder="VOX-XXXXXX"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '13px 14px',
                    borderRadius: '10px',
                    border: '1px solid rgba(0, 212, 255, 0.18)',
                    background: 'rgba(13, 24, 48, 0.85)',
                    color: '#ffffff',
                    outline: 'none',
                    fontSize: '14px',
                  }}
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '13px 18px',
              borderRadius: '10px',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              background:
                'linear-gradient(135deg, rgba(0,212,255,0.20), rgba(168,85,247,0.20))',
              color: '#ffffff',
              fontWeight: 800,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.65 : 1,
            }}
          >
            {loading
              ? 'Please wait...'
              : mode === 'login'
                ? 'Login'
                : 'Create Account'}
          </button>

          <div
            style={{
              textAlign: 'center',
              marginTop: '18px',
              color: '#8292aa',
              fontSize: '13px',
            }}
          >
            {mode === 'login'
              ? "Don't have an account? "
              : 'Already have an account? '}

            <button
              type="button"
              onClick={() =>
                switchMode(
                  mode === 'login'
                    ? 'register'
                    : 'login'
                )
              }
              style={{
                border: 'none',
                background: 'transparent',
                color: '#00d4ff',
                fontWeight: 700,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {mode === 'login'
                ? 'Create one'
                : 'Login'}
            </button>
          </div>
        </form>
      )}

      {/* ======================================================
          STEP 2: EMAIL VERIFICATION NOTICE
          ====================================================== */}
      {step === 'verify-email' && (
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '46px',
              marginBottom: '15px',
            }}
          >
            ✉️
          </div>

          <h3
            style={{
              margin: '0 0 10px',
              color: '#ffffff',
              fontSize: '21px',
            }}
          >
            Verify Your Email
          </h3>

          <p
            style={{
              margin: '0 0 22px',
              color: '#8c9bb1',
              fontSize: '13px',
              lineHeight: 1.6,
            }}
          >
            We've sent a verification email to your address. Please verify your email to continue.
          </p>

          <button
            type="button"
            onClick={handleEmailVerified}
            disabled={loading}
            style={{
              width: '100%',
              padding: '13px 18px',
              borderRadius: '10px',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              background:
                'linear-gradient(135deg, rgba(0,212,255,0.20), rgba(168,85,247,0.20))',
              color: '#ffffff',
              fontWeight: 800,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.65 : 1,
            }}
          >
            {loading ? 'Checking...' : "I've Verified My Email"}
          </button>

          <button
            type="button"
            onClick={handleResendEmail}
            style={{
              width: '100%',
              marginTop: '10px',
              padding: '12px 18px',
              borderRadius: '10px',
              border: '1px solid rgba(0, 212, 255, 0.22)',
              background: 'rgba(13, 24, 48, 0.7)',
              color: '#9feaff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Resend Verification Email
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            style={{
              width: '100%',
              marginTop: '10px',
              padding: '12px 18px',
              borderRadius: '10px',
              border: '1px solid rgba(255, 70, 90, 0.25)',
              background: 'rgba(255, 70, 90, 0.08)',
              color: '#ff9ba8',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Back to Login
          </button>
        </div>
      )}

      {/* ======================================================
          STEP 3: EMAIL OTP VERIFICATION SCREEN
          ====================================================== */}
      {step === 'email-otp' && (
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '42px',
              marginBottom: '10px',
            }}
          >
            📧
          </div>

          <h3
            style={{
              margin: '0 0 8px',
              fontSize: '21px',
              color: '#ffffff',
            }}
          >
            Verify Your Email
          </h3>

          <p
            style={{
              margin: '0 0 4px',
              color: '#8c9bb1',
              fontSize: '13px',
              lineHeight: 1.6,
            }}
          >
            We sent a 6-digit verification code to:
          </p>

          <p
            style={{
              margin: '0 0 20px',
              color: '#00d4ff',
              fontSize: '14px',
              fontWeight: 700,
            }}
          >
            {auth.currentUser?.email || pendingFirebaseUser?.email || email || 'your email'}
          </p>

          <div style={{ marginBottom: '18px' }}>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="· · · · · ·"
              autoComplete="one-time-code"
              autoFocus
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '14px',
                borderRadius: '10px',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                background: 'rgba(13, 24, 48, 0.85)',
                color: '#ffffff',
                outline: 'none',
                fontSize: '22px',
                letterSpacing: '0.35em',
                textAlign: 'center',
                fontFamily: 'monospace',
              }}
            />
          </div>

          <button
            type="button"
            onClick={handleVerifyEmailOtp}
            disabled={loading || otp.length !== 6}
            style={{
              width: '100%',
              padding: '13px 18px',
              borderRadius: '10px',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              background:
                'linear-gradient(135deg, rgba(0,212,255,0.20), rgba(168,85,247,0.20))',
              color: '#ffffff',
              fontWeight: 800,
              cursor:
                loading || otp.length !== 6
                  ? 'not-allowed'
                  : 'pointer',
              opacity:
                loading || otp.length !== 6
                  ? 0.55
                  : 1,
            }}
          >
            {loading ? 'Verifying...' : 'Verify Code'}
          </button>

          <p
            style={{
              margin: '16px 0 6px',
              color: '#8c9bb1',
              fontSize: '12px',
            }}
          >
            Didn't receive it?
          </p>

          <button
            type="button"
            onClick={handleResendEmailOtp}
            disabled={loading || resendCooldown > 0}
            style={{
              width: '100%',
              padding: '12px 18px',
              borderRadius: '10px',
              border: '1px solid rgba(0, 212, 255, 0.22)',
              background: 'rgba(13, 24, 48, 0.7)',
              color: '#9feaff',
              fontWeight: 700,
              cursor:
                loading || resendCooldown > 0
                  ? 'not-allowed'
                  : 'pointer',
              opacity:
                loading || resendCooldown > 0
                  ? 0.55
                  : 1,
            }}
          >
            {resendCooldown > 0
              ? `Resend Code (${resendCooldown}s)`
              : 'Resend Code'}
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            style={{
              width: '100%',
              marginTop: '10px',
              padding: '12px 18px',
              borderRadius: '10px',
              border: '1px solid rgba(255, 70, 90, 0.25)',
              background: 'rgba(255, 70, 90, 0.08)',
              color: '#ff9ba8',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Back to Login
          </button>
        </div>
      )}
    </div>
  );
}