"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";
import Image from "next/image";

const factoryAddress = process.env.NEXT_PUBLIC_FACTORY_ADDRESS; // Use environment variable
const marketplaceAddress = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS; // Use environment variable

// Define the fetchCollections function
async function fetchCollections() {
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
    if (!factoryContract) {
      throw new Error("Factory contract is not initialized");
    }
    const collections = await factoryContract.getAllCollections();
    return collections;
  } catch (error) {
    console.error("Error fetching collections:", error);
    throw error; // Rethrow the error for handling in the calling function
  }
}

export default function Marketplace({ userAddress }) {
  const [marketplaceNFTs, setMarketplaceNFTs] = useState([]);
  const [userNFTs, setUserNFTs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listingPrices, setListingPrices] = useState({});

  const fetchMarketplaceNFTs = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const marketplaceAbi = await fetch("/abi/NFTMarketplace.json").then(
        (res) => res.json()
      );
      const marketplaceContract = new ethers.Contract(
        marketplaceAddress,
        marketplaceAbi,
        signer
      );

      const collections = await fetchCollections();
      const plainCollections = collections.map((collection) => ({
        name: collection.name,
        symbol: collection.symbol,
        collectionAddress: collection.collectionAddress,
        owner: collection.owner,
        createdAt: collection.createdAt,
      }));

      console.log("Plain collections:", plainCollections);

      // Fetch NFTs for each collection
      const allMarketplaceNFTs = await Promise.all(
        plainCollections.map(async (collection) => {
          const nftAbi = await fetch("/abi/NFTCollection.json").then((res) =>
            res.json()
          );
          const nftContract = new ethers.Contract(
            collection.collectionAddress,
            nftAbi,
            signer
          );

          const mintedNFTs = await nftContract.getAllNFTs();
          const processedNFTs = await Promise.all(
            mintedNFTs.map(async (nft) => {
              const currentOwner = await nftContract.ownerOf(nft.tokenId);
              const isListed =
                currentOwner.toLowerCase() === marketplaceAddress.toLowerCase();

              let price = BigInt(0);
              let seller = ethers.ZeroAddress;

              if (isListed) {
                const filter = marketplaceContract.filters.NFTListed(
                  collection.collectionAddress,
                  nft.tokenId
                );
                const events = await marketplaceContract.queryFilter(filter);
                if (events.length > 0) {
                  const latestListing = events[events.length - 1];
                  price = latestListing.args?.price || BigInt(0);
                  seller = latestListing.args?.seller || ethers.ZeroAddress;
                }
              }

              return {
                tokenId: nft.tokenId,
                owner: currentOwner,
                price,
                isListed,
                seller,
              };
            })
          );

          return { ...collection, nfts: processedNFTs };
        })
      );

      console.log("All marketplace NFTs with collections:", allMarketplaceNFTs);
      setMarketplaceNFTs(allMarketplaceNFTs);
    } catch (error) {
      console.error("Error fetching marketplace NFTs:", error);
    }
  };

  const fetchUserNFTs = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const collections = await fetchCollections();
      const plainCollections = collections.map((proxyResult) =>
        proxyResult.toObject()
      );
      console.log("Converted collections:", plainCollections);

      const nftAbi = await fetch("/abi/NFTCollection.json").then((res) =>
        res.json()
      );
      const marketplaceAbi = await fetch("/abi/NFTMarketplace.json").then(
        (res) => res.json()
      );

      const marketplaceContract = new ethers.Contract(
        marketplaceAddress,
        marketplaceAbi,
        signer
      );

      const processedCollections = await Promise.all(
        collections.map(async (collection) => {
          const collectionAddress = collection[2];
          const collectionName = collection[0];

          const nftContract = new ethers.Contract(
            collectionAddress,
            nftAbi,
            signer
          );

          const mintedNFTs = await nftContract.getAllNFTs();

          const processedNFTs = await Promise.all(
            mintedNFTs.map(async (nft) => {
              const metadata = await fetchNFTMetadata(
                collectionAddress,
                nft.tokenId
              );
              const isListed = nft.owner === marketplaceAddress;
              let price = BigInt(0);
              let seller = ethers.ZeroAddress;

              if (isListed) {
                try {
                  const filter = marketplaceContract.filters.NFTListed(
                    collectionAddress,
                    nft.tokenId
                  );
                  const events = await marketplaceContract.queryFilter(filter);
                  if (events.length > 0) {
                    const latestListing = events[
                      events.length - 1
                    ] as ethers.EventLog;
                    price = latestListing.args?.[2] || BigInt(0);
                    seller = latestListing.args?.[3] || ethers.ZeroAddress;
                  }
                } catch (err) {
                  console.error("Error fetching listing details:", err);
                }
              }

              return {
                tokenId: nft.tokenId,
                owner: nft.owner,
                tokenURI: nft.tokenURI,
                metadata,
                isListed,
                price,
                seller,
              };
            })
          );

          return {
            name: collectionName,
            address: collectionAddress,
            nfts: processedNFTs,
          };
        })
      );

      setUserNFTs(processedCollections);
    } catch (err) {
      console.error("Error in fetchUserNFTs:", err);
      setError("Failed to fetch NFTs");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchNFTMetadata = async (nftContractAddress, tokenId) => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const nftContract = new ethers.Contract(
        nftContractAddress,
        [
          "function tokenURI(uint256) view returns (string)",
          "function ownerOf(uint256) view returns (address)",
        ],
        provider
      );

      let tokenURI = await nftContract.tokenURI(tokenId);

      // If tokenURI is already a JSON string
      if (tokenURI.startsWith("{")) {
        return JSON.parse(tokenURI);
      }

      // Handle IPFS URLs
      if (tokenURI.startsWith("ipfs://")) {
        tokenURI = `https://ipfs.io/ipfs/${tokenURI.slice(7)}`;
      }

      const response = await fetch(tokenURI);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const metadata = await response.json();

      // Handle IPFS image URLs
      if (metadata.image?.startsWith("ipfs://")) {
        metadata.image = `https://ipfs.io/ipfs/${metadata.image.slice(7)}`;
      }

      return metadata;
    } catch (err) {
      console.error("Error in fetchNFTMetadata:", err);
      return null;
    }
  };

  const handlePriceChange = (tokenId, value) => {
    setListingPrices((prev) => ({
      ...prev,
      [tokenId]: value > 0 ? value : 0,
    }));
  };

  const listNFT = async (nftContractAddress, tokenId) => {
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
        nftContractAddress,
        ["function approve(address to, uint256 tokenId) public"],
        signer
      );

      console.log("Approving marketplace...");
      const approveTx = await nftContract.approve(marketplaceAddress, tokenId);
      await approveTx.wait();

      // List NFT
      const marketplaceAbi = await fetch("/abi/NFTMarketplace.json").then(
        (res) => res.json()
      );

      const marketplaceContract = new ethers.Contract(
        marketplaceAddress,
        marketplaceAbi,
        signer
      );

      console.log("Listing NFT with parameters:", {
        nftContract: nftContractAddress,
        tokenId: tokenId,
        price: priceInWei.toString(),
      });

      const tx = await marketplaceContract.listNFT(
        nftContractAddress,
        tokenId,
        priceInWei
      );

      const receipt = await tx.wait();
      console.log("Listing transaction receipt:", receipt);

      if (receipt.status === 1) {
        alert("NFT successfully listed on the marketplace");
        await fetchMarketplaceNFTs(); // Refresh the display
      }
    } catch (error) {
      console.error("Error listing NFT:", error);
      alert("Error listing NFT: " + error.message);
    }
  };

  //   const buyNFT = async (nftContractAddress, tokenId, price) => {
  //     try {
  //       console.log(
  //         `Attempting to buy NFT ${tokenId} with price: ${ethers.formatEther(
  //           price.toString()
  //         )} ETH`
  //       );

  //       if (!price || price <= BigInt(0)) {
  //         console.error("Invalid price detected:", price);
  //         alert("Invalid price");
  //         return;
  //       }

  //       const provider = new ethers.BrowserProvider(window.ethereum);
  //       const signer = await provider.getSigner();

  //       const marketplaceAbi = await fetch("/abi/NFTMarketplace.json").then(
  //         (res) => res.json()
  //       );

  //       const marketplaceContract = new ethers.Contract(
  //         marketplaceAddress,
  //         marketplaceAbi,
  //         signer
  //       );

  //       console.log("Buying NFT with parameters:", {
  //         nftContract: nftContractAddress,
  //         tokenId: tokenId,
  //         value: price.toString(),
  //       });

  //       const tx = await marketplaceContract.buyNFT(nftContractAddress, tokenId, {
  //         value: price,
  //         gasLimit: 300000,
  //       });

  //       const receipt = await tx.wait();
  //       if (receipt.status === 1) {
  //         alert("NFT purchased successfully!");
  //         await fetchMarketplaceNFTs();
  //       }
  //     } catch (error) {
  //       console.error("Error buying NFT:", error);
  //       alert("Error buying NFT: " + error.message);
  //     }
  //   };

  const buyNFT = async (nftContractAddress, tokenId, price) => {
    try {
      console.log(`Starting buy process for NFT:`, {
        contractAddress: nftContractAddress,
        tokenId: tokenId,
        price: ethers.parseEther(price.toString()),
        // price: ethers.formatEther(price.toString()),
      });

      if (!price || price <= BigInt(0)) {
        console.error("Invalid price detected:", price);
        alert("Invalid price");
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // Get user's balance
      const balance = await provider.getBalance(await signer.getAddress());
      console.log(`User balance: ${ethers.formatEther(balance)} ETH`);

      if (balance < price) {
        alert("Insufficient funds to complete this purchase!");
        return;
      }

      const marketplaceAbi = await fetch("/abi/NFTMarketplace.json").then(
        (res) => res.json()
      );

      const marketplaceContract = new ethers.Contract(
        marketplaceAddress,
        marketplaceAbi,
        signer
      );

      console.log("Executing buyNFT with parameters:", {
        nftContract: nftContractAddress,
        tokenId: tokenId,
        value: price.toString(),
      });

      const tx = await marketplaceContract.buyNFT(nftContractAddress, tokenId, {
        value: price,
        gasLimit: 300000,
      });

      console.log("Buy transaction submitted:", tx.hash);
      const receipt = await tx.wait();
      console.log("Transaction receipt:", receipt);

      if (receipt.status === 1) {
        alert("NFT purchased successfully!");
        await fetchMarketplaceNFTs();
      } else {
        throw new Error("Transaction failed");
      }
    } catch (error) {
      console.error("Error buying NFT:", error);
      alert("Error buying NFT: " + error.message);
    }
  };
  useEffect(() => {
    fetchMarketplaceNFTs();
    fetchUserNFTs(); // Fetch user NFTs when the component mounts
  }, [userAddress]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center text-red-500 p-4">
        <p>{error}</p>
        <button
          onClick={fetchUserNFTs}
          className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Empty state
  if (!userNFTs.length) {
    return (
      <div className="text-center p-4">
        <p>No NFTs found in any collection.</p>
      </div>
    );
  }

  // Render NFTs
  return (
    <div className="my-4 p-4">
      <h2 className="text-2xl font-bold mb-4">NFT Collections</h2>
      {userNFTs.map((collection, collectionIndex) => (
        <div key={collectionIndex} className="mb-8 border-b pb-4">
          <h3 className="text-xl font-semibold mb-2">
            {collection.name}
            <span className="text-sm text-gray-500 ml-2">
              ({collection.address})
            </span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {collection.nfts.map((nft, nftIndex) => (
              <div key={nftIndex} className="border p-4 rounded-lg shadow">
                <p className="font-medium">
                  Token ID: {nft.tokenId.toString()}
                </p>
                <p className="text-sm text-gray-600">
                  Owner: {shortenAddress(nft.owner)}
                </p>

                {nft.metadata?.image && (
                  <div className="my-2">
                    <Image
                      src={nft.metadata.image}
                      alt={nft.metadata.name || "NFT"}
                      width={300}
                      height={300}
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  </div>
                )}

                {/* Show listing UI if user is the owner and NFT is not listed */}
                {nft.owner.toLowerCase() === userAddress?.toLowerCase() &&
                  !nft.isListed && (
                    <div className="mt-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          placeholder="Price in ETH"
                          className="border rounded px-2 py-1 w-full"
                          onChange={(e) =>
                            handlePriceChange(
                              nft.tokenId,
                              parseFloat(e.target.value)
                            )
                          }
                        />
                        <button
                          onClick={() =>
                            listNFT(collection.address, nft.tokenId)
                          }
                          className={`px-4 py-1 rounded ${
                            listingPrices[nft.tokenId] > 0
                              ? "bg-blue-500 text-white hover:bg-blue-600"
                              : "bg-gray-300 text-gray-500 cursor-not-allowed"
                          }`}
                          disabled={
                            !listingPrices[nft.tokenId] ||
                            listingPrices[nft.tokenId] <= 0
                          }
                        >
                          List
                        </button>
                      </div>
                    </div>
                  )}

                {/* Show price and buy button if NFT is listed */}
                {nft.isListed && (
                  <div className="mt-4">
                    <p className="text-lg font-semibold">
                      Price: {ethers.formatEther(nft.price.toString())} ETH
                    </p>
                    <button
                      onClick={() => {
                        console.log("Buy button clicked for NFT:", {
                          tokenId: nft.tokenId,
                          collectionAddress: nft.collectionAddress,
                          listedPrice:
                            ethers.formatEther(nft.price.toString()) + " ETH",
                          rawListedPrice: nft.price.toString(),
                          seller: nft.seller,
                        });

                        console.log("Attempting purchase with:", {
                          purchasePrice:
                            ethers.formatEther(nft.price.toString()) + " ETH",
                          rawPurchasePrice: nft.price.toString(),
                          inWei: nft.price,
                        });

                        buyNFT(nft.collectionAddress, nft.tokenId, nft.price);
                      }}
                      className="bg-green-500 text-white px-4 py-2 rounded mt-2 w-full hover:bg-green-600"
                      disabled={
                        nft.seller.toLowerCase() === userAddress?.toLowerCase()
                      }
                    >
                      Buy NFT
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div>
            {marketplaceNFTs.map((collection, index) => (
              <div key={index} className="collection">
                <h3>
                  {collection.name} ({collection.symbol})
                </h3>
                <p>Address: {collection.collectionAddress}</p>
                <p>Owner: {collection.owner}</p>

                {collection.nfts && collection.nfts.length > 0 ? (
                  <div className="nfts">
                    {collection.nfts.map((nft) => (
                      <div key={nft.tokenId} className="nft">
                        <p>Token ID: {nft.tokenId}</p>
                        <p>Owner: {nft.owner}</p>
                        {nft.isListed && (
                          <>
                            <p>
                              Price: {ethers.formatEther(nft.price.toString())}{" "}
                              ETH
                            </p>
                            <button
                              onClick={() =>
                                buyNFT(
                                  collection.collectionAddress,
                                  nft.tokenId,
                                  nft.price
                                )
                              }
                            >
                              Buy Now
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>No NFTs found in this collection.</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Helper function to shorten addresses
const shortenAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};
