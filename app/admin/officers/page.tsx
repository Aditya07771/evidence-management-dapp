'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '@/components/AuthGuard';
import Nav from '@/components/Nav';

type Officer = {
  id: string;
  name: string;
  badgeId: string;
  email: string;
  role: string;
  walletAddress?: string;
  isActive: boolean;
  stats: {
    evidenceCollected: number;
    custodyTransfers: number;
  };
};

export default function OfficersPage() {
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOfficers = () => {
    const token = localStorage.getItem('token');
    fetch('/api/admin/officers', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setOfficers(data.data.officers);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadOfficers();
  }, []);

  const toggleActive = async (id: string, isActive: boolean) => {
    const token = localStorage.getItem('token');
    const endpoint = isActive ? 'deactivate' : 'reactivate';
    const response = await fetch(`/api/admin/officers/${id}/${endpoint}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();

    if (data.success) {
      loadOfficers();
    } else {
      alert(`Error: ${data.error}`);
    }
  };

  return (
    <AuthGuard>
      <Nav />
      <div className="container">
        <h1>Officer Management</h1>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Badge ID</th>
                <th>Email</th>
                <th>Role</th>
                <th>Wallet</th>
                <th>Evidence</th>
                <th>Transfers</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {officers.map((officer) => (
                <tr key={officer.id}>
                  <td>{officer.name}</td>
                  <td>{officer.badgeId}</td>
                  <td>{officer.email}</td>
                  <td>{officer.role}</td>
                  <td style={{ fontSize: '10px' }}>{officer.walletAddress || 'N/A'}</td>
                  <td>{officer.stats.evidenceCollected}</td>
                  <td>{officer.stats.custodyTransfers}</td>
                  <td>{officer.isActive ? 'Active' : 'Inactive'}</td>
                  <td>
                    <button
                      onClick={() => toggleActive(officer.id, officer.isActive)}
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                    >
                      {officer.isActive ? 'Deactivate' : 'Reactivate'}
                    </button>
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
