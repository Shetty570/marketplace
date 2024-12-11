"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { uploadJSONToIPFS, uploadFileToIPFS } from "../utils/pinata";
import Image from "next/image";

interface MintFormProps {
  signer: any;
  userAddress: string;
}

const factoryAddress = process.env.NEXT_PUBLIC_FACTORY_ADDRESS;

if (!factoryAddress) {
  throw new Error("Factory address is not defined");
}

interface CollectionInfo {
  name: string;
  symbol: string;
  collectionAddress: string;
  owner: string;
  createdAt: number;
}

export default function MintForm({ signer, userAddress }: MintFormProps) {
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [selectedCollection, setSelectedCollection] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const factoryContract = new ethers.Contract(
        factoryAddress!,
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

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCollection || !name || !description || !image) {
      alert("Please fill in all fields");
      return;
    }

    setIsLoading(true);
    try {
      const imageUploadResponse = await uploadFileToIPFS(image);
      if (!imageUploadResponse.success) {
        throw new Error(
          "Error uploading image to IPFS: " + imageUploadResponse.message
        );
      }

      const metadata = {
        name,
        description,
        image: imageUploadResponse.pinataURL,
      };

      const metadataUploadResponse = await uploadJSONToIPFS(metadata);
      if (!metadataUploadResponse.success) {
        throw new Error(
          "Error uploading metadata to IPFS: " + metadataUploadResponse.message
        );
      }

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

      // Reset form
      setName("");
      setDescription("");
      setImage(null);
      setPreviewUrl("");
      setSelectedCollection("");
    } catch (error) {
      console.error("Error minting NFT:", error);
      alert(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden md:max-w-2xl m-4">
      <div className="p-8">
        <div className="uppercase tracking-wide text-sm text-indigo-500 font-semibold mb-4">
          Mint New NFT
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Collection
            </label>
            <select
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              required
            >
              <option value="">Select Collection</option>
              {collections.map((c) => (
                <option key={c.collectionAddress} value={c.collectionAddress}>
                  {c.name} ({c.symbol})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              NFT Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Image
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="mt-1 block w-full"
              required
            />
            {previewUrl && (
              <Image
                src={previewUrl}
                alt="Preview"
                width={500}
                height={500}
                className="mt-2 h-32 w-32 object-cover rounded-lg"
              />
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
          >
            {isLoading ? "Minting..." : "Mint NFT"}
          </button>
        </form>
      </div>
    </div>
  );
}
