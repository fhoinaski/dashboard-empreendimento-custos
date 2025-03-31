import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Configuração do cliente S3
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

export async function uploadFileToS3(file: { buffer: Buffer; originalname: string; mimetype: string }, bucketName: string, retries = 2): Promise<{ success: boolean; fileName?: string; url?: string; error?: string }> {
  try {
    const fileName = `${Date.now()}-${file.originalname}`; // Nome único com timestamp

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
      // Removido o uso de ACL, pois o bucket não suporta ACLs
    });

    await s3Client.send(command);

    // Gerar URL pública
    const publicUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

    return {
      success: true,
      fileName,
      url: publicUrl,
    };
  } catch (error) {
    console.error('Erro ao fazer upload para o S3:', error);
    if (retries > 0) return uploadFileToS3(file, bucketName, retries - 1);
    return { success: false, error: 'Falha ao fazer upload para o S3' };
  }
}