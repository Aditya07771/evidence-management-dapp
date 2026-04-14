import hardhat from "hardhat";
import * as dotenv from "dotenv";

const { ethers } = hardhat;

dotenv.config();

async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  REGISTER TEST ADMIN");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
  const TEST_ADMIN_WALLET = process.env.TEST_ADMIN_WALLET;
  const TEST_ADMIN_NAME = process.env.TEST_ADMIN_NAME || "Test Admin";
  const TEST_ADMIN_BADGE = process.env.TEST_ADMIN_BADGE || "BADGE-001";

  if (!CONTRACT_ADDRESS) {
    throw new Error("CONTRACT_ADDRESS not set in .env");
  }

  if (!TEST_ADMIN_WALLET) {
    throw new Error("TEST_ADMIN_WALLET not set in .env");
  }

  const [deployer] = await ethers.getSigners();
  console.log("Calling from:", deployer.address);

  // Attach to deployed contract
  const contract = await ethers.getContractAt("EvidenceRegistry", CONTRACT_ADDRESS);

  // Generate hashes
  const nameHash = ethers.keccak256(ethers.toUtf8Bytes(TEST_ADMIN_NAME));
  const badgeHash = ethers.keccak256(ethers.toUtf8Bytes(TEST_ADMIN_BADGE));
  const ADMIN_ROLE = await contract.ADMIN_ROLE();

  console.log("Registering officer:");
  console.log("  Wallet:", TEST_ADMIN_WALLET);
  console.log("  Name:", TEST_ADMIN_NAME);
  console.log("  Badge:", TEST_ADMIN_BADGE);
  console.log("  Role: ADMIN_ROLE");
  console.log("\nHashes:");
  console.log("  nameHash:", nameHash);
  console.log("  badgeHash:", badgeHash);

  // Check if already registered
  const isRegistered = await contract.isRegistered(TEST_ADMIN_WALLET);
  if (isRegistered) {
    console.log("\n⚠️  Officer already registered");
    const officer = await contract.getOfficerDetails(TEST_ADMIN_WALLET);
    console.log("   Active:", officer.isActive);
    console.log("   Role:", officer.role);
    return;
  }

  // Register
  console.log("\n📝 Submitting registration transaction...");
  const tx = await contract.registerOfficer(
    TEST_ADMIN_WALLET,
    nameHash,
    badgeHash,
    ADMIN_ROLE
  );

  console.log("   Tx hash:", tx.hash);
  console.log("   Waiting for confirmation...");

  const receipt = await tx.wait(1);
  console.log("✅ Confirmed in block:", receipt?.blockNumber);

  // Verify
  const officer = await contract.getOfficerDetails(TEST_ADMIN_WALLET);
  console.log("\n✅ Officer registered successfully");
  console.log("   Wallet:", officer.wallet);
  console.log("   Role:", officer.role);
  console.log("   Active:", officer.isActive);
  console.log("   Registered at:", new Date(Number(officer.registeredAt) * 1000).toISOString());

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });