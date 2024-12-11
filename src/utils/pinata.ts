import axios from "axios";
import FormData from "form-data";

const key = process.env.NEXT_PUBLIC_PINATA_KEY;
const secret = process.env.NEXT_PUBLIC_PINATA_SECRET;

interface PinataResponse {
  success: boolean;
  pinataURL?: string;
  message?: string;
}

export const uploadJSONToIPFS = async (
  JSONBody: any
): Promise<PinataResponse> => {
  const url = `https://api.pinata.cloud/pinning/pinJSONToIPFS`;

  try {
    const response = await axios.post(url, JSONBody, {
      headers: {
        pinata_api_key: key,
        pinata_secret_api_key: secret,
      },
    });

    return {
      success: true,
      pinataURL: `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`,
    };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
};

export const uploadFileToIPFS = async (file: File): Promise<PinataResponse> => {
  const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;
  const data = new FormData();
  data.append("file", file);

  const metadata = JSON.stringify({
    name: "testname",
    keyvalues: {
      exampleKey: "exampleValue",
    },
  });
  data.append("pinataMetadata", metadata);

  const pinataOptions = JSON.stringify({
    cidVersion: 0,
    customPinPolicy: {
      regions: [
        { id: "FRA1", desiredReplicationCount: 1 },
        { id: "NYC1", desiredReplicationCount: 2 },
      ],
    },
  });
  data.append("pinataOptions", pinataOptions);

  try {
    const response = await axios.post(url, data, {
      maxBodyLength: Infinity,
      headers: {
        "Content-Type": `multipart/form-data; boundary=${
          (data as any)._boundary
        }`,
        pinata_api_key: key,
        pinata_secret_api_key: secret,
      },
    });

    console.log("image uploaded", response.data.IpfsHash);
    return {
      success: true,
      pinataURL: `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`,
    };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
};
