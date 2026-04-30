# Evidence Management System — DApp

A blockchain-backed digital evidence management platform for law enforcement. Files are stored off-chain (local/IPFS); cryptographic hashes and custody records are anchored on Ethereum for tamper-proof auditability.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend + API | Next.js 14 (App Router) |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT (Bearer tokens) |
| Blockchain | Solidity 0.8.20, Hardhat, Ethers.js |
| Network | Ethereum Sepolia Testnet |

---

## Architecture Overview

```
Browser (Next.js UI)
      │
      ▼
Next.js API Routes          ──►  PostgreSQL (primary store)
      │                               │
      ▼                               ▼
lib/contract.ts             Prisma ORM (db-helpers)
      │
      ▼
EvidenceRegistry.sol  (Sepolia)
  - Stores file hashes
  - Tracks chain of custody
  - Multi-sig for sensitive evidence
```

Every write goes to Postgres first. Blockchain registration is supplementary — failures are logged but do not block the API response.

---

## Project Structure

```
├── app/
│   ├── (auth)/             # Login & Register pages
│   ├── admin/              # Audit logs, officer management
│   ├── api/                # All API route handlers
│   │   ├── auth/           # login, register, me
│   │   ├── cases/          # CRUD + status transitions
│   │   ├── evidence/       # Upload, transfer, verify
│   │   ├── transfer-requests/  # Multi-sig flow
│   │   └── admin/          # Stats, officers, audit logs
│   ├── cases/              # Case list, detail, create
│   ├── evidence/           # Evidence list, detail, upload
│   └── verify/             # Quick verify, batch verify
├── Blockchain/
│   ├── contracts/EvidenceRegistry.sol
│   └── scripts/            # deploy.ts, registerAdmin.ts
└── prisma/schema.prisma
```

---

## Roles & Permissions

| Action | ADMIN | INVESTIGATOR | AUDITOR |
|---|:---:|:---:|:---:|
| Register/upload evidence | ✅ | ✅ | ❌ |
| Transfer evidence (non-sensitive) | ✅ | ✅ | ❌ |
| Create transfer request (sensitive) | ✅ | ✅ | ❌ |
| Approve transfer request | ✅ | ❌ | ❌ |
| Verify evidence | ✅ | ✅ | ✅ |
| View cases & evidence | ✅ | ✅ | ✅ |
| Manage officers | ✅ | ❌ | ❌ |
| View audit logs | ✅ | ❌ | ❌ |
| Force archive evidence | ✅ | ❌ | ❌ |

---

## Evidence Lifecycle

```
COLLECTED → SUBMITTED → UNDER_REVIEW → TRANSFERRED
                                     ↘ ARCHIVED
                                     ↘ REJECTED
```

`ARCHIVED` and `REJECTED` are terminal states. Admins can force-archive from any state.

---

## Sensitive Evidence (Multi-Sig Flow)

Evidence flagged `isSensitive = true` cannot be directly transferred. It requires:

1. Owner/admin calls `POST /api/transfer-requests` → creates a pending request
2. **N admins** call `POST /api/transfer-requests/:id/approve` (default N = 2)
3. Anyone calls `POST /api/transfer-requests/:id/execute` once approvals are met

The same logic is mirrored on-chain via `requestTransfer → approveTransfer → executeTransfer`.

---

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL database
- (Optional) Ethereum wallet + Sepolia RPC for blockchain features

### 1. Install dependencies

```bash
npm install
cd Blockchain && npm install
```

### 2. Configure environment

```env
# .env (root)
DATABASE_URL="postgresql://user:pass@localhost:5432/evidence_db"
JWT_SECRET="your-secret-key"
CONTRACT_ADDRESS="0x..."          # after deploying
PRIVATE_KEY="your-wallet-key"     # for blockchain writes
RPC_URL="https://sepolia.rpc..."
REQUIRED_APPROVALS=2

# Blockchain/.env
PRIVATE_KEY="your-wallet-key"
CONTRACT_ADDRESS="0x..."
TEST_ADMIN_WALLET="0x..."
TEST_ADMIN_NAME="Admin Name"
TEST_ADMIN_BADGE="BADGE-001"
```

### 3. Database setup

```bash
npx prisma migrate dev
npx prisma generate
```

### 4. Deploy smart contract (optional)

```bash
cd Blockchain
npx hardhat run scripts/deploy.ts --network sepolia
# Copy CONTRACT_ADDRESS from output to .env

npx hardhat run scripts/registerAdmin.ts --network sepolia
```

### 5. Run the app

```bash
npm run dev
```

---

## Key API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new officer |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Current user profile |

### Cases
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/cases` | List cases (paginated, filterable) |
| POST | `/api/cases` | Create case |
| GET | `/api/cases/:id` | Case detail + evidence list |
| PATCH | `/api/cases/:id/status` | Update case status |

### Evidence
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/evidence` | List/search evidence |
| POST | `/api/evidence` | Upload evidence file (multipart) |
| GET | `/api/evidence/:id` | Detail + custody history + verifications |
| POST | `/api/evidence/:id/transfer` | Direct transfer (non-sensitive) |
| POST | `/api/evidence/:id/verify` | Verify with file upload |

### Transfer Requests (Sensitive)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/transfer-requests` | Create request |
| POST | `/api/transfer-requests/:id/approve` | Admin approve |
| POST | `/api/transfer-requests/:id/execute` | Execute once approved |
| POST | `/api/transfer-requests/:id/cancel` | Cancel request |

### Verification
| Method | Endpoint | Description |
|---|---|---|
| POST | `/verify/quick` | Hash-only check, no blockchain write |
| POST | `/verify/batch` | Up to 50 items at once |

### Admin
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/stats` | System-wide statistics |
| GET | `/api/admin/officers` | List all officers |
| POST | `/api/admin/officers/:id/deactivate` | Deactivate officer |
| POST | `/api/admin/officers/:id/reactivate` | Reactivate officer |
| GET | `/api/admin/audit-logs` | System audit log |
| POST | `/api/admin/evidence/:id/force-archive` | Emergency archive |
| PATCH | `/api/admin/evidence/:id/sensitive` | Toggle sensitive flag |

---

## Smart Contract — EvidenceRegistry.sol

Deployed on Sepolia. Key properties:

- **No external dependencies** — pure Solidity, no OpenZeppelin imports
- File content is never stored on-chain; only the SHA-256 hash
- Privacy-sensitive fields (description, location, name) stored as `keccak256` hashes
- `evidenceId` = `keccak256(caseId + fileHash + timestamp + counter)` — globally unique
- `quickVerify()` is a gas-free `view` function for read-only hash checks
- `forceArchive()` restricted to `superAdmin` only
- Super-admin can be transferred via `transferSuperAdmin()`

### Contract Functions Summary

```
registerOfficer / deactivateOfficer / reactivateOfficer
registerEvidence → returns evidenceId (bytes32)
updateEvidenceStatus
transferEvidence (non-sensitive)
requestTransfer / approveTransfer / executeTransfer / cancelTransferRequest
verifyEvidence / batchVerifyEvidence / quickVerify
setSensitiveFlag / forceArchive
getEvidenceDetails / getEvidenceHistory / getEvidenceByCase
```

---

## Database Schema (Key Models)

- **User** — officers with role, badge ID, optional wallet address
- **Case** — groups evidence; statuses: OPEN → CLOSED → ARCHIVED
- **Evidence** — file metadata, hash, status, blockchain sync fields
- **CustodyLog** — append-only chain-of-custody trail per evidence item
- **Verification** — each hash-check attempt logged with result
- **TransferRequest** — multi-sig state for sensitive evidence transfers
- **AuditLog** — system-wide action log (login, register, transfers, etc.)

---

## Important Notes

- Blockchain registration is **optional/supplementary**. The system works fully without a deployed contract.
- Files are stored locally (or IPFS). Only hashes go on-chain.
- `REQUIRED_APPROVALS` defaults to `2` and is configurable both in `.env` and on-chain via `setRequiredApprovals()`.
- Deactivated officers retain all historical records — nothing is deleted.
- JWT tokens must be passed as `Authorization: Bearer <token>` on all protected routes.
