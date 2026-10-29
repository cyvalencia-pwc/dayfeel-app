import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectVersionsCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AppError } from '../../utils/errors';
export interface ObjectStorage {
  download(key: string): Promise<string>;
  putJson(key: string, value: unknown): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
  head(key: string): Promise<{ contentType?: string; size?: number }>;
}
export class S3Storage implements ObjectStorage {
  constructor(
    private client: S3Client,
    private bucket: string,
  ) {}
  download(key: string) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: 900 },
    );
  }
  async head(key: string) {
    const r = await this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    return { contentType: r.ContentType, size: r.ContentLength };
  }
  async putJson(key: string, value: unknown) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: 'application/json',
        Body: JSON.stringify(value),
        ServerSideEncryption: 'AES256',
      }),
    );
  }
  async deletePrefix(prefix: string) {
    let keyMarker: string | undefined, versionMarker: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectVersionsCommand({
          Bucket: this.bucket,
          Prefix: prefix,
          KeyMarker: keyMarker,
          VersionIdMarker: versionMarker,
        }),
      );
      const objects = [
        ...(page.Versions ?? []),
        ...(page.DeleteMarkers ?? []),
      ].map((o) => ({ Key: o.Key!, VersionId: o.VersionId }));
      for (let offset = 0; offset < objects.length; offset += 1000) {
        const result = await this.client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: objects.slice(offset, offset + 1000) },
          }),
        );
        if (result.Errors?.length) throw new Error('Storage cleanup failed');
      }
      keyMarker = page.IsTruncated ? page.NextKeyMarker : undefined;
      versionMarker = page.IsTruncated ? page.NextVersionIdMarker : undefined;
      if (page.IsTruncated && !keyMarker)
        throw new Error('Storage cleanup pagination failed');
    } while (keyMarker);
  }
}
export class UnavailableStorage implements ObjectStorage {
  private fail(): never {
    throw new AppError(
      503,
      'STORAGE_UNAVAILABLE',
      'Configure S3 storage for this operation',
    );
  }
  async download(): Promise<string> {
    return this.fail();
  }
  async head(): Promise<{ contentType?: string; size?: number }> {
    return this.fail();
  }
  async putJson(): Promise<void> {
    return this.fail();
  }
  async deletePrefix(): Promise<void> {
    return this.fail();
  }
}
