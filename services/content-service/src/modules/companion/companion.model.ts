import { Schema, model } from 'mongoose';
const conversation = new Schema(
  {
    userId: { type: String, required: true },
    title: { type: String, default: 'New conversation' },
    titleEdited: { type: Boolean, default: false },
    summary: { type: String, default: '' },
    replyCount: { type: Number, default: 0 },
    lease: { type: String, default: null },
    leaseUntil: { type: Date, default: null },
  },
  { timestamps: true, collection: 'companion_conversations' },
);
conversation.index({ userId: 1, _id: -1 });
export const Conversation = model('CompanionConversation', conversation);
const message = new Schema(
  {
    userId: { type: String, required: true },
    conversationId: { type: Schema.Types.ObjectId, required: true },
    role: {
      type: String,
      enum: ['USER', 'ASSISTANT', 'CRISIS'],
      required: true,
    },
    text: { type: String, required: true },
    screened: { type: Boolean, default: false },
    safe: { type: Boolean, default: false },
    support: Schema.Types.Mixed,
  },
  { timestamps: true, collection: 'companion_messages' },
);
message.index({ userId: 1, conversationId: 1, _id: -1 });
export const CompanionMessage = model('CompanionMessage', message);
