'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import Nav from '@/components/Nav';

type CaseItem = { id: string; caseNumber: string; title: string };

export default function UploadEvidencePage() {
  const router = useRouter();
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    caseId: '',
    title: '',
    description: '',
    evidenceType: 'DOCUMENT',
    location: '',
    isSensitive: false,
  });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/cases', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setCases(data.data.cases);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file');
      return;
    }

    setError('');
    setUploading(true);

    const formDataObj = new FormData();
    formDataObj.append('file', file);
    formDataObj.append('caseId', formData.caseId);
    formDataObj.append('title', formData.title);
    formDataObj.append('description', formData.description);
    formDataObj.append('evidenceType', formData.evidenceType);
    formDataObj.append('location', formData.location);
    formDataObj.append('collectedAt', new Date().toISOString());
    formDataObj.append('isSensitive', formData.isSensitive.toString());

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/evidence', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formDataObj,
      });
      const data = await response.json();

      if (data.success) {
        router.push(`/evidence/${data.data.evidence.id}`);
      } else {
        setError(data.error || 'Upload failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <AuthGuard>
      <Nav />
      <div className="container">
        <h1>Upload Evidence</h1>

        {error && (
          <div style={{ background: '#fee', padding: '10px', border: '1px solid red', marginBottom: '15px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ background: 'white', padding: '20px' }}>
          <div>
            <label>Case:</label>
            <select
              value={formData.caseId}
              onChange={(e) => setFormData({ ...formData, caseId: e.target.value })}
              required
            >
              <option value="">Select a case...</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.caseNumber} - {c.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Evidence File:</label>
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
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
              rows={4}
            />
          </div>

          <div>
            <label>Evidence Type:</label>
            <select
              value={formData.evidenceType}
              onChange={(e) => setFormData({ ...formData, evidenceType: e.target.value })}
            >
              <option value="DOCUMENT">Document</option>
              <option value="IMAGE">Image</option>
              <option value="VIDEO">Video</option>
              <option value="AUDIO">Audio</option>
              <option value="DIGITAL">Digital</option>
              <option value="PHYSICAL">Physical</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label>Location Collected:</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Address or GPS coordinates"
            />
          </div>

          <div style={{ margin: '10px 0' }}>
            <label>
              <input
                type="checkbox"
                checked={formData.isSensitive}
                onChange={(e) => setFormData({ ...formData, isSensitive: e.target.checked })}
                style={{ width: 'auto', margin: '0 5px 0 0' }}
              />
              Sensitive (requires multi-signature transfer)
            </label>
          </div>

          <button type="submit" disabled={uploading} style={{ marginTop: '10px' }}>
            {uploading ? 'Uploading...' : 'Upload Evidence'}
          </button>

          <Link href="/evidence" style={{ marginLeft: '10px' }}>
            <button type="button">Cancel</button>
          </Link>
        </form>
      </div>
    </AuthGuard>
  );
}
