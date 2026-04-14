'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AuthGuard from '@/components/AuthGuard';
import Nav from '@/components/Nav';

type CaseItem = {
  id: string;
  caseNumber: string;
  title: string;
  status: string;
  createdAt: string;
  _count?: { evidences?: number };
};

export default function CasesPage() {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/cases', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setCases(data.data.cases);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <AuthGuard>
      <Nav />
      <div className="container">
        <h1>Cases</h1>

        <div style={{ marginBottom: '20px' }}>
          <Link href="/cases/create">
            <button>Create New Case</button>
          </Link>
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Case Number</th>
                <th>Title</th>
                <th>Status</th>
                <th>Evidence Count</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id}>
                  <td>{c.caseNumber}</td>
                  <td>{c.title}</td>
                  <td>{c.status}</td>
                  <td>{c._count?.evidences || 0}</td>
                  <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td>
                    <Link href={`/cases/${c.id}`}>
                      <button style={{ padding: '4px 8px', fontSize: '12px' }}>View</button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AuthGuard>
  );
}
