import { content } from "./client";
import type { C } from "../types";
export type JournalFilters = { before?: string; limit?: number };
export const journalApi = {
  list: (params: JournalFilters = {}) =>
    content.get<C["JournalList"]>("/journal", { params }).then((r) => r.data),
  get: (id: string) =>
    content.get<C["JournalEntry"]>(`/journal/${id}`).then((r) => r.data),
  create: (body: C["JournalInput"]) =>
    content.post<C["JournalWrite"]>("/journal", body).then((r) => r.data),
  update: (id: string, body: C["JournalInput"]) =>
    content.put<C["JournalWrite"]>(`/journal/${id}`, body).then((r) => r.data),
  remove: (id: string) => content.delete(`/journal/${id}`),
};
