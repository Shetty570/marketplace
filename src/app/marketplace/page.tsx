"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import Marketplace from "../../components/Marketplace";
import WalletConnection from "../../components/WalletConnection";

export default function MarketplacePage() {
  const [userAddress, setUserAddress] = useState<string>("");
  const [signer, setSigner] = useState<any>(null);

  useEffect(() => {
    const connectWallet = async () => {
      if (typeof window.ethereum !== "undefined") {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        setUserAddress(accounts[0]);
        setSigner(provider.getSigner());
      }
    };

    connectWallet();
  }, []);

  const handleAccountsChanged = async (accounts: string[]) => {
    if (accounts.length > 0) {
      setUserAddress(accounts[0]);
      const provider = new ethers.BrowserProvider(window.ethereum);
      setSigner(provider.getSigner());
    } else {
      setUserAddress("");
      setSigner(null);
    }
  };

  return (
    <main className="max-w-7xl mx-auto p-4">
      <WalletConnection
        walletConnected={signer !== null}
        userAddress={userAddress}
        onConnect={handleAccountsChanged}
      />
      {signer !== null && <Marketplace userAddress={userAddress} />}
    </main>
  );
}
