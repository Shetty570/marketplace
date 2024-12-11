"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { uploadJSONToIPFS, uploadFileToIPFS } from "../utils/pinata";

interface MintFormProps {
  signer: any;
  userAddress: string;
}

const factoryAddress = process.env.NEXT_PUBLIC_FACTORY_ADDRESS;

export default function MintForm({ signer, userAddress }: MintFormProps) {
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState(null);

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const factoryContract = new ethers.Contract(
        factoryAddress,
        [
          "function getCollectionsByOwner(address owner) view returns (tuple(string name, string symbol, address collectionAddress, address owner, uint256 createdAt)[])",
        ],
        signer
      );

      const collections = await factoryContract.getCollectionsByOwner(
        signer.address
      );
      setCollections(collections);
    } catch (error) {
      console.error("Error fetching collections:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!selectedCollection || !name || !description || !image) {
        alert("Please fill in all fields");
        return;
      }

      // Upload image to IPFS
      const imageUploadResponse = await uploadFileToIPFS(image);
      if (!imageUploadResponse.success) {
        alert("Error uploading image to IPFS: " + imageUploadResponse.message);
        return;
      }

      // Prepare metadata for IPFS
      const metadata = {
        name,
        description,
        image: imageUploadResponse.pinataURL,
      };

      // Upload metadata to IPFS
      const metadataUploadResponse = await uploadJSONToIPFS(metadata);
      if (!metadataUploadResponse.success) {
        alert(
          "Error uploading metadata to IPFS: " + metadataUploadResponse.message
        );
        return;
      }

      // Mint the NFT
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const nftContract = new ethers.Contract(
        selectedCollection,
        [
          "function mint(address to, string memory ipfsHash) public returns (uint256)",
        ],
        signer
      );

      const tx = await nftContract.mint(
        signer.address,
        metadataUploadResponse.pinataURL
      );
      await tx.wait();
      alert("NFT minted successfully!");
    } catch (error) {
      console.error("Error minting NFT:", error);
      alert("Error minting NFT: " + error.message);
    }
  };

  return (
    <div className="mint-form-container">
      <h2>Mint New NFT</h2>
      <form onSubmit={handleSubmit} className="mint-form">
        <select
          value={selectedCollection}
          onChange={(e) => setSelectedCollection(e.target.value)}
          required
        >
          <option value="">Select Collection</option>
          {collections.map((c) => (
            <option key={c.collectionAddress} value={c.collectionAddress}>
              {c.name} ({c.symbol})
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="NFT Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="NFT Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImage(e.target.files[0])}
          required
        />
        <button type="submit">Mint NFT</button>
      </form>
    </div>
  );
}
