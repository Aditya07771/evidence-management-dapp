'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type User = {
  name: string;
  role: string;
};

export default function Nav() {
  const router = useRouter();
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
      })
      .catch(() => {});
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  if (!user) return null;

  return (
    <nav style={{ background: '#333', color: 'white', padding: '15px' }}>
      <div
        className="container"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div>
          <strong>Evidence System</strong> | {user.name} ({user.role})
        </div>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <Link href="/dashboard" style={{ color: 'white' }}>
            Dashboard
          </Link>
          <Link href="/evidence" style={{ color: 'white' }}>
            Evidence
          </Link>
          <Link href="/cases" style={{ color: 'white' }}>
            Cases
          </Link>
          {user.role === 'ADMIN' && (
            <>
              <Link href="/admin/officers" style={{ color: 'white' }}>
                Officers
              </Link>
              <Link href="/admin/audit-logs" style={{ color: 'white' }}>
                Audit Logs
              </Link>
            </>
          )}
          <button onClick={logout} style={{ padding: '4px 12px' }}>
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
