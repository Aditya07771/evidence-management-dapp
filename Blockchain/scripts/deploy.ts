import hardhat from "hardhat";
import * as fs from "fs";
import * as path from "path";

const { ethers } = hardhat;

async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  EVIDENCE REGISTRY DEPLOYMENT");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Get deployer
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH\n");

  // Deploy parameters
  const REQUIRED_APPROVALS = 2;

  console.log("Deployment parameters:");
  console.log("  Required Approvals:", REQUIRED_APPROVALS);
  console.log("\nDeploying EvidenceRegistry...");

  // Deploy contract
  const EvidenceRegistry = await ethers.getContractFactory("EvidenceRegistry");
  const contract = await EvidenceRegistry.deploy(REQUIRED_APPROVALS);

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log("✅ EvidenceRegistry deployed to:", address);

  // Get deployment transaction
  const deployTx = contract.deploymentTransaction();
  if (deployTx) {
    console.log("   Transaction hash:", deployTx.hash);
    const receipt = await deployTx.wait(1);
    if (receipt) {
      console.log("   Block number:", receipt.blockNumber);
      console.log("   Gas used:", receipt.gasUsed.toString());
    }
  }

  // Verify deployer is super admin
  const superAdmin = await contract.superAdmin();
  console.log("\n✅ Super Admin:", superAdmin);
  console.log("   Matches deployer:", superAdmin === deployer.address);

  // Get role constants
  const ADMIN_ROLE = await contract.ADMIN_ROLE();
  const INVESTIGATOR_ROLE = await contract.INVESTIGATOR_ROLE();
  const AUDITOR_ROLE = await contract.AUDITOR_ROLE();

  console.log("\n📋 Role Constants:");
  console.log("   ADMIN_ROLE:", ADMIN_ROLE);
  console.log("   INVESTIGATOR_ROLE:", INVESTIGATOR_ROLE);
  console.log("   AUDITOR_ROLE:", AUDITOR_ROLE);

  // Save deployment info
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    contractAddress: address,
    deployer: deployer.address,
    superAdmin: superAdmin,
    requiredApprovals: REQUIRED_APPROVALS,
    deploymentBlock: deployTx?.blockNumber || 0,
    deploymentTx: deployTx?.hash || "",
    timestamp: new Date().toISOString(),
    roles: {
      ADMIN_ROLE,
      INVESTIGATOR_ROLE,
      AUDITOR_ROLE,
    },
    abi: "EvidenceRegistry.json",
  };

  // Create output directory if it doesn't exist
  const outputDir = path.join(__dirname, "..", "src", "contracts");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write deployment info
  const deployedPath = path.join(outputDir, "deployed.json");
  fs.writeFileSync(deployedPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n💾 Deployment info saved to:", deployedPath);

  // Copy ABI
  const artifactPath = path.join(
    __dirname,
    "..",
    "src",
    "contracts",
    "artifacts",
    "contracts",
    "EvidenceRegistry.sol",
    "EvidenceRegistry.json"
  );

  if (fs.existsSync(artifactPath)) {
    console.log("✅ ABI available at:", artifactPath);
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  DEPLOYMENT COMPLETE");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("Next steps:");
  console.log("1. Update .env with CONTRACT_ADDRESS=" + address);
  console.log("2. Run: npm run register:admin");
  console.log("3. Verify on Etherscan (if mainnet/testnet):");
  console.log(`   npx hardhat verify --network sepolia ${address} ${REQUIRED_APPROVALS}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });