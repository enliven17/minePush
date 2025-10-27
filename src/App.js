import { PushUniversalWalletProvider, PushUI } from '@pushchain/ui-kit';
import Game from './components/Game';

function App() {
  // Define Wallet Config
  const walletConfig = {
    network: PushUI.CONSTANTS.PUSH_NETWORK.TESTNET,
    app: {
      title: 'minePush',
      description: 'Find the gems, avoid the mines!',
      logoUrl: '/minepushlogo.png'
    },
    login: {
      email: true,
      google: true,
      wallet: true,
      appPreview: true
    },
    modal: {
      loginLayout: 'default',
      connectedLayout: 'default',
      connectedInteraction: 'default',
      appPreview: true
    }
  };

  return (
    <PushUniversalWalletProvider config={walletConfig} themeMode="dark">
      <Game />
    </PushUniversalWalletProvider>
  );
}

export default App;