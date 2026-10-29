import { content } from "./client";
import type { C } from "../types";
export const companionApi = {
  list: () =>
    content
      .get<C["ConversationList"]>("/companion/conversations")
      .then((r) => r.data),
  create: () =>
    content
      .post<C["ConversationCreated"]>("/companion/conversations", {
        title: "New conversation",
      })
      .then((r) => r.data),
  messages: (id: string, cursor?: string) =>
    content
      .get<C["CompanionMessageList"]>(
        `/companion/conversations/${id}/messages`,
        { params: { cursor } },
      )
      .then((r) => r.data),
  send: (id: string, text: string) =>
    content
      .post<C["CompanionReply"]>(
        `/companion/conversations/${id}/messages`,
        {
          text,
        },
        { timeout: 90000 },
      )
      .then((r) => r.data),
  rename: (id: string, title: string) =>
    content.patch(`/companion/conversations/${id}`, { title }),
  remove: (id: string) => content.delete(`/companion/conversations/${id}`),
  exercises: () =>
    content
      .get<C["CompanionExercises"]>("/companion/exercises")
      .then((r) => r.data),
};
