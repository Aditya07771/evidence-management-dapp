'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import AuthGuard from '@/components/AuthGuard';
import Nav from '@/components/Nav';

type CaseData = {
  case: {
    caseNumber: string;
    title: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    description?: string;
  };
  evidences: Array<{
    id: string;
    title: string;
    evidenceType: string;
    status: string;
    collectedAt: string;
    collectedBy: { name: string };
  }>;
  stats?: {
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
  };
};

export default function CaseDetailsPage() {
  const params = useParams<{ id: string }>();
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`/api/cases/${params.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setCaseData(data.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <AuthGuard>
        <Nav />
        <div className="container">
          <p>Loading...</p>
        </div>
      </AuthGuard>
    );
  }

  if (!caseData) {
    return (
      <AuthGuard>
        <Nav />
        <div className="container">
          <p>Case not found</p>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <Nav />
      <div className="container">
        <h1>Case Details</h1>

        <div style={{ background: 'white', padding: '20px', marginBottom: '20px' }}>
          <h2>{caseData.case.caseNumber}</h2>
          <table>
            <tbody>
              <tr>
                <td>
                  <strong>Title</strong>
                </td>
                <td>{caseData.case.title}</td>
              </tr>
              <tr>
                <td>
                  <strong>Status</strong>
                </td>
                <td>{caseData.case.status}</td>
              </tr>
              <tr>
                <td>
                  <strong>Created</strong>
                </td>
                <td>{new Date(caseData.case.createdAt).toLocaleString()}</td>
              </tr>
              <tr>
                <td>
                  <strong>Last Updated</strong>
                </td>
                <td>{new Date(caseData.case.updatedAt).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <h3>Description</h3>
          <p>{caseData.case.description || 'No description provided'}</p>
        </div>

        <h2>Evidence ({caseData.evidences.length} items)</h2>

        {caseData.stats && (
          <div style={{ background: '#f0f0f0', padding: '15px', marginBottom: '20px' }}>
            <h3>Statistics</h3>
            <p>Total: {caseData.stats.total}</p>
            <p>By Status: {JSON.stringify(caseData.stats.byStatus)}</p>
            <p>By Type: {JSON.stringify(caseData.stats.byType)}</p>
          </div>
        )}

        {caseData.evidences.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Status</th>
                <th>Collected By</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {caseData.evidences.map((ev) => (
                <tr key={ev.id}>
                  <td>{ev.title}</td>
                  <td>{ev.evidenceType}</td>
                  <td>{ev.status}</td>
                  <td>{ev.collectedBy.name}</td>
                  <td>{new Date(ev.collectedAt).toLocaleDateString()}</td>
                  <td>
                    <Link href={`/evidence/${ev.id}`}>
                      <button style={{ padding: '4px 8px', fontSize: '12px' }}>View</button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No evidence in this case yet.</p>
        )}
      </div>
    </AuthGuard>
  );
}
