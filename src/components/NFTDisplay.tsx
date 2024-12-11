"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";

const factoryAddress = process.env.NEXT_PUBLIC_FACTORY_ADDRESS; // Use environment variable

export default function NFTDisplay({ userAddress }) {
  const [userNFTs, setUserNFTs] = useState([]);

  const fetchUserNFTs = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const factoryAbi = await fetch("/abi/NFTCollectionFactory.json").then(
        (res) => res.json()
      );
      const factoryContract = new ethers.Contract(
        factoryAddress, // Use the variable here
        factoryAbi,
        signer
      );

      const collections = await factoryContract.getCollectionsByOwner(
        userAddress
      );
      const nftAbi = await fetch("/abi/NFTCollection.json").then((res) =>
        res.json()
      );

      const allNFTs = [];

      for (const collection of collections) {
        const nftContract = new ethers.Contract(
          collection.collectionAddress,
          nftAbi,
          signer
        );
        const mintedNFTs = await nftContract.getAllNFTs();

        const ownedNFTs = mintedNFTs.filter(
          (nft) => nft.owner.toLowerCase() === userAddress.toLowerCase()
        );

        allNFTs.push(...ownedNFTs);
      }

      setUserNFTs(allNFTs);
    } catch (err) {
      console.error("Error fetching user NFTs:", err);
    }
  };

  useEffect(() => {
    fetchUserNFTs();
  }, [userAddress]);

  return (
    <div className="my-4 p-4 border rounded">
      <h2>Your NFTs</h2>
      {userNFTs.length > 0 ? (
        userNFTs.map((nft, index) => (
          <div key={index} className="border p-2 mb-2 rounded">
            <p>Token ID: {nft.tokenId}</p>
            <p>Name: {nft.metadata?.name || "Unnamed"}</p>
            {nft.metadata?.image && (
              <img
                src={nft.metadata.image}
                alt={nft.metadata.name || "NFT Image"}
                className="max-w-xs"
              />
            )}
          </div>
        ))
      ) : (
        <p>No NFTs owned by you.</p>
      )}
    </div>
  );
}
