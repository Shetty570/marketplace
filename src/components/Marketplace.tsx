"use client";

import { useEffect, useState, useCallback } from "react";
import { ethers } from "ethers";
import Image from "next/image";
import { formatEther } from "ethers";
import Link from "next/link";

const factoryAddress = process.env.NEXT_PUBLIC_FACTORY_ADDRESS;
const marketplaceAddress = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS;

interface CollectionInfo {
  name: string;
  symbol: string;
  collectionAddress: string;
  owner: string;
  createdAt: number;
}

interface NFTInfo {
  tokenId: number;
  owner: string;
  tokenURI: string;
}

interface CollectionNFTs {
  nfts: NFTInfo[];
}

// Add new interface for listed NFTs
interface ListedNFT {
  nftContract: string;
  tokenId: number;
  price: bigint;
  seller: string;
}

interface MarketplaceProps {
  userAddress: string;
}

export default function Marketplace({ userAddress }: MarketplaceProps) {
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [collectionNFTs, setCollectionNFTs] = useState<{
    [collectionAddress: string]: CollectionNFTs;
  }>({});
  const [loading, setLoading] = useState(true);
  const [factoryABI, setFactoryABI] = useState<any>(null);
  const [collectionABI, setCollectionABI] = useState<any>(null);
  const [marketplaceABI, setMarketplaceABI] = useState<any>(null);
  const [listedNFTs, setListedNFTs] = useState<ListedNFT[]>([]);
  const [listingPrices, setListingPrices] = useState<{ [key: string]: number }>(
    {}
  );
  const [imageUrls, setImageUrls] = useState<{ [key: string]: string }>({});

  // Fetch ABIs
  const fetchABIs = useCallback(async () => {
    try {
      const [factoryResponse, collectionResponse, marketplaceResponse] =
        await Promise.all([
          fetch("/abi/NFTCollectionFactory.json"),
          fetch("/abi/NFTCollection.json"),
          fetch("/abi/NFTMarketplace.json"),
        ]);

      const [factoryAbi, collectionAbi, marketplaceAbi] = await Promise.all([
        factoryResponse.json(),
        collectionResponse.json(),
        marketplaceResponse.json(),
      ]);

      setFactoryABI(factoryAbi);
      setCollectionABI(collectionAbi);
      setMarketplaceABI(marketplaceAbi);
    } catch (error) {
      console.error("Error fetching ABIs:", error);
    }
  }, []);

  // Add function to fetch NFTs for a collection
  const fetchCollectionNFTs = useCallback(
    async (provider: ethers.Provider, collectionAddress: string) => {
      if (!collectionABI) return { nfts: [] };

      try {
        const collection = new ethers.Contract(
          collectionAddress,
          collectionABI,
          provider
        );

        // Get all NFTs from the collection
        const nfts = await collection.getAllNFTs();
        return { nfts };
      } catch (error) {
        console.error(
          `Error fetching NFTs for collection ${collectionAddress}:`,
          error
        );
        return { nfts: [] };
      }
    },
    [collectionABI]
  );

  // Update fetchCollections
  const fetchCollections = useCallback(async () => {
    if (!factoryABI) return;

    try {
      if (typeof window.ethereum === "undefined") {
        throw new Error("Please install MetaMask to use this feature");
      }

      await window.ethereum.request({ method: "eth_requestAccounts" });
      const provider = new ethers.BrowserProvider(window.ethereum);

      const factory = new ethers.Contract(
        factoryAddress!,
        factoryABI,
        provider
      );

      const allCollections = await factory.getAllCollections();
      setCollections(allCollections);

      // Fetch NFTs for each collection
      const nftsMap: { [key: string]: CollectionNFTs } = {};
      for (const collection of allCollections) {
        const collectionData = await fetchCollectionNFTs(
          provider,
          collection.collectionAddress
        );
        nftsMap[collection.collectionAddress] = collectionData;
      }
      setCollectionNFTs(nftsMap);
    } catch (error) {
      console.error("Error fetching collections:", error);
      setCollections([]);
    } finally {
      setLoading(false);
    }
  }, [factoryABI, fetchCollectionNFTs]);

  // Add function to fetch listed NFTs
  // Add function to fetch listed NFTs
  const fetchListedNFTs = useCallback(async () => {
    if (!marketplaceABI) return;

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const marketplace = new ethers.Contract(
        marketplaceAddress!,
        marketplaceABI,
        provider
      );

      const [nftContracts, tokenIds, prices, sellers] =
        await marketplace.getAllListedNFTs();

      // Create a Map to ensure uniqueness
      const uniqueListedNFTs = new Map<string, ListedNFT>();

      nftContracts.forEach((contract: string, index: number) => {
        const key = `${contract}-${tokenIds[index]}`;
        uniqueListedNFTs.set(key, {
          nftContract: contract,
          tokenId: Number(tokenIds[index]),
          price: prices[index],
          seller: sellers[index],
        });
      });

      // Convert the Map back to an array and set it to state
      setListedNFTs(Array.from(uniqueListedNFTs.values()));
    } catch (error) {
      console.error("Error fetching listed NFTs:", error);
    }
  }, [marketplaceABI]);

  // Add function to list NFT for sale
  const listNFTForSale = async (collectionAddress: string, tokenId: number) => {
    try {
      const priceInEth = listingPrices[tokenId];
      if (!priceInEth || priceInEth <= 0) {
        alert("Please enter a valid price");
        return;
      }

      console.log(`Listing NFT ${tokenId} for ${priceInEth} ETH`);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const priceInWei = ethers.parseEther(priceInEth.toString());

      console.log(`Price in Wei: ${priceInWei.toString()}`);

      // Approve marketplace
      const nftContract = new ethers.Contract(
        collectionAddress,
        ["function approve(address to, uint256 tokenId) public"],
        signer
      );

      console.log("Approving marketplace...");
      const approveTx = await nftContract.approve(marketplaceAddress, tokenId);
      await approveTx.wait();

      // List NFT
      const marketplace = new ethers.Contract(
        marketplaceAddress!,
        marketplaceABI,
        signer
      );

      console.log("Listing NFT with parameters:", {
        nftContract: collectionAddress,
        tokenId: tokenId,
        price: priceInWei.toString(),
      });

      const tx = await marketplace.listNFT(
        collectionAddress,
        tokenId,
        priceInWei
      );

      const receipt = await tx.wait();
      console.log("Listing transaction receipt:", receipt);

      if (receipt.status === 1) {
        alert("NFT successfully listed on the marketplace");
        await fetchListedNFTs(); // Refresh the display
      }
    } catch (error) {
      console.error("Error listing NFT:", error);
      alert("Error listing NFT: " + (error as Error).message);
    }
  };

  // Add buyNFT function
  const buyNFT = async (
    nftContract: string,
    tokenId: number,
    price: bigint
  ) => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const marketplace = new ethers.Contract(
        marketplaceAddress!,
        marketplaceABI,
        signer
      );

      console.log("Buying NFT with parameters:", {
        nftContract,
        tokenId,
        price: price.toString(),
      });

      const tx = await marketplace.buyNFT(nftContract, tokenId, {
        value: price,
      });

      const receipt = await tx.wait();
      console.log("Purchase transaction receipt:", receipt);

      if (receipt.status === 1) {
        alert("NFT successfully purchased!");
        await fetchListedNFTs(); // Refresh the listed NFTs
      }
    } catch (error) {
      console.error("Error buying NFT:", error);
      alert("Error buying NFT: " + (error as Error).message);
    }
  };

  useEffect(() => {
    fetchABIs();
  }, [fetchABIs]);

  useEffect(() => {
    if (factoryABI) {
      fetchCollections();
    }
  }, [fetchCollections, factoryABI]);

  useEffect(() => {
    if (marketplaceABI) {
      fetchListedNFTs();
    }
  }, [fetchListedNFTs, marketplaceABI]);

  useEffect(() => {
    const fetchAllImageUrls = async () => {
      const urls: { [key: string]: string } = {};
      for (const collection of collections) {
        for (const nft of collectionNFTs[collection.collectionAddress]?.nfts ||
          []) {
          if (nft.tokenURI && isValidUrl(nft.tokenURI)) {
            urls[nft.tokenId] = await fetchImageUrl(nft.tokenURI);
          }
        }
      }
      setImageUrls(urls);
    };

    fetchAllImageUrls();
  }, [collections, collectionNFTs]);

  // Function to fetch image URL from metadata if necessary
  async function fetchImageUrl(tokenURI: string): Promise<string> {
    try {
      const response = await fetch(tokenURI);
      const metadata = await response.json();
      return metadata.image; // Assuming the image URL is stored under the 'image' key
    } catch (error) {
      console.error("Error fetching image URL:", error);
      return tokenURI; // Fallback to the original URI if fetching fails
    }
  }

  if (loading) {
    return <div>Loading collections...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href="/"
        className="inline-flex items-center mb-6 text-blue-600 hover:text-blue-800 transition-colors"
      >
        <svg
          className="w-5 h-5 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 19l-7-7m0 0l7-7m-7 7h18"
          />
        </svg>
        Back to Home
      </Link>

      <h1 className="text-3xl font-bold mb-8">NFT Marketplace</h1>

      {/* NFTs for Sale Section */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6 border-b pb-2">NFTs for Sale</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {listedNFTs.length === 0 ? (
            <p className="text-gray-500 col-span-full">
              No NFTs currently listed for sale
            </p>
          ) : (
            listedNFTs.map((nft, index) => (
              <div
                key={index}
                className="bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="mb-3">
                  <p className="font-semibold">Token ID: {nft.tokenId}</p>
                  <p className="text-sm text-gray-600 truncate">
                    From: {nft.nftContract}
                  </p>
                  <p className="text-lg font-medium text-blue-600 my-2">
                    {formatEther(nft.price)} ETH
                  </p>
                  <p className="text-sm text-gray-500 truncate">
                    Seller: {nft.seller}
                  </p>
                </div>

                {nft.seller.toLowerCase() !==
                  window.ethereum?.selectedAddress?.toLowerCase() && (
                  <button
                    onClick={() =>
                      buyNFT(nft.nftContract, nft.tokenId, nft.price)
                    }
                    className="w-full bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600 transition-colors"
                  >
                    Buy Now
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* Collections Section */}
      <section>
        <h2 className="text-2xl font-bold mb-6 border-b pb-2">
          NFT Collections
        </h2>
        <div className="space-y-8">
          {collections.map((collection) => (
            <div
              key={collection.collectionAddress}
              className="bg-white border rounded-lg p-6 shadow-sm"
            >
              {/* Collection Header */}
              <div className="mb-6">
                <h3 className="text-xl font-bold">{collection.name}</h3>
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-gray-600">
                    Symbol: {collection.symbol}
                  </p>
                  <p className="text-sm text-gray-500 truncate">
                    Address: {collection.collectionAddress}
                  </p>
                </div>
              </div>

              {/* Collection NFTs */}
              <div className="mt-4">
                <h4 className="text-lg font-semibold mb-4">Collection NFTs</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {collectionNFTs[collection.collectionAddress]?.nfts.length ===
                  0 ? (
                    <p className="text-gray-500 col-span-full">
                      No NFTs in this collection
                    </p>
                  ) : (
                    collectionNFTs[collection.collectionAddress]?.nfts.map(
                      (nft) => (
                        <div
                          key={nft.tokenId.toString()}
                          className="border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          {/* Display NFT Image if tokenURI is a valid URL */}
                          {imageUrls[nft.tokenId] && (
                            <Image
                              src={imageUrls[nft.tokenId]}
                              alt={`NFT ${nft.tokenId}`}
                              width={200}
                              height={200}
                              className="mb-3 rounded"
                            />
                          )}
                          <p className="font-medium">
                            Token ID: {nft.tokenId.toString()}
                          </p>
                          <p className="text-sm text-gray-600 truncate">
                            Owner: {nft.owner}
                          </p>
                          <p className="text-xs text-gray-500 truncate mb-3">
                            URI: {nft.tokenURI}
                          </p>

                          {nft.owner.toLowerCase() ===
                            window.ethereum?.selectedAddress?.toLowerCase() && (
                            <div className="mt-3 space-y-2">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="Price in ETH"
                                className="w-full p-2 border rounded text-sm"
                                onChange={(e) =>
                                  setListingPrices({
                                    ...listingPrices,
                                    [nft.tokenId]: parseFloat(e.target.value),
                                  })
                                }
                                value={listingPrices[nft.tokenId] || ""}
                              />
                              <button
                                onClick={() =>
                                  listNFTForSale(
                                    collection.collectionAddress,
                                    nft.tokenId
                                  )
                                }
                                className="w-full bg-blue-500 text-white py-1.5 px-4 rounded text-sm hover:bg-blue-600 transition-colors"
                              >
                                List for Sale
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    )
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// Helper function to validate URLs
function isValidUrl(url: string) {
  try {
    new URL(url);
    return true;
  } catch (_) {
    return false;
  }
}
