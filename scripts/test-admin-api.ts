/**
 * Test admin API endpoints
 * Run with: ts-node scripts/test-admin-api.ts
 */

const API_BASE = 'http://localhost:3000/api';

interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

async function testAPI(
  endpoint: string,
  method: string = 'GET',
  body?: any,
  token?: string
): Promise<ApiResponse> {
  const url = `${API_BASE}${endpoint}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    return data;
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function getAuthToken(email: string): Promise<string> {
  const loginResponse = await testAPI('/auth/login', 'POST', {
    email,
    password: 'password123',
  });

  if (!loginResponse.success) {
    throw new Error('Failed to login: ' + loginResponse.error);
  }

  return loginResponse.data.token;
}

async function testAdminAPI() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ADMIN API TEST');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Get admin token
  console.log('🔐 Getting admin token...');
  const adminToken = await getAuthToken('admin@evidence.gov');
  console.log('✅ Admin token obtained\n');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TEST 1: Get system statistics
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  console.log('📊 TEST 1: Get System Statistics');
  console.log('   Endpoint: GET /api/admin/stats');

  const statsResponse = await testAPI('/admin/stats', 'GET', undefined, adminToken);

  if (statsResponse.success) {
    console.log('   ✅ Statistics retrieved');
    console.log('\n   Overview:');
    console.log('   - Total Evidence:', statsResponse.data.overview.totalEvidence);
    console.log('   - Total Cases:', statsResponse.data.overview.totalCases);
    console.log('   - Total Officers:', statsResponse.data.overview.totalOfficers);
    console.log('   - Pending Transfers:', statsResponse.data.overview.pendingTransfers);
    console.log('   - Blockchain Count:', statsResponse.data.overview.blockchainEvidenceCount);

    console.log('\n   Evidence by Status:');
    Object.entries(statsResponse.data.evidenceByStatus).forEach(([status, count]) => {
      console.log(`   - ${status}: ${count}`);
    });

    console.log('\n   Evidence by Type:');
    Object.entries(statsResponse.data.evidenceByType).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count}`);
    });

    console.log('\n   Recent Activity:', statsResponse.data.recentActivity.length, 'items');
  } else {
    console.log('   ❌ Failed:', statsResponse.error);
  }

  console.log('');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TEST 2: List all officers
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  console.log('👥 TEST 2: List All Officers');
  console.log('   Endpoint: GET /api/admin/officers');

  const officersResponse = await testAPI('/admin/officers', 'GET', undefined, adminToken);

  if (officersResponse.success) {
    console.log('   ✅ Officers retrieved');
    console.log('   Total:', officersResponse.data.pagination.total);
    console.log('   On this page:', officersResponse.data.officers.length);

    console.log('\n   Officers:');
    officersResponse.data.officers.slice(0, 5).forEach((o: any, i: number) => {
      console.log(`   ${i + 1}. ${o.name} (${o.badgeId}) - ${o.role} - ${o.isActive ? 'Active' : 'Inactive'}`);
      console.log(`      Evidence: ${o.stats.evidenceCollected}, Transfers: ${o.stats.custodyTransfers}`);
    });
  } else {
    console.log('   ❌ Failed:', officersResponse.error);
  }

  console.log('');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TEST 3: Filter officers by role
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  console.log('🔍 TEST 3: Filter Officers by Role');
  console.log('   Endpoint: GET /api/admin/officers?role=INVESTIGATOR');

  const filterResponse = await testAPI('/admin/officers?role=INVESTIGATOR', 'GET', undefined, adminToken);

  if (filterResponse.success) {
    console.log('   ✅ Filtered officers retrieved');
    console.log('   Investigators:', filterResponse.data.pagination.total);
  } else {
    console.log('   ❌ Failed:', filterResponse.error);
  }

  console.log('');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TEST 4: Deactivate an officer
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  console.log('🚫 TEST 4: Deactivate an Officer');

  // Get an officer to deactivate
  const testOfficer = officersResponse.data?.officers.find((o: any) => 
    o.role === 'INVESTIGATOR' && o.isActive
  );

  if (testOfficer) {
    console.log(`   Endpoint: POST /api/admin/officers/${testOfficer.id}/deactivate`);

    const deactivateResponse = await testAPI(
      `/admin/officers/${testOfficer.id}/deactivate`,
      'POST',
      undefined,
      adminToken
    );

    if (deactivateResponse.success) {
      console.log('   ✅ Officer deactivated');
      console.log('   Name:', deactivateResponse.data.officer.name);
      console.log('   Active:', deactivateResponse.data.officer.isActive);
      console.log('   Blockchain deactivated:', deactivateResponse.data.blockchain.deactivated);
    } else {
      console.log('   ❌ Failed:', deactivateResponse.error);
    }

    // Reactivate for cleanup
    await testAPI(
      `/admin/officers/${testOfficer.id}/reactivate`,
      'POST',
      undefined,
      adminToken
    );
  } else {
    console.log('   ⚠️  No suitable officer found to deactivate');
  }

  console.log('');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TEST 5: Set evidence sensitive flag
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  console.log('🔒 TEST 5: Set Evidence Sensitive Flag');

  // Get an evidence item
  const evidenceResponse = await testAPI('/evidence?limit=1', 'GET', undefined, adminToken);
  
  if (evidenceResponse.success && evidenceResponse.data.evidences.length > 0) {
    const evidenceId = evidenceResponse.data.evidences[0].id;
    console.log(`   Endpoint: PATCH /api/admin/evidence/${evidenceId}/sensitive`);

    const sensitiveResponse = await testAPI(
      `/admin/evidence/${evidenceId}/sensitive`,
      'PATCH',
      { isSensitive: true },
      adminToken
    );

    if (sensitiveResponse.success) {
      console.log('   ✅ Sensitive flag updated');
      console.log('   Is Sensitive:', sensitiveResponse.data.evidence.isSensitive);
      console.log('   Blockchain updated:', sensitiveResponse.data.blockchain.updated);
    } else {
      console.log('   ❌ Failed:', sensitiveResponse.error);
    }
  } else {
    console.log('   ⚠️  No evidence found');
  }

  console.log('');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TEST 6: Get audit logs
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  console.log('📝 TEST 6: Get Audit Logs');
  console.log('   Endpoint: GET /api/admin/audit-logs?limit=5');

  const auditResponse = await testAPI('/admin/audit-logs?limit=5', 'GET', undefined, adminToken);

  if (auditResponse.success) {
    console.log('   ✅ Audit logs retrieved');
    console.log('   Showing:', auditResponse.data.logs.length, 'logs');

    console.log('\n   Recent actions:');
    auditResponse.data.logs.forEach((log: any, i: number) => {
      console.log(`   ${i + 1}. ${log.action} - ${log.resource || 'N/A'}`);
      console.log(`      Time: ${new Date(log.createdAt).toLocaleString()}`);
    });
  } else {
    console.log('   ❌ Failed:', auditResponse.error);
  }

  console.log('');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TEST 7: Filter audit logs by action
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  console.log('🔎 TEST 7: Filter Audit Logs by Action');
  console.log('   Endpoint: GET /api/admin/audit-logs?action=EVIDENCE_REGISTERED');

  const filteredAuditResponse = await testAPI(
    '/admin/audit-logs?action=EVIDENCE_REGISTERED&limit=3',
    'GET',
    undefined,
    adminToken
  );

  if (filteredAuditResponse.success) {
    console.log('   ✅ Filtered audit logs retrieved');
    console.log('   Evidence registration logs:', filteredAuditResponse.data.logs.length);
  } else {
    console.log('   ❌ Failed:', filteredAuditResponse.error);
  }

  console.log('');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Summary
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  TEST SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('✅ All admin API tests completed');
  console.log('\n📊 Admin Features Tested:');
  console.log('   - System statistics');
  console.log('   - Officer management');
  console.log('   - Officer filtering');
  console.log('   - Deactivate/reactivate');
  console.log('   - Evidence sensitive flag');
  console.log('   - Audit logs');
  console.log('   - Audit log filtering\n');
}

// Run tests
testAdminAPI().catch(console.error);
