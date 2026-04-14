/**
 * Test evidence API endpoints
 * Run with: ts-node scripts/test-evidence-api.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';

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
    const headers: any = {};

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    if (body && !(body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const options: any = {
        method,
        headers,
    };

    if (body) {
        options.body = body instanceof FormData ? body : JSON.stringify(body);
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
    const loginResponse = await testAPI('/auth/login', 'POST', {
        email: 'officer.smith@evidence.gov',
        password: 'password123',
    });

    if (!loginResponse.success) {
        throw new Error('Failed to login: ' + loginResponse.error);
    }

    return loginResponse.data.token;
}

async function getCaseId(token: string): Promise<string> {
    const casesResponse = await testAPI('/cases', 'GET', undefined, token);
    if (!casesResponse.success || casesResponse.data.cases.length === 0) {
        throw new Error('No cases found. Please run test-cases-api.ts first');
    }
    return casesResponse.data.cases[0].id;
}

async function testEvidenceAPI() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  EVIDENCE API TEST');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Get authentication token
    console.log('🔐 Getting authentication token...');
    const token = await getAuthToken();
    console.log('✅ Token obtained\n');

    // Get a case ID
    console.log('📁 Getting case ID...');
    const caseId = await getCaseId(token);
    console.log(`✅ Using case: ${caseId}\n`);

    let createdEvidenceId = '';

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 1: Upload evidence file
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('📤 TEST 1: Upload Evidence File');
    console.log('   Endpoint: POST /api/evidence');

    // Create a test file
    const testFilePath = path.join(__dirname, 'test-evidence.txt');
    const testContent = `Test Evidence File
Created: ${new Date().toISOString()}
Content: This is a sample evidence file for testing purposes.
Hash verification test.`;

    fs.writeFileSync(testFilePath, testContent);

    // Create form data
    const formData = new FormData();
    formData.append('file', fs.createReadStream(testFilePath));
    formData.append('caseId', caseId);
    formData.append('title', 'Test Evidence Document');
    formData.append('description', 'Sample document for API testing');
    formData.append('evidenceType', 'DOCUMENT');
    formData.append('location', '123 Test Street, Evidence Lab');
    formData.append('collectedAt', new Date().toISOString());
    formData.append('isSensitive', 'false');

    const uploadResponse = await fetch(`${API_BASE}/evidence`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
        },
        body: formData,
    });

    const uploadResult = await uploadResponse.json();

    if (uploadResult.success) {
        console.log('   ✅ Evidence uploaded successfully');
        console.log('   ID:', uploadResult.data.evidence.id);
        console.log('   Title:', uploadResult.data.evidence.title);
        console.log('   File Hash:', uploadResult.data.evidence.fileHash);
        console.log('   File Size:', uploadResult.data.evidence.fileSize, 'bytes');
        console.log('   Blockchain Registered:', uploadResult.data.blockchain.registered);
        if (uploadResult.data.blockchain.txHash) {
            console.log('   Tx Hash:', uploadResult.data.blockchain.txHash);
        }
        createdEvidenceId = uploadResult.data.evidence.id;
    } else {
        console.log('   ❌ Failed:', uploadResult.error);
    }

    // Clean up test file
    fs.unlinkSync(testFilePath);

    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 2: Get all evidence
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('📋 TEST 2: Get All Evidence');
    console.log('   Endpoint: GET /api/evidence');

    const listResponse = await testAPI('/evidence?page=1&limit=10', 'GET', undefined, token);

    if (listResponse.success) {
        console.log('   ✅ Evidence retrieved');
        console.log('   Total:', listResponse.data.pagination.total);
        console.log('   On this page:', listResponse.data.evidences.length);
        console.log('\n   Recent evidence:');
        listResponse.data.evidences.slice(0, 3).forEach((e: any, i: number) => {
            console.log(`   ${i + 1}. ${e.title} - ${e.evidenceType} (${e.status})`);
        });
    } else {
        console.log('   ❌ Failed:', listResponse.error);
    }

    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 3: Filter evidence
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('🔍 TEST 3: Filter Evidence');
    console.log(`   Endpoint: GET /api/evidence?caseId=${caseId}`);

    const filterResponse = await testAPI(`/evidence?caseId=${caseId}`, 'GET', undefined, token);

    if (filterResponse.success) {
        console.log('   ✅ Filtered evidence retrieved');
        console.log('   Evidence for this case:', filterResponse.data.evidences.length);
    } else {
        console.log('   ❌ Failed:', filterResponse.error);
    }

    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 4: Get evidence details
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('🔎 TEST 4: Get Evidence Details');
    console.log(`   Endpoint: GET /api/evidence/${createdEvidenceId}`);

    const detailsResponse = await testAPI(`/evidence/${createdEvidenceId}`, 'GET', undefined, token);

    if (detailsResponse.success) {
        console.log('   ✅ Evidence details retrieved');
        console.log('   ID:', detailsResponse.data.evidence.id);
        console.log('   Title:', detailsResponse.data.evidence.title);
        console.log('   Type:', detailsResponse.data.evidence.evidenceType);
        console.log('   Status:', detailsResponse.data.evidence.status);
        console.log('   File Hash:', detailsResponse.data.evidence.fileHash);
        console.log('   Collected By:', detailsResponse.data.collectedBy.name);
        console.log('   Custody History:', detailsResponse.data.custodyHistory.length, 'records');
        console.log('   Verifications:', detailsResponse.data.verifications.length);
    } else {
        console.log('   ❌ Failed:', detailsResponse.error);
    }

    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 5: Update evidence status
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('📊 TEST 5: Update Evidence Status');
    console.log(`   Endpoint: PATCH /api/evidence/${createdEvidenceId}/status`);

    const statusUpdate = {
        newStatus: 'SUBMITTED',
        reason: 'Evidence submitted for forensic analysis',
    };

    const statusResponse = await testAPI(
        `/evidence/${createdEvidenceId}/status`,
        'PATCH',
        statusUpdate,
        token
    );

    if (statusResponse.success) {
        console.log('   ✅ Status updated successfully');
        console.log('   Previous:', statusResponse.data.previousStatus);
        console.log('   New:', statusResponse.data.evidence.status);
        console.log('   Blockchain updated:', statusResponse.data.blockchain.updated);
        if (statusResponse.data.blockchain.txHash) {
            console.log('   Tx Hash:', statusResponse.data.blockchain.txHash);
        }
    } else {
        console.log('   ❌ Failed:', statusResponse.error);
    }

    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 6: Duplicate file upload
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('🔄 TEST 6: Duplicate File Upload');
    console.log('   Endpoint: POST /api/evidence');

    // Create same file again
    fs.writeFileSync(testFilePath, testContent);

    const duplicateFormData = new FormData();
    duplicateFormData.append('file', fs.createReadStream(testFilePath));
    duplicateFormData.append('caseId', caseId);
    duplicateFormData.append('title', 'Duplicate Evidence');
    duplicateFormData.append('evidenceType', 'DOCUMENT');
    duplicateFormData.append('collectedAt', new Date().toISOString());

    const duplicateResponse = await fetch(`${API_BASE}/evidence`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
        },
        body: duplicateFormData,
    });

    const duplicateResult = await duplicateResponse.json();

    if (!duplicateResult.success) {
        console.log('   ✅ Correctly rejected duplicate file');
        console.log('   Error:', duplicateResult.error);
    } else {
        console.log('   ❌ Allowed duplicate file upload!');
    }

    fs.unlinkSync(testFilePath);

    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 7: Search evidence
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('🔎 TEST 7: Search Evidence');
    console.log('   Endpoint: GET /api/evidence?search=test');

    const searchResponse = await testAPI('/evidence?search=test', 'GET', undefined, token);

    if (searchResponse.success) {
        console.log('   ✅ Search results retrieved');
        console.log('   Matching evidence:', searchResponse.data.evidences.length);
    } else {
        console.log('   ❌ Failed:', searchResponse.error);
    }

    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Summary
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  TEST SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('✅ All evidence API tests completed');
    console.log('\n📌 Created Test Evidence:');
    console.log(`   ID: ${createdEvidenceId}`);
    console.log(`   Case ID: ${caseId}`);
    console.log('\n💡 Use this evidence ID to test verification endpoints\n');
}

// Run tests
testEvidenceAPI().catch(console.error);