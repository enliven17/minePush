// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract SimpleMinesGame {
    struct Game {
        address player;
        uint256 betAmount;
        uint8 totalMines;
        uint256 startTime;
        bool isActive;
        bool hasWon;
    }
    
    mapping(address => Game) public games;
    mapping(address => uint256) public playerBalances;
    
    uint256 public houseEdge = 5; // 5% house edge
    uint256 public constant MAX_MINES = 24;
    uint256 public constant MIN_BET = 1; // Minimum 0.01 PC
    
    address public owner;
    uint256 public totalPoolBalance;
    
    event GameStarted(address indexed player, uint256 betAmount, uint8 mineCount);
    event GameCashedOut(address indexed player, uint256 payout);
    event GameLost(address indexed player);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    // Start a new game - only requires signature
    function startGame(uint8 numberOfMines) external payable {
        require(msg.value >= MIN_BET, "Bet amount too low");
        require(numberOfMines > 0 && numberOfMines <= MAX_MINES, "Invalid mine count");
        require(!games[msg.sender].isActive, "Game already active");
        
        // Store game data
        games[msg.sender] = Game({
            player: msg.sender,
            betAmount: msg.value,
            totalMines: numberOfMines,
            startTime: block.timestamp,
            isActive: true,
            hasWon: false
        });
        
        // Add to pool balance
        totalPoolBalance += msg.value;
        
        emit GameStarted(msg.sender, msg.value, numberOfMines);
    }
    
    // Cash out - only requires signature, payout calculation done off-chain
    function cashOut(uint256 safeTilesRevealed) external {
        Game storage game = games[msg.sender];
        require(game.isActive, "No active game");
        require(safeTilesRevealed > 0, "Must reveal at least one safe tile");
        
        // Calculate payout based on revealed safe tiles
        uint256 payout = calculatePayout(game.betAmount, game.totalMines, safeTilesRevealed);
        
        // Ensure we have enough balance
        require(payout <= totalPoolBalance, "Insufficient pool balance");
        
        // End the game
        game.isActive = false;
        game.hasWon = true;
        
        // Update balances
        totalPoolBalance -= payout;
        playerBalances[msg.sender] += payout;
        
        // Send payout to player
        payable(msg.sender).transfer(payout);
        
        emit GameCashedOut(msg.sender, payout);
    }
    
    // Calculate payout based on mines and safe tiles revealed
    function calculatePayout(uint256 betAmount, uint8 totalMines, uint256 safeTiles) public pure returns (uint256) {
        if (safeTiles == 0) return 0;
        
        uint256 totalTiles = 25;
        uint256 safeTilesRemaining = totalTiles - totalMines;
        
        // Calculate multiplier based on probability
        uint256 multiplier = 100; // Start with 1.00x (100 basis points)
        
        for (uint256 i = 0; i < safeTiles; i++) {
            multiplier = multiplier * totalTiles / (safeTilesRemaining - i);
            totalTiles--;
        }
        
        // Apply house edge (5%)
        multiplier = multiplier * 95 / 100;
        
        return (betAmount * multiplier) / 100;
    }
    
    // End game as lost (called when player hits a mine)
    function endGameAsLost() external {
        Game storage game = games[msg.sender];
        require(game.isActive, "No active game");
        
        game.isActive = false;
        game.hasWon = false;
        
        emit GameLost(msg.sender);
    }
    
    // Get game status
    function getGameStatus(address player) external view returns (
        address playerAddr,
        uint256 betAmount,
        uint8 totalMines,
        uint256 startTime,
        bool isActive,
        bool hasWon
    ) {
        Game memory game = games[player];
        return (
            game.player,
            game.betAmount,
            game.totalMines,
            game.startTime,
            game.isActive,
            game.hasWon
        );
    }
    
    // Get pool balance
    function getPoolBalance() external view returns (uint256) {
        return totalPoolBalance;
    }
    
    // Owner functions
    function withdrawHouseFunds() external onlyOwner {
        uint256 houseFunds = address(this).balance - totalPoolBalance;
        require(houseFunds > 0, "No house funds to withdraw");
        payable(owner).transfer(houseFunds);
    }
    
    function emergencyWithdraw() external onlyOwner {
        payable(owner).transfer(address(this).balance);
        totalPoolBalance = 0;
    }
    
    // Fallback to receive ETH
    receive() external payable {
        totalPoolBalance += msg.value;
    }
}