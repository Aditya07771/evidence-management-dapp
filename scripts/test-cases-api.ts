/**
 * Test cases API endpoints
 * Run with: ts-node scripts/test-cases-api.ts
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

async function getAuthToken(): Promise<string> {
    // Login with seeded user
    const loginResponse = await testAPI('/auth/login', 'POST', {
        email: 'officer.smith@evidence.gov',
        password: 'password123',
    });

    if (!loginResponse.success) {
        throw new Error('Failed to login: ' + loginResponse.error);
    }

    return loginResponse.data.token;
}

async function testCasesAPI() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  CASES API TEST');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Get authentication token
    console.log('🔐 Getting authentication token...');
    const token = await getAuthToken();
    console.log('✅ Token obtained\n');

    let createdCaseId = '';
    const timestamp = Date.now();

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 1: Create new case
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('📁 TEST 1: Create New Case');
    console.log('   Endpoint: POST /api/cases');

    const newCase = {
        caseNumber: `CASE-TEST-${timestamp}`,
        title: 'Test Investigation Case',
        description: 'This is a test case for API validation',
    };

    const createResponse = await testAPI('/cases', 'POST', newCase, token);

    if (createResponse.success) {
        console.log('   ✅ Case created successfully');
        console.log('   ID:', createResponse.data.case.id);
        console.log('   Case Number:', createResponse.data.case.caseNumber);
        console.log('   Title:', createResponse.data.case.title);
        console.log('   Status:', createResponse.data.case.status);
        createdCaseId = createResponse.data.case.id;
    } else {
        console.log('   ❌ Failed:', createResponse.error);
    }

    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 2: Get all cases
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('📋 TEST 2: Get All Cases');
    console.log('   Endpoint: GET /api/cases');

    const listResponse = await testAPI('/cases?page=1&limit=10', 'GET', undefined, token);

    if (listResponse.success) {
        console.log('   ✅ Cases retrieved');
        console.log('   Total cases:', listResponse.data.pagination.total);
        console.log('   Page:', listResponse.data.pagination.page);
        console.log('   Cases on this page:', listResponse.data.cases.length);
        console.log('\n   Recent cases:');
        listResponse.data.cases.slice(0, 3).forEach((c: any, i: number) => {
            console.log(`   ${i + 1}. ${c.caseNumber} - ${c.title} (${c.status})`);
        });
    } else {
        console.log('   ❌ Failed:', listResponse.error);
    }

    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 3: Get cases with filter (OPEN status)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('🔍 TEST 3: Filter Cases by Status');
    console.log('   Endpoint: GET /api/cases?status=OPEN');

    const filterResponse = await testAPI('/cases?status=OPEN', 'GET', undefined, token);

    if (filterResponse.success) {
        console.log('   ✅ Filtered cases retrieved');
        console.log('   Open cases:', filterResponse.data.pagination.total);
    } else {
        console.log('   ❌ Failed:', filterResponse.error);
    }

    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 4: Get case details
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('🔎 TEST 4: Get Case Details');
    console.log(`   Endpoint: GET /api/cases/${createdCaseId}`);

    const detailsResponse = await testAPI(`/cases/${createdCaseId}`, 'GET', undefined, token);

    if (detailsResponse.success) {
        console.log('   ✅ Case details retrieved');
        console.log('   ID:', detailsResponse.data.case.id);
        console.log('   Case Number:', detailsResponse.data.case.caseNumber);
        console.log('   Title:', detailsResponse.data.case.title);
        console.log('   Status:', detailsResponse.data.case.status);
        console.log('   Evidence count:', detailsResponse.data.evidences.length);
        console.log('   Stats:', JSON.stringify(detailsResponse.data.stats, null, 2));
    } else {
        console.log('   ❌ Failed:', detailsResponse.error);
    }

    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 5: Update case details
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('✏️  TEST 5: Update Case Details');
    console.log(`   Endpoint: PATCH /api/cases/${createdCaseId}`);

    const updateData = {
        title: 'Updated Test Investigation Case',
        description: 'Updated description with more details',
    };

    const updateResponse = await testAPI(
        `/cases/${createdCaseId}`,
        'PATCH',
        updateData,
        token
    );

    if (updateResponse.success) {
        console.log('   ✅ Case updated successfully');
        console.log('   New title:', updateResponse.data.case.title);
        console.log('   New description:', updateResponse.data.case.description);
    } else {
        console.log('   ❌ Failed:', updateResponse.error);
    }

    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 6: Update case status
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('📊 TEST 6: Update Case Status');
    console.log(`   Endpoint: PATCH /api/cases/${createdCaseId}/status`);

    const statusUpdate = {
        status: 'CLOSED',
        reason: 'Investigation completed, all evidence collected',
    };

    const statusResponse = await testAPI(
        `/cases/${createdCaseId}/status`,
        'PATCH',
        statusUpdate,
        token
    );

    if (statusResponse.success) {
        console.log('   ✅ Status updated successfully');
        console.log('   Previous status:', statusResponse.data.previousStatus);
        console.log('   New status:', statusResponse.data.case.status);
    } else {
        console.log('   ❌ Failed:', statusResponse.error);
    }

    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 7: Invalid status transition
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('⚠️  TEST 7: Invalid Status Transition');
    console.log(`   Endpoint: PATCH /api/cases/${createdCaseId}/status`);
    console.log('   Attempting: CLOSED → OPEN (should succeed)');

    const invalidTransition = {
        status: 'OPEN',
        reason: 'Reopening case',
    };

    const invalidResponse = await testAPI(
        `/cases/${createdCaseId}/status`,
        'PATCH',
        invalidTransition,
        token
    );

    if (invalidResponse.success) {
        console.log('   ✅ Transition allowed (CLOSED → OPEN is valid)');
        console.log('   New status:', invalidResponse.data.case.status);
    } else {
        console.log('   ❌ Transition rejected:', invalidResponse.error);
    }

    console.log('');

    // Try ARCHIVED (terminal state)
    console.log('   Attempting: OPEN → ARCHIVED');
    const archiveResponse = await testAPI(
        `/cases/${createdCaseId}/status`,
        'PATCH',
        { status: 'ARCHIVED', reason: 'Archiving case' },
        token
    );

    if (archiveResponse.success) {
        console.log('   ✅ Case archived');
    } else {
        console.log('   ❌ Failed:', archiveResponse.error);
    }

    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 8: Duplicate case number
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('🔄 TEST 8: Duplicate Case Number');
    console.log('   Endpoint: POST /api/cases');

    const duplicateCase = {
        caseNumber: newCase.caseNumber, // Same as before
        title: 'Another Case',
        description: 'Different description',
    };

    const duplicateResponse = await testAPI('/cases', 'POST', duplicateCase, token);

    if (!duplicateResponse.success) {
        console.log('   ✅ Correctly rejected duplicate');
        console.log('   Error:', duplicateResponse.error);
    } else {
        console.log('   ❌ Allowed duplicate case number!');
    }

    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 9: Unauthorized access (no token)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('🚫 TEST 9: Unauthorized Access');
    console.log('   Endpoint: GET /api/cases (no token)');

    const unauthorizedResponse = await testAPI('/cases', 'GET');

    if (!unauthorizedResponse.success) {
        console.log('   ✅ Correctly rejected unauthorized request');
        console.log('   Error:', unauthorizedResponse.error);
    } else {
        console.log('   ❌ Security issue: allowed access without token!');
    }

    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 10: Invalid case ID
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('❓ TEST 10: Invalid Case ID');
    console.log('   Endpoint: GET /api/cases/invalid-id');

    const invalidIdResponse = await testAPI('/cases/invalid-id', 'GET', undefined, token);

    if (!invalidIdResponse.success) {
        console.log('   ✅ Correctly rejected invalid ID format');
        console.log('   Error:', invalidIdResponse.error);
    } else {
        console.log('   ❌ Accepted invalid ID format!');
    }

    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 11: Non-existent case
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('🔍 TEST 11: Non-existent Case');
    const fakeId = '00000000-0000-0000-0000-000000000000';
    console.log(`   Endpoint: GET /api/cases/${fakeId}`);

    const notFoundResponse = await testAPI(`/cases/${fakeId}`, 'GET', undefined, token);

    if (!notFoundResponse.success) {
        console.log('   ✅ Correctly returned 404');
        console.log('   Error:', notFoundResponse.error);
    } else {
        console.log('   ❌ Did not return 404 for non-existent case!');
    }

    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 12: Pagination
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('📄 TEST 12: Pagination');
    console.log('   Endpoint: GET /api/cases?page=1&limit=2');

    const page1Response = await testAPI('/cases?page=1&limit=2', 'GET', undefined, token);

    if (page1Response.success) {
        console.log('   ✅ Page 1 retrieved');
        console.log('   Cases on page:', page1Response.data.cases.length);
        console.log('   Total pages:', page1Response.data.pagination.totalPages);
        console.log('   Has more:', page1Response.data.pagination.hasMore);
    }

    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Summary
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  TEST SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('✅ All cases API tests completed');
    console.log('\n📌 Created Test Case:');
    console.log(`   ID: ${createdCaseId}`);
    console.log(`   Case Number: ${newCase.caseNumber}`);
    console.log('\n💡 Use this case ID to test evidence endpoints\n');
}

// Run tests
testCasesAPI().catch(console.error);