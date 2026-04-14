import { PrismaClient, Role, CaseStatus, EvidenceType, EvidenceStatus } from '@prisma/client';
import { hashPassword } from '../src/lib/auth';
import { hashFile } from '../src/lib/hash';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   DATABASE SEEDING                     ║');
    console.log('╚════════════════════════════════════════╝\n');

    // Clean up existing data to prevent duplicates (optional, comment out in production)
    console.log('Clearing old data...');
    await prisma.custodyLog.deleteMany();
    await prisma.verification.deleteMany();
    await prisma.transferRequest.deleteMany();
    await prisma.evidence.deleteMany();
    await prisma.case.deleteMany();
    await prisma.user.deleteMany();

    // 1. Create a User (Investigator)
    console.log('Creating users...');
    const hashedPwd = await hashPassword('Admin123!');
    const investigator = await prisma.user.create({
        data: {
            name: 'John Doe Investigates',
            email: 'investigator@evidencesync.com',
            passwordHash: hashedPwd,
            badgeId: 'BDG-INV-001',
            role: Role.INVESTIGATOR,
        },
    });

    // 2. Create 5 Cases
    console.log('Creating 5 Cases...');
    const cases = [];
    for (let i = 1; i <= 5; i++) {
        const c = await prisma.case.create({
            data: {
                caseNumber: `CASE-2024-00${i}`,
                title: `State vs. Suspect ${i}`,
                description: `A detailed investigation file for case number ${i} involving digital and physical evidence.`,
                status: CaseStatus.OPEN,
            },
        });
        cases.push(c);
    }

    // 3. Create 5 Evidences
    console.log('Creating 5 Evidences...');
    const evidenceData = [
        { title: 'Security Footage', type: EvidenceType.VIDEO },
        { title: 'Financial Records', type: EvidenceType.DOCUMENT },
        { title: 'Audio Recording Device', type: EvidenceType.PHYSICAL },
        { title: 'Encrypted Hard Drive', type: EvidenceType.DIGITAL },
        { title: 'Witness Testimony Transcripts', type: EvidenceType.DOCUMENT }
    ];

    for (let i = 0; i < 5; i++) {
        const dummyFileContent = Buffer.from(`fake-file-content-${i}`);
        const fileHash = hashFile(dummyFileContent);

        await prisma.evidence.create({
            data: {
                caseId: cases[i].id,
                title: evidenceData[i].title,
                description: `Collected ${evidenceData[i].type} evidence related to ${cases[i].caseNumber}`,
                evidenceType: evidenceData[i].type,
                fileHash: fileHash,
                fileURI: `/uploads/mock-${i}.pdf`,
                fileName: `mock-${i}.pdf`,
                fileSize: 1024 * i + 1024,
                locationText: 'Evidence Locker Room B',
                collectedAt: new Date(Date.now() - 100000000 * (i + 1)),
                status: EvidenceStatus.COLLECTED,
                collectedById: investigator.id,
                currentOwnerId: investigator.id,
                isSensitive: i % 2 === 0,
            },
        });
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  SEEDING COMPLETE ✅');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });