'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import AuthGuard from '@/components/AuthGuard';
import Nav from '@/components/Nav';

type EvidenceDetails = {
  evidence: {
    id: string;
    evidenceId?: string;
    title: string;
    evidenceType: string;
    status: string;
    fileHash: string;
    fileName: string;
    fileSize: number;
    isSensitive: boolean;
    locationText?: string;
    collectedAt: string;
    registeredOnChain: boolean;
    txHash?: string;
    description?: string;
  };
  case: { id: string; caseNumber: string; title: string; status: string };
  collectedBy: { name: string; badgeId: string; walletAddress?: string };
  custodyHistory: Array<{
    id: string;
    action: string;
    reason?: string;
    createdAt: string;
    from?: { name?: string };
    to?: { name?: string };
  }>;
  verifications: Array<{
    id: string;
    isAuthentic: boolean;
    createdAt: string;
    verifiedBy: { name: string };
  }>;
  blockchainStatus?: Record<string, unknown> | null;
};

export default function EvidenceDetailsPage() {
  const params = useParams<{ id: string }>();
  const [evidence, setEvidence] = useState<EvidenceDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`/api/evidence/${params.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setEvidence(data.data);
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

  if (!evidence) {
    return (
      <AuthGuard>
        <Nav />
        <div className="container">
          <p>Evidence not found</p>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <Nav />
      <div className="container">
        <h1>Evidence Details</h1>
        <div style={{ background: 'white', padding: '20px', marginBottom: '20px' }}>
          <h2>{evidence.evidence.title}</h2>
          <table>
            <tbody>
              <tr>
                <td>
                  <strong>ID</strong>
                </td>
                <td>{evidence.evidence.id}</td>
              </tr>
              <tr>
                <td>
                  <strong>Blockchain ID</strong>
                </td>
                <td>{evidence.evidence.evidenceId || 'Not registered'}</td>
              </tr>
              <tr>
                <td>
                  <strong>Type</strong>
                </td>
                <td>{evidence.evidence.evidenceType}</td>
              </tr>
              <tr>
                <td>
                  <strong>Status</strong>
                </td>
                <td>{evidence.evidence.status}</td>
              </tr>
              <tr>
                <td>
                  <strong>File Hash</strong>
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{evidence.evidence.fileHash}</td>
              </tr>
              <tr>
                <td>
                  <strong>File Name</strong>
                </td>
                <td>{evidence.evidence.fileName}</td>
              </tr>
              <tr>
                <td>
                  <strong>File Size</strong>
                </td>
                <td>{(evidence.evidence.fileSize / 1024).toFixed(2)} KB</td>
              </tr>
              <tr>
                <td>
                  <strong>Sensitive</strong>
                </td>
                <td>{evidence.evidence.isSensitive ? 'Yes' : 'No'}</td>
              </tr>
              <tr>
                <td>
                  <strong>Location</strong>
                </td>
                <td>{evidence.evidence.locationText || 'N/A'}</td>
              </tr>
              <tr>
                <td>
                  <strong>Collected At</strong>
                </td>
                <td>{new Date(evidence.evidence.collectedAt).toLocaleString()}</td>
              </tr>
              <tr>
                <td>
                  <strong>Registered On Blockchain</strong>
                </td>
                <td>{evidence.evidence.registeredOnChain ? 'Yes' : 'No'}</td>
              </tr>
              {evidence.evidence.txHash && (
                <tr>
                  <td>
                    <strong>Transaction Hash</strong>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{evidence.evidence.txHash}</td>
                </tr>
              )}
            </tbody>
          </table>

          <h3>Description</h3>
          <p>{evidence.evidence.description || 'No description provided'}</p>

          <h3>Case Information</h3>
          <table>
            <tbody>
              <tr>
                <td>
                  <strong>Case Number</strong>
                </td>
                <td>
                  <Link href={`/cases/${evidence.case.id}`}>{evidence.case.caseNumber}</Link>
                </td>
              </tr>
              <tr>
                <td>
                  <strong>Case Title</strong>
                </td>
                <td>{evidence.case.title}</td>
              </tr>
              <tr>
                <td>
                  <strong>Case Status</strong>
                </td>
                <td>{evidence.case.status}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>Chain of Custody ({evidence.custodyHistory.length} records)</h2>
        <table>
          <thead>
            <tr>
              <th>Action</th>
              <th>From</th>
              <th>To</th>
              <th>Reason</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {evidence.custodyHistory.map((log) => (
              <tr key={log.id}>
                <td>{log.action}</td>
                <td>{log.from?.name || 'System'}</td>
                <td>{log.to?.name || 'N/A'}</td>
                <td>{log.reason || 'N/A'}</td>
                <td>{new Date(log.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Verifications ({evidence.verifications.length} records)</h2>
        {evidence.verifications.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Verified By</th>
                <th>Result</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {evidence.verifications.map((v) => (
                <tr key={v.id}>
                  <td>{v.verifiedBy.name}</td>
                  <td>{v.isAuthentic ? 'Authentic' : 'Tampered'}</td>
                  <td>{new Date(v.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No verifications yet</p>
        )}

        {evidence.blockchainStatus && (
          <>
            <h2>Blockchain Status</h2>
            <pre>{JSON.stringify(evidence.blockchainStatus, null, 2)}</pre>
          </>
        )}
      </div>
    </AuthGuard>
  );
}
