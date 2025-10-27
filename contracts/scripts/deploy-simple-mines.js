const hre = require("hardhat");

async function main() {
  console.log("Deploying SimpleMinesGame contract...");

  // Get the ContractFactory and Signers here.
  const SimpleMinesGame = await hre.ethers.getContractFactory("SimpleMinesGame");
  
  // Deploy the contract
  const simpleMinesGame = await SimpleMinesGame.deploy();
  
  await simpleMinesGame.waitForDeployment();
  
  const contractAddress = await simpleMinesGame.getAddress();
  
  console.log("SimpleMinesGame deployed to:", contractAddress);
  
  // Save deployment info
  const deploymentInfo = {
    contractAddress: contractAddress,
    network: hre.network.name,
    deployer: (await hre.ethers.getSigners())[0].address,
    timestamp: new Date().toISOString(),
    blockNumber: await hre.ethers.provider.getBlockNumber()
  };
  
  console.log("Deployment Info:", deploymentInfo);
  
  // Verify contract if on a supported network
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("Waiting for block confirmations...");
    await simpleMinesGame.deploymentTransaction().wait(6);
    
    try {
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: [],
      });
      console.log("Contract verified successfully");
    } catch (error) {
      console.log("Verification failed:", error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });