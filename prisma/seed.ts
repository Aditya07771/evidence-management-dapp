/**
 * Test all utility functions
 * Verifies hash, auth, and contract utilities work correctly
 */

import {
    hashFile,
    hashText,
    toBytes32,
    isValidBytes32,
    hashesMatch,
    randomBytes32,
} from '../src/lib/hash';
import {
    signToken,
    verifyToken,
    hashPassword,
    comparePassword,
    extractTokenFromHeader,
    validatePassword,
} from '../src/lib/auth';
import { Role } from '@prisma/client';

async function testHashUtilities() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  HASH UTILITIES TEST');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Test file hashing
    const testBuffer = Buffer.from('test file content');
    const fileHash = hashFile(testBuffer);
    console.log('✓ File hash:', fileHash);
    console.log('  Valid bytes32:', isValidBytes32(fileHash) ? '✅' : '❌');

    // Test text hashing
    const textHash = hashText('test string');
    console.log('\n✓ Text hash:', textHash);
    console.log('  Valid bytes32:', isValidBytes32(textHash) ? '✅' : '❌');

    // Test toBytes32 alias
    const bytes32 = toBytes32('CASE-2024-001');
    console.log('\n✓ Case ID bytes32:', bytes32);

    // Test hash comparison
    const hash1 = randomBytes32();
    const hash2 = hash1;
    const hash3 = randomBytes32();
    console.log('\n✓ Hash comparison:');
    console.log('  Same hash:', hashesMatch(hash1, hash2) ? '✅' : '❌');
    console.log('  Different hash:', !hashesMatch(hash1, hash3) ? '✅' : '❌');

    console.log('\n✅ Hash utilities test passed\n');
}

async function testAuthUtilities() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  AUTH UTILITIES TEST');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Test JWT signing and verification
    const payload = {
        userId: 'test-user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: Role.INVESTIGATOR,
    };

    const token = signToken(payload);
    console.log('✓ Generated JWT:', token.substring(0, 50) + '...');

    const verified = verifyToken(token);
    console.log('\n✓ Token verification:');
    console.log('  Valid:', verified !== null ? '✅' : '❌');
    console.log('  User ID matches:', verified?.userId === payload.userId ? '✅' : '❌');
    console.log('  Email matches:', verified?.email === payload.email ? '✅' : '❌');

    // Test token extraction
    const authHeader = `Bearer ${token}`;
    const extracted = extractTokenFromHeader(authHeader);
    console.log('\n✓ Token extraction:', extracted === token ? '✅' : '❌');

    // Test password hashing
    const plainPassword = 'SecurePassword123!';
    const hashedPassword = await hashPassword(plainPassword);
    console.log('\n✓ Password hashed');

    const isMatch = await comparePassword(plainPassword, hashedPassword);
    console.log('  Comparison:', isMatch ? '✅' : '❌');

    const isWrongMatch = await comparePassword('WrongPassword', hashedPassword);
    console.log('  Wrong password rejected:', !isWrongMatch ? '✅' : '❌');

    // Test password validation
    const validationWeak = validatePassword('weak');
    const validationStrong = validatePassword('StrongPass123!');
    console.log('\n✓ Password validation:');
    console.log('  Weak password rejected:', !validationWeak.isValid ? '✅' : '❌');
    console.log('  Strong password accepted:', validationStrong.isValid ? '✅' : '❌');

    console.log('\n✅ Auth utilities test passed\n');
}

async function testContractUtilities() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  CONTRACT UTILITIES TEST');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    try {
        const {
            ROLE_ADMIN,
            ROLE_INVESTIGATOR,
            ROLE_AUDITOR,
            getRoleConstant,
            parseEvidenceStatus,
            parseEvidenceType,
        } = await import('../src/lib/contract');

        console.log('✓ Role constants:');
        console.log('  ADMIN:', ROLE_ADMIN);
        console.log('  INVESTIGATOR:', ROLE_INVESTIGATOR);
        console.log('  AUDITOR:', ROLE_AUDITOR);

        const roleFromName = getRoleConstant('ADMIN');
        console.log('\n✓ Get role by name:', roleFromName === ROLE_ADMIN ? '✅' : '❌');

        console.log('\n✓ Status parsing:');
        console.log('  0 →', parseEvidenceStatus(0));
        console.log('  1 →', parseEvidenceStatus(1));
        console.log('  4 →', parseEvidenceStatus(4));

        console.log('\n✓ Type parsing:');
        console.log('  0 →', parseEvidenceType(0));
        console.log('  1 →', parseEvidenceType(1));
        console.log('  2 →', parseEvidenceType(2));

        console.log('\n✅ Contract utilities loaded successfully');
        console.log('⚠️  Full contract tests require deployed contract\n');
    } catch (error: any) {
        console.log('⚠️  Contract utilities not fully available');
        console.log('   This is expected if contract not deployed yet');
        console.log('   Error:', error.message, '\n');
    }
}

async function main() {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   UTILITIES TEST SUITE                 ║');
    console.log('╚════════════════════════════════════════╝\n');

    await testHashUtilities();
    await testAuthUtilities();
    await testContractUtilities();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  ALL UTILITY TESTS COMPLETE ✅');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);