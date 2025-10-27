import React from "react";
import { PushUniversalWalletProvider, PushUI } from "@pushchain/ui-kit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Create a client
const queryClient = new QueryClient();

// App metadata for Push UI Kit
const appMetadata = {
  logoUrl: "/logo.png",
  title: "MinePush Game",
  description: "Minesweeper game on Push Chain",
};

// Wallet configuration
const walletConfig = {
  network: PushUI.CONSTANTS.PUSH_NETWORK.TESTNET,
  login: {
    email: true,
    google: true,
    wallet: {
      enabled: true,
    },
    appPreview: true,
  },
  modal: {
    loginLayout: PushUI.CONSTANTS.LOGIN.LAYOUT.SPLIT,
    connectedLayout: PushUI.CONSTANTS.CONNECTED.LAYOUT.HOVER,
    appPreview: true,
  },
};

export function Web3Provider({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <PushUniversalWalletProvider 
        config={walletConfig} 
        app={appMetadata}
        themeMode="dark"
      >
        {children}
      </PushUniversalWalletProvider>
    </QueryClientProvider>
  );
}