import {
  S3Client,
  ListObjectVersionsCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { S3Storage } from '../src/modules/files/storage';

test('prefix deletion removes versions and delete markers across pages', async () => {
  const send = jest
    .fn()
    .mockResolvedValueOnce({
      Versions: [{ Key: 'users/u/a', VersionId: 'old' }],
      DeleteMarkers: [{ Key: 'users/u/a', VersionId: 'marker' }],
      IsTruncated: true,
      NextKeyMarker: 'users/u/a',
      NextVersionIdMarker: 'marker',
    })
    .mockResolvedValueOnce({})
    .mockResolvedValueOnce({
      Versions: [{ Key: 'users/u/b', VersionId: 'null' }],
    })
    .mockResolvedValueOnce({});
  await new S3Storage({ send } as unknown as S3Client, 'bucket').deletePrefix(
    'users/u/',
  );
  expect(send.mock.calls[0][0]).toBeInstanceOf(ListObjectVersionsCommand);
  expect(send.mock.calls[1][0]).toBeInstanceOf(DeleteObjectsCommand);
  expect(send.mock.calls[1][0].input.Delete.Objects).toEqual([
    { Key: 'users/u/a', VersionId: 'old' },
    { Key: 'users/u/a', VersionId: 'marker' },
  ]);
  expect(send.mock.calls[2][0].input).toMatchObject({
    Prefix: 'users/u/',
    KeyMarker: 'users/u/a',
    VersionIdMarker: 'marker',
  });
});

test('partial S3 deletion failure is not acknowledged as success', async () => {
  const send = jest
    .fn()
    .mockResolvedValueOnce({
      Versions: [{ Key: 'users/u/a', VersionId: 'old' }],
    })
    .mockResolvedValueOnce({ Errors: [{ Code: 'AccessDenied' }] });
  await expect(
    new S3Storage({ send } as unknown as S3Client, 'bucket').deletePrefix(
      'users/u/',
    ),
  ).rejects.toThrow('Storage cleanup failed');
});
