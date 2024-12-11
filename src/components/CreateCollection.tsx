"use client";

import { useState } from "react";
import { ethers } from "ethers";

const factoryAddress = process.env.NEXT_PUBLIC_FACTORY_ADDRESS;

export default function CreateCollection() {
  const [collectionName, setCollectionName] = useState("");
  const [collectionSymbol, setCollectionSymbol] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateCollection = async () => {
    if (!collectionName || !collectionSymbol) {
      alert("Please fill in all fields");
      return;
    }

    setIsLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const factoryAbi = await fetch("/abi/NFTCollectionFactory.json").then(
        (res) => res.json()
      );
      const factoryContract = new ethers.Contract(
        factoryAddress!,
        factoryAbi,
        signer
      );

      const tx = await factoryContract.createCollection(
        collectionName,
        collectionSymbol
      );
      await tx.wait();
      alert("Collection created successfully!");
      setCollectionName("");
      setCollectionSymbol("");
    } catch (err) {
      console.error("Error creating collection:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden md:max-w-2xl m-4">
      <div className="p-8">
        <div className="uppercase tracking-wide text-sm text-indigo-500 font-semibold mb-1">
          Create New Collection
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Collection Name
            </label>
            <input
              type="text"
              placeholder="e.g., Bored Ape Yacht Club"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Collection Symbol
            </label>
            <input
              type="text"
              placeholder="e.g., BAYC"
              value={collectionSymbol}
              onChange={(e) => setCollectionSymbol(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <button
            onClick={handleCreateCollection}
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
          >
            {isLoading ? "Creating..." : "Create Collection"}
          </button>
        </div>
      </div>
    </div>
  );
}
