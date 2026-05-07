/**
 * MinIO Testcontainers helpers — start container, create bucket, set policy.
 *
 * @module
 */

import { MinioContainer, type StartedMinioContainer } from '@testcontainers/minio';
import { AwsClient } from 'aws4fetch';

export interface MinioFixture {
  container: StartedMinioContainer;
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  publicBaseUrl: string;
}

export async function startMinio(bucket: string): Promise<MinioFixture> {
  const accessKey = 'minioadmin';
  const secretKey = 'minioadmin';

  const container = await new MinioContainer()
    .withUsername(accessKey)
    .withPassword(secretKey)
    .start();

  const endpoint = container.getConnectionUrl();
  const publicBaseUrl = `${endpoint}/${bucket}`;

  const aws = new AwsClient({
    accessKeyId: accessKey,
    secretAccessKey: secretKey,
    service: 's3',
    region: 'us-east-1',
  });

  // Create bucket via S3 PUT.
  const createRes = await aws.fetch(`${endpoint}/${bucket}`, { method: 'PUT' });
  if (!createRes.ok && createRes.status !== 409) {
    throw new Error(`Failed to create MinIO bucket: ${createRes.status} ${await createRes.text()}`);
  }

  // Set bucket policy to public-read so public-url-roundtrip can fetch.
  const policy = JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'PublicRead',
        Effect: 'Allow',
        Principal: '*',
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${bucket}/*`],
      },
    ],
  });
  const policyRes = await aws.fetch(`${endpoint}/${bucket}?policy`, {
    method: 'PUT',
    body: policy,
    headers: { 'Content-Type': 'application/json' },
  });
  if (!policyRes.ok) {
    throw new Error(
      `Failed to set MinIO bucket policy: ${policyRes.status} ${await policyRes.text()}`,
    );
  }

  return { container, endpoint, accessKey, secretKey, bucket, publicBaseUrl };
}
