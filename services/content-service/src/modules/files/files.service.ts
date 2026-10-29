import { FileMetadata } from './files.model';
import { ObjectStorage } from './storage';
import { CommunityService } from '../community/community.service';
import { AppError } from '../../utils/errors';
import { DeletedUser } from '../events/events.model';
export class FilesService {
  constructor(
    private storage: ObjectStorage,
    private community: CommunityService,
    private now: () => Date = () => new Date(),
  ) {}
  async download(userId: string, key: string) {
    const file = await FileMetadata.findOne({ objectKey: key }).lean();
    if (
      !file ||
      (await DeletedUser.exists({ _id: file.userId })) ||
      (await DeletedUser.exists({ _id: userId }))
    )
      throw new AppError(404, 'NOT_FOUND', 'File not found');
    if (file.purpose === 'community')
      await this.community.access(userId, file.circleId!, false);
    else if (file.userId !== userId)
      throw new AppError(404, 'NOT_FOUND', 'File not found');
    const stored = await this.storage.head(key);
    if (stored.contentType !== file.contentType || stored.size !== file.size)
      throw new AppError(
        409,
        'INVALID_UPLOAD',
        'Uploaded file does not match its declaration',
      );
    return {
      url: await this.storage.download(key),
      expiresAt: new Date(this.now().getTime() + 900000),
    };
  }
}
