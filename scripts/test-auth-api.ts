/**
 * Test authentication API endpoints
 * Run with: ts-node scripts/test-auth-api.ts
 */

export {};
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

async function testAuthFlow() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  AUTHENTICATION API TEST');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Test data
    const testUser = {
        email: `test.officer.${Date.now()}@evidence.gov`,
        password: 'SecurePassword123!',
        name: 'Test Officer',
        badgeId: `TEST-${Date.now()}`,
        role: 'INVESTIGATOR',
        walletAddress: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    };

    let authToken = '';

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 1: Register new user
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('📝 TEST 1: Register New User');
    console.log('   Endpoint: POST /api/auth/register');
    console.log('   Data:', JSON.stringify(testUser, null, 2));

    const registerResponse = await testAPI('/auth/register', 'POST', testUser);

    if (registerResponse.success) {
        console.log('   ✅ Registration successful');
        console.log('   User ID:', registerResponse.data.user.id);
        console.log('   Token received:', registerResponse.data.token ? 'Yes' : 'No');
        console.log('   Blockchain registered:', registerResponse.data.blockchainRegistered);
        if (registerResponse.data.txHash) {
            console.log('   Tx Hash:', registerResponse.data.txHash);
        }
        authToken = registerResponse.data.token;
    } else {
        console.log('   ❌ Registration failed:', registerResponse.error);
    }

    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 2: Login with credentials
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('🔐 TEST 2: Login with Credentials');
    console.log('   Endpoint: POST /api/auth/login');

    const loginResponse = await testAPI('/auth/login', 'POST', {
        email: testUser.email,
        password: testUser.password,
    });

    if (loginResponse.success) {
        console.log('   ✅ Login successful');
        console.log('   User:', loginResponse.data.user.name);
        console.log('   Role:', loginResponse.data.user.role);
        console.log('   Token received:', loginResponse.data.token ? 'Yes' : 'No');
        authToken = loginResponse.data.token; // Update token
    } else {
        console.log('   ❌ Login failed:', loginResponse.error);
    }

    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 3: Login with wrong password
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('❌ TEST 3: Login with Wrong Password');
    console.log('   Endpoint: POST /api/auth/login');

    const wrongLoginResponse = await testAPI('/auth/login', 'POST', {
        email: testUser.email,
        password: 'WrongPassword123!',
    });

    if (!wrongLoginResponse.success) {
        console.log('   ✅ Correctly rejected invalid password');
        console.log('   Error:', wrongLoginResponse.error);
    } else {
        console.log('   ❌ Security issue: accepted wrong password!');
    }

    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 4: Get current user profile
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('👤 TEST 4: Get Current User Profile');
    console.log('   Endpoint: GET /api/auth/me');

    const meResponse = await testAPI('/auth/me', 'GET', undefined, authToken);

    if (meResponse.success) {
        console.log('   ✅ Profile retrieved');
        console.log('   ID:', meResponse.data.id);
        console.log('   Name:', meResponse.data.name);
        console.log('   Email:', meResponse.data.email);
        console.log('   Badge ID:', meResponse.data.badgeId);
        console.log('   Role:', meResponse.data.role);
        console.log('   Wallet:', meResponse.data.walletAddress);
        console.log('   Active:', meResponse.data.isActive);
    } else {
        console.log('   ❌ Failed to get profile:', meResponse.error);
    }

    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 5: Access protected route without token
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('🚫 TEST 5: Access Protected Route Without Token');
    console.log('   Endpoint: GET /api/auth/me (no token)');

    const unauthorizedResponse = await testAPI('/auth/me', 'GET');

    if (!unauthorizedResponse.success) {
        console.log('   ✅ Correctly rejected unauthorized request');
        console.log('   Error:', unauthorizedResponse.error);
    } else {
        console.log('   ❌ Security issue: allowed access without token!');
    }

    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 6: Duplicate email registration
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('🔄 TEST 6: Duplicate Email Registration');
    console.log('   Endpoint: POST /api/auth/register');

    const duplicateResponse = await testAPI('/auth/register', 'POST', {
        ...testUser,
        badgeId: `DIFFERENT-${Date.now()}`, // Different badge
    });

    if (!duplicateResponse.success) {
        console.log('   ✅ Correctly rejected duplicate email');
        console.log('   Error:', duplicateResponse.error);
    } else {
        console.log('   ❌ Allowed duplicate email registration!');
    }

    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 7: Invalid validation (weak password)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('⚠️  TEST 7: Validation - Weak Password');
    console.log('   Endpoint: POST /api/auth/register');

    const weakPasswordResponse = await testAPI('/auth/register', 'POST', {
        email: `test.${Date.now()}@example.com`,
        password: 'weak',
        name: 'Test',
        badgeId: `TEST-${Date.now()}`,
        role: 'INVESTIGATOR',
    });

    if (!weakPasswordResponse.success) {
        console.log('   ✅ Correctly rejected weak password');
        console.log('   Error:', weakPasswordResponse.error);
    } else {
        console.log('   ❌ Accepted weak password!');
    }

    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 8: Register without wallet (blockchain optional)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('📋 TEST 8: Register Without Wallet Address');
    console.log('   Endpoint: POST /api/auth/register');

    const noWalletUser = {
        email: `no.wallet.${Date.now()}@evidence.gov`,
        password: 'SecurePassword123!',
        name: 'No Wallet Officer',
        badgeId: `NOWALLET-${Date.now()}`,
        role: 'AUDITOR',
        // No walletAddress
    };

    const noWalletResponse = await testAPI('/auth/register', 'POST', noWalletUser);

    if (noWalletResponse.success) {
        console.log('   ✅ Registration successful without wallet');
        console.log('   Blockchain registered:', noWalletResponse.data.blockchainRegistered);
        console.log('   Expected: false, Actual:', noWalletResponse.data.blockchainRegistered);
    } else {
        console.log('   ❌ Registration failed:', noWalletResponse.error);
    }

    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Summary
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  TEST SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('✅ All authentication API tests completed');
    console.log('\n📌 Test User Credentials:');
    console.log(`   Email: ${testUser.email}`);
    console.log(`   Password: ${testUser.password}`);
    console.log(`   Badge ID: ${testUser.badgeId}`);
    console.log(`   Token: ${authToken.substring(0, 30)}...`);
    console.log('\n💡 Use these credentials to test other endpoints\n');
}

// Run tests
testAuthFlow().catch(console.error);
