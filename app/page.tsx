export default function Home() {
  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Evidence Management System</h1>
      <p>API is running at /api</p>
      <h2>Available Endpoints:</h2>
      <ul>
        <li>POST /api/auth/register - Register new user</li>
        <li>POST /api/auth/login - User login</li>
        <li>GET /api/auth/me - Get current user (protected)</li>
      </ul>
    </div>
  );
}