import AWS from 'aws-sdk';

interface TokenMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  creator?: {
    name: string;
    site: string;
  };
  attributes?: Array<{
    trait_type: string;
    value: string;
  }>;
  collection?: {
    name: string;
    size: number;
    number: number;
  };
}

interface FilebaseResponse {
  url: string;
  cid: string;
}

const s3 = new AWS.S3({
  endpoint: 'https://s3.filebase.com',
  region: 'us-east-1',
  signatureVersion: 'v4',
  accessKeyId: process.env.NEXT_PUBLIC_FILEBASE_API_KEY,
  secretAccessKey: process.env.NEXT_PUBLIC_FILEBASE_API_SECRET
});

export const uploadImageToFilebase = async (file: File): Promise<FilebaseResponse> => {
  const buffer = await file.arrayBuffer();
  const fileName = `${Date.now()}-${file.name}`;
  
  const params: AWS.S3.PutObjectRequest = {
    Bucket: process.env.NEXT_PUBLIC_FILEBASE_BUCKET || '',
    Key: fileName,
    Body: Buffer.from(buffer),
    ContentType: file.type,
    Metadata: {
      'x-amz-meta-collection': 'token-images'
    }
  };

  try {
    return new Promise((resolve, reject) => {
      const request = s3.putObject(params);
      request.on('httpHeaders', (statusCode, headers) => {
        if (statusCode === 200) {
          const cid = headers['x-amz-meta-cid'];
          resolve({ 
            url: `ipfs://${cid}`,
            cid 
          });
        }
      });
      request.send((err) => {
        if (err) reject(new Error('Error uploading image'));
      });
    });
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Error uploading image');
  }
};

export const uploadMetadataToFilebase = async (metadata: TokenMetadata): Promise<FilebaseResponse> => {
  const fileName = `${Date.now()}-metadata.json`;
  
  const params: AWS.S3.PutObjectRequest = {
    Bucket: process.env.NEXT_PUBLIC_FILEBASE_BUCKET || '',
    Key: fileName,
    Body: JSON.stringify(metadata),
    ContentType: 'application/json',
    Metadata: {
      'x-amz-meta-collection': 'token-metadata'
    }
  };

  try {
    return new Promise((resolve, reject) => {
      const request = s3.putObject(params);
      request.on('httpHeaders', (statusCode, headers) => {
        if (statusCode === 200) {
          const cid = headers['x-amz-meta-cid'];
          resolve({ 
            url: `ipfs://${cid}`,
            cid 
          });
        }
      });
      request.send((err) => {
        if (err) reject(new Error('Error uploading metadata'));
      });
    });
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Error uploading metadata');
  }
};

export const getFilebaseUrl = (cid: string): string => {
  return `https://assistant-scarlet-goose.myfilebase.com/ipfs/${cid}`;
};
