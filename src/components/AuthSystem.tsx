import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  role: 'user' | 'admin';
  referralCode: string;
  referredBy?: string;
  createdAt: string;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => boolean;
  register: (
    email: string,
    password: string,
    name: string,
    referralCode?: string
  ) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('voxforensics_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Seed demo accounts on first load
  useEffect(() => {
    const users: User[] = JSON.parse(
      localStorage.getItem('voxforensics_users') || '[]'
    );

    const hasAdmin = users.find(
      (u) => u.email === 'admin@voxforensics.com'
    );

    const hasUser = users.find(
      (u) => u.email === 'user@example.com'
    );

    if (!hasAdmin) {
      users.push({
        id: 'admin-001',
        email: 'admin@voxforensics.com',
        password: 'admin123',
        name: 'Admin User',
        role: 'admin',
        referralCode: 'VF-ADMIN01',
        createdAt: new Date().toISOString(),
        twoFactorEnabled: false,
      });
    }

    if (!hasUser) {
      users.push({
        id: 'user-001',
        email: 'user@example.com',
        password: 'user123',
        name: 'Demo User',
        role: 'user',
        referralCode: 'VF-USER001',
        createdAt: new Date().toISOString(),
        twoFactorEnabled: false,
      });
    }

    localStorage.setItem('voxforensics_users', JSON.stringify(users));
  }, []);

  const login = (email: string, password: string): boolean => {
    const users: User[] = JSON.parse(
      localStorage.getItem('voxforensics_users') || '[]'
    );

    const user = users.find(
      (u) => u.email === email && u.password === password
    );

    if (user) {
      setCurrentUser(user);
      localStorage.setItem(
        'voxforensics_current_user',
        JSON.stringify(user)
      );

      return true;
    }

    return false;
  };

  const register = (
    email: string,
    password: string,
    name: string,
    referralCode?: string
  ): boolean => {
    const users: User[] = JSON.parse(
      localStorage.getItem('voxforensics_users') || '[]'
    );

    if (users.find((u) => u.email === email)) {
      return false;
    }

    const newUser: User = {
      id: Date.now().toString(),
      email,
      password,
      name,
      role: email === 'admin@voxforensics.com' ? 'admin' : 'user',
      referralCode:
        referralCode ||
        `VF-${Math.random()
          .toString(36)
          .substring(2, 8)
          .toUpperCase()}`,
      referredBy: referralCode,
      createdAt: new Date().toISOString(),
      twoFactorEnabled: false,
    };

    users.push(newUser);

    localStorage.setItem(
      'voxforensics_users',
      JSON.stringify(users)
    );

    setCurrentUser(newUser);

    localStorage.setItem(
      'voxforensics_current_user',
      JSON.stringify(newUser)
    );

    return true;
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('voxforensics_current_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user: currentUser,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default function AuthSystem() {
  const { login, register } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'login') {
      const success = login(email, password);

      if (!success) {
        setError('Invalid email or password');
      }
    } else {
      if (!name || !email || !password) {
        setError('Please fill in all fields');
        return;
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }

      const success = register(
        email,
        password,
        name,
        referralCode || undefined
      );

      if (!success) {
        setError('Email already registered');
      }
    }
  };

  return (
    <div className="w-full flex items-center justify-center">
      <div className="glass-panel p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#a855f7] flex items-center justify-center">
            <i className="fa-solid fa-wave-square text-white text-2xl"></i>
          </div>

          <h1 className="text-3xl font-bold text-gradient mb-2">
            VoxForensics
          </h1>

          <p className="text-gray-400 text-sm">
            {mode === 'login'
              ? 'Welcome back!'
              : 'Create your account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Name
              </label>

              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-[#050914]/50 border border-[#1a2a4a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00d4ff]"
                placeholder="John Doe"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-[#050914]/50 border border-[#1a2a4a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00d4ff]"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-[#050914]/50 border border-[#1a2a4a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00d4ff]"
              placeholder="••••••••"
              required
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Referral Code (Optional)
              </label>

              <input
                type="text"
                value={referralCode}
                onChange={(e) =>
                  setReferralCode(e.target.value)
                }
                className="w-full px-4 py-3 bg-[#050914]/50 border border-[#1a2a4a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00d4ff]"
                placeholder="VF-XXXXXX"
              />
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full neon-btn neon-btn-primary py-3 font-semibold"
          >
            {mode === 'login' ? 'Login' : 'Register'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setMode(
                mode === 'login' ? 'register' : 'login'
              );
              setError('');
            }}
            className="text-sm text-[#00d4ff] hover:text-white transition"
          >
            {mode === 'login'
              ? "Don't have an account? Register"
              : 'Already have an account? Login'}
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-[#1a2a4a]">
          <p className="text-xs text-gray-500 text-center mb-3">
            Demo Accounts:
          </p>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-gray-400">
              <span>Admin:</span>
              <span className="font-mono">
                admin@voxforensics.com / admin123
              </span>
            </div>

            <div className="flex justify-between text-gray-400">
              <span>User:</span>
              <span className="font-mono">
                user@example.com / user123
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}