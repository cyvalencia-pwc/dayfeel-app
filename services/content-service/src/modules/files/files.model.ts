import { Schema, model } from 'mongoose';
export const FileMetadata = model(
  'FileMetadata',
  new Schema(
    {
      userId: { type: String, required: true },
      objectKey: { type: String, required: true },
      contentType: { type: String, required: true },
      size: { type: Number, required: true, min: 1 },
      purpose: {
        type: String,
        enum: ['avatar', 'journal', 'community'],
        default: 'journal',
      },
      circleId: String,
      uploadExpiresAt: Date,
    },
    { collection: 'file_metadata', timestamps: true },
  ),
);
FileMetadata.schema.index({ objectKey: 1 }, { unique: true });
FileMetadata.schema.index({ userId: 1 });
