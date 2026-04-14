'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import Nav from '@/components/Nav';

export default function CreateCasePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    caseNumber: '',
    title: '',
    description: '',
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/cases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      const data = await response.json();

      if (data.success) {
        router.push(`/cases/${data.data.case.id}`);
      } else {
        setError(data.error || 'Failed to create case');
      }
    } catch {
      setError('Network error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <AuthGuard>
      <Nav />
      <div className="container">
        <h1>Create New Case</h1>

        {error && (
          <div style={{ background: '#fee', padding: '10px', border: '1px solid red', marginBottom: '15px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ background: 'white', padding: '20px' }}>
          <div>
            <label>Case Number:</label>
            <input
              type="text"
              value={formData.caseNumber}
              onChange={(e) => setFormData({ ...formData, caseNumber: e.target.value })}
              required
              placeholder="CASE-2024-001"
            />
          </div>

          <div>
            <label>Title:</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div>
            <label>Description:</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={5}
            />
          </div>

          <button type="submit" disabled={creating} style={{ marginTop: '10px' }}>
            {creating ? 'Creating...' : 'Create Case'}
          </button>

          <Link href="/cases" style={{ marginLeft: '10px' }}>
            <button type="button">Cancel</button>
          </Link>
        </form>
      </div>
    </AuthGuard>
  );
}
