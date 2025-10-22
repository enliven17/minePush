const hre = require("hardhat");

async function main() {
  console.log("💰 Adding funds to contract...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Using account:", deployer.address);

  const contractAddress = "0xAcb2aF1b66FA3e35C2710A6A551f3291BA34a15B";
  const contract = await hre.ethers.getContractAt("MinesGame", contractAddress);
  
  console.log("Adding 10 PC to house funds...");
  const tx = await contract.addHouseFunds({ 
    value: hre.ethers.parseEther("10"),
    gasLimit: 100000
  });
  
  console.log("Transaction hash:", tx.hash);
  await tx.wait();
  
  const balance = await contract.getSharedPoolBalance();
  console.log("✅ New pool balance:", hre.ethers.formatEther(balance), "PC");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });