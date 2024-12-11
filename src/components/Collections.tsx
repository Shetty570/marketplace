"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";

export default function Collections({ userAddress }) {
  const [collections, setCollections] = useState([]);

  useEffect(() => {
    const fetchCollections = async () => {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const factoryAbi = await fetch("/abi/NFTCollectionFactory.json").then(
        (res) => res.json()
      );
      const factoryContract = new ethers.Contract(
        "0x2203994926b94DD7a1C16092566ebCbae6972372", // Replace with your contract address
        factoryAbi,
        signer
      );

      const result = await factoryContract.getCollectionsByOwner(userAddress);
      setCollections(result);
    };

    fetchCollections();
  }, [userAddress]);

  return (
    <div className="my-4 p-4 border rounded">
      <h2>Your Collections</h2>
      {collections.map((collection) => (
        <div key={collection.collectionAddress}>
          <p>Name: {collection.name}</p>
          <p>Address: {collection.collectionAddress}</p>
        </div>
      ))}
    </div>
  );
}
