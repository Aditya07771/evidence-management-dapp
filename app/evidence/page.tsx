'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AuthGuard from '@/components/AuthGuard';
import Nav from '@/components/Nav';

type EvidenceItem = {
  id: string;
  title: string;
  evidenceType: string;
  status: string;
  collectedAt: string;
  registeredOnChain: boolean;
  case: { id: string; caseNumber: string };
  collectedBy: { name: string };
};

export default function EvidencePage() {
  const [evidences, setEvidences] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    type: '',
    search: '',
  });

  const loadEvidence = () => {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.type) params.append('type', filters.type);
    if (filters.search) params.append('search', filters.search);

    fetch(`/api/evidence?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setEvidences(data.data.evidences);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadEvidence();
    // initial load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthGuard>
      <Nav />
      <div className="container">
        <h1>Evidence Management</h1>

        <div style={{ marginBottom: '20px' }}>
          <Link href="/evidence/upload">
            <button>Upload New Evidence</button>
          </Link>
        </div>

        <div style={{ background: 'white', padding: '15px', marginBottom: '20px' }}>
          <h3>Filters</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 100px', gap: '10px' }}>
            <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All Status</option>
              <option value="COLLECTED">Collected</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="TRANSFERRED">Transferred</option>
              <option value="ARCHIVED">Archived</option>
              <option value="REJECTED">Rejected</option>
            </select>

            <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
              <option value="">All Types</option>
              <option value="DOCUMENT">Document</option>
              <option value="IMAGE">Image</option>
              <option value="VIDEO">Video</option>
              <option value="AUDIO">Audio</option>
              <option value="DIGITAL">Digital</option>
              <option value="PHYSICAL">Physical</option>
            </select>

            <input
              type="text"
              placeholder="Search..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />

            <button onClick={loadEvidence}>Apply</button>
          </div>
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <>
            <p>Total: {evidences.length} items</p>

            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Case</th>
                  <th>Collected By</th>
                  <th>Date</th>
                  <th>Blockchain</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {evidences.map((ev) => (
                  <tr key={ev.id}>
                    <td>{ev.title}</td>
                    <td>{ev.evidenceType}</td>
                    <td>{ev.status}</td>
                    <td>
                      <Link href={`/cases/${ev.case.id}`}>{ev.case.caseNumber}</Link>
                    </td>
                    <td>{ev.collectedBy.name}</td>
                    <td>{new Date(ev.collectedAt).toLocaleDateString()}</td>
                    <td>{ev.registeredOnChain ? 'Y' : 'N'}</td>
                    <td>
                      <Link href={`/evidence/${ev.id}`}>
                        <button style={{ padding: '4px 8px', fontSize: '12px' }}>View</button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {evidences.length === 0 && <p>No evidence found.</p>}
          </>
        )}
      </div>
    </AuthGuard>
  );
}
