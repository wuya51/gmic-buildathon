// utils.js
export const formatAccountOwner = (address) => {
  if (!address) return '';
  const cleanAddress = address.trim();
  if (cleanAddress.startsWith('0x')) {
    return cleanAddress.toLowerCase();
  }
  return `0x${cleanAddress.toLowerCase()}`;
};

export const formatAddressForDisplay = (address, isMobile = false, startChars = 6, endChars = 4) => {
  if (!address) return '';
  const isMobileView = isMobile || window.innerWidth <= 768;
  return isMobileView
    ? `${address.slice(0, startChars)}...${address.slice(-endChars)}`
    : address;
};

export const uploadToPinata = async (file, filename) => {
  if (!file) return { success: false, error: 'No file provided' };
  
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    if (filename) {
      formData.append('filename', filename);
    }
    
    const apiKey = import.meta.env.VITE_PINATA_API_KEY;
    const secretApiKey = import.meta.env.VITE_PINATA_SECRET_API_KEY;
    
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'pinata_api_key': apiKey,
        'pinata_secret_api_key': secretApiKey,
      },
      body: formData,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pinata upload failed: ${response.statusText} - ${errorText}`);
    }
    
    const result = await response.json();
    
    if (result.IpfsHash) {
      const ipfsUrl = `https://salmon-main-vole-335.mypinata.cloud/ipfs/${result.IpfsHash}`;
      return { success: true, url: ipfsUrl };
    } else {
      throw new Error('No IPFS hash returned from Pinata');
    }
  } catch (error) {
    console.error('Upload to Pinata error:', error);
    return { success: false, error: error.message };
  }
};

export const MAX_MESSAGE_LENGTH = 280;
export const WARNING_THRESHOLD = 250;