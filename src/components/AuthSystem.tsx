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
  multiFactor,
  RecaptchaVerifier,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  getMultiFactorResolver,
  type User as FirebaseUser,
  type MultiFactorResolver,
} from 'firebase/auth';

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';

import { auth, db } from '../firebase';

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
  | 'phone'
  | 'otp';

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
  return {
    id: firebaseUser.uid,

    email:
      firebaseUser.email ||
      data?.email ||
      '',

    name:
      data?.name ||
      firebaseUser.displayName ||
      'VoxForensics User',

    phoneNumber:
      data?.phoneNumber ||
      '',

    role:
      data?.role === 'admin'
        ? 'admin'
        : 'user',

    referralCode:
      data?.referralCode ||
      generateReferralCode(),

    referredBy:
      data?.referredBy ||
      undefined,

    createdAt:
      typeof data?.createdAt === 'string'
        ? data.createdAt
        : new Date().toISOString(),

    twoFactorEnabled:
      Boolean(data?.twoFactorEnabled),
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
        return firebaseUserToProfile(
          firebaseUser,
          snapshot.data()
        );
      }

      const enrolledFactors =
        multiFactor(firebaseUser).enrolledFactors;

      const hasMFA =
        mfaVerified ||
        enrolledFactors.length > 0;

      let phoneNumber = '';

      if (enrolledFactors.length > 0) {
        const phoneFactor =
          enrolledFactors.find(
            (factor: any) =>
              factor.factorId ===
              PhoneMultiFactorGenerator.FACTOR_ID
          );

        if (phoneFactor) {
          phoneNumber =
            phoneFactor.phoneNumber ||
            '';
        }
      }

      const name =
        firebaseUser.displayName?.trim() ||
        'VoxForensics User';

      const referralCode =
        generateReferralCode();

      const recoveryProfile = {
        username: name,

        name,

        email:
          firebaseUser.email || '',

        phoneNumber,

        role: 'user',

        referralCode,

        referredBy: null,

        createdAt:
          serverTimestamp(),

        twoFactorEnabled:
          hasMFA,
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

        email:
          firebaseUser.email || '',

        name,

        phoneNumber,

        role: 'user',

        referralCode,

        referredBy:
          undefined,

        createdAt:
          new Date().toISOString(),

        twoFactorEnabled:
          hasMFA,
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
   * FIREBASE AUTH STATE
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
             * Regular users preserve existing email verification
             * and MFA requirements.
             */
            if (!firebaseUser.emailVerified) {
              setCurrentUser(null);
              setAuthLoading(false);
              return;
            }

            const enrolledFactors =
              multiFactor(firebaseUser).enrolledFactors;

            if (mfaJustCompletedRef.current) {
              setCurrentUser(profile);
              setAuthLoading(false);
              return;
            }

            if (profile.twoFactorEnabled && enrolledFactors.length === 0) {
              setCurrentUser(null);
              setAuthLoading(false);
              return;
            }

            setCurrentUser(profile);
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
      await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      return true;
    } catch (error: any) {
      /*
       * MFA-required is intentionally re-thrown
       * so AuthSystem can create the resolver.
       */
      if (
        error?.code ===
        'auth/multi-factor-auth-required'
      ) {
        throw error;
      }

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
      const normalizedPhone =
        normalizePhoneNumber(
          phoneNumber
        );

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

      await signOut(auth);

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
 * FIREBASE ERROR MESSAGES
 * ============================================================ */

function getFirebaseErrorMessage(
  error: any
): string {
  const code =
    error?.code || '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Invalid email or password.';

    case 'auth/user-not-found':
      return 'No account was found with this email.';

    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';

    case 'auth/weak-password':
      return 'Password must be at least 6 characters long.';

    case 'auth/invalid-email':
      return 'Please enter a valid email address.';

    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';

    case 'auth/invalid-phone-number':
      return 'Please enter a valid phone number.';

    case 'auth/missing-phone-number':
      return 'Please enter your phone number.';

    case 'auth/quota-exceeded':
      return 'SMS quota exceeded. Please try again later.';

    case 'auth/code-expired':
      return 'The verification code has expired. Please request a new one.';

    case 'auth/invalid-verification-code':
      return 'The verification code is incorrect.';

    case 'auth/session-expired':
      return 'Your verification session has expired. Please try again.';

    case 'auth/invalid-app-credential':
      return 'The reCAPTCHA verification failed. Please complete the reCAPTCHA again.';

    case 'auth/billing-not-enabled':
      return 'Firebase billing is not enabled for this project.';

    case 'auth/multi-factor-auth-required':
      return 'Two-factor authentication is required.';

    case 'auth/requires-recent-login':
      return 'Please sign in again and try this operation.';

    case 'permission-denied':
      return 'You do not have permission to perform this operation.';

    case 'auth/operation-not-allowed':
      return 'This authentication method is not enabled in Firebase.';

    default:
      return (
        error?.message ||
        'Something went wrong. Please try again.'
      );
  }
}

/* ============================================================
 * AUTH SYSTEM UI
 * ============================================================ */

export default function AuthSystem() {
  const {
    user,
    login,
    completeLogin,
    register,
    logout,
  } = useAuth();

  /* ----------------------------------------------------------
   * STATE
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

  const [verificationId, setVerificationId] =
    useState('');

  const [pendingFirebaseUser, setPendingFirebaseUser] =
    useState<FirebaseUser | null>(null);

  const [mfaResolver, setMfaResolver] =
    useState<MultiFactorResolver | null>(
      null
    );

  /*
   * IMPORTANT:
   * This controls whether the reCAPTCHA container
   * is actually visible.
   *
   * Previously it was always visible whenever
   * step === 'otp', which caused the reCAPTCHA
   * to remain on screen after successful verification.
   */
  const [showRecaptcha, setShowRecaptcha] =
    useState(false);

  /* ----------------------------------------------------------
   * REFS
   * ---------------------------------------------------------- */

  const verificationIdRef =
    useRef('');

  const pendingFirebaseUserRef =
    useRef<FirebaseUser | null>(
      null
    );

  const mfaResolverRef =
    useRef<MultiFactorResolver | null>(
      null
    );

  const recaptchaVerifierRef =
    useRef<RecaptchaVerifier | null>(
      null
    );

  const smsRequestInProgressRef =
    useRef(false);

  /* ----------------------------------------------------------
   * STATE SYNC HELPERS
   * ---------------------------------------------------------- */

  const updateVerificationId = (
    id: string
  ) => {
    verificationIdRef.current =
      id;

    setVerificationId(id);
  };

  const updatePendingFirebaseUser = (
    firebaseUser: FirebaseUser | null
  ) => {
    pendingFirebaseUserRef.current =
      firebaseUser;

    setPendingFirebaseUser(
      firebaseUser
    );
  };

  const updateMfaResolver = (
    resolver: MultiFactorResolver | null
  ) => {
    mfaResolverRef.current =
      resolver;

    setMfaResolver(resolver);
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
   * CLEANUP RECAPTCHA
   *
   * THIS IS THE MAIN FIX.
   * ---------------------------------------------------------- */

  const clearRecaptcha = () => {
    try {
      if (
        recaptchaVerifierRef.current
      ) {
        recaptchaVerifierRef.current.clear();
      }
    } catch (error) {
      console.warn(
        'Could not clear reCAPTCHA:',
        error
      );
    }

    recaptchaVerifierRef.current =
      null;

    const container =
      document.getElementById(
        'voxforensics-recaptcha-container'
      );

    if (container) {
      container.innerHTML = '';
    }

    setShowRecaptcha(false);
  };

  /*
   * Clean up any active reCAPTCHA widget on unmount.
   */
  useEffect(() => {
    return () => {
      clearRecaptcha();
    };
  }, []);

  /* ----------------------------------------------------------
   * CREATE RECAPTCHA
   * ---------------------------------------------------------- */

  const createRecaptcha =
    async () => {
      /*
       * Clean up any existing verifier instance
       * before creating a fresh one to prevent
       * duplicate widget or expired token errors.
       */
      if (
        recaptchaVerifierRef.current
      ) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch (error) {
          console.warn(
            'Could not clear previous reCAPTCHA:',
            error
          );
        }

        recaptchaVerifierRef.current =
          null;
      }

      const container =
        document.getElementById(
          'voxforensics-recaptcha-container'
        );

      if (!container) {
        throw new Error(
          'reCAPTCHA container was not found.'
        );
      }

      /*
       * Wait for DOM paint before initializing
       * the Firebase reCAPTCHA instance.
       */
      await new Promise<void>(
        (resolve) => {
          window.requestAnimationFrame(
            () => resolve()
          );
        }
      );

      /*
       * Make sure the container is empty
       * before rendering a new Firebase widget.
       */
      container.innerHTML = '';

      const verifier =
        new RecaptchaVerifier(
          auth,
          'voxforensics-recaptcha-container',
          {
            size: 'invisible',

            callback: () => {
              console.log(
                'Invisible reCAPTCHA completed.'
              );
            },

            'expired-callback': () => {
              console.log(
                'reCAPTCHA expired.'
              );

              clearRecaptcha();

              setError(
                'reCAPTCHA verification expired. Please request a new code.'
              );
            },

            'error-callback': (err: any) => {
              console.error(
                'reCAPTCHA error:',
                err
              );

              clearRecaptcha();

              setError(
                'reCAPTCHA verification failed. Please try again.'
              );
            },
          }
        );

      recaptchaVerifierRef.current =
        verifier;

      await verifier.render();

      console.log(
        'Invisible reCAPTCHA rendered successfully.'
      );

      return verifier;
    };

  /* ----------------------------------------------------------
   * SEND MFA LOGIN CODE
   * ---------------------------------------------------------- */

  const sendMfaLoginCode =
    async (
      resolver: MultiFactorResolver
    ) => {
      if (
        smsRequestInProgressRef.current
      ) {
        return;
      }

      const phoneHint =
        resolver.hints.find(
          (hint: any) =>
            hint.factorId ===
            PhoneMultiFactorGenerator.FACTOR_ID
        );

      if (!phoneHint) {
        setError(
          'No phone-based two-factor authentication method was found.'
        );

        return;
      }

      smsRequestInProgressRef.current =
        true;

      setLoading(true);
      setError('');
      setMessage('');

      try {
        /*
         * Show OTP page and reCAPTCHA.
         */
        setStep('otp');
        setShowRecaptcha(true);

        await new Promise<void>(
          (resolve) => {
            window.requestAnimationFrame(
              () => resolve()
            );
          }
        );

        const verifier =
          await createRecaptcha();

        const provider =
          new PhoneAuthProvider(
            auth
          );

        const id =
          await provider.verifyPhoneNumber(
            {
              multiFactorHint:
                phoneHint,
              session:
                resolver.session,
            },
            verifier
          );

        /*
         * IMPORTANT:
         *
         * verifyPhoneNumber() only resolves after
         * Firebase has accepted the reCAPTCHA
         * and successfully requested the SMS.
         *
         * Therefore it is now safe to destroy
         * the reCAPTCHA widget.
         */
        updateVerificationId(id);

        clearRecaptcha();

        setOtp('');

        setResendCooldown(30);

        setMessage(
          'Verification code sent to your registered phone number.'
        );
      } catch (error: any) {
        console.error(
          'MFA SMS error:',
          error
        );

        setError(
          getFirebaseErrorMessage(
            error
          )
        );

        clearRecaptcha();
      } finally {
        smsRequestInProgressRef.current =
          false;

        setLoading(false);
      }
    };

  /* ----------------------------------------------------------
   * SEND FIRST-TIME MFA ENROLLMENT CODE
   * ---------------------------------------------------------- */

  const handleSendEnrollmentCode =
    async () => {
      setError('');
      setMessage('');

      if (!phoneNumber.trim()) {
        setError(
          'Please enter your phone number.'
        );

        return;
      }

      const firebaseUser =
        pendingFirebaseUserRef.current ||
        pendingFirebaseUser;

      if (!firebaseUser) {
        setError(
          'Your registration session has expired. Please register again.'
        );

        return;
      }

      if (
        !firebaseUser.emailVerified
      ) {
        setError(
          'Please verify your email before enabling two-factor authentication.'
        );

        return;
      }

      if (
        smsRequestInProgressRef.current
      ) {
        return;
      }

      smsRequestInProgressRef.current =
        true;

      setLoading(true);

      try {
        const normalizedPhone =
          normalizePhoneNumber(
            phoneNumber
          );

        /*
         * Show OTP screen and reCAPTCHA.
         */
        setStep('otp');
        setShowRecaptcha(true);

        await new Promise<void>(
          (resolve) => {
            window.requestAnimationFrame(
              () => resolve()
            );
          }
        );

        const verifier =
          await createRecaptcha();

        const session =
          await multiFactor(
            firebaseUser
          ).getSession();

        const provider =
          new PhoneAuthProvider(
            auth
          );

        const id =
          await provider.verifyPhoneNumber(
            {
              phoneNumber:
                normalizedPhone,
              session,
            },
            verifier
          );

        updateVerificationId(id);

        /*
         * MAIN FIX:
         * Remove the reCAPTCHA immediately
         * after Firebase successfully sends SMS.
         */
        clearRecaptcha();

        setOtp('');

        setResendCooldown(30);

        setMessage(
          'Verification code sent to your phone number.'
        );
      } catch (error: any) {
        console.error(
          'Enrollment SMS error:',
          error
        );

        setError(
          getFirebaseErrorMessage(
            error
          )
        );

        clearRecaptcha();
      } finally {
        smsRequestInProgressRef.current =
          false;

        setLoading(false);
      }
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

      if (
        mode === 'register' &&
        !phoneNumber.trim()
      ) {
        setError(
          'Please enter your phone number.'
        );

        return;
      }

      setLoading(true);

      try {
        if (mode === 'register') {
          await register(
            email,
            password,
            name,
            phoneNumber,
            referralCode
          );

          setStep(
            'verify-email'
          );

          setMessage(
            'Account created successfully. Please verify your email address.'
          );

          return;
        }

        /*
         * LOGIN
         */
        try {
          await login(
            email,
            password
          );

          /*
           * The auth state listener will
           * finish normal login if applicable.
           */
        } catch (authError: any) {
          if (
            authError?.code ===
            'auth/multi-factor-auth-required'
          ) {
            const resolver =
              getMultiFactorResolver(
                auth,
                authError
              );

            updateMfaResolver(
              resolver
            );

            await sendMfaLoginCode(
              resolver
            );

            return;
          }

          throw authError;
        }
      } catch (error: any) {
        console.error(
          'Authentication error:',
          error
        );

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
   * VERIFY EMAIL
   * ---------------------------------------------------------- */

  const handleEmailVerified =
    async () => {
      setError('');
      setMessage('');

      const firebaseUser =
        auth.currentUser;

      if (!firebaseUser) {
        setError(
          'Your registration session has expired. Please register again.'
        );

        return;
      }

      setLoading(true);

      try {
        await firebaseUser.reload();

        const refreshedUser =
          auth.currentUser;

        if (
          !refreshedUser?.emailVerified
        ) {
          setError(
            'Your email is not verified yet. Please verify it and try again.'
          );

          return;
        }

        updatePendingFirebaseUser(
          refreshedUser
        );

        setStep('phone');

        setMessage(
          'Email verified. Now enable two-factor authentication.'
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
   * RESEND EMAIL
   * ---------------------------------------------------------- */

  const handleResendEmail =
    async () => {
      setError('');
      setMessage('');

      const firebaseUser =
        auth.currentUser;

      if (!firebaseUser) {
        setError(
          'Your registration session has expired.'
        );

        return;
      }

      try {
        await sendEmailVerification(
          firebaseUser
        );

        setMessage(
          'Verification email sent again.'
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
   * VERIFY OTP
   * ---------------------------------------------------------- */

  const handleVerifyEnrollment =
    async () => {
      setError('');
      setMessage('');

      if (!otp.trim()) {
        setError(
          'Please enter the verification code.'
        );

        return;
      }

      const id =
        verificationIdRef.current ||
        verificationId;

      if (!id) {
        setError(
          'Verification session not found. Please request a new code.'
        );

        return;
      }

      setLoading(true);

      try {
        const credential =
          PhoneAuthProvider.credential(
            id,
            otp.trim()
          );

        const assertion =
          PhoneMultiFactorGenerator.assertion(
            credential
          );

        const currentResolver =
          mfaResolverRef.current ||
          mfaResolver;

        const firebaseUser =
          pendingFirebaseUserRef.current ||
          pendingFirebaseUser;

        /*
         * ----------------------------------------------------
         * FIRST-TIME MFA ENROLLMENT
         * ----------------------------------------------------
         */

        if (
          firebaseUser &&
          !currentResolver
        ) {
          await multiFactor(
            firebaseUser
          ).enroll(
            assertion,
            'VoxForensics Phone'
          );

          const normalizedPhone =
            normalizePhoneNumber(
              phoneNumber
            );

          await setDoc(
            doc(
              db,
              'users',
              firebaseUser.uid
            ),
            {
              phoneNumber:
                normalizedPhone,

              twoFactorEnabled:
                true,
            },
            {
              merge: true,
            }
          );

          await signOut(auth);

          clearRecaptcha();

          updateMfaResolver(null);

          updateVerificationId('');

          updatePendingFirebaseUser(
            null
          );

          setOtp('');

          setResendCooldown(0);

          setStep(
            'credentials'
          );

          setMode('login');

          setMessage(
            'Two-factor authentication enabled successfully. Please log in.'
          );

          return;
        }

        /*
         * ----------------------------------------------------
         * MFA LOGIN
         * ----------------------------------------------------
         */

        if (!currentResolver) {
          setError(
            'Two-factor authentication session was not found. Please log in again.'
          );

          return;
        }

        const signedInCredential =
          await currentResolver.resolveSignIn(
            assertion
          );

        const signedInUser =
          signedInCredential.user;

        console.log(
          'Firebase user after MFA:',
          signedInUser.uid
        );

        console.log(
          'MFA factors:',
          signedInUser.multiFactor
            ?.enrolledFactors?.length
        );

        const success =
          await completeLogin(
            signedInUser,
            true
          );

        if (!success) {
          setError(
            'Login could not be completed. Please try again.'
          );

          await signOut(auth);

          return;
        }

        /*
         * Clean everything immediately after
         * successful MFA authentication.
         */
        clearRecaptcha();

        updateMfaResolver(null);

        updateVerificationId('');

        updatePendingFirebaseUser(
          null
        );

        setOtp('');

        setResendCooldown(0);

        setStep(
          'credentials'
        );

        setMessage('');
      } catch (error: any) {
        console.error(
          'OTP verification error:',
          error
        );

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
   * RESEND OTP
   * ---------------------------------------------------------- */

  const handleResendCode =
    async () => {
      if (resendCooldown > 0) {
        return;
      }

      if (
        smsRequestInProgressRef.current
      ) {
        return;
      }

      const currentResolver =
        mfaResolverRef.current ||
        mfaResolver;

      const firebaseUser =
        pendingFirebaseUserRef.current ||
        pendingFirebaseUser;

      setError('');
      setMessage('');

      smsRequestInProgressRef.current =
        true;

      setLoading(true);

      try {
        /*
         * ----------------------------------------------------
         * MFA LOGIN RESEND
         * ----------------------------------------------------
         */

        if (currentResolver) {
          const phoneHint =
            currentResolver.hints.find(
              (hint: any) =>
                hint.factorId ===
                PhoneMultiFactorGenerator.FACTOR_ID
            );

          if (!phoneHint) {
            setError(
              'No phone-based two-factor authentication method was found.'
            );

            return;
          }

          /*
           * Show a fresh reCAPTCHA.
           */
          setShowRecaptcha(true);

          await new Promise<void>(
            (resolve) => {
              window.requestAnimationFrame(
                () => resolve()
              );
            }
          );

          const verifier =
            await createRecaptcha();

          const provider =
            new PhoneAuthProvider(
              auth
            );

          const id =
            await provider.verifyPhoneNumber(
              {
                multiFactorHint:
                  phoneHint,

                session:
                  currentResolver.session,
              },
              verifier
            );

          updateVerificationId(id);

          /*
           * Hide the reCAPTCHA after
           * successful SMS request.
           */
          clearRecaptcha();

          setOtp('');

          setResendCooldown(30);

          setMessage(
            'A new verification code has been sent.'
          );

          return;
        }

        /*
         * ----------------------------------------------------
         * FIRST-TIME MFA ENROLLMENT RESEND
         * ----------------------------------------------------
         */

        if (firebaseUser) {
          const normalizedPhone =
            normalizePhoneNumber(
              phoneNumber
            );

          setShowRecaptcha(true);

          await new Promise<void>(
            (resolve) => {
              window.requestAnimationFrame(
                () => resolve()
              );
            }
          );

          const verifier =
            await createRecaptcha();

          const session =
            await multiFactor(
              firebaseUser
            ).getSession();

          const provider =
            new PhoneAuthProvider(
              auth
            );

          const id =
            await provider.verifyPhoneNumber(
              {
                phoneNumber:
                  normalizedPhone,

                session,
              },
              verifier
            );

          updateVerificationId(id);

          /*
           * Hide after successful SMS request.
           */
          clearRecaptcha();

          setOtp('');

          setResendCooldown(30);

          setMessage(
            'A new verification code has been sent.'
          );

          return;
        }

        setError(
          'Verification session not found. Please start again.'
        );
      } catch (error: any) {
        console.error(
          'Resend OTP error:',
          error
        );

        setError(
          getFirebaseErrorMessage(
            error
          )
        );

        clearRecaptcha();
      } finally {
        smsRequestInProgressRef.current =
          false;

        setLoading(false);
      }
    };

  /* ----------------------------------------------------------
   * SWITCH LOGIN / REGISTER
   * ---------------------------------------------------------- */

  const switchMode = (
    nextMode: AuthMode
  ) => {
    clearRecaptcha();

    setMode(nextMode);

    setStep(
      'credentials'
    );

    setError('');
    setMessage('');

    setOtp('');

    updateVerificationId('');

    updateMfaResolver(null);

    updatePendingFirebaseUser(
      null
    );
  };

  /* ----------------------------------------------------------
   * BACK TO CREDENTIALS
   * ---------------------------------------------------------- */

  const handleBack = () => {
    clearRecaptcha();

    setError('');
    setMessage('');

    setOtp('');

    updateVerificationId('');

    updateMfaResolver(null);

    updatePendingFirebaseUser(
      null
    );

    setStep(
      'credentials'
    );
  };

  /* ----------------------------------------------------------
   * CANCEL OTP
   * ---------------------------------------------------------- */

  const handleCancelOtp = () => {
    clearRecaptcha();

    setOtp('');

    setError('');

    setMessage('');

    updateVerificationId('');

    updateMfaResolver(null);

    setStep(
      'credentials'
    );
  };

  /* ==========================================================
   * LOGGED-IN CARD
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
          background:
            'rgba(5, 9, 20, 0.96)',
          border:
            '1px solid rgba(0, 212, 255, 0.55)',
          borderRadius: '16px',
          boxShadow:
            '0 0 35px rgba(0, 212, 255, 0.10)',
          color: '#ffffff',
        }}
      >
        <div
          style={{
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: '13px',
              color: '#00d4ff',
              fontWeight: 700,
              letterSpacing:
                '0.08em',
              textTransform:
                'uppercase',
              marginBottom: '8px',
            }}
          >
            Welcome back
          </div>

          <h2
            style={{
              margin:
                '0 0 8px',
              fontSize: '25px',
              color: '#ffffff',
            }}
          >
            {user.name}
          </h2>

          <p
            style={{
              margin:
                '0 0 22px',
              color: '#9fb0c8',
              fontSize: '14px',
            }}
          >
            {user.email}
          </p>

          <button
            type="button"
            onClick={logout}
            style={{
              width: '100%',
              padding:
                '13px 18px',
              borderRadius:
                '10px',
              border:
                '1px solid rgba(0, 212, 255, 0.3)',
              background:
                'linear-gradient(135deg, rgba(0,212,255,0.14), rgba(168,85,247,0.14))',
              color: '#ffffff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  /* ==========================================================
   * MAIN AUTH CARD
   * ========================================================== */

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '520px',
        margin: '0 auto',
        padding: '28px',
        boxSizing: 'border-box',
        background:
          'rgba(5, 9, 20, 0.96)',
        border:
          '1px solid rgba(0, 212, 255, 0.55)',
        borderRadius: '16px',
        boxShadow:
          '0 0 35px rgba(0, 212, 255, 0.10), 0 0 70px rgba(168, 85, 247, 0.06)',
        color: '#ffffff',
      }}
    >
      {/* ======================================================
          HEADER
          ====================================================== */}

      <div
        style={{
          textAlign: 'center',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            fontSize: '30px',
            fontWeight: 800,
            letterSpacing:
              '-0.03em',
            background:
              'linear-gradient(90deg, #00d4ff, #a855f7)',
            WebkitBackgroundClip:
              'text',
            WebkitTextFillColor:
              'transparent',
            marginBottom: '6px',
          }}
        >
          VoxForensics
        </div>

        <div
          style={{
            fontSize: '17px',
            fontWeight: 700,
            color: '#ffffff',
            marginBottom: '5px',
          }}
        >
          {mode === 'login'
            ? 'Secure Login'
            : 'Create Account'}
        </div>

        <div
          style={{
            color: '#8292aa',
            fontSize: '13px',
          }}
        >
          AI-Based Deepfake Audio Detection System
        </div>
      </div>

      {/* ======================================================
          ERROR
          ====================================================== */}

      {error && (
        <div
          style={{
            marginBottom: '18px',
            padding: '12px 14px',
            borderRadius: '10px',
            background:
              'rgba(255, 70, 90, 0.08)',
            border:
              '1px solid rgba(255, 70, 90, 0.25)',
            color: '#ff9ba8',
            fontSize: '13px',
            lineHeight: 1.5,
          }}
        >
          {error}
        </div>
      )}

      {/* ======================================================
          MESSAGE
          ====================================================== */}

      {message && (
        <div
          style={{
            marginBottom: '18px',
            padding: '12px 14px',
            borderRadius: '10px',
            background:
              'rgba(0, 255, 136, 0.06)',
            border:
              '1px solid rgba(0, 255, 136, 0.22)',
            color: '#8dffc1',
            fontSize: '13px',
            lineHeight: 1.5,
          }}
        >
          {message}
        </div>
      )}

      {/* ======================================================
          CREDENTIALS
          ====================================================== */}

      {step ===
        'credentials' && (
        <form
          onSubmit={
            handleCredentialsSubmit
          }
        >
          {mode === 'register' && (
            <div
              style={{
                marginBottom:
                  '15px',
              }}
            >
              <label
                style={{
                  display:
                    'block',
                  marginBottom:
                    '7px',
                  fontSize:
                    '13px',
                  color:
                    '#b8c6d9',
                }}
              >
                Full Name
              </label>

              <input
                type="text"
                value={name}
                onChange={(event) =>
                  setName(
                    event.target
                      .value
                  )
                }
                placeholder="Enter your full name"
                style={{
                  width:
                    '100%',
                  boxSizing:
                    'border-box',
                  padding:
                    '13px 14px',
                  borderRadius:
                    '10px',
                  border:
                    '1px solid rgba(0, 212, 255, 0.18)',
                  background:
                    'rgba(13, 24, 48, 0.85)',
                  color:
                    '#ffffff',
                  outline:
                    'none',
                  fontSize:
                    '14px',
                }}
              />
            </div>
          )}

          <div
            style={{
              marginBottom:
                '15px',
            }}
          >
            <label
              style={{
                display:
                  'block',
                marginBottom:
                  '7px',
                fontSize:
                  '13px',
                color:
                  '#b8c6d9',
              }}
            >
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target
                    .value
                )
              }
              placeholder="Enter your email"
              autoComplete="email"
              style={{
                width:
                  '100%',
                boxSizing:
                  'border-box',
                padding:
                  '13px 14px',
                borderRadius:
                  '10px',
                border:
                  '1px solid rgba(0, 212, 255, 0.18)',
                background:
                  'rgba(13, 24, 48, 0.85)',
                color:
                  '#ffffff',
                outline:
                  'none',
                fontSize:
                  '14px',
              }}
            />
          </div>

          <div
            style={{
              marginBottom:
                '15px',
            }}
          >
            <label
              style={{
                display:
                  'block',
                marginBottom:
                  '7px',
                fontSize:
                  '13px',
                color:
                  '#b8c6d9',
              }}
            >
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target
                    .value
                )
              }
              placeholder="Enter your password"
              autoComplete={
                mode === 'login'
                  ? 'current-password'
                  : 'new-password'
              }
              style={{
                width:
                  '100%',
                boxSizing:
                  'border-box',
                padding:
                  '13px 14px',
                borderRadius:
                  '10px',
                border:
                  '1px solid rgba(0, 212, 255, 0.18)',
                background:
                  'rgba(13, 24, 48, 0.85)',
                color:
                  '#ffffff',
                outline:
                  'none',
                fontSize:
                  '14px',
              }}
            />
          </div>

          {mode === 'register' && (
            <>
              <div
                style={{
                  marginBottom:
                    '15px',
                }}
              >
                <label
                  style={{
                    display:
                      'block',
                    marginBottom:
                      '7px',
                    fontSize:
                      '13px',
                    color:
                      '#b8c6d9',
                  }}
                >
                  Phone Number
                </label>

                <input
                  type="tel"
                  value={
                    phoneNumber
                  }
                  onChange={(
                    event
                  ) =>
                    setPhoneNumber(
                      event.target
                        .value
                    )
                  }
                  placeholder="+91 9876543210"
                  autoComplete="tel"
                  style={{
                    width:
                      '100%',
                    boxSizing:
                      'border-box',
                    padding:
                      '13px 14px',
                    borderRadius:
                      '10px',
                    border:
                      '1px solid rgba(0, 212, 255, 0.18)',
                    background:
                      'rgba(13, 24, 48, 0.85)',
                    color:
                      '#ffffff',
                    outline:
                      'none',
                    fontSize:
                      '14px',
                  }}
                />
              </div>

              <div
                style={{
                  marginBottom:
                    '18px',
                }}
              >
                <label
                  style={{
                    display:
                      'block',
                    marginBottom:
                      '7px',
                    fontSize:
                      '13px',
                    color:
                      '#b8c6d9',
                  }}
                >
                  Referral Code{' '}
                  <span
                    style={{
                      color:
                        '#65758c',
                    }}
                  >
                    (Optional)
                  </span>
                </label>

                <input
                  type="text"
                  value={
                    referralCode
                  }
                  onChange={(
                    event
                  ) =>
                    setReferralCode(
                      event.target
                        .value
                    )
                  }
                  placeholder="VOX-XXXXXX"
                  style={{
                    width:
                      '100%',
                    boxSizing:
                      'border-box',
                    padding:
                      '13px 14px',
                    borderRadius:
                      '10px',
                    border:
                      '1px solid rgba(0, 212, 255, 0.18)',
                    background:
                      'rgba(13, 24, 48, 0.85)',
                    color:
                      '#ffffff',
                    outline:
                      'none',
                    fontSize:
                      '14px',
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
              padding:
                '13px 18px',
              borderRadius:
                '10px',
              border:
                '1px solid rgba(0, 212, 255, 0.3)',
              background:
                'linear-gradient(135deg, rgba(0,212,255,0.20), rgba(168,85,247,0.20))',
              color:
                '#ffffff',
              fontWeight: 800,
              cursor:
                loading
                  ? 'not-allowed'
                  : 'pointer',
              opacity:
                loading
                  ? 0.65
                  : 1,
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
              textAlign:
                'center',
              marginTop:
                '18px',
              color:
                '#8292aa',
              fontSize:
                '13px',
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
                border:
                  'none',
                background:
                  'transparent',
                color:
                  '#00d4ff',
                fontWeight:
                  700,
                cursor:
                  'pointer',
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
          EMAIL VERIFICATION
          ====================================================== */}

      {step ===
        'verify-email' && (
        <div
          style={{
            textAlign:
              'center',
          }}
        >
          <div
            style={{
              fontSize:
                '46px',
              marginBottom:
                '15px',
            }}
          >
            ✉️
          </div>

          <h3
            style={{
              margin:
                '0 0 10px',
              color:
                '#ffffff',
              fontSize:
                '21px',
            }}
          >
            Verify Your Email
          </h3>

          <p
            style={{
              margin:
                '0 0 22px',
              color:
                '#8c9bb1',
              fontSize:
                '13px',
              lineHeight:
                1.6,
            }}
          >
            We've sent a verification
            link to{' '}
            <strong
              style={{
                color:
                  '#bcefff',
              }}
            >
              {email}
            </strong>
            . Verify your email before
            continuing.
          </p>

          <button
            type="button"
            onClick={
              handleEmailVerified
            }
            disabled={loading}
            style={{
              width: '100%',
              padding:
                '13px 18px',
              borderRadius:
                '10px',
              border:
                '1px solid rgba(0, 212, 255, 0.3)',
              background:
                'linear-gradient(135deg, rgba(0,212,255,0.20), rgba(168,85,247,0.20))',
              color:
                '#ffffff',
              fontWeight: 800,
              cursor:
                loading
                  ? 'not-allowed'
                  : 'pointer',
              opacity:
                loading
                  ? 0.65
                  : 1,
            }}
          >
            {loading
              ? 'Checking...'
              : 'I Have Verified My Email'}
          </button>

          <button
            type="button"
            onClick={
              handleResendEmail
            }
            style={{
              width:
                '100%',
              marginTop:
                '10px',
              padding:
                '12px 18px',
              borderRadius:
                '10px',
              border:
                '1px solid rgba(0, 212, 255, 0.22)',
              background:
                'rgba(13, 24, 48, 0.7)',
              color:
                '#9feaff',
              fontWeight:
                700,
              cursor:
                'pointer',
            }}
          >
            Resend Verification Email
          </button>

          <button
            type="button"
            onClick={
              handleBack
            }
            style={{
              border:
                'none',
              background:
                'transparent',
              color:
                '#00d4ff',
              fontWeight:
                700,
              cursor:
                'pointer',
              padding:
                '12px 0 0',
            }}
          >
            Back
          </button>
        </div>
      )}

      {/* ======================================================
          PHONE ENROLLMENT
          ====================================================== */}

      {step ===
        'phone' && (
        <div>
          <div
            style={{
              textAlign:
                'center',
              marginBottom:
                '20px',
            }}
          >
            <div
              style={{
                fontSize:
                  '42px',
                marginBottom:
                  '10px',
              }}
            >
              📱
            </div>

            <h3
              style={{
                margin:
                  '0 0 8px',
                fontSize:
                  '21px',
                color:
                  '#ffffff',
              }}
            >
              Enable Two-Factor Authentication
            </h3>

            <p
              style={{
                margin:
                  0,
                color:
                  '#8c9bb1',
                fontSize:
                  '13px',
                lineHeight:
                  1.6,
              }}
            >
              Your phone number will be used
              to secure your VoxForensics
              account.
            </p>
          </div>

          <div
            style={{
              marginBottom:
                '15px',
            }}
          >
            <label
              style={{
                display:
                  'block',
                marginBottom:
                  '7px',
                fontSize:
                  '13px',
                color:
                  '#b8c6d9',
              }}
            >
              Phone Number
            </label>

            <input
              type="tel"
              value={
                phoneNumber
              }
              onChange={(event) =>
                setPhoneNumber(
                  event.target
                    .value
                )
              }
              placeholder="+91 9876543210"
              style={{
                width:
                  '100%',
                boxSizing:
                  'border-box',
                padding:
                  '13px 14px',
                borderRadius:
                  '10px',
                border:
                  '1px solid rgba(0, 212, 255, 0.18)',
                background:
                  'rgba(13, 24, 48, 0.85)',
                color:
                  '#ffffff',
                outline:
                  'none',
                fontSize:
                  '14px',
              }}
            />
          </div>

          <button
            type="button"
            onClick={
              handleSendEnrollmentCode
            }
            disabled={loading}
            style={{
              width:
                '100%',
              padding:
                '13px 18px',
              borderRadius:
                '10px',
              border:
                '1px solid rgba(0, 212, 255, 0.3)',
              background:
                'linear-gradient(135deg, rgba(0,212,255,0.20), rgba(168,85,247,0.20))',
              color:
                '#ffffff',
              fontWeight:
                800,
              cursor:
                loading
                  ? 'not-allowed'
                  : 'pointer',
              opacity:
                loading
                  ? 0.65
                  : 1,
            }}
          >
            {loading
              ? 'Sending...'
              : 'Send Verification Code'}
          </button>

          <button
            type="button"
            onClick={
              handleBack
            }
            style={{
              width:
                '100%',
              marginTop:
                '10px',
              padding:
                '12px 18px',
              borderRadius:
                '10px',
              border:
                '1px solid rgba(0, 212, 255, 0.22)',
              background:
                'rgba(13, 24, 48, 0.7)',
              color:
                '#9feaff',
              fontWeight:
                700,
              cursor:
                'pointer',
            }}
          >
            Back
          </button>
        </div>
      )}

      {/* ======================================================
          OTP
          ====================================================== */}

      {step === 'otp' && (
        <div>
          <div
            style={{
              textAlign:
                'center',
              marginBottom:
                '20px',
            }}
          >
            <div
              style={{
                fontSize:
                  '42px',
                marginBottom:
                  '10px',
              }}
            >
              🔐
            </div>

            <h3
              style={{
                margin:
                  '0 0 8px',
                fontSize:
                  '21px',
                color:
                  '#ffffff',
              }}
            >
              Enter Verification Code
            </h3>

            <p
              style={{
                margin:
                  0,
                color:
                  '#8c9bb1',
                fontSize:
                  '13px',
                lineHeight:
                  1.6,
              }}
            >
              Enter the 6-digit verification
              code sent to your phone.
            </p>
          </div>

          <div
            style={{
              marginBottom:
                '15px',
            }}
          >
            <label
              style={{
                display:
                  'block',
                marginBottom:
                  '7px',
                fontSize:
                  '13px',
                color:
                  '#b8c6d9',
              }}
            >
              Verification Code
            </label>

            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(event) =>
                setOtp(
                  event.target
                    .value
                    .replace(
                      /\D/g,
                      ''
                    )
                )
              }
              placeholder="Enter 6-digit code"
              autoComplete="one-time-code"
              style={{
                width:
                  '100%',
                boxSizing:
                  'border-box',
                padding:
                  '13px 14px',
                borderRadius:
                  '10px',
                border:
                  '1px solid rgba(0, 212, 255, 0.18)',
                background:
                  'rgba(13, 24, 48, 0.85)',
                color:
                  '#ffffff',
                outline:
                  'none',
                fontSize:
                  '18px',
                letterSpacing:
                  '0.25em',
                textAlign:
                  'center',
              }}
            />
          </div>

          <button
            type="button"
            onClick={
              handleVerifyEnrollment
            }
            disabled={
              loading ||
              otp.length !== 6
            }
            style={{
              width:
                '100%',
              padding:
                '13px 18px',
              borderRadius:
                '10px',
              border:
                '1px solid rgba(0, 212, 255, 0.3)',
              background:
                'linear-gradient(135deg, rgba(0,212,255,0.20), rgba(168,85,247,0.20))',
              color:
                '#ffffff',
              fontWeight:
                800,
              cursor:
                loading ||
                otp.length !==
                  6
                  ? 'not-allowed'
                  : 'pointer',
              opacity:
                loading ||
                otp.length !==
                  6
                  ? 0.55
                  : 1,
            }}
          >
            {loading
              ? 'Verifying...'
              : 'Verify Code'}
          </button>

          <button
            type="button"
            onClick={
              handleResendCode
            }
            disabled={
              loading ||
              resendCooldown > 0
            }
            style={{
              width:
                '100%',
              marginTop:
                '10px',
              padding:
                '12px 18px',
              borderRadius:
                '10px',
              border:
                '1px solid rgba(0, 212, 255, 0.22)',
              background:
                'rgba(13, 24, 48, 0.7)',
              color:
                '#9feaff',
              fontWeight:
                700,
              cursor:
                loading ||
                resendCooldown >
                  0
                  ? 'not-allowed'
                  : 'pointer',
              opacity:
                loading ||
                resendCooldown >
                  0
                  ? 0.55
                  : 1,
            }}
          >
            {resendCooldown >
            0
              ? `Resend Code (${resendCooldown}s)`
              : 'Resend Code'}
          </button>

          <button
            type="button"
            onClick={
              handleCancelOtp
            }
            style={{
              border:
                'none',
              background:
                'transparent',
              color:
                '#00d4ff',
              fontWeight:
                700,
              cursor:
                'pointer',
              padding:
                '12px 0 0',
              width:
                '100%',
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* ======================================================
          RECAPTCHA CONTAINER

          IMPORTANT:
          It is NOT visible just because we are on the
          OTP screen.

          It is visible only while Firebase is requesting
          the SMS verification code.

          Once verifyPhoneNumber() succeeds,
          clearRecaptcha() hides and destroys it.
          ====================================================== */}

      <div
        id="voxforensics-recaptcha-container"
        style={{
          display: 'flex',
          justifyContent: 'center',
        }}
      />
    </div>
  );
}