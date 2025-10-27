import React, { useState, useEffect, useCallback } from 'react';
import { usePushChainClient, PushUniversalAccountButton, usePushWalletContext, PushUI } from '@pushchain/ui-kit';
import {
  readGameStatus, getWalletBalance, calculateCurrentWinnings, getSharedPoolBalance
} from '../config';
import { ethers } from 'ethers';

const GRID_SIZE = 25;
const GRID_COLS = 5;

const calculateMultiplier = (mines, safeTiles) => {
  if (safeTiles === 0) return 1;
  
  const totalTiles = 25;
  const safeTilesRemaining = totalTiles - mines;
  
  let probability = 1;
  for (let i = 0; i < safeTiles; i++) {
    probability *= (safeTilesRemaining - i) / (totalTiles - i);
  }
  
  return probability > 0 ? 1 / probability : 1;
};

function Game() {
  // Use Push Chain Client and Wallet Context
  const { pushChainClient } = usePushChainClient();
  const { connectionStatus } = usePushWalletContext();
  
  // Check if wallet is connected using connection status
  const isConnected = connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTED;
  
  // Extract account info
  const accountObj = pushChainClient?.universal?.account;
  const account = typeof accountObj === 'string' ? accountObj : accountObj?.address;
  
  // Send transaction using Push Chain Client
  const sendPushTransaction = async (txData) => {
    if (!pushChainClient || !isConnected || !account) {
      console.error('Missing requirements:', { pushChainClient: !!pushChainClient, isConnected, account });
      throw new Error('Wallet not connected');
    }
    
    try {
      console.log('Sending transaction with Push Chain Client:', txData);
      
      // Use Push Chain Client's sendTransaction method
      const result = await pushChainClient.universal.sendTransaction(txData);
      
      console.log('Transaction sent:', result);
      return result;
    } catch (error) {
      console.error('Error sending transaction:', error);
      throw error;
    }
  };
  
  const [walletBalance, setWalletBalance] = useState('0');
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(false);
  const [liveProfit, setLiveProfit] = useState('0');
  const [betAmount, setBetAmount] = useState('0.1');
  const [mineCount, setMineCount] = useState(3);
  const [pendingTile, setPendingTile] = useState(null);
  const [error, setError] = useState(null);
  const [modalState, setModalState] = useState({ isOpen: false, isWin: false, amount: '0', txHash: null });

  const fetchAndUpdateState = useCallback(async (acc) => {
    if (!acc) return;
    try {
      const [walletBal, status, poolBalanceBN] = await Promise.all([
        getWalletBalance(acc),
        readGameStatus(acc),
        getSharedPoolBalance()
      ]);

      setWalletBalance(walletBal);

      if (status && status.isActive) {
        setGame(status);
        const theoreticalProfitBN = await calculateCurrentWinnings(status);
        const betAmountBN = BigInt(status.betAmount);
        const theoreticalPayoutBN = betAmountBN + theoreticalProfitBN;
        
        let actualPayoutBN;
        const effectivePoolBalance = poolBalanceBN - betAmountBN;

        if (theoreticalPayoutBN > effectivePoolBalance) {
          actualPayoutBN = effectivePoolBalance;
        } else {
          actualPayoutBN = theoreticalPayoutBN;
        }
        
        let actualProfitBN = actualPayoutBN - betAmountBN;
        if (actualProfitBN < 0n) {
          actualProfitBN = 0n;
        }
        
        setLiveProfit(actualProfitBN.toString());
      } else {
        setGame(null);
        setLiveProfit('0');
      }
      return status;
    } catch (err) {
      console.error("Error fetching wallet data:", err);
    }
  }, []);

  // Debug: Log wallet state
  useEffect(() => {
    console.log('Push Chain Client State:', { 
      isConnected,
      account,
      connectionStatus,
      pushChainClient: !!pushChainClient,
      hasUniversal: !!pushChainClient?.universal,
      hasSendTransaction: typeof pushChainClient?.universal?.sendTransaction === 'function'
    });
  }, [pushChainClient, account, isConnected, connectionStatus]);

  // Fetch game state when account changes
  useEffect(() => {
    if (account && isConnected) {
      fetchAndUpdateState(account);
    }
  }, [account, isConnected, fetchAndUpdateState]);

  const onStartGame = async () => {
    if (!account || !isConnected) return;
    setLoading(true);
    setError(null);
    try {
      console.log('Starting game with:', { mineCount, betAmount, account });
      
      const valueInWei = ethers.parseEther(betAmount);
      console.log('Parsed bet amount:', valueInWei.toString());
      
      // Encode the function call
      const MinesGameContract = await import('../MinesGame.json');
      const iface = new ethers.Interface(MinesGameContract.abi);
      const data = iface.encodeFunctionData('startGame', [mineCount]);
      
      console.log('Sending transaction to contract...');
      
      // Send transaction using Push Chain Client
      await sendPushTransaction({
        to: process.env.REACT_APP_MINES_CONTRACT_ADDRESS,
        data: data,
        value: valueInWei.toString(),
        gas: 3000000n,
      });
      
      console.log('Transaction sent successfully');
      
      // Wait a bit for transaction to be mined
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      await fetchAndUpdateState(account);
    } catch (err) {
      console.error('Start game error:', err);
      setError("Start game failed: " + (err?.reason || err?.message || err));
      setGame(null);
    } finally {
      setLoading(false);
    }
  };

  const onRevealTile = async (index) => {
    if (!game?.isActive || loading || pendingTile !== null) return;
    setPendingTile(index);
    setError(null);
    try {
      // Encode the function call
      const MinesGameContract = await import('../MinesGame.json');
      const iface = new ethers.Interface(MinesGameContract.abi);
      const data = iface.encodeFunctionData('revealTile', [index]);
      
      // Send transaction using Push Chain Client
      await sendPushTransaction({
        to: process.env.REACT_APP_MINES_CONTRACT_ADDRESS,
        data: data,
        value: '0',
        gas: 500000n,
      });
      
      // Wait for transaction to be mined
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const newStatus = await fetchAndUpdateState(account);
      if (!newStatus || !newStatus.isActive) {
        setModalState({ isOpen: true, isWin: false, amount: '0', txHash: null });
      }
    } catch (err) {
      setError("Reveal failed: " + (err?.reason || err?.message || err));
    } finally {
      setPendingTile(null);
    }
  };

  const onCashOut = async () => {
    if (!game || game.revealedSafeTiles === 0) return;
    setLoading(true);
    setError(null);
    const expectedPayout = (BigInt(game.betAmount) + BigInt(liveProfit)).toString();
    try {
      // Encode the function call
      const MinesGameContract = await import('../MinesGame.json');
      const iface = new ethers.Interface(MinesGameContract.abi);
      const data = iface.encodeFunctionData('cashOut', []);
      
      console.log('Sending cash out transaction...');
      
      // Send transaction using Push Chain Client
      const result = await sendPushTransaction({
        to: process.env.REACT_APP_MINES_CONTRACT_ADDRESS,
        data: data,
        value: '0',
        gas: 500000n,
      });
      
      console.log('Cash out transaction sent');
      
      // Wait for transaction to be mined
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      await fetchAndUpdateState(account);
      setModalState({ 
        isOpen: true, 
        isWin: true, 
        amount: expectedPayout,
        txHash: result?.hash || 'pending'
      });
    } catch (err) {
      setError("Cashout failed: " + (err?.reason || err?.message || err));
    } finally {
      setLoading(false);
    }
  };



  const renderTileContent = (index) => {
    if (!game) return null;
    
    if (pendingTile === index) {
      return <div className="w-6 h-6 border-2 border-t-purple-400 border-gray-600 rounded-full animate-spin"></div>;
    }
    
    if (game.revealedTiles[index]) {
      if (game.mineLocations.includes(index)) {
        return <span className="text-3xl">💥</span>;
      } else {
        return <span className="text-3xl">💎</span>;
      }
    }
    
    return null;
  };

  const getTileStyle = (index) => {
    if (!game) {
      return "bg-[#2a1a3e] border-[#3d2b52] text-purple-400 hover:bg-[#342447]";
    }
    
    if (pendingTile === index) {
      return "bg-[#4c3663] border-purple-400 text-purple-400";
    }
    
    if (game.revealedTiles[index]) {
      if (game.mineLocations.includes(index)) {
        return "bg-red-900 border-red-600 text-red-400 animate-pulse";
      } else {
        return "bg-purple-900 border-purple-600 text-purple-400";
      }
    }
    
    return "bg-[#2a1a3e] border-[#3d2b52] text-purple-400 hover:bg-[#342447] cursor-pointer";
  };

  return (
    <div className="min-h-screen w-screen bg-gradient-to-br from-[#1a0d2e] to-[#2d1b3d] flex items-center justify-center py-8 fixed inset-0 overflow-auto">
      {error && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg">
          {error}
          <button 
            onClick={() => setError(null)}
            className="ml-4 text-white hover:text-gray-200"
          >
            ✕
          </button>
        </div>
      )}

      {modalState.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#3d2b52] text-white rounded-2xl p-8 text-center">
            <div className="text-6xl mb-4">
              {modalState.isWin ? '🎉' : '💥'}
            </div>
            <h2 className="text-2xl font-bold mb-4">
              {modalState.isWin ? 'Congratulations!' : 'Game Over!'}
            </h2>
            <p className="mb-4">
              {modalState.isWin 
                ? `You won ${ethers.formatEther(modalState.amount)} PC!`
                : 'Better luck next time!'
              }
            </p>
            {modalState.isWin && modalState.txHash && (
              <div className="mb-6 p-4 bg-[#2a1a3e]/60 rounded-xl border border-[#5d4a6b]/30">
                <p className="text-sm text-gray-300 mb-2">💰 Cash Out Transaction:</p>
                <p className="text-xs text-gray-400 mb-3">
                  ✅ {ethers.formatEther(modalState.amount)} PC sent to your wallet
                </p>
                <div className="flex items-center justify-between bg-[#0f1419]/80 rounded-lg p-3">
                  <span className="text-xs font-mono text-green-400 break-all">
                    {modalState.txHash.slice(0, 10)}...{modalState.txHash.slice(-8)}
                  </span>
                  <button
                    onClick={() => window.open(`https://donut.push.network/tx/${modalState.txHash}`, '_blank')}
                    className="ml-2 text-blue-400 hover:text-blue-300 text-sm"
                  >
                    🔗 View
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  💡 Transaction value shows 0 PC because the contract sends you the winnings internally
                </p>
              </div>
            )}
            <button
              onClick={() => setModalState({ isOpen: false, isWin: false, amount: '0', txHash: null })}
              className="bg-gradient-to-r from-[#e879f9] to-[#f472b6] text-white px-6 py-2 rounded-lg font-bold"
            >
              {modalState.isWin ? 'Play Again' : 'Try Again'}
            </button>
          </div>
        </div>
      )}

      <div className="w-full max-w-7xl flex flex-col lg:flex-row gap-8 items-center justify-center px-6">
        <aside className="w-full max-w-xl bg-gradient-to-b from-[#3d2b52]/90 to-[#2a1a3e]/90 backdrop-blur-sm rounded-3xl shadow-2xl p-5 flex flex-col h-[700px] border border-[#5d4a6b]/50">
          <div className="flex flex-col gap-4 flex-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-r from-[#2a1a3e]/80 to-[#3d2b52]/80 backdrop-blur-sm rounded-2xl p-3 border border-[#5d4a6b]/50 shadow-lg">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-gray-300 text-sm font-medium">💼 Wallet</div>
                    {isConnected && <div className="text-purple-400 text-xs font-semibold">Connected</div>}
                  </div>
                  {isConnected && account ? (
                    <div className="bg-[#0f1419]/60 backdrop-blur-sm rounded-xl p-2 border border-[#5d4a6b]/30 mb-2">
                      <div className="text-gray-400 text-xs mb-1">Address</div>
                      <div className="text-white text-sm font-mono mb-2">{account.slice(0, 6)}...{account.slice(-4)}</div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-xs">Balance</span>
                        <span className="text-purple-400 text-base font-bold">{parseFloat(walletBalance).toFixed(4)} PC</span>
                      </div>
                    </div>
                  ) : null}
                  <PushUniversalAccountButton />
                </div>
              </div>

              <div className="bg-[#2a1a3e]/40 backdrop-blur-sm rounded-2xl p-3 border border-[#5d4a6b]/30">
                <label className="block text-gray-200 text-sm mb-2 font-medium">💰 Bet Amount</label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="number"
                    value={betAmount}
                    onChange={e => setBetAmount(e.target.value)}
                    disabled={game?.isActive || loading}
                    className="flex-1 bg-[#0f1419]/80 backdrop-blur-sm border border-[#3d4656]/50 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/50 disabled:opacity-50"
                    min="0"
                    step="0.00000001"
                    style={{ width: 'calc(100% - 60px)' }}
                  />
                  <span className="text-yellow-400 text-sm font-semibold bg-[#0f1419]/80 backdrop-blur-sm border border-[#3d4656]/50 rounded-xl px-3 py-2 whitespace-nowrap">PC</span>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setBetAmount((parseFloat(betAmount) / 2).toString())}
                    className="flex-1 bg-[#232b39]/60 backdrop-blur-sm text-gray-300 rounded-xl py-1 text-xs hover:text-white hover:bg-[#2d3646]/60 border border-[#3d4656]/30 transition-all"
                  >
                    ½
                  </button>
                  <button 
                    onClick={() => setBetAmount((parseFloat(betAmount) * 2).toString())}
                    className="flex-1 bg-[#232b39]/60 backdrop-blur-sm text-gray-300 rounded-xl py-1 text-xs hover:text-white hover:bg-[#2d3646]/60 border border-[#3d4656]/30 transition-all"
                  >
                    2x
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#2a1a3e]/40 backdrop-blur-sm rounded-2xl p-3 border border-[#5d4a6b]/30">
                <label className="block text-gray-200 text-sm mb-2 font-medium">💣 Mines</label>
                <select
                  value={mineCount}
                  onChange={e => setMineCount(Number(e.target.value))}
                  disabled={game?.isActive || loading}
                  className="w-full bg-[#0f1419]/80 backdrop-blur-sm border border-[#3d4656]/50 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/50 disabled:opacity-50 mb-3"
                >
                  {Array.from({ length: 24 }, (_, i) => i + 1).map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
                
                <div className="bg-[#0f1419]/60 backdrop-blur-sm rounded-xl p-2 border border-[#3d4656]/30">
                  <div className="text-gray-200 text-xs mb-2 font-medium">📊 Multipliers</div>
                  <div className="space-y-1 text-xs">
                    <div className="grid grid-cols-3 gap-2 text-gray-200 font-medium">
                      <span>Mines</span>
                      <span className="text-center">Safe</span>
                      <span className="text-right">Multiplier</span>
                    </div>
                    {[1, 2, 3, 4, 5].map(safeCount => {
                      const multiplier = calculateMultiplier(mineCount, safeCount);
                      return (
                        <div key={safeCount} className="grid grid-cols-3 gap-2">
                          <span className="text-red-400">{mineCount}</span>
                          <span className="text-green-400 text-center">{safeCount}</span>
                          <span className="text-yellow-400 text-right">{multiplier.toFixed(2)}x</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="bg-[#2a1a3e]/40 backdrop-blur-sm rounded-2xl p-3 border border-[#5d4a6b]/30">
                <div className="text-gray-200 text-sm mb-2 font-medium">📈 Game Stats</div>
                {game ? (
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">Bet:</span>
                      <span className="text-white font-semibold">{ethers.formatEther(game.betAmount)} PC</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">Mines:</span>
                      <span className="text-red-400 font-semibold">{game.totalMines}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">Safe:</span>
                      <span className="text-green-400 font-semibold">{game.revealedSafeTiles}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">Profit:</span>
                      <span className="text-yellow-400 font-semibold">{ethers.formatEther(liveProfit)} PC</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-400 text-sm text-center py-4">
                    No active game
                  </div>
                )}
              </div>
            </div>

            <div className="flex bg-[#2d3646]/60 backdrop-blur-sm rounded-xl p-1 border border-[#3d4656]/30">
              <button className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-[#232b39] to-[#2d3646]">Manual</button>
              <button className="flex-1 py-2 rounded-lg text-sm font-semibold text-gray-400 hover:text-white">Auto</button>
            </div>
          </div>

          <div className="mt-3 flex-shrink-0 space-y-2">
            {game && game.revealedSafeTiles > 0 && (
              <button 
                onClick={onCashOut}
                disabled={loading}
                className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-[#181f2a] font-bold rounded-2xl py-3 text-base transition-all duration-150 shadow-lg"
              >
                {loading ? 'Cashing Out...' : '💰 Cash Out'} 
              </button>
            )}
            <button 
              onClick={onStartGame}
              disabled={!isConnected || !account || game?.isActive || loading}
              className="w-full bg-gradient-to-r from-[#e879f9] to-[#f472b6] hover:from-[#f472b6] hover:to-[#e879f9] disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold rounded-2xl py-3 text-lg transition-all duration-150 shadow-lg"
            >
              {loading ? 'Starting...' : (isConnected ? '🎯 Bet' : '🔒 Connect Wallet First')} 
            </button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col items-center justify-center min-h-[700px]">
          <div className="bg-gradient-to-br from-[#3d2b52]/90 to-[#2a1a3e]/90 backdrop-blur-sm rounded-3xl shadow-2xl p-12 flex flex-col items-center justify-center border border-[#5d4a6b]/50 relative overflow-hidden w-full max-w-4xl">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-3xl pointer-events-none"></div>
            
            <div className="text-center mb-10">
              <h1 className="text-4xl font-bold text-white mb-3">🎮 minePush</h1>
              <p className="text-gray-400 text-lg">Find the gems, avoid the mines!</p>
            </div>

            <div className="grid grid-cols-5 gap-4 relative z-10 mb-8">
              {Array.from({ length: GRID_SIZE }).map((_, i) => (
                <div
                  key={i}
                  onClick={() => !game?.isActive ? null : onRevealTile(i)}
                  className={`w-24 h-24 rounded-2xl flex items-center justify-center border-2 shadow-xl transition-all duration-300 text-3xl backdrop-blur-sm relative overflow-hidden hover:scale-105 ${getTileStyle(i)}`}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-2xl pointer-events-none"></div>
                  <div className="relative z-10">
                    {renderTileContent(i)}
                  </div>
                </div>
              ))}
            </div>
            
            {game && game.revealedSafeTiles > 0 && (
              <div className="w-full bg-gradient-to-r from-[#2d3646]/80 to-[#232b39]/80 backdrop-blur-sm rounded-3xl p-8 border border-[#3d4656]/50 shadow-xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-3xl pointer-events-none"></div>
                <div className="text-center relative z-10">
                  <div className="text-gray-200 text-lg mb-4 font-medium">💰 Current Profit</div>
                  <div className="text-pink-400 text-5xl font-bold mb-4">{ethers.formatEther(liveProfit)} PC</div>
                  <div className="bg-[#2a1a3e]/60 backdrop-blur-sm rounded-2xl p-6 border border-[#5d4a6b]/30">
                    <div className="text-green-400 text-lg font-semibold mb-3">
                      🎯 {game.revealedSafeTiles} safe tiles revealed
                    </div>
                    <div className="text-gray-300 text-base">
                      Keep going to increase your winnings! 🚀
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default Game;
