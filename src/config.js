import { ethers } from 'ethers';
import SimpleMinesGameContract from './SimpleMinesGame.json';

// Define BigInt for older environments
/* global BigInt */

// Local Hardhat Network Configuration
export const hardhatNetwork = {
  chainId: 1337,
  name: 'Hardhat Local',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: ['http://127.0.0.1:8545']
    }
  },
  blockExplorerUrls: []
};

// Push Chain Donut Testnet Configuration
export const pushChainDonutTestnet = {
  chainId: 42101,
  name: 'Push Chain Donut Testnet',
  nativeCurrency: {
    name: 'Push Chain Token',
    symbol: 'PC',
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: ['https://evm.rpc-testnet-donut-node1.push.org/', 'https://evm.rpc-testnet-donut-node2.push.org/']
    }
  },
  blockExplorerUrls: ['https://donut.push.network']
};

// Contract address - updated after deployment to Push Chain Donut Testnet
const MINES_GAME_CONTRACT_ADDRESS = process.env.REACT_APP_MINES_CONTRACT_ADDRESS || '0xD60763b504a2727e60d7D21b8086DAC192ba7679';

// Provider and signer setup
export const getProvider = () => {
  // Always use Push Chain RPC for reads
  return new ethers.JsonRpcProvider('https://evm.rpc-testnet-donut-node1.push.org/');
};

export const getSigner = async () => {
  const provider = getProvider();
  if (provider) {
    return await provider.getSigner();
  }
  return null;
};

// Contract instance
export const getContract = () => {
  const provider = getProvider();
  if (!provider) return null;
  
  return new ethers.Contract(
    MINES_GAME_CONTRACT_ADDRESS, 
    SimpleMinesGameContract.abi, 
    provider
  );
};

export const getContractWithSigner = async (customSigner = null) => {
  const signer = customSigner || await getSigner();
  if (!signer) return null;
  
  return new ethers.Contract(
    MINES_GAME_CONTRACT_ADDRESS, 
    SimpleMinesGameContract.abi, 
    signer
  );
};

// Account management
export const getAccount = async () => {
  // This function is now deprecated and will be handled by Push Chain Client
  // Return null as account management is handled by @pushchain/ui-kit
  return null;
};

// Balance functions
export const getWalletBalance = async (address) => {
  if (!address) return '0';
  const provider = getProvider();
  if (!provider) return '0';
  
  const balance = await provider.getBalance(address);
  // Return balance as is without formatting, or format with appropriate decimals
  return balance.toString();
};

// Transaction creation functions
export const createStartGameTransaction = async (numberOfMines, betAmountInEth) => {
  const contract = await getContractWithSigner();
  if (!contract) throw new Error('No contract instance available');
  
  const tx = await contract.startGame.populateTransaction(
    numberOfMines, 
    { value: ethers.parseEther(betAmountInEth) }
  );
  return tx;
};

export const createRevealTileTransaction = async (tileIndex) => {
  const contract = await getContractWithSigner();
  if (!contract) throw new Error('No contract instance available');
  
  const tx = await contract.revealTile.populateTransaction(tileIndex);
  return tx;
};

export const createCashOutTransaction = async () => {
  const contract = await getContractWithSigner();
  if (!contract) throw new Error('No contract instance available');
  
  const tx = await contract.cashOut.populateTransaction();
  return tx;
};

// Read functions
export const readGameStatus = async (playerAddress) => {
  const contract = getContract();
  if (!contract) return null;
  
  try {
    const game = await contract.getGameStatus(playerAddress);
    return {
      player: game.playerAddr,
      betAmount: game.betAmount.toString(),
      totalMines: Number(game.totalMines),
      revealedSafeTiles: 0, // Will be tracked locally
      revealedTiles: new Array(25).fill(false), // Initialize empty grid
      mineLocations: [], // Will be determined locally
      isActive: game.isActive,
      startTime: game.startTime,
      hasWon: game.hasWon
    };
  } catch (error) {
    console.error('Error reading game status:', error);
    return null;
  }
};

export const getSharedPoolBalance = async () => {
  const contract = getContract();
  if (!contract) return 0n;
  
  try {
    const balance = await contract.getPoolBalance();
    return balance;
  } catch (error) {
    console.error('Error reading pool balance:', error);
    return 0n;
  }
};

export const calculateCurrentWinnings = async (gameData) => {
  if (!gameData || gameData.revealedSafeTiles === 0) return 0n;
  
  const contract = getContract();
  if (!contract) return 0n;
  
  try {
    const payout = await contract.calculatePayout(
      BigInt(gameData.betAmount),
      gameData.totalMines,
      gameData.revealedSafeTiles
    );
    // Return profit (payout - bet amount)
    return payout - BigInt(gameData.betAmount);
  } catch (error) {
    console.error('Error calculating winnings:', error);
    return 0n;
  }
};

// Network switching
export const switchToPushChainDonutTestnet = async () => {
  if (typeof window !== 'undefined' && window.ethereum) {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${pushChainDonutTestnet.chainId.toString(16)}` }],
      });
    } catch (switchError) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [pushChainDonutTestnet],
          });
        } catch (addError) {
          console.error('Error adding Push Chain Donut Testnet to MetaMask:', addError);
        }
      }
    }
  }
};