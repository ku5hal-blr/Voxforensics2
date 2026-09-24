import { useState, useEffect } from 'react';
import { User } from './AuthSystem';
import { getUserScanHistory } from '../services/history';
import { ScanRecord } from '../utils/analysis';

export default function UserDashboard({ currentUser, onLogout, onBack }: { 
  currentUser: User; 
  onLogout: () => void;
  onBack: () => void;
}) {
  const [scanHistory, setScanHistory] = useState<ScanRecord[]>([]);
  const [referrals, setReferrals] = useState<any[]>([]);
  const is2FAEnabled = Boolean(currentUser.twoFactorEnabled);

  useEffect(() => {
    let isCancelled = false;

    // Immediately clear previous scan history to avoid cross-account data lingering
    setScanHistory([]);

    // Query scans strictly belonging to this authenticated user
    getUserScanHistory(currentUser.id)
      .then((records) => {
        if (!isCancelled) {
          // Extra safety check: ensure record belongs to this currentUser.id
          const userRecords = records.filter(
            (s) => !s.userId || s.userId === currentUser.id
          );
          setScanHistory(userRecords);
        }
      })
      .catch((error) => {
        console.warn('Failed to load user scan history for dashboard:', error);
        if (!isCancelled) {
          setScanHistory([]);
        }
      });

    // Referrals namespaced by user ID
    try {
      const userReferrals = JSON.parse(
        localStorage.getItem(`referrals_${currentUser.id}`) || '[]'
      );
      setReferrals(userReferrals);
    } catch {
      setReferrals([]);
    }

    return () => {
      isCancelled = true;
    };
  }, [currentUser.id]);

  const copyReferralCode = () => {
    navigator.clipboard.writeText(currentUser.referralCode);
    alert('Referral code copied to clipboard!');
  };

  const deepfakesCount = scanHistory.filter(
    (s) => s.result?.isDeepfake || s.result?.verdict === 'AI-Generated'
  ).length;

  return (
    <div className="min-h-screen" style={{ background: '#030712' }}>
      {/* Header */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white">👤 My Dashboard</h1>
            <span className="px-2 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-xs text-cyan-300">
              {currentUser.role}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="neon-btn text-xs py-2 px-4">
              🔬 Back to App
            </button>
            <button onClick={onLogout} className="neon-btn neon-btn-danger text-xs py-2 px-4">
              🚪 Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome Card */}
        <div className="glass-card p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-white font-bold text-2xl">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Welcome, {currentUser.name}!</h2>
              <p className="text-sm text-gray-400">{currentUser.email}</p>
              <p className="text-xs text-gray-500 mt-1">
                Member since {new Date(currentUser.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="glass-card p-6">
            <p className="text-xs text-gray-400 mb-1">Total Scans</p>
            <p className="text-3xl font-bold text-cyan-400">{scanHistory.length}</p>
            <p className="text-xs text-gray-500 mt-2">Audio analyses performed</p>
          </div>
          <div className="glass-card p-6">
            <p className="text-xs text-gray-400 mb-1">Deepfakes Detected</p>
            <p className="text-3xl font-bold text-red-400">
              {deepfakesCount}
            </p>
            <p className="text-xs text-gray-500 mt-2">AI-generated audio found</p>
          </div>
          <div className="glass-card p-6">
            <p className="text-xs text-gray-400 mb-1">Referrals</p>
            <p className="text-3xl font-bold text-yellow-400">{referrals.length}</p>
            <p className="text-xs text-gray-500 mt-2">Users you've invited</p>
          </div>
        </div>

        {/* Referral Program */}
        <div className="glass-card p-6 mb-6">
          <h3 className="text-lg font-bold text-white mb-4">🎁 Referral Program</h3>
          <p className="text-sm text-gray-400 mb-4">
            Share your referral code with friends and help them get started with VoxForensics!
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1 p-3 rounded-xl bg-black/40 border border-white/10">
              <p className="text-xs text-gray-500 mb-1">Your Referral Code</p>
              <p className="text-lg font-mono font-bold text-cyan-400">{currentUser.referralCode}</p>
            </div>
            <button onClick={copyReferralCode} className="neon-btn py-3 px-6">
              📋 Copy
            </button>
          </div>
          {referrals.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-gray-400 mb-2">Your Referrals:</p>
              <div className="space-y-2">
                {referrals.map((ref, idx) => (
                  <div key={idx} className="p-2 rounded-lg bg-white/5 text-xs text-gray-300">
                    User {ref.userId} joined on {new Date(ref.date).toLocaleDateString()}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Security Settings */}
        <div className="glass-card p-6 mb-6">
          <h3 className="text-lg font-bold text-white mb-4">🔐 Security</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
              <div>
                <p className="text-sm font-medium text-white">Two-Factor Authentication</p>
                <p className="text-xs text-gray-400">
                  {is2FAEnabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs ${
                  is2FAEnabled 
                    ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                    : 'bg-red-500/20 text-red-300 border border-red-500/30'
                }`}>
                  {is2FAEnabled ? '✅ Active (Email 2FA)' : '❌ Inactive'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Scan History */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold text-white mb-4">📋 Recent Scans</h3>
          {scanHistory.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              No scans yet. Start analyzing audio files!
            </p>
          ) : (
            <div className="space-y-3">
              {scanHistory.slice(0, 5).map((scan, idx) => {
                const isDeepfake =
                  scan.result?.isDeepfake ??
                  scan.result?.verdict === 'AI-Generated';
                const confidenceVal = scan.result?.confidence ?? 0;
                const displayConfidence =
                  confidenceVal <= 1
                    ? (confidenceVal * 100).toFixed(1)
                    : confidenceVal.toFixed(1);

                return (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-3">
                      <span className={`w-3 h-3 rounded-full ${
                        isDeepfake ? 'bg-red-500' : 'bg-green-500'
                      }`}></span>
                      <div>
                        <p className="text-sm font-medium text-white">{scan.filename}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(scan.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${
                        isDeepfake ? 'text-red-400' : 'text-green-400'
                      }`}>
                        {isDeepfake ? 'Deepfake' : 'Real'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {displayConfidence}% confidence
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
