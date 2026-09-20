import { useState, useEffect } from 'react';
import { User } from './AuthSystem';

export default function AdminDashboard({
  currentUser,
  onLogout,
  onBack,
}: {
  currentUser: User;
  onLogout: () => void;
  onBack: () => void;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'users' | 'analytics' | 'settings'
  >('overview');

  useEffect(() => {
    const allUsers: User[] = JSON.parse(
      localStorage.getItem('voxforensics_users') || '[]'
    );
    setUsers(allUsers);
  }, []);

  const totalUsers = users.length;
  const adminUsers = users.filter((u) => u.role === 'admin').length;
  const regularUsers = users.filter((u) => u.role === 'user').length;
  const twoFactorEnabled = users.filter((u) => u.twoFactorEnabled).length;

  const deleteUser = (userId: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      const updatedUsers = users.filter((u) => u.id !== userId);
      setUsers(updatedUsers);
      localStorage.setItem(
        'voxforensics_users',
        JSON.stringify(updatedUsers)
      );
    }
  };

  const toggleUserRole = (userId: string) => {
    const updatedUsers = users.map((u) => {
      if (u.id === userId) {
        return {
          ...u,
          role: (u.role === 'admin' ? 'user' : 'admin') as 'user' | 'admin',
        };
      }
      return u;
    });

    setUsers(updatedUsers);
    localStorage.setItem(
      'voxforensics_users',
      JSON.stringify(updatedUsers)
    );
  };

  return (
    <div className="min-h-screen" style={{ background: '#030712' }}>
      {/* Header */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white">
              🛡️ Admin Dashboard
            </h1>

            <span className="px-2 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-xs text-purple-300">
              Admin
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">
              Welcome, {currentUser.name}
            </span>

            {/* Go to Main Page */}
            <button
              onClick={onBack}
              className="neon-btn text-xs py-2 px-4"
            >
              🏠 Main Page
            </button>

            {/* Logout */}
            <button
              onClick={onLogout}
              className="neon-btn neon-btn-danger text-xs py-2 px-4"
            >
              🚪 Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-8">
          {(['overview', 'users', 'analytics', 'settings'] as const).map(
            (tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 rounded-xl border font-medium text-sm transition-all capitalize ${
                  activeTab === tab
                    ? 'tab-active'
                    : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20 bg-white/5'
                }`}
              >
                {tab === 'overview' && '📊'}
                {tab === 'users' && '👥'}
                {tab === 'analytics' && '📈'}
                {tab === 'settings' && '⚙️'}
                {' '}
                {tab}
              </button>
            )
          )}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="glass-card p-6">
                <p className="text-xs text-gray-400 mb-1">Total Users</p>
                <p className="text-3xl font-bold text-white">
                  {totalUsers}
                </p>
                <p className="text-xs text-green-400 mt-2">
                  ↑ Active system
                </p>
              </div>

              <div className="glass-card p-6">
                <p className="text-xs text-gray-400 mb-1">Admin Users</p>
                <p className="text-3xl font-bold text-purple-400">
                  {adminUsers}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  With admin access
                </p>
              </div>

              <div className="glass-card p-6">
                <p className="text-xs text-gray-400 mb-1">
                  Regular Users
                </p>
                <p className="text-3xl font-bold text-cyan-400">
                  {regularUsers}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Standard access
                </p>
              </div>

              <div className="glass-card p-6">
                <p className="text-xs text-gray-400 mb-1">
                  2FA Enabled
                </p>
                <p className="text-3xl font-bold text-green-400">
                  {twoFactorEnabled}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  {totalUsers > 0
                    ? ((twoFactorEnabled / totalUsers) * 100).toFixed(0)
                    : 0}
                  % of users
                </p>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="glass-card p-6">
              <h2 className="text-lg font-bold text-white mb-4">
                📋 Recent Registrations
              </h2>

              <div className="space-y-3">
                {users
                  .slice(-5)
                  .reverse()
                  .map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-white font-bold">
                          {user.name.charAt(0).toUpperCase()}
                        </div>

                        <div>
                          <p className="text-sm font-medium text-white">
                            {user.name}
                          </p>

                          <p className="text-xs text-gray-400">
                            {user.email}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-gray-400">
                          {new Date(
                            user.createdAt
                          ).toLocaleDateString()}
                        </p>

                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            user.role === 'admin'
                              ? 'bg-purple-500/20 text-purple-300'
                              : 'bg-cyan-500/20 text-cyan-300'
                          }`}
                        >
                          {user.role}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="glass-card p-6">
            <h2 className="text-lg font-bold text-white mb-4">
              👥 User Management
            </h2>

            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                      {user.name.charAt(0).toUpperCase()}
                    </div>

                    <div>
                      <p className="text-sm font-medium text-white">
                        {user.name}
                      </p>

                      <p className="text-xs text-gray-400">
                        {user.email}
                      </p>

                      <div className="flex gap-2 mt-1">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            user.role === 'admin'
                              ? 'bg-purple-500/20 text-purple-300'
                              : 'bg-cyan-500/20 text-cyan-300'
                          }`}
                        >
                          {user.role}
                        </span>

                        {user.twoFactorEnabled && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-300">
                            🔐 2FA
                          </span>
                        )}

                        {user.referredBy && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300">
                            🎁 Referred
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleUserRole(user.id)}
                      className="neon-btn text-xs py-1 px-3"
                    >
                      {user.role === 'admin'
                        ? '↓ Demote'
                        : '↑ Promote'}
                    </button>

                    <button
                      onClick={() => deleteUser(user.id)}
                      className="neon-btn neon-btn-danger text-xs py-1 px-3"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="glass-card p-6">
              <h2 className="text-lg font-bold text-white mb-4">
                📈 System Analytics
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <p className="text-sm text-gray-400 mb-2">
                    User Growth
                  </p>

                  <p className="text-2xl font-bold text-cyan-400">
                    {totalUsers} Total
                  </p>

                  <div className="mt-3 h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
                      style={{ width: '100%' }}
                    ></div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <p className="text-sm text-gray-400 mb-2">
                    Security Status
                  </p>

                  <p className="text-2xl font-bold text-green-400">
                    {totalUsers > 0
                      ? ((twoFactorEnabled / totalUsers) * 100).toFixed(0)
                      : 0}
                    %
                  </p>

                  <p className="text-xs text-gray-500">
                    2FA adoption rate
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <p className="text-sm text-gray-400 mb-2">
                    Referral Program
                  </p>

                  <p className="text-2xl font-bold text-yellow-400">
                    {users.filter((u) => u.referredBy).length}
                  </p>

                  <p className="text-xs text-gray-500">
                    Users joined via referral
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <p className="text-sm text-gray-400 mb-2">
                    System Health
                  </p>

                  <p className="text-2xl font-bold text-green-400">
                    99.9%
                  </p>

                  <p className="text-xs text-gray-500">
                    Uptime
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="glass-card p-6">
            <h2 className="text-lg font-bold text-white mb-4">
              ⚙️ System Settings
            </h2>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                <h3 className="text-sm font-semibold text-white mb-2">
                  System Information
                </h3>

                <div className="text-xs text-gray-400 space-y-1">
                  <p>Version: 3.2.1</p>
                  <p>Environment: Production</p>
                  <p>Database: localStorage</p>
                  <p>Authentication: Client-side</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                <h3 className="text-sm font-semibold text-white mb-2">
                  Danger Zone
                </h3>

                <button
                  onClick={() => {
                    if (
                      confirm(
                        'This will delete ALL user data. Are you sure?'
                      )
                    ) {
                      localStorage.removeItem(
                        'voxforensics_users'
                      );
                      localStorage.removeItem(
                        'voxforensics_history'
                      );
                      localStorage.removeItem(
                        'voxforensics_consent'
                      );
                      setUsers([]);
                    }
                  }}
                  className="neon-btn neon-btn-danger text-xs"
                >
                  🗑️ Reset All System Data
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}