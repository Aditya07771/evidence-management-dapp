/**
 * Blockchain Contract Utilities
 * Ethers.js integration for EvidenceRegistry smart contract
 */

import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import {
    ContractCallResult,
    EvidenceOnChain,
    CustodyRecordOnChain,
    TransferRequestOnChain,
    NumberToEvidenceStatus,
    NumberToEvidenceType,
} from './types';
import { hashText } from './hash';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIGURATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

if (!PRIVATE_KEY) {
    console.warn('⚠️  PRIVATE_KEY not set - write operations will fail');
}

if (!CONTRACT_ADDRESS) {
    console.warn('⚠️  CONTRACT_ADDRESS not set - contract calls will fail');
}

// Load ABI
let contractABI: any[] = [];
try {
    const artifactPath = path.join(
        process.cwd(),
        'src/contracts/artifacts/contracts/EvidenceRegistry.sol/EvidenceRegistry.json'
    );
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    contractABI = artifact.abi;
} catch (error) {
    console.error('❌ Failed to load contract ABI:', error);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROVIDER & SIGNER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

let providerInstance: ethers.JsonRpcProvider | null = null;
let signerInstance: ethers.Wallet | null = null;
let contractInstance: ethers.Contract | null = null;
let readContractInstance: ethers.Contract | null = null;

/**
 * Get or create provider instance (singleton)
 */
export function getProvider(): ethers.JsonRpcProvider {
    if (!providerInstance) {
        providerInstance = new ethers.JsonRpcProvider(RPC_URL);
    }
    return providerInstance;
}

/**
 * Get or create signer instance (singleton)
 * Uses PRIVATE_KEY from environment
 */
export function getSigner(): ethers.Wallet {
    if (!signerInstance) {
        if (!PRIVATE_KEY) {
            throw new Error('PRIVATE_KEY not set in environment');
        }
        const provider = getProvider();
        signerInstance = new ethers.Wallet(PRIVATE_KEY, provider);
    }
    return signerInstance;
}

/**
 * Get contract instance with signer (for write operations)
 */
export function getContract(): ethers.Contract {
    if (!contractInstance) {
        if (!CONTRACT_ADDRESS) {
            throw new Error('CONTRACT_ADDRESS not set in environment');
        }
        const signer = getSigner();
        contractInstance = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer);
    }
    return contractInstance;
}

/**
 * Get contract instance with provider only (for read operations)
 */
export function getReadContract(): ethers.Contract {
    if (!readContractInstance) {
        if (!CONTRACT_ADDRESS) {
            throw new Error('CONTRACT_ADDRESS not set in environment');
        }
        const provider = getProvider();
        readContractInstance = new ethers.Contract(
            CONTRACT_ADDRESS,
            contractABI,
            provider
        );
    }
    return readContractInstance;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ROLE CONSTANTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const ROLE_ADMIN = ethers.id('ADMIN_ROLE');
export const ROLE_INVESTIGATOR = ethers.id('INVESTIGATOR_ROLE');
export const ROLE_AUDITOR = ethers.id('AUDITOR_ROLE');

/**
 * Get role constant by name
 */
export function getRoleConstant(roleName: string): string {
    switch (roleName.toUpperCase()) {
        case 'ADMIN':
        case 'ADMIN_ROLE':
            return ROLE_ADMIN;
        case 'INVESTIGATOR':
        case 'INVESTIGATOR_ROLE':
            return ROLE_INVESTIGATOR;
        case 'AUDITOR':
        case 'AUDITOR_ROLE':
            return ROLE_AUDITOR;
        default:
            throw new Error(`Unknown role: ${roleName}`);
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WRITE FUNCTIONS (require signer)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Register a new officer on the blockchain
 */
export async function registerOfficer(
    wallet: string,
    name: string,
    badgeId: string,
    role: string
): Promise<ContractCallResult> {
    try {
        const contract = getContract();
        const nameHash = hashText(name);
        const badgeHash = hashText(badgeId);
        const roleBytes32 = getRoleConstant(role);

        const tx = await contract.registerOfficer(
            wallet,
            nameHash,
            badgeHash,
            roleBytes32
        );

        const receipt = await tx.wait(1);

        return {
            success: true,
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber,
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Failed to register officer',
        };
    }
}

/**
 * Register evidence on the blockchain
 */
export async function registerEvidence(params: {
    caseId: string;
    fileHash: string;
    fileURI: string;
    title: string;
    description: string;
    evidenceType: number;
    location: string;
    collectedAt: number; // Unix timestamp
    isSensitive: boolean;
}): Promise<ContractCallResult<{ evidenceId: string }>> {
    try {
        const contract = getContract();

        const caseIdBytes32 = hashText(params.caseId);
        const descriptionHash = hashText(params.description);
        const locationHash = hashText(params.location);

        const tx = await contract.registerEvidence(
            caseIdBytes32,
            params.fileHash,
            params.fileURI,
            params.title,
            descriptionHash,
            params.evidenceType,
            locationHash,
            params.collectedAt,
            params.isSensitive
        );

        const receipt = await tx.wait(1);

        // Parse event to get evidenceId
        let evidenceId = '';
        for (const log of receipt.logs) {
            try {
                const parsed = contract.interface.parseLog({
                    topics: log.topics as string[],
                    data: log.data,
                });
                if (parsed && parsed.name === 'EvidenceRegistered') {
                    evidenceId = parsed.args.evidenceId;
                    break;
                }
            } catch {
                continue;
            }
        }

        return {
            success: true,
            data: { evidenceId },
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber,
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Failed to register evidence',
        };
    }
}

/**
 * Update evidence status
 */
export async function updateEvidenceStatus(
    evidenceId: string,
    newStatus: number,
    reason: string
): Promise<ContractCallResult> {
    try {
        const contract = getContract();
        const actionHash = hashText(reason);

        const tx = await contract.updateEvidenceStatus(
            evidenceId,
            newStatus,
            actionHash
        );

        const receipt = await tx.wait(1);

        return {
            success: true,
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber,
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Failed to update evidence status',
        };
    }
}

/**
 * Transfer evidence (non-sensitive)
 */
export async function transferEvidence(
    evidenceId: string,
    toOfficer: string,
    reason: string
): Promise<ContractCallResult> {
    try {
        const contract = getContract();
        const reasonHash = hashText(reason);

        const tx = await contract.transferEvidence(evidenceId, toOfficer, reasonHash);
        const receipt = await tx.wait(1);

        return {
            success: true,
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber,
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Failed to transfer evidence',
        };
    }
}

/**
 * Request multi-sig transfer (sensitive evidence)
 */
export async function requestTransfer(
    evidenceId: string,
    proposedOwner: string,
    reason: string
): Promise<ContractCallResult<{ requestId: string }>> {
    try {
        const contract = getContract();
        const reasonHash = hashText(reason);

        const tx = await contract.requestTransfer(evidenceId, proposedOwner, reasonHash);
        const receipt = await tx.wait(1);

        // Parse event to get requestId
        let requestId = '';
        for (const log of receipt.logs) {
            try {
                const parsed = contract.interface.parseLog({
                    topics: log.topics as string[],
                    data: log.data,
                });
                if (parsed && parsed.name === 'TransferRequestCreated') {
                    requestId = parsed.args.requestId;
                    break;
                }
            } catch {
                continue;
            }
        }

        return {
            success: true,
            data: { requestId },
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber,
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Failed to request transfer',
        };
    }
}

/**
 * Approve transfer request
 */
export async function approveTransfer(
    requestId: string
): Promise<ContractCallResult> {
    try {
        const contract = getContract();
        const tx = await contract.approveTransfer(requestId);
        const receipt = await tx.wait(1);

        return {
            success: true,
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber,
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Failed to approve transfer',
        };
    }
}

/**
 * Execute approved transfer request
 */
export async function executeTransfer(
    requestId: string
): Promise<ContractCallResult> {
    try {
        const contract = getContract();
        const tx = await contract.executeTransfer(requestId);
        const receipt = await tx.wait(1);

        return {
            success: true,
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber,
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Failed to execute transfer',
        };
    }
}

/**
 * Cancel transfer request
 */
export async function cancelTransferRequest(
    requestId: string
): Promise<ContractCallResult> {
    try {
        const contract = getContract();
        const tx = await contract.cancelTransferRequest(requestId);
        const receipt = await tx.wait(1);

        return {
            success: true,
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber,
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Failed to cancel transfer request',
        };
    }
}

/**
 * Verify evidence authenticity (writes verification log on-chain)
 */
export async function verifyEvidence(
    evidenceId: string,
    submittedHash: string
): Promise<ContractCallResult<{
    isAuthentic: boolean;
    registeredHash: string;
    registeredAt: bigint;
}>> {
    try {
        const contract = getContract();
        const tx = await contract.verifyEvidence(evidenceId, submittedHash);
        const receipt = await tx.wait(1);

        // The return value is lost after mining, so we need to call again
        const readContract = getReadContract();
        const result = await readContract.verifyEvidence.staticCall(
            evidenceId,
            submittedHash
        );

        return {
            success: true,
            data: {
                isAuthentic: result.isAuthentic,
                registeredHash: result.registeredHash,
                registeredAt: result.registeredAt,
            },
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber,
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Failed to verify evidence',
        };
    }
}

/**
 * Deactivate officer
 */
export async function deactivateOfficer(
    wallet: string
): Promise<ContractCallResult> {
    try {
        const contract = getContract();
        const tx = await contract.deactivateOfficer(wallet);
        const receipt = await tx.wait(1);

        return {
            success: true,
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber,
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Failed to deactivate officer',
        };
    }
}

/**
 * Set sensitive flag on evidence
 */
export async function setSensitiveFlag(
    evidenceId: string,
    isSensitive: boolean
): Promise<ContractCallResult> {
    try {
        const contract = getContract();
        const tx = await contract.setSensitiveFlag(evidenceId, isSensitive);
        const receipt = await tx.wait(1);

        return {
            success: true,
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber,
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Failed to set sensitive flag',
        };
    }
}

/**
 * Force archive evidence (super admin only)
 */
export async function forceArchive(
    evidenceId: string,
    reason: string
): Promise<ContractCallResult> {
    try {
        const contract = getContract();
        const reasonHash = hashText(reason);
        const tx = await contract.forceArchive(evidenceId, reasonHash);
        const receipt = await tx.wait(1);

        return {
            success: true,
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber,
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Failed to force archive',
        };
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// READ FUNCTIONS (view/pure - no gas)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get evidence details from blockchain
 */
export async function getEvidenceDetails(
    evidenceId: string
): Promise<ContractCallResult<EvidenceOnChain>> {
    try {
        const contract = getReadContract();
        const evidence = await contract.getEvidenceDetails(evidenceId);

        return {
            success: true,
            data: evidence as EvidenceOnChain,
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Failed to get evidence details',
        };
    }
}

/**
 * Get evidence custody history
 */
export async function getEvidenceHistory(
    evidenceId: string
): Promise<ContractCallResult<CustodyRecordOnChain[]>> {
    try {
        const contract = getReadContract();
        const history = await contract.getEvidenceHistory(evidenceId);

        return {
            success: true,
            data: history as CustodyRecordOnChain[],
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Failed to get evidence history',
        };
    }
}

/**
 * Get all evidence IDs for a case
 */
export async function getEvidenceByCase(
    caseId: string
): Promise<ContractCallResult<string[]>> {
    try {
        const contract = getReadContract();
        const caseIdBytes32 = hashText(caseId);
        const evidenceIds = await contract.getEvidenceByCase(caseIdBytes32);

        return {
            success: true,
            data: evidenceIds,
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Failed to get evidence by case',
        };
    }
}

/**
 * Quick verify (read-only, no gas)
 */
export async function quickVerify(
    evidenceId: string,
    fileHash: string
): Promise<ContractCallResult<boolean>> {
    try {
        const contract = getReadContract();
        const isAuthentic = await contract.quickVerify(evidenceId, fileHash);

        return {
            success: true,
            data: isAuthentic,
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Failed to quick verify',
        };
    }
}

/**
 * Check if file hash is already registered
 */
export async function isFileHashRegistered(
    fileHash: string
): Promise<ContractCallResult<boolean>> {
    try {
        const contract = getReadContract();
        const isRegistered = await contract.isFileHashRegistered(fileHash);

        return {
            success: true,
            data: isRegistered,
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Failed to check file hash',
        };
    }
}

/**
 * Get transfer request details
 */
export async function getTransferRequest(
    requestId: string
): Promise<ContractCallResult<TransferRequestOnChain>> {
    try {
        const contract = getReadContract();
        const request = await contract.getTransferRequest(requestId);

        return {
            success: true,
            data: request as TransferRequestOnChain,
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Failed to get transfer request',
        };
    }
}

/**
 * Get evidence status summary
 */
export async function getEvidenceStatus(evidenceId: string): Promise<
    ContractCallResult<{
        status: number;
        currentOwner: string;
        custodyCount: bigint;
    }>
> {
    try {
        const contract = getReadContract();
        const result = await contract.getEvidenceStatus(evidenceId);

        return {
            success: true,
            data: {
                status: result.status,
                currentOwner: result.currentOwner,
                custodyCount: result.custodyCount,
            },
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Failed to get evidence status',
        };
    }
}

/**
 * Get total evidence count
 */
export async function getTotalEvidenceCount(): Promise<
    ContractCallResult<number>
> {
    try {
        const contract = getReadContract();
        const count = await contract.totalEvidenceCount();

        return {
            success: true,
            data: Number(count),
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Failed to get total evidence count',
        };
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Parse evidence status number to enum label
 */
export function parseEvidenceStatus(statusNum: number): string {
    const status = NumberToEvidenceStatus[statusNum];
    return status || 'UNKNOWN';
}

/**
 * Parse evidence type number to enum label
 */
export function parseEvidenceType(typeNum: number): string {
    const type = NumberToEvidenceType[typeNum];
    return type || 'OTHER';
}

/**
 * Convert timestamp to Date
 */
export function timestampToDate(timestamp: bigint): Date {
    return new Date(Number(timestamp) * 1000);
}

/**
 * Get current block number
 */
export async function getCurrentBlockNumber(): Promise<number> {
    const provider = getProvider();
    return await provider.getBlockNumber();
}

/**
 * Get gas price
 */
export async function getGasPrice(): Promise<bigint> {
    const provider = getProvider();
    const feeData = await provider.getFeeData();
    return feeData.gasPrice || BigInt(0);
}

/**
 * Estimate gas for a transaction
 */
export async function estimateGas(
    contractMethod: string,
    ...args: any[]
): Promise<bigint> {
    try {
        const contract = getContract();
        return await contract[contractMethod].estimateGas(...args);
    } catch (error: any) {
        console.error('Gas estimation failed:', error);
        return BigInt(0);
    }
}