"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import WalletConnection from "../components/WalletConnection";
import CreateCollection from "../components/CreateCollection";
import MintForm from "../components/MintForm";
import Collections from "../components/Collections";
import Marketplace from "../components/Marketplace";
import NFTDisplay from "../components/NFTDisplay";

export default function Home() {
  const [signer, setSigner] = useState<any>(null);
  const [userAddress, setUserAddress] = useState<string>("");

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
    <main className="max-w-4xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">NFT Marketplace Interface</h1>
      <WalletConnection
        walletConnected={signer !== null}
        userAddress={userAddress}
        onConnect={handleAccountsChanged}
      />
      {signer !== null && (
        <>
          <CreateCollection />
          <MintForm signer={signer} userAddress={userAddress} />
          <Collections userAddress={userAddress} />
          <Marketplace userAddress={userAddress} />
          {/* <NFTDisplay userAddress={userAddress} /> */}
        </>
      )}
    </main>
  );
}
