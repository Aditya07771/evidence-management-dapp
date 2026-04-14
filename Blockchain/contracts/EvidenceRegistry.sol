// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EvidenceRegistry
 * @author Evidence Management System
 * @notice Tamper-proof digital evidence tracking system on Ethereum blockchain.
 *         Stores cryptographic hashes and metadata of evidence files.
 *         Actual files are stored off-chain (IPFS / cloud storage).
 * @dev    Roles: ADMIN_ROLE, INVESTIGATOR_ROLE, AUDITOR_ROLE
 *         Deploy on Sepolia testnet for development/testing.
 */

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES & IMPORTS (inline, no external dependencies needed)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @dev Simple role-based access control without importing OpenZeppelin.
 *      For production you should replace this with OZ's AccessControl.
 */
contract EvidenceRegistry {

    // ─────────────────────────────────────────────────────────────────────────
    // CONSTANTS
    // ─────────────────────────────────────────────────────────────────────────

    bytes32 public constant ADMIN_ROLE       = keccak256("ADMIN_ROLE");
    bytes32 public constant INVESTIGATOR_ROLE = keccak256("INVESTIGATOR_ROLE");
    bytes32 public constant AUDITOR_ROLE     = keccak256("AUDITOR_ROLE");

    // ─────────────────────────────────────────────────────────────────────────
    // ENUMS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Lifecycle states for a piece of evidence.
     *      Transitions are restricted — not every jump is valid.
     *
     *  Collected → Submitted → UnderReview → Transferred
     *                                      ↘ Archived
     *                                      ↘ Rejected
     */
    enum EvidenceStatus {
        Collected,    // 0 - just collected from scene
        Submitted,    // 1 - submitted to system, awaiting review
        UnderReview,  // 2 - actively being reviewed
        Transferred,  // 3 - custody transferred to another officer
        Archived,     // 4 - case closed, stored permanently
        Rejected      // 5 - flagged as invalid or inadmissible
    }

    /**
     * @dev Supported evidence types for classification.
     */
    enum EvidenceType {
        Document,     // 0 - PDFs, Word docs, text files
        Image,        // 1 - photos, screenshots
        Video,        // 2 - surveillance footage, recordings
        Audio,        // 3 - call recordings, voice memos
        Digital,      // 4 - logs, dumps, binary data
        Physical,     // 5 - physical item digitised (photo of object)
        Other         // 6 - anything that doesn't fit above
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STRUCTS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Core evidence record stored on-chain.
     *      Sensitive fields (description, location) are only stored as hashes
     *      to balance transparency with privacy.
     */
    struct Evidence {
        bytes32      evidenceId;        // keccak256 of (caseId + fileHash + timestamp)
        bytes32      caseId;            // case this evidence belongs to
        bytes32      fileHash;          // SHA-256 hash of the actual evidence file
        string       fileURI;           // IPFS CID or cloud URL of the file
        string       title;             // human-readable title
        bytes32      descriptionHash;   // keccak256 of description (privacy)
        EvidenceType evidenceType;      // classification
        bytes32      locationHash;      // keccak256 of GPS/address string
        address      collectedBy;       // officer who originally collected
        address      currentOwner;      // current custodian
        uint256      collectedAt;       // Unix timestamp of collection
        uint256      registeredAt;      // block.timestamp of on-chain registration
        EvidenceStatus status;          // current lifecycle status
        bool         exists;            // guard against uninitialised reads
        bool         isSensitive;       // flag: requires multi-sig for transfer
        uint256      custodyCount;      // total number of custody changes
        uint8        verificationCount; // times verified by auditors
    }

    /**
     * @dev A single entry in the chain-of-custody audit trail.
     */
    struct CustodyRecord {
        address      fromAddress;    // previous custodian (address(0) for first entry)
        address      toAddress;      // new custodian
        EvidenceStatus previousStatus;
        EvidenceStatus newStatus;
        bytes32      actionHash;     // keccak256 of action description
        uint256      timestamp;
        bytes32      txContext;      // keccak256(msg.sender + block.number) for traceability
    }

    /**
     * @dev Registered system user (off-chain DB mirrors this for performance).
     */
    struct Officer {
        address      wallet;
        bytes32      nameHash;       // keccak256 of officer name
        bytes32      badgeHash;      // keccak256 of badge/ID number
        bytes32      role;           // ADMIN_ROLE | INVESTIGATOR_ROLE | AUDITOR_ROLE
        bool         isActive;
        uint256      registeredAt;
        uint256      evidenceCount;  // total evidence registered by this officer
    }

    /**
     * @dev Pending multi-signature transfer request for sensitive evidence.
     */
    struct TransferRequest {
        bytes32  evidenceId;
        address  initiator;
        address  proposedOwner;
        bytes32  reasonHash;
        uint256  createdAt;
        uint256  approvalCount;
        bool     executed;
        bool     cancelled;
        address[] approvers;      // who has approved so far
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STATE VARIABLES
    // ─────────────────────────────────────────────────────────────────────────

    address public superAdmin;          // contract deployer, can never be removed
    uint256 public evidenceCounter;     // monotonic counter for evidenceId generation
    uint256 public requiredApprovals;   // approvals needed for sensitive transfers (default: 2)

    // Evidence storage
    mapping(bytes32 => Evidence) private evidences;                     // evidenceId → Evidence
    mapping(bytes32 => CustodyRecord[]) private custodyHistory;         // evidenceId → trail
    mapping(bytes32 => bytes32[]) private caseEvidences;                // caseId → evidenceIds[]
    mapping(bytes32 => bool) private fileHashRegistered;               // prevent duplicate file registration

    // Officers / access control
    mapping(address => Officer) private officers;
    mapping(address => bytes32) private addressToRole;
    mapping(address => bool) public isRegistered;

    // Multi-sig transfers
    mapping(bytes32 => TransferRequest) private transferRequests;       // requestId → request
    mapping(bytes32 => mapping(address => bool)) private hasApproved;   // requestId → approver → bool
    bytes32[] private pendingTransferIds;

    // Verification log (evidenceId → list of verifier addresses)
    mapping(bytes32 => address[]) private verificationLog;

    // ─────────────────────────────────────────────────────────────────────────
    // EVENTS
    // ─────────────────────────────────────────────────────────────────────────

    event OfficerRegistered(
        address indexed wallet,
        bytes32 indexed role,
        uint256 timestamp
    );

    event OfficerDeactivated(
        address indexed wallet,
        address indexed deactivatedBy,
        uint256 timestamp
    );

    event EvidenceRegistered(
        bytes32 indexed evidenceId,
        bytes32 indexed caseId,
        bytes32 indexed fileHash,
        address collectedBy,
        EvidenceType evidenceType,
        uint256 timestamp
    );

    event EvidenceStatusUpdated(
        bytes32 indexed evidenceId,
        EvidenceStatus previousStatus,
        EvidenceStatus newStatus,
        address updatedBy,
        uint256 timestamp
    );

    event EvidenceTransferred(
        bytes32 indexed evidenceId,
        address indexed fromOfficer,
        address indexed toOfficer,
        bytes32 reasonHash,
        uint256 timestamp
    );

    event EvidenceVerified(
        bytes32 indexed evidenceId,
        address indexed verifiedBy,
        bool    isAuthentic,
        uint256 timestamp
    );

    event TransferRequestCreated(
        bytes32 indexed requestId,
        bytes32 indexed evidenceId,
        address indexed proposedOwner,
        uint256 timestamp
    );

    event TransferRequestApproved(
        bytes32 indexed requestId,
        address indexed approver,
        uint256 approvalCount,
        uint256 timestamp
    );

    event TransferRequestExecuted(
        bytes32 indexed requestId,
        bytes32 indexed evidenceId,
        address newOwner,
        uint256 timestamp
    );

    event TransferRequestCancelled(
        bytes32 indexed requestId,
        address indexed cancelledBy,
        uint256 timestamp
    );

    event RequiredApprovalsUpdated(
        uint256 oldValue,
        uint256 newValue,
        uint256 timestamp
    );

    // ─────────────────────────────────────────────────────────────────────────
    // MODIFIERS
    // ─────────────────────────────────────────────────────────────────────────

    modifier onlySuperAdmin() {
        require(msg.sender == superAdmin, "EvidenceRegistry: caller is not super admin");
        _;
    }

    modifier onlyAdmin() {
        require(
            addressToRole[msg.sender] == ADMIN_ROLE || msg.sender == superAdmin,
            "EvidenceRegistry: caller is not an admin"
        );
        _;
    }

    modifier onlyInvestigator() {
        require(
            addressToRole[msg.sender] == INVESTIGATOR_ROLE ||
            addressToRole[msg.sender] == ADMIN_ROLE ||
            msg.sender == superAdmin,
            "EvidenceRegistry: caller is not an investigator"
        );
        _;
    }

    modifier onlyAuthorized() {
        require(isRegistered[msg.sender], "EvidenceRegistry: caller is not registered");
        require(officers[msg.sender].isActive, "EvidenceRegistry: account is deactivated");
        _;
    }

    modifier evidenceExists(bytes32 evidenceId) {
        require(evidences[evidenceId].exists, "EvidenceRegistry: evidence does not exist");
        _;
    }

    modifier onlyEvidenceOwner(bytes32 evidenceId) {
        require(
            evidences[evidenceId].currentOwner == msg.sender ||
            addressToRole[msg.sender] == ADMIN_ROLE ||
            msg.sender == superAdmin,
            "EvidenceRegistry: caller is not evidence owner"
        );
        _;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CONSTRUCTOR
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param _requiredApprovals Number of admin approvals required for sensitive transfers.
     * @notice The deployer becomes the superAdmin and is automatically registered as ADMIN.
     */
    constructor(uint256 _requiredApprovals) {
        require(_requiredApprovals >= 1, "EvidenceRegistry: approvals must be >= 1");
        superAdmin = msg.sender;
        requiredApprovals = _requiredApprovals;

        // Register deployer as the first admin
        _registerOfficer(msg.sender, keccak256("Super Admin"), keccak256("SA-001"), ADMIN_ROLE);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ADMIN FUNCTIONS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Register a new officer/user on the system.
     * @param wallet       Ethereum address of the officer.
     * @param nameHash     keccak256(officer full name) — stored for privacy.
     * @param badgeHash    keccak256(badge or employee ID).
     * @param role         ADMIN_ROLE | INVESTIGATOR_ROLE | AUDITOR_ROLE.
     */
    function registerOfficer(
        address wallet,
        bytes32 nameHash,
        bytes32 badgeHash,
        bytes32 role
    ) external onlyAdmin {
        require(wallet != address(0), "EvidenceRegistry: invalid address");
        require(!isRegistered[wallet], "EvidenceRegistry: officer already registered");
        require(
            role == ADMIN_ROLE || role == INVESTIGATOR_ROLE || role == AUDITOR_ROLE,
            "EvidenceRegistry: invalid role"
        );

        _registerOfficer(wallet, nameHash, badgeHash, role);
    }

    /**
     * @dev Internal registration to allow constructor to call it safely.
     */
    function _registerOfficer(
        address wallet,
        bytes32 nameHash,
        bytes32 badgeHash,
        bytes32 role
    ) internal {
        officers[wallet] = Officer({
            wallet: wallet,
            nameHash: nameHash,
            badgeHash: badgeHash,
            role: role,
            isActive: true,
            registeredAt: block.timestamp,
            evidenceCount: 0
        });
        addressToRole[wallet] = role;
        isRegistered[wallet] = true;

        emit OfficerRegistered(wallet, role, block.timestamp);
    }

    /**
     * @notice Deactivate an officer. They can no longer interact with the system.
     *         Their historical records remain intact and immutable.
     * @param wallet Address of the officer to deactivate.
     */
    function deactivateOfficer(address wallet) external onlyAdmin {
        require(isRegistered[wallet], "EvidenceRegistry: officer not found");
        require(wallet != superAdmin, "EvidenceRegistry: cannot deactivate super admin");
        officers[wallet].isActive = false;

        emit OfficerDeactivated(wallet, msg.sender, block.timestamp);
    }

    /**
     * @notice Reactivate a previously deactivated officer.
     */
    function reactivateOfficer(address wallet) external onlyAdmin {
        require(isRegistered[wallet], "EvidenceRegistry: officer not found");
        officers[wallet].isActive = true;
    }

    /**
     * @notice Update the required number of approvals for sensitive evidence transfers.
     * @param newValue Must be >= 1.
     */
    function setRequiredApprovals(uint256 newValue) external onlySuperAdmin {
        require(newValue >= 1, "EvidenceRegistry: must be >= 1");
        uint256 old = requiredApprovals;
        requiredApprovals = newValue;
        emit RequiredApprovalsUpdated(old, newValue, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EVIDENCE REGISTRATION
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Register a new piece of evidence on the blockchain.
     * @dev    Only investigators/admins can call this.
     *         The file itself is NOT stored here — only its SHA-256 hash.
     *
     * @param caseId          Identifier for the case (keccak256 of the case number string).
     * @param fileHash        SHA-256 hash of the evidence file, prefixed with 0x.
     * @param fileURI         IPFS CID or signed cloud URL where the file lives.
     * @param title           Short human-readable name for this evidence item.
     * @param descriptionHash keccak256(full description text) — text stored off-chain.
     * @param evidenceType    EvidenceType enum value.
     * @param locationHash    keccak256(GPS coordinates or address string).
     * @param collectedAt     Unix timestamp of when evidence was physically collected.
     * @param isSensitive     If true, transfers require multi-sig approval.
     * @return evidenceId     The unique on-chain identifier for this evidence record.
     */
    function registerEvidence(
        bytes32      caseId,
        bytes32      fileHash,
        string calldata fileURI,
        string calldata title,
        bytes32      descriptionHash,
        EvidenceType evidenceType,
        bytes32      locationHash,
        uint256      collectedAt,
        bool         isSensitive
    )
        external
        onlyAuthorized
        onlyInvestigator
        returns (bytes32 evidenceId)
    {
        require(caseId != bytes32(0),  "EvidenceRegistry: invalid caseId");
        require(fileHash != bytes32(0), "EvidenceRegistry: invalid fileHash");
        require(bytes(fileURI).length > 0, "EvidenceRegistry: fileURI required");
        require(bytes(title).length > 0,   "EvidenceRegistry: title required");
        require(collectedAt <= block.timestamp, "EvidenceRegistry: future collection date");
        require(!fileHashRegistered[fileHash], "EvidenceRegistry: file already registered");

        // Generate unique evidence ID
        evidenceCounter++;
        evidenceId = keccak256(
            abi.encodePacked(caseId, fileHash, block.timestamp, evidenceCounter)
        );

        evidences[evidenceId] = Evidence({
            evidenceId:        evidenceId,
            caseId:            caseId,
            fileHash:          fileHash,
            fileURI:           fileURI,
            title:             title,
            descriptionHash:   descriptionHash,
            evidenceType:      evidenceType,
            locationHash:      locationHash,
            collectedBy:       msg.sender,
            currentOwner:      msg.sender,
            collectedAt:       collectedAt,
            registeredAt:      block.timestamp,
            status:            EvidenceStatus.Collected,
            exists:            true,
            isSensitive:       isSensitive,
            custodyCount:      0,
            verificationCount: 0
        });

        // Record first custody entry
        _addCustodyRecord(
            evidenceId,
            address(0),
            msg.sender,
            EvidenceStatus.Collected,
            EvidenceStatus.Collected,
            keccak256("Initial evidence registration")
        );

        // Index by case
        caseEvidences[caseId].push(evidenceId);

        // Mark file hash as used
        fileHashRegistered[fileHash] = true;

        // Update officer stats
        officers[msg.sender].evidenceCount++;

        emit EvidenceRegistered(
            evidenceId,
            caseId,
            fileHash,
            msg.sender,
            evidenceType,
            block.timestamp
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EVIDENCE STATUS UPDATE
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Update the lifecycle status of an evidence item.
     * @dev    Valid transitions are enforced — you cannot go backwards arbitrarily.
     *         Archived and Rejected are terminal states.
     *
     * @param evidenceId   The evidence to update.
     * @param newStatus    The desired new EvidenceStatus.
     * @param actionHash   keccak256(reason/notes for this status change).
     */
    function updateEvidenceStatus(
        bytes32        evidenceId,
        EvidenceStatus newStatus,
        bytes32        actionHash
    )
        external
        onlyAuthorized
        onlyInvestigator
        evidenceExists(evidenceId)
        onlyEvidenceOwner(evidenceId)
    {
        Evidence storage ev = evidences[evidenceId];

        require(
            ev.status != EvidenceStatus.Archived,
            "EvidenceRegistry: archived evidence is immutable"
        );
        require(
            ev.status != EvidenceStatus.Rejected,
            "EvidenceRegistry: rejected evidence cannot be updated"
        );
        require(
            _isValidTransition(ev.status, newStatus),
            "EvidenceRegistry: invalid status transition"
        );

        EvidenceStatus prev = ev.status;
        ev.status = newStatus;

        _addCustodyRecord(
            evidenceId,
            msg.sender,
            msg.sender, // same owner, only status changed
            prev,
            newStatus,
            actionHash
        );

        emit EvidenceStatusUpdated(evidenceId, prev, newStatus, msg.sender, block.timestamp);
    }

    /**
     * @dev Enforce allowed status transitions.
     *      Collected → Submitted → UnderReview → {Transferred, Archived, Rejected}
     *      Admins can archive or reject from any non-terminal state.
     */
    function _isValidTransition(
        EvidenceStatus from,
        EvidenceStatus to
    ) internal pure returns (bool) {
        if (from == EvidenceStatus.Collected)   return to == EvidenceStatus.Submitted;
        if (from == EvidenceStatus.Submitted)   return to == EvidenceStatus.UnderReview  ||
                                                       to == EvidenceStatus.Rejected;
        if (from == EvidenceStatus.UnderReview) return to == EvidenceStatus.Transferred  ||
                                                       to == EvidenceStatus.Archived     ||
                                                       to == EvidenceStatus.Rejected;
        if (from == EvidenceStatus.Transferred) return to == EvidenceStatus.UnderReview  ||
                                                       to == EvidenceStatus.Archived     ||
                                                       to == EvidenceStatus.Rejected;
        return false; // Archived and Rejected are terminal
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STANDARD EVIDENCE TRANSFER (non-sensitive)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Transfer custody of evidence to another registered investigator.
     * @dev    For non-sensitive evidence only.
     *         Sensitive evidence must use the multi-sig flow (requestTransfer / approveTransfer).
     *
     * @param evidenceId  The evidence to transfer.
     * @param toOfficer   Address of the receiving investigator.
     * @param reasonHash  keccak256(reason for transfer).
     */
    function transferEvidence(
        bytes32 evidenceId,
        address toOfficer,
        bytes32 reasonHash
    )
        external
        onlyAuthorized
        onlyInvestigator
        evidenceExists(evidenceId)
        onlyEvidenceOwner(evidenceId)
    {
        Evidence storage ev = evidences[evidenceId];

        require(!ev.isSensitive, "EvidenceRegistry: use requestTransfer for sensitive evidence");
        require(toOfficer != address(0), "EvidenceRegistry: invalid recipient");
        require(toOfficer != msg.sender, "EvidenceRegistry: cannot transfer to yourself");
        require(isRegistered[toOfficer], "EvidenceRegistry: recipient not registered");
        require(officers[toOfficer].isActive, "EvidenceRegistry: recipient account is inactive");
        require(
            addressToRole[toOfficer] == INVESTIGATOR_ROLE ||
            addressToRole[toOfficer] == ADMIN_ROLE,
            "EvidenceRegistry: recipient must be investigator or admin"
        );
        require(
            ev.status != EvidenceStatus.Archived &&
            ev.status != EvidenceStatus.Rejected,
            "EvidenceRegistry: cannot transfer terminal evidence"
        );

        address prevOwner = ev.currentOwner;
        EvidenceStatus prevStatus = ev.status;
        ev.currentOwner = toOfficer;
        ev.status = EvidenceStatus.Transferred;
        ev.custodyCount++;

        _addCustodyRecord(
            evidenceId,
            prevOwner,
            toOfficer,
            prevStatus,
            EvidenceStatus.Transferred,
            reasonHash
        );

        emit EvidenceTransferred(evidenceId, prevOwner, toOfficer, reasonHash, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MULTI-SIG TRANSFER (sensitive evidence)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Initiate a multi-signature transfer request for sensitive evidence.
     * @dev    After creation, `requiredApprovals` admins must call approveTransfer
     *         before executeTransfer can be called.
     *
     * @param evidenceId    The sensitive evidence to transfer.
     * @param proposedOwner New custodian.
     * @param reasonHash    keccak256(transfer justification).
     * @return requestId    Unique ID for this transfer request.
     */
    function requestTransfer(
        bytes32 evidenceId,
        address proposedOwner,
        bytes32 reasonHash
    )
        external
        onlyAuthorized
        onlyInvestigator
        evidenceExists(evidenceId)
        onlyEvidenceOwner(evidenceId)
        returns (bytes32 requestId)
    {
        Evidence storage ev = evidences[evidenceId];

        require(ev.isSensitive, "EvidenceRegistry: use transferEvidence for non-sensitive");
        require(proposedOwner != address(0), "EvidenceRegistry: invalid recipient");
        require(proposedOwner != msg.sender, "EvidenceRegistry: cannot transfer to yourself");
        require(isRegistered[proposedOwner], "EvidenceRegistry: recipient not registered");
        require(officers[proposedOwner].isActive, "EvidenceRegistry: recipient inactive");
        require(
            ev.status != EvidenceStatus.Archived &&
            ev.status != EvidenceStatus.Rejected,
            "EvidenceRegistry: cannot transfer terminal evidence"
        );

        requestId = keccak256(
            abi.encodePacked(evidenceId, proposedOwner, block.timestamp, msg.sender)
        );

        address[] memory emptyApprovers;
        transferRequests[requestId] = TransferRequest({
            evidenceId:    evidenceId,
            initiator:     msg.sender,
            proposedOwner: proposedOwner,
            reasonHash:    reasonHash,
            createdAt:     block.timestamp,
            approvalCount: 0,
            executed:      false,
            cancelled:     false,
            approvers:     emptyApprovers
        });

        pendingTransferIds.push(requestId);

        emit TransferRequestCreated(requestId, evidenceId, proposedOwner, block.timestamp);
    }

    /**
     * @notice Approve a pending sensitive transfer request.
     * @dev    Only admins (or super admin) can approve. Each address can approve once.
     *
     * @param requestId The transfer request to approve.
     */
    function approveTransfer(bytes32 requestId) external onlyAdmin {
        TransferRequest storage req = transferRequests[requestId];

        require(req.createdAt != 0, "EvidenceRegistry: request does not exist");
        require(!req.executed, "EvidenceRegistry: already executed");
        require(!req.cancelled, "EvidenceRegistry: request cancelled");
        require(!hasApproved[requestId][msg.sender], "EvidenceRegistry: already approved");

        hasApproved[requestId][msg.sender] = true;
        req.approvalCount++;
        req.approvers.push(msg.sender);

        emit TransferRequestApproved(requestId, msg.sender, req.approvalCount, block.timestamp);
    }

    /**
     * @notice Execute a transfer request that has reached the required approval count.
     * @dev    Anyone (caller must be registered) can trigger execution once approved.
     *         This encourages timely execution without requiring admin presence.
     *
     * @param requestId The approved transfer request to execute.
     */
    function executeTransfer(bytes32 requestId) external onlyAuthorized {
        TransferRequest storage req = transferRequests[requestId];

        require(req.createdAt != 0, "EvidenceRegistry: request does not exist");
        require(!req.executed, "EvidenceRegistry: already executed");
        require(!req.cancelled, "EvidenceRegistry: request cancelled");
        require(
            req.approvalCount >= requiredApprovals,
            "EvidenceRegistry: insufficient approvals"
        );

        req.executed = true;

        Evidence storage ev = evidences[req.evidenceId];
        address prevOwner = ev.currentOwner;
        EvidenceStatus prevStatus = ev.status;

        ev.currentOwner = req.proposedOwner;
        ev.status = EvidenceStatus.Transferred;
        ev.custodyCount++;

        _addCustodyRecord(
            req.evidenceId,
            prevOwner,
            req.proposedOwner,
            prevStatus,
            EvidenceStatus.Transferred,
            req.reasonHash
        );

        emit EvidenceTransferred(
            req.evidenceId, prevOwner, req.proposedOwner, req.reasonHash, block.timestamp
        );
        emit TransferRequestExecuted(requestId, req.evidenceId, req.proposedOwner, block.timestamp);
    }

    /**
     * @notice Cancel a pending transfer request.
     * @dev    Only the initiator or an admin can cancel.
     *
     * @param requestId The transfer request to cancel.
     */
    function cancelTransferRequest(bytes32 requestId) external onlyAuthorized {
        TransferRequest storage req = transferRequests[requestId];

        require(req.createdAt != 0, "EvidenceRegistry: request does not exist");
        require(!req.executed, "EvidenceRegistry: already executed");
        require(!req.cancelled, "EvidenceRegistry: already cancelled");
        require(
            req.initiator == msg.sender ||
            addressToRole[msg.sender] == ADMIN_ROLE ||
            msg.sender == superAdmin,
            "EvidenceRegistry: not authorised to cancel"
        );

        req.cancelled = true;
        emit TransferRequestCancelled(requestId, msg.sender, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EVIDENCE VERIFICATION
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Verify the authenticity of an evidence file by comparing its hash
     *         against the on-chain record.
     * @dev    The caller re-generates the SHA-256 hash off-chain and passes it here.
     *         If hashes match, the file has not been tampered with since registration.
     *
     * @param evidenceId       The evidence to verify.
     * @param submittedHash    SHA-256 hash of the file being checked.
     * @return isAuthentic     True if hashes match (file unchanged).
     * @return registeredHash  The original hash stored at registration time.
     * @return registeredAt    Block timestamp of original registration.
     */
    function verifyEvidence(
        bytes32 evidenceId,
        bytes32 submittedHash
    )
        external
        onlyAuthorized
        evidenceExists(evidenceId)
        returns (
            bool    isAuthentic,
            bytes32 registeredHash,
            uint256 registeredAt
        )
    {
        Evidence storage ev = evidences[evidenceId];

        registeredHash = ev.fileHash;
        registeredAt   = ev.registeredAt;
        isAuthentic    = (submittedHash == ev.fileHash);

        // Log the verification attempt
        ev.verificationCount++;
        verificationLog[evidenceId].push(msg.sender);

        emit EvidenceVerified(evidenceId, msg.sender, isAuthentic, block.timestamp);
    }

    /**
     * @notice Batch-verify multiple evidence items. Returns parallel arrays.
     * @dev    Useful for court/legal batch authentication workflows.
     *
     * @param evidenceIds      Array of evidence IDs to verify.
     * @param submittedHashes  Corresponding array of SHA-256 hashes to check.
     */
    function batchVerifyEvidence(
        bytes32[] calldata evidenceIds,
        bytes32[] calldata submittedHashes
    )
        external
        onlyAuthorized
        returns (bool[] memory results)
    {
        require(
            evidenceIds.length == submittedHashes.length,
            "EvidenceRegistry: array length mismatch"
        );
        require(evidenceIds.length <= 50, "EvidenceRegistry: batch too large (max 50)");

        results = new bool[](evidenceIds.length);

        for (uint256 i = 0; i < evidenceIds.length; i++) {
            if (!evidences[evidenceIds[i]].exists) {
                results[i] = false;
                continue;
            }
            Evidence storage ev = evidences[evidenceIds[i]];
            bool isMatch = (submittedHashes[i] == ev.fileHash);
            results[i] = isMatch;
            ev.verificationCount++;
            verificationLog[evidenceIds[i]].push(msg.sender);
            emit EvidenceVerified(evidenceIds[i], msg.sender, isMatch, block.timestamp);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INTERNAL HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Append a new record to the chain-of-custody trail.
     */
    function _addCustodyRecord(
        bytes32        evidenceId,
        address        from,
        address        to,
        EvidenceStatus prevStatus,
        EvidenceStatus newStatus,
        bytes32        actionHash
    ) internal {
        custodyHistory[evidenceId].push(CustodyRecord({
            fromAddress:    from,
            toAddress:      to,
            previousStatus: prevStatus,
            newStatus:      newStatus,
            actionHash:     actionHash,
            timestamp:      block.timestamp,
            txContext:      keccak256(abi.encodePacked(msg.sender, block.number, block.timestamp))
        }));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // READ / QUERY FUNCTIONS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Retrieve the full on-chain record for a piece of evidence.
     * @dev    Returns the complete Evidence struct.
     */
    function getEvidenceDetails(bytes32 evidenceId)
        external
        view
        onlyAuthorized
        evidenceExists(evidenceId)
        returns (Evidence memory)
    {
        return evidences[evidenceId];
    }

    /**
     * @notice Return the complete chain-of-custody audit trail.
     * @dev    The array is ordered from oldest to newest — index 0 = registration.
     */
    function getEvidenceHistory(bytes32 evidenceId)
        external
        view
        onlyAuthorized
        evidenceExists(evidenceId)
        returns (CustodyRecord[] memory)
    {
        return custodyHistory[evidenceId];
    }

    /**
     * @notice Get all evidence IDs associated with a case.
     */
    function getEvidenceByCase(bytes32 caseId)
        external
        view
        onlyAuthorized
        returns (bytes32[] memory)
    {
        return caseEvidences[caseId];
    }

    /**
     * @notice Read the on-chain details of a registered officer.
     */
    function getOfficerDetails(address wallet)
        external
        view
        onlyAuthorized
        returns (Officer memory)
    {
        require(isRegistered[wallet], "EvidenceRegistry: officer not found");
        return officers[wallet];
    }

    /**
     * @notice Check whether a file hash has already been registered.
     *         Useful off-chain to detect duplicate submissions.
     */
    function isFileHashRegistered(bytes32 fileHash)
        external
        view
        returns (bool)
    {
        return fileHashRegistered[fileHash];
    }

    /**
     * @notice Get the current status of an evidence item (public for court use).
     */
    function getEvidenceStatus(bytes32 evidenceId)
        external
        view
        evidenceExists(evidenceId)
        returns (EvidenceStatus status, address currentOwner, uint256 custodyCount)
    {
        Evidence storage ev = evidences[evidenceId];
        return (ev.status, ev.currentOwner, ev.custodyCount);
    }

    /**
     * @notice Retrieve a pending transfer request by its ID.
     */
    function getTransferRequest(bytes32 requestId)
        external
        view
        onlyAuthorized
        returns (TransferRequest memory)
    {
        require(
            transferRequests[requestId].createdAt != 0,
            "EvidenceRegistry: request not found"
        );
        return transferRequests[requestId];
    }

    /**
     * @notice Get who has verified a specific evidence item.
     */
    function getVerificationLog(bytes32 evidenceId)
        external
        view
        onlyAuthorized
        evidenceExists(evidenceId)
        returns (address[] memory)
    {
        return verificationLog[evidenceId];
    }

    /**
     * @notice Return the role assigned to any wallet address.
     */
    function getRoleOf(address wallet) external view returns (bytes32) {
        return addressToRole[wallet];
    }

    /**
     * @notice Quick integrity check: supply an evidenceId and a hash,
     *         returns true/false WITHOUT writing to state (view function).
     *         Use this for read-only hash checks from the frontend.
     */
    function quickVerify(bytes32 evidenceId, bytes32 fileHash)
        external
        view
        evidenceExists(evidenceId)
        returns (bool)
    {
        return evidences[evidenceId].fileHash == fileHash;
    }

    /**
     * @notice Return total number of evidence records registered.
     */
    function totalEvidenceCount() external view returns (uint256) {
        return evidenceCounter;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SENSITIVE FLAG UPDATE (admin only)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Admins can promote evidence to sensitive or downgrade it.
     * @dev    Only affects future transfers — existing transfer requests are unaffected.
     */
    function setSensitiveFlag(bytes32 evidenceId, bool sensitive)
        external
        onlyAdmin
        evidenceExists(evidenceId)
    {
        evidences[evidenceId].isSensitive = sensitive;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EMERGENCY CONTROLS (super admin only)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Force-archive evidence without going through normal status transitions.
     *         Use only in emergency or court-order scenarios.
     * @dev    Creates an audit record so the action is transparent.
     */
    function forceArchive(bytes32 evidenceId, bytes32 reasonHash)
        external
        onlySuperAdmin
        evidenceExists(evidenceId)
    {
        Evidence storage ev = evidences[evidenceId];
        require(
            ev.status != EvidenceStatus.Archived,
            "EvidenceRegistry: already archived"
        );

        EvidenceStatus prev = ev.status;
        ev.status = EvidenceStatus.Archived;

        _addCustodyRecord(
            evidenceId,
            msg.sender,
            msg.sender,
            prev,
            EvidenceStatus.Archived,
            reasonHash
        );

        emit EvidenceStatusUpdated(evidenceId, prev, EvidenceStatus.Archived, msg.sender, block.timestamp);
    }

    /**
     * @notice Transfer super-admin rights to a new address.
     *         Emits no event intentionally — super admin transfers should be
     *         tracked externally (e.g. company governance docs).
     * @dev    The old superAdmin loses all elevated permissions.
     */
    function transferSuperAdmin(address newAdmin) external onlySuperAdmin {
        require(newAdmin != address(0), "EvidenceRegistry: invalid address");
        require(isRegistered[newAdmin], "EvidenceRegistry: new admin must be registered");
        require(
            addressToRole[newAdmin] == ADMIN_ROLE,
            "EvidenceRegistry: new admin must have ADMIN_ROLE"
        );
        superAdmin = newAdmin;
    }
}
