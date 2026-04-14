/**
 * Test transfer and verification API endpoints
 * Run with: ts-node scripts/test-transfer-verify-api.ts
 */

export {};
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

async function testTransferVerifyAPI() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  TRANSFER & VERIFICATION API TEST');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Get tokens for different users
    console.log('🔐 Getting authentication tokens...');
    const investigator1Token = await getAuthToken('officer.smith@evidence.gov');
    const investigator2Token = await getAuthToken('officer.jones@evidence.gov');
    const adminToken = await getAuthToken('admin@evidence.gov');
    console.log('✅ Tokens obtained\n');

    // Get user IDs
    const user1Response = await testAPI('/auth/me', 'GET', undefined, investigator1Token);
    const user2Response = await testAPI('/auth/me', 'GET', undefined, investigator2Token);
    const user1Id = user1Response.data.id;
    const user2Id = user2Response.data.id;

    // Get existing evidence
    const evidenceListResponse = await testAPI('/evidence?limit=1', 'GET', undefined, investigator1Token);
    if (!evidenceListResponse.success || evidenceListResponse.data.evidences.length === 0) {
        console.log('⚠️  No evidence found. Run test-evidence-api.ts first\n');
        return;
    }

    const evidenceId = evidenceListResponse.data.evidences[0].id;
    const evidenceHash = evidenceListResponse.data.evidences[0].fileHash;

    console.log(`📦 Using evidence: ${evidenceId}\n`);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 1: Simple evidence transfer
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('🔄 TEST 1: Simple Evidence Transfer');
    console.log(`   Endpoint: POST /api/evidence/${evidenceId}/transfer`);

    const transferData = {
        toUserId: user2Id,
        reason: 'Transferring for forensic analysis',
    };

    const transferResponse = await testAPI(
        `/evidence/${evidenceId}/transfer`,
        'POST',
        transferData,
        investigator1Token
    );

    if (transferResponse.success) {
        console.log('   ✅ Transfer successful');
        console.log('   From:', transferResponse.data.transfer.from);
        console.log('   To:', transferResponse.data.transfer.to);
        console.log('   Blockchain transferred:', transferResponse.data.blockchain.transferred);
        if (transferResponse.data.blockchain.txHash) {
            console.log('   Tx Hash:', transferResponse.data.blockchain.txHash);
        }
    } else {
        console.log('   ❌ Failed:', transferResponse.error);
    }

    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 2: Quick verify (read-only)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('✓ TEST 2: Quick Verify (Read-Only)');
    console.log('   Endpoint: POST /api/verify/quick');

    const quickVerifyData = {
        evidenceId,
        fileHash: evidenceHash,
    };

    const quickVerifyResponse = await testAPI(
        '/verify/quick',
        'POST',
        quickVerifyData,
        investigator2Token
    );

    if (quickVerifyResponse.success) {
        console.log('   ✅ Quick verification completed');
        console.log('   Authentic:', quickVerifyResponse.data.isAuthentic);
        console.log('   Database match:', quickVerifyResponse.data.verification.databaseMatch);
        console.log('   Blockchain match:', quickVerifyResponse.data.verification.blockchainMatch);
        console.log('   Both match:', quickVerifyResponse.data.verification.bothMatch);
    } else {
        console.log('   ❌ Failed:', quickVerifyResponse.error);
    }

    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 3: Full verification with file upload
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('📁 TEST 3: Full Verification with File Upload');
    console.log(`   Endpoint: POST /api/evidence/${evidenceId}/verify`);

    // Create a test file with same content
    const testFilePath = path.join(__dirname, 'verify-test.txt');
    const testContent = 'Test verification content';
    fs.writeFileSync(testFilePath, testContent);

    const verifyFormData = new FormData();
    verifyFormData.append('file', fs.createReadStream(testFilePath));

    const verifyResponse = await fetch(
        `${API_BASE}/evidence/${evidenceId}/verify`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${investigator2Token}`,
            },
            body: verifyFormData,
        }
    );

    const verifyResult = await verifyResponse.json();

    if (verifyResult.success) {
        console.log('   ✅ Verification completed');
        console.log('   Authentic:', verifyResult.data.verification.isAuthentic);
        console.log('   Hashes match:', verifyResult.data.verification.hashesMatch);
        console.log('   Blockchain verified:', verifyResult.data.blockchain.verified);
        if (verifyResult.data.blockchain.txHash) {
            console.log('   Tx Hash:', verifyResult.data.blockchain.txHash);
        }
    } else {
        console.log('   ❌ Failed:', verifyResult.error);
    }

    fs.unlinkSync(testFilePath);

    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 4: Batch verification
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('📊 TEST 4: Batch Verification');
    console.log('   Endpoint: POST /api/verify/batch');

    const batchData = {
        items: [
            {
                evidenceId,
                fileHash: evidenceHash,
            },
        ],
    };

    const batchResponse = await testAPI('/verify/batch', 'POST', batchData, investigator2Token);

    if (batchResponse.success) {
        console.log('   ✅ Batch verification completed');
        console.log('   Total items:', batchResponse.data.summary.total);
        console.log('   Verified:', batchResponse.data.summary.verified);
        console.log('   Authentic:', batchResponse.data.summary.authentic);
        console.log('   Tampered:', batchResponse.data.summary.tampered);
    } else {
        console.log('   ❌ Failed:', batchResponse.error);
    }

    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 5: Multi-sig transfer request (for sensitive evidence)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('🔐 TEST 5: Create Multi-Sig Transfer Request');
    console.log('   Endpoint: POST /api/transfer-requests');

    // First, mark evidence as sensitive (admin action)
    // ... (skip for this test unless evidence is already sensitive)

    console.log('   (Skipping - requires sensitive evidence)\n');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 6: Get transfer requests
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('📋 TEST 6: Get Pending Transfer Requests');
    console.log('   Endpoint: GET /api/transfer-requests');

    const requestsResponse = await testAPI('/transfer-requests', 'GET', undefined, adminToken);

    if (requestsResponse.success) {
        console.log('   ✅ Requests retrieved');
        console.log('   Total pending:', requestsResponse.data.total);
    } else {
        console.log('   ❌ Failed:', requestsResponse.error);
    }

    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Summary
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  TEST SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('✅ All transfer & verification tests completed\n');
}

// Run tests
testTransferVerifyAPI().catch(console.error);
