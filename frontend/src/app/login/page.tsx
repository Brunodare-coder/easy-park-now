'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <form onSubmit={handleSubmit} className="max-w-md w-full bg-white p-8 rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-6 text-center">Login to EasyParkNow</h1>
        {error && <p className="text-red-600 mb-4">{error}</p>}
        <label className="block mb-2 font-semibold">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="input mb-4"
          placeholder="you@example.com"
        />
        <label className="block mb-2 font-semibold">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="input mb-6"
          placeholder="Your password"
        />
        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary w-full py-3 font-semibold"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}
