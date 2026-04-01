'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function SignupPage() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (): boolean => {
    if (!name.trim()) {
      setError('Name is required.');
      return false;
    }
    if (!email.trim()) {
      setError('Email is required.');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return false;
    }
    if (!password) {
      setError('Password is required.');
      return false;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!validate()) return;

    setIsSubmitting(true);

    const { error: signUpError } = await signUp({ email, password, name });

    if (signUpError) {
      setError(signUpError.message);
      setIsSubmitting(false);
      return;
    }

    router.push('/dashboard');
  };

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          Create your account
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Join the library and start exploring books.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-inset ring-red-200">
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700"
          >
            Full name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
            placeholder="Jane Doe"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700"
          >
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
            placeholder="At least 6 characters"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-semibold text-indigo-600 hover:text-indigo-500 transition-colors"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
