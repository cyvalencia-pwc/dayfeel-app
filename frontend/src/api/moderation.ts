import { identity, content } from "./client";
import type { C } from "../types";
import type { I } from "../types";
export const moderationApi = {
  content: (id: string) => content.get<(C["CommunityContent"] & { kind: string }) | null>(`/moderation/reports/${id}/content`).then(r => r.data),
  reports: (circle: string, page = 0) =>
    identity
      .get<I["ReportView"][]>(`/circles/${circle}/reports`, {
        params: { page },
      })
      .then((r) => r.data),
  report: (id: string) =>
    identity.get<I["ReportView"]>(`/reports/${id}`).then((r) => r.data),
  act: (circle: string, body: I["Moderation"]) =>
    identity.post(`/circles/${circle}/moderation`, body),
};
