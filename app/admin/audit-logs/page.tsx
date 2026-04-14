'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '@/components/AuthGuard';
import Nav from '@/components/Nav';

type AuditLog = {
  id: string;
  createdAt: string;
  action: string;
  resource?: string;
  userId?: string;
  ipAddress?: string;
  metadata?: unknown;
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/admin/audit-logs?limit=50', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setLogs(data.data.logs);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <AuthGuard>
      <Nav />
      <div className="container">
        <h1>Audit Logs</h1>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Resource</th>
                <th>User ID</th>
                <th>IP Address</th>
                <th>Metadata</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.createdAt).toLocaleString()}</td>
                  <td>{log.action}</td>
                  <td>{log.resource || 'N/A'}</td>
                  <td style={{ fontSize: '10px' }}>{log.userId || 'System'}</td>
                  <td>{log.ipAddress || 'N/A'}</td>
                  <td>
                    <details>
                      <summary style={{ cursor: 'pointer' }}>View</summary>
                      <pre style={{ fontSize: '10px' }}>{JSON.stringify(log.metadata, null, 2)}</pre>
                    </details>
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
