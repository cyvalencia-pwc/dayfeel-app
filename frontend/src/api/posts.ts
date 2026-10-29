import { content } from "./client";
import type { C } from "../types";
export const postsApi = {
  reportComment: (id: string, reason: string) => content.post(`/comments/${id}/report`, { reason }),
  report: (id: string, reason: string) => content.post(`/posts/${id}/report`, { reason }),
  reactions: (id: string) => content.get<C["ReactionState"]>(`/posts/${id}/reactions`).then(r => r.data),
  list: (circle: string, cursor?: string) =>
    content
      .get<C["PostList"]>(`/circles/${circle}/posts`, { params: { cursor } })
      .then((r) => r.data),
  create: (circle: string, text: string) =>
    content
      .post<C["CommunityCreated"]>(`/circles/${circle}/posts`, { text })
      .then((r) => r.data),
  get: (id: string) =>
    content.get<C["CommunityContent"]>(`/posts/${id}`).then((r) => r.data),
  remove: (id: string) => content.delete(`/posts/${id}`),
  comments: (id: string, cursor?: string) =>
    content
      .get<C["CommentList"]>(`/posts/${id}/comments`, { params: { cursor } })
      .then((r) => r.data),
  comment: (id: string, text: string) =>
    content
      .post<C["CommunityCreated"]>(`/posts/${id}/comments`, { text })
      .then((r) => r.data),
  removeComment: (id: string) => content.delete(`/comments/${id}`),
  react: (id: string, type: C["ReactionInput"]["type"]) =>
    content
      .put<C["ReactionResult"]>(`/posts/${id}/reactions`, { type })
      .then((r) => r.data),
};
