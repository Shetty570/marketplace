"use client";

import { useState } from "react";
import { ethers } from "ethers";

const factoryAddress = process.env.NEXT_PUBLIC_FACTORY_ADDRESS;

export default function CreateCollection() {
  const [collectionName, setCollectionName] = useState("");
  const [collectionSymbol, setCollectionSymbol] = useState("");

  const handleCreateCollection = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const factoryAbi = await fetch("/abi/NFTCollectionFactory.json").then(
        (res) => res.json()
      );
      const factoryContract = new ethers.Contract(
        factoryAddress,
        factoryAbi,
        signer
      );

      const tx = await factoryContract.createCollection(
        collectionName,
        collectionSymbol
      );
      await tx.wait();

      alert("Collection created successfully!");
    } catch (err) {
      console.error("Error creating collection:", err);
    }
  };

  return (
    <div className="my-4 p-4 border rounded">
      <h2>Create NFT Collection</h2>
      <input
        type="text"
        placeholder="Collection Name"
        value={collectionName}
        onChange={(e) => setCollectionName(e.target.value)}
        className="block mb-2 px-2 py-1 border rounded"
      />
      <input
        type="text"
        placeholder="Collection Symbol"
        value={collectionSymbol}
        onChange={(e) => setCollectionSymbol(e.target.value)}
        className="block mb-2 px-2 py-1 border rounded"
      />
      <button
        className="px-4 py-2 bg-green-500 text-white rounded"
        onClick={handleCreateCollection}
      >
        Create Collection
      </button>
    </div>
  );
}
