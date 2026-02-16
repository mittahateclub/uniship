'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, FormEvent } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import Link from 'next/link';

export default function CreateUniadminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    universityName: '',
    universityId: '',
    phone: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      // Create auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      // Add user data to Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        name: formData.name,
        email: formData.email,
        role: 'uniadmin',
        universityName: formData.universityName,
        universityId: formData.universityId,
        phone: formData.phone,
        createdAt: new Date(),
        createdBy: user?.uid,
      });

      setSuccess(`University Admin account created successfully for ${formData.email}`);
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        password: '',
        universityName: '',
        universityId: '',
        phone: '',
      });

    } catch (err: any) {
      console.error('Error creating uniadmin:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else {
        setError('Failed to create account. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-black text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/superadmin/dashboard" 
            className="text-black hover:text-gray-600 mb-4 inline-block"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-4xl font-bold text-black mb-2">Create University Admin</h1>
          <p className="text-gray-600">Add a new university administrator account</p>
        </div>

        {/* Form */}
        <div className="bg-black text-white p-8 rounded-lg shadow-2xl">
          {error && (
            <div className="mb-6 p-4 bg-red-500 text-white rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-500 text-white rounded-lg">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                Full Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white text-black border-2 border-white rounded-lg focus:outline-none focus:border-gray-300 transition-colors"
                placeholder="Enter admin's full name"
                required
                disabled={submitting}
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email Address *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white text-black border-2 border-white rounded-lg focus:outline-none focus:border-gray-300 transition-colors"
                placeholder="admin@university.edu"
                required
                disabled={submitting}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Password *
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white text-black border-2 border-white rounded-lg focus:outline-none focus:border-gray-300 transition-colors"
                placeholder="Min 6 characters"
                required
                disabled={submitting}
                minLength={6}
              />
            </div>

            {/* University Name */}
            <div>
              <label htmlFor="universityName" className="block text-sm font-medium mb-2">
                University Name *
              </label>
              <input
                type="text"
                id="universityName"
                name="universityName"
                value={formData.universityName}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white text-black border-2 border-white rounded-lg focus:outline-none focus:border-gray-300 transition-colors"
                placeholder="e.g., Harvard University"
                required
                disabled={submitting}
              />
            </div>

            {/* University ID */}
            <div>
              <label htmlFor="universityId" className="block text-sm font-medium mb-2">
                University ID *
              </label>
              <input
                type="text"
                id="universityId"
                name="universityId"
                value={formData.universityId}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white text-black border-2 border-white rounded-lg focus:outline-none focus:border-gray-300 transition-colors"
                placeholder="e.g., HARV-001"
                required
                disabled={submitting}
              />
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white text-black border-2 border-white rounded-lg focus:outline-none focus:border-gray-300 transition-colors"
                placeholder="+1 (555) 123-4567"
                disabled={submitting}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-white text-black py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating Account...' : 'Create University Admin'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}