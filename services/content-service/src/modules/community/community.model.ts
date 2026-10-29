import { Schema, model } from 'mongoose';
const fields = () => ({
  userId: { type: String, default: null },
  authorAlias: { type: String, required: true },
  circleId: { type: String, required: true },
  text: { type: String, required: true },
  status: {
    type: String,
    enum: ['VISIBLE', 'HELD', 'REMOVED'],
    required: true,
  },
});
const posts = new Schema(fields(), { timestamps: true, collection: 'posts' });
posts.index({ circleId: 1, status: 1, createdAt: -1, _id: -1 });
posts.index({ userId: 1 });
export const Post = model('Post', posts);
const comments = new Schema(
  { ...fields(), postId: { type: Schema.Types.ObjectId, required: true } },
  { timestamps: true, collection: 'comments' },
);
comments.index({ postId: 1, status: 1, createdAt: -1, _id: -1 });
comments.index({ userId: 1 });
export const Comment = model('Comment', comments);
const chat = new Schema(fields(), {
  timestamps: true,
  collection: 'chat_messages',
});
chat.index({ circleId: 1, status: 1, _id: -1 });
chat.index({ userId: 1 });
export const ChatMessage = model('ChatMessage', chat);
const reaction = new Schema(
  {
    userId: { type: String, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    targetType: { type: String, enum: ['POST', 'COMMENT'], required: true },
    type: {
      type: String,
      enum: ['support', 'hug', 'relate', 'helpful'],
      required: true,
    },
  },
  { timestamps: true, collection: 'reactions' },
);
reaction.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true });
reaction.index({ targetType: 1, targetId: 1, type: 1 });
export const Reaction = model('Reaction', reaction);
const restriction = new Schema(
  {
    userId: String,
    circleId: String,
    muted: Boolean,
    banned: Boolean,
    mutedUntil: Date,
    bannedUntil: Date,
    occurredAt: Date,
  },
  { collection: 'user_restrictions' },
);
restriction.index({ userId: 1, circleId: 1 }, { unique: true });
export const UserRestriction = model('UserRestriction', restriction);
const reports = new Schema(
  {
    userId: String,
    circleId: String,
    contentId: { type: String, required: true },
    reason: {
      type: String,
      enum: ['HARASSMENT', 'SPAM', 'UNSAFE'],
      required: true,
    },
  },
  { collection: 'pending_reports', timestamps: true },
);
reports.index({ contentId: 1 }, { unique: true });
export const PendingReport = model('PendingReport', reports);
