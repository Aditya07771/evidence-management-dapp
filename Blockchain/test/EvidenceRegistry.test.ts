import { expect } from "chai";
import { ethers } from "hardhat";
import { EvidenceRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("EvidenceRegistry", function () {
  let contract: EvidenceRegistry;
  let superAdmin: SignerWithAddress;
  let admin: SignerWithAddress;
  let investigator1: SignerWithAddress;
  let investigator2: SignerWithAddress;
  let auditor: SignerWithAddress;
  let unauthorized: SignerWithAddress;

  let ADMIN_ROLE: string;
  let INVESTIGATOR_ROLE: string;
  let AUDITOR_ROLE: string;

  const REQUIRED_APPROVALS = 2;

  // Helper to generate bytes32 hash
  const toBytes32 = (str: string) => ethers.keccak256(ethers.toUtf8Bytes(str));

  // Mock evidence data
  const mockEvidence = {
    caseId: toBytes32("CASE-001"),
    fileHash: toBytes32("mock_file_content_v1"),
    fileURI: "ipfs://QmTest123456789",
    title: "Crime Scene Photo",
    descriptionHash: toBytes32("Photo of weapon found at scene"),
    evidenceType: 1, // Image
    locationHash: toBytes32("40.7128,-74.0060"),
    collectedAt: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    isSensitive: false,
  };

  beforeEach(async function () {
    // Get signers
    [superAdmin, admin, investigator1, investigator2, auditor, unauthorized] =
      await ethers.getSigners();

    // Deploy contract
    const EvidenceRegistry = await ethers.getContractFactory("EvidenceRegistry");
    contract = await EvidenceRegistry.deploy(REQUIRED_APPROVALS);
    await contract.waitForDeployment();

    // Get role constants
    ADMIN_ROLE = await contract.ADMIN_ROLE();
    INVESTIGATOR_ROLE = await contract.INVESTIGATOR_ROLE();
    AUDITOR_ROLE = await contract.AUDITOR_ROLE();

    // Register officers
    await contract.registerOfficer(
      admin.address,
      toBytes32("Admin User"),
      toBytes32("ADMIN-001"),
      ADMIN_ROLE
    );

    await contract.registerOfficer(
      investigator1.address,
      toBytes32("Officer Smith"),
      toBytes32("INV-001"),
      INVESTIGATOR_ROLE
    );

    await contract.registerOfficer(
      investigator2.address,
      toBytes32("Officer Jones"),
      toBytes32("INV-002"),
      INVESTIGATOR_ROLE
    );

    await contract.registerOfficer(
      auditor.address,
      toBytes32("Legal Auditor"),
      toBytes32("AUD-001"),
      AUDITOR_ROLE
    );
  });

  describe("Deployment", function () {
    it("should set the deployer as super admin", async function () {
      expect(await contract.superAdmin()).to.equal(superAdmin.address);
    });

    it("should set required approvals correctly", async function () {
      expect(await contract.requiredApprovals()).to.equal(REQUIRED_APPROVALS);
    });

    it("should register deployer as admin automatically", async function () {
      expect(await contract.isRegistered(superAdmin.address)).to.be.true;
      const officer = await contract.getOfficerDetails(superAdmin.address);
      expect(officer.role).to.equal(ADMIN_ROLE);
      expect(officer.isActive).to.be.true;
    });

    it("should revert if required approvals < 1", async function () {
      const EvidenceRegistry = await ethers.getContractFactory("EvidenceRegistry");
      await expect(EvidenceRegistry.deploy(0)).to.be.revertedWith(
        "EvidenceRegistry: approvals must be >= 1"
      );
    });
  });

  describe("Officer Registration", function () {
    it("should allow admin to register new officer", async function () {
      const newOfficer = unauthorized.address;
      const nameHash = toBytes32("New Officer");
      const badgeHash = toBytes32("BADGE-999");

      await expect(
        contract
          .connect(admin)
          .registerOfficer(newOfficer, nameHash, badgeHash, INVESTIGATOR_ROLE)
      )
        .to.emit(contract, "OfficerRegistered")
        .withArgs(newOfficer, INVESTIGATOR_ROLE, await time.latest());

      expect(await contract.isRegistered(newOfficer)).to.be.true;
      const officer = await contract.getOfficerDetails(newOfficer);
      expect(officer.wallet).to.equal(newOfficer);
      expect(officer.role).to.equal(INVESTIGATOR_ROLE);
      expect(officer.isActive).to.be.true;
    });

    it("should prevent non-admin from registering officers", async function () {
      await expect(
        contract
          .connect(investigator1)
          .registerOfficer(
            unauthorized.address,
            toBytes32("Test"),
            toBytes32("TEST"),
            INVESTIGATOR_ROLE
          )
      ).to.be.revertedWith("EvidenceRegistry: caller is not an admin");
    });

    it("should prevent duplicate registration", async function () {
      await expect(
        contract
          .connect(admin)
          .registerOfficer(
            investigator1.address,
            toBytes32("Duplicate"),
            toBytes32("DUP"),
            INVESTIGATOR_ROLE
          )
      ).to.be.revertedWith("EvidenceRegistry: officer already registered");
    });

    it("should reject invalid roles", async function () {
      const invalidRole = toBytes32("INVALID_ROLE");
      await expect(
        contract
          .connect(admin)
          .registerOfficer(
            unauthorized.address,
            toBytes32("Test"),
            toBytes32("TEST"),
            invalidRole
          )
      ).to.be.revertedWith("EvidenceRegistry: invalid role");
    });
  });

  describe("Officer Deactivation", function () {
    it("should allow admin to deactivate officer", async function () {
      await expect(contract.connect(admin).deactivateOfficer(investigator1.address))
        .to.emit(contract, "OfficerDeactivated")
        .withArgs(investigator1.address, admin.address, await time.latest());

      const officer = await contract.getOfficerDetails(investigator1.address);
      expect(officer.isActive).to.be.false;
    });

    it("should prevent deactivating super admin", async function () {
      await expect(
        contract.connect(admin).deactivateOfficer(superAdmin.address)
      ).to.be.revertedWith("EvidenceRegistry: cannot deactivate super admin");
    });

    it("should allow reactivation", async function () {
      await contract.connect(admin).deactivateOfficer(investigator1.address);
      await contract.connect(admin).reactivateOfficer(investigator1.address);

      const officer = await contract.getOfficerDetails(investigator1.address);
      expect(officer.isActive).to.be.true;
    });
  });

  describe("Evidence Registration", function () {
    it("should register evidence successfully", async function () {
      const tx = await contract
        .connect(investigator1)
        .registerEvidence(
          mockEvidence.caseId,
          mockEvidence.fileHash,
          mockEvidence.fileURI,
          mockEvidence.title,
          mockEvidence.descriptionHash,
          mockEvidence.evidenceType,
          mockEvidence.locationHash,
          mockEvidence.collectedAt,
          mockEvidence.isSensitive
        );

      const receipt = await tx.wait();
      const event = receipt?.logs
        .map((log) => {
          try {
            return contract.interface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            });
          } catch {
            return null;
          }
        })
        .find((e) => e?.name === "EvidenceRegistered");

      expect(event).to.not.be.undefined;
      expect(event?.args.caseId).to.equal(mockEvidence.caseId);
      expect(event?.args.fileHash).to.equal(mockEvidence.fileHash);
      expect(event?.args.collectedBy).to.equal(investigator1.address);

      const evidenceId = event?.args.evidenceId;
      expect(await contract.isFileHashRegistered(mockEvidence.fileHash)).to.be.true;

      // Verify evidence details
      const evidence = await contract.getEvidenceDetails(evidenceId);
      expect(evidence.title).to.equal(mockEvidence.title);
      expect(evidence.fileURI).to.equal(mockEvidence.fileURI);
      expect(evidence.evidenceType).to.equal(mockEvidence.evidenceType);
      expect(evidence.collectedBy).to.equal(investigator1.address);
      expect(evidence.currentOwner).to.equal(investigator1.address);
      expect(evidence.status).to.equal(0); // Collected
      expect(evidence.exists).to.be.true;
    });

    it("should reject duplicate file hash", async function () {
      await contract.connect(investigator1).registerEvidence(
        mockEvidence.caseId,
        mockEvidence.fileHash,
        mockEvidence.fileURI,
        mockEvidence.title,
        mockEvidence.descriptionHash,
        mockEvidence.evidenceType,
        mockEvidence.locationHash,
        mockEvidence.collectedAt,
        mockEvidence.isSensitive
      );

      await expect(
        contract.connect(investigator1).registerEvidence(
          mockEvidence.caseId,
          mockEvidence.fileHash, // Same hash
          "different_uri",
          "Different Title",
          mockEvidence.descriptionHash,
          mockEvidence.evidenceType,
          mockEvidence.locationHash,
          mockEvidence.collectedAt,
          false
        )
      ).to.be.revertedWith("EvidenceRegistry: file already registered");
    });

    it("should reject future collection date", async function () {
      const futureTime = (await time.latest()) + 3600;

      await expect(
        contract.connect(investigator1).registerEvidence(
          mockEvidence.caseId,
          mockEvidence.fileHash,
          mockEvidence.fileURI,
          mockEvidence.title,
          mockEvidence.descriptionHash,
          mockEvidence.evidenceType,
          mockEvidence.locationHash,
          futureTime,
          false
        )
      ).to.be.revertedWith("EvidenceRegistry: future collection date");
    });

    it("should reject unauthorized caller", async function () {
      await expect(
        contract.connect(auditor).registerEvidence(
          mockEvidence.caseId,
          mockEvidence.fileHash,
          mockEvidence.fileURI,
          mockEvidence.title,
          mockEvidence.descriptionHash,
          mockEvidence.evidenceType,
          mockEvidence.locationHash,
          mockEvidence.collectedAt,
          false
        )
      ).to.be.revertedWith("EvidenceRegistry: caller is not an investigator");
    });

    it("should update officer evidence count", async function () {
      await contract.connect(investigator1).registerEvidence(
        mockEvidence.caseId,
        mockEvidence.fileHash,
        mockEvidence.fileURI,
        mockEvidence.title,
        mockEvidence.descriptionHash,
        mockEvidence.evidenceType,
        mockEvidence.locationHash,
        mockEvidence.collectedAt,
        false
      );

      const officer = await contract.getOfficerDetails(investigator1.address);
      expect(officer.evidenceCount).to.equal(1);
    });
  });

  describe("Evidence Status Updates", function () {
    let evidenceId: string;

    beforeEach(async function () {
      const tx = await contract.connect(investigator1).registerEvidence(
        mockEvidence.caseId,
        mockEvidence.fileHash,
        mockEvidence.fileURI,
        mockEvidence.title,
        mockEvidence.descriptionHash,
        mockEvidence.evidenceType,
        mockEvidence.locationHash,
        mockEvidence.collectedAt,
        false
      );

      const receipt = await tx.wait();
      const event = receipt?.logs
        .map((log) => {
          try {
            return contract.interface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            });
          } catch {
            return null;
          }
        })
        .find((e) => e?.name === "EvidenceRegistered");

      evidenceId = event?.args.evidenceId;
    });

    it("should update status through valid transitions", async function () {
      const actionHash = toBytes32("Moving to submitted");

      // Collected (0) → Submitted (1)
      await expect(
        contract
          .connect(investigator1)
          .updateEvidenceStatus(evidenceId, 1, actionHash)
      )
        .to.emit(contract, "EvidenceStatusUpdated")
        .withArgs(evidenceId, 0, 1, investigator1.address, await time.latest());

      let evidence = await contract.getEvidenceDetails(evidenceId);
      expect(evidence.status).to.equal(1);

      // Submitted (1) → UnderReview (2)
      await contract
        .connect(investigator1)
        .updateEvidenceStatus(evidenceId, 2, actionHash);
      evidence = await contract.getEvidenceDetails(evidenceId);
      expect(evidence.status).to.equal(2);

      // UnderReview (2) → Archived (4)
      await contract
        .connect(investigator1)
        .updateEvidenceStatus(evidenceId, 4, actionHash);
      evidence = await contract.getEvidenceDetails(evidenceId);
      expect(evidence.status).to.equal(4);
    });

    it("should reject invalid status transitions", async function () {
      // Try Collected (0) → Archived (4) directly
      await expect(
        contract
          .connect(investigator1)
          .updateEvidenceStatus(evidenceId, 4, toBytes32("invalid jump"))
      ).to.be.revertedWith("EvidenceRegistry: invalid status transition");
    });

    it("should prevent updates to archived evidence", async function () {
      // Move to archived
      await contract
        .connect(investigator1)
        .updateEvidenceStatus(evidenceId, 1, toBytes32("submit"));
      await contract
        .connect(investigator1)
        .updateEvidenceStatus(evidenceId, 2, toBytes32("review"));
      await contract
        .connect(investigator1)
        .updateEvidenceStatus(evidenceId, 4, toBytes32("archive"));

      // Try to update again
      await expect(
        contract
          .connect(investigator1)
          .updateEvidenceStatus(evidenceId, 3, toBytes32("try update"))
      ).to.be.revertedWith("EvidenceRegistry: archived evidence is immutable");
    });

    it("should only allow owner or admin to update status", async function () {
      await expect(
        contract
          .connect(investigator2)
          .updateEvidenceStatus(evidenceId, 1, toBytes32("unauthorized"))
      ).to.be.revertedWith("EvidenceRegistry: caller is not evidence owner");
    });
  });

  describe("Evidence Transfer (Non-Sensitive)", function () {
    let evidenceId: string;

    beforeEach(async function () {
      const tx = await contract.connect(investigator1).registerEvidence(
        mockEvidence.caseId,
        mockEvidence.fileHash,
        mockEvidence.fileURI,
        mockEvidence.title,
        mockEvidence.descriptionHash,
        mockEvidence.evidenceType,
        mockEvidence.locationHash,
        mockEvidence.collectedAt,
        false // NOT sensitive
      );

      const receipt = await tx.wait();
      const event = receipt?.logs
        .map((log) => {
          try {
            return contract.interface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            });
          } catch {
            return null;
          }
        })
        .find((e) => e?.name === "EvidenceRegistered");

      evidenceId = event?.args.evidenceId;
    });

    it("should transfer evidence to another investigator", async function () {
      const reasonHash = toBytes32("Transfer for lab analysis");

      await expect(
        contract
          .connect(investigator1)
          .transferEvidence(evidenceId, investigator2.address, reasonHash)
      )
        .to.emit(contract, "EvidenceTransferred")
        .withArgs(
          evidenceId,
          investigator1.address,
          investigator2.address,
          reasonHash,
          await time.latest()
        );

      const evidence = await contract.getEvidenceDetails(evidenceId);
      expect(evidence.currentOwner).to.equal(investigator2.address);
      expect(evidence.status).to.equal(3); // Transferred
      expect(evidence.custodyCount).to.equal(1);
    });

    it("should reject transfer to self", async function () {
      await expect(
        contract
          .connect(investigator1)
          .transferEvidence(evidenceId, investigator1.address, toBytes32("self"))
      ).to.be.revertedWith("EvidenceRegistry: cannot transfer to yourself");
    });

    it("should reject transfer to unregistered user", async function () {
      await expect(
        contract
          .connect(investigator1)
          .transferEvidence(evidenceId, unauthorized.address, toBytes32("bad"))
      ).to.be.revertedWith("EvidenceRegistry: recipient not registered");
    });

    it("should update custody history", async function () {
      await contract
        .connect(investigator1)
        .transferEvidence(
          evidenceId,
          investigator2.address,
          toBytes32("transfer reason")
        );

      const history = await contract.getEvidenceHistory(evidenceId);
      expect(history.length).to.equal(2); // Initial + transfer
      expect(history[1].fromAddress).to.equal(investigator1.address);
      expect(history[1].toAddress).to.equal(investigator2.address);
      expect(history[1].newStatus).to.equal(3); // Transferred
    });
  });

  describe("Multi-Sig Transfer (Sensitive Evidence)", function () {
    let evidenceId: string;

    beforeEach(async function () {
      const tx = await contract.connect(investigator1).registerEvidence(
        mockEvidence.caseId,
        toBytes32("sensitive_file_content"),
        mockEvidence.fileURI,
        "Sensitive Evidence",
        mockEvidence.descriptionHash,
        mockEvidence.evidenceType,
        mockEvidence.locationHash,
        mockEvidence.collectedAt,
        true // IS sensitive
      );

      const receipt = await tx.wait();
      const event = receipt?.logs
        .map((log) => {
          try {
            return contract.interface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            });
          } catch {
            return null;
          }
        })
        .find((e) => e?.name === "EvidenceRegistered");

      evidenceId = event?.args.evidenceId;
    });

    it("should reject direct transfer of sensitive evidence", async function () {
      await expect(
        contract
          .connect(investigator1)
          .transferEvidence(
            evidenceId,
            investigator2.address,
            toBytes32("direct")
          )
      ).to.be.revertedWith(
        "EvidenceRegistry: use requestTransfer for sensitive evidence"
      );
    });

    it("should create transfer request", async function () {
      const reasonHash = toBytes32("Needs forensic analysis");

      const tx = await contract
        .connect(investigator1)
        .requestTransfer(evidenceId, investigator2.address, reasonHash);

      const receipt = await tx.wait();
      const event = receipt?.logs
        .map((log) => {
          try {
            return contract.interface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            });
          } catch {
            return null;
          }
        })
        .find((e) => e?.name === "TransferRequestCreated");

      expect(event).to.not.be.undefined;
      const requestId = event?.args.requestId;

      const request = await contract.getTransferRequest(requestId);
      expect(request.evidenceId).to.equal(evidenceId);
      expect(request.initiator).to.equal(investigator1.address);
      expect(request.proposedOwner).to.equal(investigator2.address);
      expect(request.approvalCount).to.equal(0);
      expect(request.executed).to.be.false;
    });

    it("should complete full multi-sig workflow", async function () {
      // 1. Request transfer
      const tx = await contract
        .connect(investigator1)
        .requestTransfer(
          evidenceId,
          investigator2.address,
          toBytes32("Multi-sig test")
        );

      const receipt = await tx.wait();
      const event = receipt?.logs
        .map((log) => {
          try {
            return contract.interface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            });
          } catch {
            return null;
          }
        })
        .find((e) => e?.name === "TransferRequestCreated");

      const requestId = event?.args.requestId;

      // 2. First admin approves
      await expect(contract.connect(admin).approveTransfer(requestId))
        .to.emit(contract, "TransferRequestApproved")
        .withArgs(requestId, admin.address, 1, await time.latest());

      // 3. Second admin (superAdmin) approves
      await contract.connect(superAdmin).approveTransfer(requestId);

      let request = await contract.getTransferRequest(requestId);
      expect(request.approvalCount).to.equal(2);

      // 4. Execute transfer
      await expect(contract.connect(investigator1).executeTransfer(requestId))
        .to.emit(contract, "TransferRequestExecuted")
        .withArgs(requestId, evidenceId, investigator2.address, await time.latest());

      // Verify ownership changed
      const evidence = await contract.getEvidenceDetails(evidenceId);
      expect(evidence.currentOwner).to.equal(investigator2.address);

      request = await contract.getTransferRequest(requestId);
      expect(request.executed).to.be.true;
    });

    it("should reject execution without enough approvals", async function () {
      const tx = await contract
        .connect(investigator1)
        .requestTransfer(
          evidenceId,
          investigator2.address,
          toBytes32("test")
        );
      const receipt = await tx.wait();
      const event = receipt?.logs
        .map((log) => {
          try {
            return contract.interface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            });
          } catch {
            return null;
          }
        })
        .find((e) => e?.name === "TransferRequestCreated");
      const requestId = event?.args.requestId;

      // Only 1 approval (need 2)
      await contract.connect(admin).approveTransfer(requestId);

      await expect(
        contract.connect(investigator1).executeTransfer(requestId)
      ).to.be.revertedWith("EvidenceRegistry: insufficient approvals");
    });

    it("should allow cancellation by initiator", async function () {
      const tx = await contract
        .connect(investigator1)
        .requestTransfer(
          evidenceId,
          investigator2.address,
          toBytes32("test")
        );
      const receipt = await tx.wait();
      const event = receipt?.logs
        .map((log) => {
          try {
            return contract.interface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            });
          } catch {
            return null;
          }
        })
        .find((e) => e?.name === "TransferRequestCreated");
      const requestId = event?.args.requestId;

      await expect(
        contract.connect(investigator1).cancelTransferRequest(requestId)
      )
        .to.emit(contract, "TransferRequestCancelled")
        .withArgs(requestId, investigator1.address, await time.latest());

      const request = await contract.getTransferRequest(requestId);
      expect(request.cancelled).to.be.true;
    });

    it("should prevent duplicate approvals", async function () {
      const tx = await contract
        .connect(investigator1)
        .requestTransfer(
          evidenceId,
          investigator2.address,
          toBytes32("test")
        );
      const receipt = await tx.wait();
      const event = receipt?.logs
        .map((log) => {
          try {
            return contract.interface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            });
          } catch {
            return null;
          }
        })
        .find((e) => e?.name === "TransferRequestCreated");
      const requestId = event?.args.requestId;

      await contract.connect(admin).approveTransfer(requestId);

      await expect(
        contract.connect(admin).approveTransfer(requestId)
      ).to.be.revertedWith("EvidenceRegistry: already approved");
    });
  });

  describe("Evidence Verification", function () {
    let evidenceId: string;
    const correctHash = toBytes32("correct_file_content");
    const wrongHash = toBytes32("tampered_content");

    beforeEach(async function () {
      const tx = await contract.connect(investigator1).registerEvidence(
        mockEvidence.caseId,
        correctHash,
        mockEvidence.fileURI,
        mockEvidence.title,
        mockEvidence.descriptionHash,
        mockEvidence.evidenceType,
        mockEvidence.locationHash,
        mockEvidence.collectedAt,
        false
      );

      const receipt = await tx.wait();
      const event = receipt?.logs
        .map((log) => {
          try {
            return contract.interface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            });
          } catch {
            return null;
          }
        })
        .find((e) => e?.name === "EvidenceRegistered");

      evidenceId = event?.args.evidenceId;
    });

    it("should verify authentic evidence", async function () {
      const result = await contract
        .connect(auditor)
        .verifyEvidence.staticCall(evidenceId, correctHash);

      expect(result.isAuthentic).to.be.true;
      expect(result.registeredHash).to.equal(correctHash);

      // Actually call it to update state
      await expect(
        contract.connect(auditor).verifyEvidence(evidenceId, correctHash)
      )
        .to.emit(contract, "EvidenceVerified")
        .withArgs(evidenceId, auditor.address, true, await time.latest());

      const evidence = await contract.getEvidenceDetails(evidenceId);
      expect(evidence.verificationCount).to.equal(1);
    });

    it("should detect tampered evidence", async function () {
      const result = await contract
        .connect(auditor)
        .verifyEvidence.staticCall(evidenceId, wrongHash);

      expect(result.isAuthentic).to.be.false;
      expect(result.registeredHash).to.equal(correctHash);
    });

    it("should track verifiers", async function () {
      await contract.connect(auditor).verifyEvidence(evidenceId, correctHash);
      await contract
        .connect(investigator2)
        .verifyEvidence(evidenceId, correctHash);

      const verifiers = await contract.getVerificationLog(evidenceId);
      expect(verifiers.length).to.equal(2);
      expect(verifiers[0]).to.equal(auditor.address);
      expect(verifiers[1]).to.equal(investigator2.address);
    });

    it("should support quick verify (read-only)", async function () {
      const isValid = await contract.quickVerify(evidenceId, correctHash);
      expect(isValid).to.be.true;

      const isInvalid = await contract.quickVerify(evidenceId, wrongHash);
      expect(isInvalid).to.be.false;

      // Should not update verification count
      const evidence = await contract.getEvidenceDetails(evidenceId);
      expect(evidence.verificationCount).to.equal(0);
    });

    it("should batch verify multiple evidence items", async function () {
      // Register second evidence
      const tx = await contract.connect(investigator1).registerEvidence(
        mockEvidence.caseId,
        toBytes32("second_file"),
        "ipfs://second",
        "Second Evidence",
        mockEvidence.descriptionHash,
        0,
        mockEvidence.locationHash,
        mockEvidence.collectedAt,
        false
      );

      const receipt = await tx.wait();
      const event = receipt?.logs
        .map((log) => {
          try {
            return contract.interface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            });
          } catch {
            return null;
          }
        })
        .find((e) => e?.name === "EvidenceRegistered");

      const evidenceId2 = event?.args.evidenceId;

      // Batch verify
      const results = await contract
        .connect(auditor)
        .batchVerifyEvidence.staticCall(
          [evidenceId, evidenceId2],
          [correctHash, toBytes32("second_file")]
        );

      expect(results[0]).to.be.true;
      expect(results[1]).to.be.true;
    });
  });

  describe("Admin Functions", function () {
    let evidenceId: string;

    beforeEach(async function () {
      const tx = await contract.connect(investigator1).registerEvidence(
        mockEvidence.caseId,
        mockEvidence.fileHash,
        mockEvidence.fileURI,
        mockEvidence.title,
        mockEvidence.descriptionHash,
        mockEvidence.evidenceType,
        mockEvidence.locationHash,
        mockEvidence.collectedAt,
        false
      );

      const receipt = await tx.wait();
      const event = receipt?.logs
        .map((log) => {
          try {
            return contract.interface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            });
          } catch {
            return null;
          }
        })
        .find((e) => e?.name === "EvidenceRegistered");

      evidenceId = event?.args.evidenceId;
    });

    it("should allow admin to set sensitive flag", async function () {
      await contract.connect(admin).setSensitiveFlag(evidenceId, true);

      const evidence = await contract.getEvidenceDetails(evidenceId);
      expect(evidence.isSensitive).to.be.true;
    });

    it("should allow super admin to force archive", async function () {
      const reasonHash = toBytes32("Court order");

      await expect(
        contract.connect(superAdmin).forceArchive(evidenceId, reasonHash)
      )
        .to.emit(contract, "EvidenceStatusUpdated")
        .withArgs(evidenceId, 0, 4, superAdmin.address, await time.latest());

      const evidence = await contract.getEvidenceDetails(evidenceId);
      expect(evidence.status).to.equal(4); // Archived
    });

    it("should prevent non-super-admin from force archiving", async function () {
      await expect(
        contract
          .connect(admin)
          .forceArchive(evidenceId, toBytes32("unauthorized"))
      ).to.be.revertedWith("EvidenceRegistry: caller is not super admin");
    });

    it("should update required approvals", async function () {
      await expect(contract.connect(superAdmin).setRequiredApprovals(3))
        .to.emit(contract, "RequiredApprovalsUpdated")
        .withArgs(2, 3, await time.latest());

      expect(await contract.requiredApprovals()).to.equal(3);
    });

    it("should transfer super admin rights", async function () {
      await contract.connect(superAdmin).transferSuperAdmin(admin.address);

      expect(await contract.superAdmin()).to.equal(admin.address);
    });
  });

  describe("Query Functions", function () {
    it("should return evidence by case", async function () {
      const caseId = toBytes32("CASE-MULTI");

      // Register 3 evidence items for same case
      for (let i = 0; i < 3; i++) {
        await contract.connect(investigator1).registerEvidence(
          caseId,
          toBytes32(`file_${i}`),
          `ipfs://file_${i}`,
          `Evidence ${i}`,
          toBytes32(`desc_${i}`),
          0,
          mockEvidence.locationHash,
          mockEvidence.collectedAt,
          false
        );
      }

      const evidenceIds = await contract.getEvidenceByCase(caseId);
      expect(evidenceIds.length).to.equal(3);
    });

    it("should return total evidence count", async function () {
      expect(await contract.totalEvidenceCount()).to.equal(0);

      await contract.connect(investigator1).registerEvidence(
        mockEvidence.caseId,
        mockEvidence.fileHash,
        mockEvidence.fileURI,
        mockEvidence.title,
        mockEvidence.descriptionHash,
        mockEvidence.evidenceType,
        mockEvidence.locationHash,
        mockEvidence.collectedAt,
        false
      );

      expect(await contract.totalEvidenceCount()).to.equal(1);
    });

    it("should return role of address", async function () {
      expect(await contract.getRoleOf(admin.address)).to.equal(ADMIN_ROLE);
      expect(await contract.getRoleOf(investigator1.address)).to.equal(
        INVESTIGATOR_ROLE
      );
      expect(await contract.getRoleOf(auditor.address)).to.equal(AUDITOR_ROLE);
    });
  });
});