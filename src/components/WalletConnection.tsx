"use client";

import { useState } from "react";

export default function WalletConnection({
  walletConnected,
  userAddress,
  onConnect,
}) {
  const handleConnectWallet = async () => {
    if (typeof window.ethereum !== "undefined") {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      onConnect(accounts);
    } else {
      alert("MetaMask is not installed!");
    }
  };

  return (
    <div>
      <button
        className="px-4 py-2 bg-blue-500 text-white rounded"
        onClick={handleConnectWallet}
      >
        {walletConnected ? "Wallet Connected" : "Connect Wallet"}
      </button>
      {walletConnected && <p>Connected: {userAddress}</p>}
    </div>
  );
}
