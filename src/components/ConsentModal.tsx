import {
  useState,
  useEffect,
  createContext,
  useContext,
  ReactNode,
  useRef,
} from 'react';

import { useAuth } from './AuthSystem';

interface ConsentContextType {
  hasConsented: boolean;
  giveConsent: () => void;
  revokeConsent: () => void;
}

const ConsentContext =
  createContext<ConsentContextType | null>(null);

export function useConsent() {
  const context = useContext(ConsentContext);

  if (!context) {
    throw new Error(
      'useConsent must be used within ConsentProvider'
    );
  }

  return context;
}

export function ConsentProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = useAuth();

  const [hasConsented, setHasConsented] =
    useState(false);

  /*
   * Keeps track of the user who was previously logged in.
   *
   * This allows us to:
   *
   * - Keep consent after page refresh
   * - Remove consent when the user logs out
   * - Show consent again when the user logs in again
   */
  const previousUserIdRef =
    useRef<string | null>(null);

  useEffect(() => {
    /*
     * User is logged out.
     *
     * Remove the previous user's consent so that
     * consent is requested again on the next login.
     */
    if (!user) {
      if (previousUserIdRef.current) {
        sessionStorage.removeItem(
          `voxforensics_consent_${previousUserIdRef.current}`
        );
      }

      previousUserIdRef.current = null;
      setHasConsented(false);

      return;
    }

    /*
     * Admin users bypass the consent modal.
     */
    if (user.role === 'admin') {
      setHasConsented(true);
      return;
    }

    const consentKey =
      `voxforensics_consent_${user.id}`;

    const storedConsent =
      sessionStorage.getItem(consentKey);

    /*
     * Remember the currently logged-in user.
     */
    previousUserIdRef.current = user.id;

    /*
     * If consent was accepted earlier during
     * this browser session, do not show the modal.
     *
     * sessionStorage survives page refreshes.
     */
    setHasConsented(
      storedConsent === 'true'
    );
  }, [user?.id, user?.role]);

  const giveConsent = () => {
    if (!user) {
      return;
    }

    const consentKey =
      `voxforensics_consent_${user.id}`;

    sessionStorage.setItem(
      consentKey,
      'true'
    );

    setHasConsented(true);
  };

  const revokeConsent = () => {
    if (user) {
      const consentKey =
        `voxforensics_consent_${user.id}`;

      sessionStorage.removeItem(
        consentKey
      );
    }

    setHasConsented(false);
  };

  return (
    <ConsentContext.Provider
      value={{
        hasConsented,
        giveConsent,
        revokeConsent,
      }}
    >
      {children}

      {user && user.role !== 'admin' && !hasConsented && (
        <ConsentModal
          onAccept={giveConsent}
        />
      )}
    </ConsentContext.Provider>
  );
}

interface ConsentModalProps {
  onAccept: () => void;
}

function ConsentModal({
  onAccept,
}: ConsentModalProps) {
  const [agreed, setAgreed] =
    useState(false);

  const handleAccept = () => {
    if (!agreed) {
      return;
    }

    onAccept();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto glass-panel border border-[#1e3a5f] rounded-2xl shadow-2xl">

        {/* Header */}
        <div className="p-6 sm:p-8 border-b border-[#1a2a4a]">
          <div className="flex items-start gap-4">

            <div className="w-12 h-12 shrink-0 rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#a855f7] flex items-center justify-center">
              <i className="fa-solid fa-shield-halved text-white text-xl"></i>
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
                Privacy & Consent
              </h2>

              <p className="text-sm text-gray-400 leading-relaxed">
                Before using VoxForensics, please review and accept
                the following terms regarding audio analysis and data
                handling.
              </p>
            </div>

          </div>
        </div>

        {/* Consent Content */}
        <div className="p-6 sm:p-8 space-y-6">

          {/* Audio Processing */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">

              <div className="w-8 h-8 rounded-lg bg-[#00d4ff]/10 flex items-center justify-center">
                <i className="fa-solid fa-microphone-lines text-[#00d4ff] text-sm"></i>
              </div>

              <h3 className="text-base font-semibold text-white">
                Audio Processing
              </h3>

            </div>

            <p className="text-sm text-gray-400 leading-relaxed pl-11">
              Audio files uploaded or recorded through VoxForensics
              may be processed by the application to detect signs of
              synthetic or manipulated speech.
            </p>
          </div>

          {/* Analysis */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">

              <div className="w-8 h-8 rounded-lg bg-[#a855f7]/10 flex items-center justify-center">
                <i className="fa-solid fa-brain text-[#a855f7] text-sm"></i>
              </div>

              <h3 className="text-base font-semibold text-white">
                AI Analysis
              </h3>

            </div>

            <p className="text-sm text-gray-400 leading-relaxed pl-11">
              The system analyzes characteristics of the supplied
              audio and provides an estimated classification. Results
              should be treated as analytical assistance rather than
              absolute proof that an audio recording is genuine or
              manipulated.
            </p>
          </div>

          {/* Data Storage */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">

              <div className="w-8 h-8 rounded-lg bg-[#00d4ff]/10 flex items-center justify-center">
                <i className="fa-solid fa-database text-[#00d4ff] text-sm"></i>
              </div>

              <h3 className="text-base font-semibold text-white">
                Data & Storage
              </h3>

            </div>

            <p className="text-sm text-gray-400 leading-relaxed pl-11">
              Depending on the application's configuration, scan
              information and analysis results may be stored locally
              or on connected services for features such as scan
              history and account management.
            </p>
          </div>

          {/* Microphone */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">

              <div className="w-8 h-8 rounded-lg bg-[#a855f7]/10 flex items-center justify-center">
                <i className="fa-solid fa-microphone text-[#a855f7] text-sm"></i>
              </div>

              <h3 className="text-base font-semibold text-white">
                Microphone Access
              </h3>

            </div>

            <p className="text-sm text-gray-400 leading-relaxed pl-11">
              If you use the recording feature, your browser may ask
              for permission to access your microphone. Microphone
              access is only required when you choose to record audio.
            </p>
          </div>

          {/* User Responsibility */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">

              <div className="w-8 h-8 rounded-lg bg-[#00d4ff]/10 flex items-center justify-center">
                <i className="fa-solid fa-circle-info text-[#00d4ff] text-sm"></i>
              </div>

              <h3 className="text-base font-semibold text-white">
                User Responsibility
              </h3>

            </div>

            <p className="text-sm text-gray-400 leading-relaxed pl-11">
              Only upload or record audio that you have the right and
              permission to analyze. Do not use VoxForensics to
              process private or confidential recordings without the
              appropriate authorization.
            </p>
          </div>

          {/* Agreement */}
          <div className="pt-4 border-t border-[#1a2a4a]">

            <label className="flex items-start gap-3 cursor-pointer group">

              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) =>
                  setAgreed(e.target.checked)
                }
                className="mt-1 w-4 h-4 accent-[#00d4ff] cursor-pointer"
              />

              <span className="text-sm text-gray-300 leading-relaxed group-hover:text-white transition">
                I have read and understood the information above. I
                consent to the processing of audio and related data as
                described and agree to use VoxForensics responsibly.
              </span>

            </label>

          </div>
        </div>

        {/* Footer */}
        <div className="p-6 sm:p-8 pt-0">

          <button
            onClick={handleAccept}
            disabled={!agreed}
            className={`w-full py-3.5 rounded-xl font-semibold transition-all ${
              agreed
                ? 'neon-btn neon-btn-primary text-white cursor-pointer'
                : 'bg-[#111c32] text-gray-500 border border-[#1a2a4a] cursor-not-allowed'
            }`}
          >
            <i className="fa-solid fa-check mr-2"></i>
            I Agree & Continue
          </button>

          <p className="text-[11px] text-gray-500 text-center mt-3">
            Consent is required each time you log in to VoxForensics.
          </p>

        </div>
      </div>
    </div>
  );
}

export default ConsentModal;