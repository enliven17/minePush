# minePush

A Mines game built on Push Chain Donut Testnet. Players bet PC tokens and play the classic Mines game.

## Features

- Mines game with blockchain integration
- Push Chain Donut Testnet support
- Smart contract backend
- Responsive interface

## Tech Stack

- React 19, Tailwind CSS, Ethers.js v6
- Solidity 0.8.19, Hardhat
- Push Chain Donut Testnet (Chain ID: 42101)

## Prerequisites

- Node.js 18+
- MetaMask wallet
- PC tokens for gas fees

## Setup

### 1. Clone Repository
```bash
git clone <repository-url>
cd minepush
```

### 2. Install Dependencies
```bash
npm install --legacy-peer-deps
```

### 3. Environment Setup
Create `.env` file in `contracts/` directory:
```bash
cd contracts
echo "PRIVATE_KEY=your_private_key_here" > .env
```

### 4. Deploy Contract
```bash
cd contracts
npx hardhat run scripts/deploy.js --network pushDonutTestnet
```

### 5. Update Contract Address
Copy deployed contract address and update `src/config.js`:
```javascript
const MINES_GAME_CONTRACT_ADDRESS = '0x...';
```

### 6. Start Development Server
```bash
npm start
```

## How to Play

1. Connect MetaMask wallet
2. Set bet amount in PC tokens
3. Choose number of mines (1-24)
4. Click "Bet" to start game
5. Click tiles to reveal diamonds or mines
6. Cash out to collect winnings

## Development Scripts

```bash
npm start          # Start development server
npm run build      # Build for production
```

## Network Configuration

### Push Chain Donut Testnet
- Chain ID: 42101
- RPC URL: https://evm.rpc-testnet-donut-node1.push.org/
- Explorer: https://donut.push.network
- Currency: PC

### MetaMask Setup
1. Open MetaMask
2. Add Network → Add Network Manually
3. Network Name: `Push Chain Donut Testnet`
4. New RPC URL: `https://evm.rpc-testnet-donut-node1.push.org/`
5. Chain ID: `42101`
6. Currency Symbol: `PC`
7. Block Explorer URL: `https://donut.push.network`

## Project Structure

```
minepush/
├── contracts/           # Smart contracts
│   ├── contracts/       # Solidity files
│   ├── scripts/         # Deployment scripts
│   └── hardhat.config.js
├── src/                 # React frontend
│   ├── components/      # React components
│   ├── config.js        # Blockchain configuration
│   └── App.js
├── public/              # Static assets
└── package.json
```

## License

MIT License

## Disclaimer

Demo project for educational purposes. Use at your own risk.

## Links

- [Push Chain Documentation](https://pushchain.github.io/push-chain-website/)
- [Push Chain Donut Testnet Explorer](https://donut.push.network)
- [Hardhat Documentation](https://hardhat.org/docs)
- [Ethers.js Documentation](https://docs.ethers.org/)
