import { PushUniversalAccountButton, usePushWalletContext, usePushChainClient, PushUI } from "@pushchain/ui-kit";
import './WalletButton.css';

export function WalletButton({ className = "" }) {
  const { connectionStatus } = usePushWalletContext();
  const { pushChainClient } = usePushChainClient();
  const isConnected = connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTED;
  const address = pushChainClient?.universal?.account;

  return (
    <div className={`wallet-button-container ${className}`}>
      <PushUniversalAccountButton 
        connectButtonText="Connect Wallet"
        className="push-wallet-button"
      />
      {isConnected && address && (
        <div className="wallet-info">
          <div className="wallet-status">
            <span className="status-indicator"></span>
            <span className="status-text">Connected</span>
          </div>
          <div className="wallet-address">
            {typeof address === 'string' ? address.slice(0, 6) + '...' + address.slice(-4) : 'Connected'}
          </div>
        </div>
      )}
    </div>
  );
}