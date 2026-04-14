'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Nav from '@/components/Nav';
import AuthGuard from '@/components/AuthGuard';

type Stats = {
  overview: {
    totalEvidence: number;
    totalCases: number;
    totalOfficers: number;
    pendingTransfers: number;
    blockchainEvidenceCount: number;
  };
  evidenceByStatus: Record<string, number>;
  evidenceByType: Record<string, number>;
  recentActivity: Array<{
    id: string;
    action: string;
    createdAt: string;
    evidence?: { title?: string };
    from?: { name?: string };
    to?: { name?: string };
  }>;
};

type User = {
  name: string;
  role: string;
  badgeId: string;
  email: string;
  walletAddress?: string;
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setUser(data.data);
      });

    fetch('/api/admin/stats', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setStats(data.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <AuthGuard>
      <Nav />
      <div className="container">
        <h1>Dashboard</h1>

        {user && (
          <div style={{ background: 'white', padding: '15px', marginBottom: '20px' }}>
            <h2>Welcome, {user.name}</h2>
            <p>Role: {user.role}</p>
            <p>Badge ID: {user.badgeId}</p>
            <p>Email: {user.email}</p>
            {user.walletAddress && <p>Wallet: {user.walletAddress}</p>}
          </div>
        )}

        {loading && <p>Loading stats...</p>}

        {stats && (
          <>
            <h2>System Statistics</h2>
            <table>
              <tbody>
                <tr>
                  <td>
                    <strong>Total Evidence</strong>
                  </td>
                  <td>{stats.overview.totalEvidence}</td>
                </tr>
                <tr>
                  <td>
                    <strong>Total Cases</strong>
                  </td>
                  <td>{stats.overview.totalCases}</td>
                </tr>
                <tr>
                  <td>
                    <strong>Total Officers</strong>
                  </td>
                  <td>{stats.overview.totalOfficers}</td>
                </tr>
                <tr>
                  <td>
                    <strong>Pending Transfers</strong>
                  </td>
                  <td>{stats.overview.pendingTransfers}</td>
                </tr>
                <tr>
                  <td>
                    <strong>Blockchain Evidence Count</strong>
                  </td>
                  <td>{stats.overview.blockchainEvidenceCount}</td>
                </tr>
              </tbody>
            </table>

            <h3>Evidence by Status</h3>
            <pre>{JSON.stringify(stats.evidenceByStatus, null, 2)}</pre>

            <h3>Evidence by Type</h3>
            <pre>{JSON.stringify(stats.evidenceByType, null, 2)}</pre>

            <h3>Recent Activity ({stats.recentActivity.length} items)</h3>
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Evidence</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentActivity.map((activity) => (
                  <tr key={activity.id}>
                    <td>{activity.action}</td>
                    <td>{activity.evidence?.title || 'N/A'}</td>
                    <td>{activity.from?.name || 'System'}</td>
                    <td>{activity.to?.name || 'N/A'}</td>
                    <td>{new Date(activity.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {!loading && !stats && user?.role !== 'ADMIN' && <p>Statistics available for admins only.</p>}

        <div style={{ marginTop: '30px' }}>
          <h2>Quick Actions</h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Link href="/evidence/upload">
              <button>Upload Evidence</button>
            </Link>
            <Link href="/cases/create">
              <button>Create Case</button>
            </Link>
            <Link href="/evidence">
              <button>View Evidence</button>
            </Link>
            <Link href="/cases">
              <button>View Cases</button>
            </Link>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
