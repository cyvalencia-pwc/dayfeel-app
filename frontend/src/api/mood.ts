import { content } from "./client";
import type { C, Range } from "../types";
import { timezone } from "../utils/format";
export const moodApi = {
  save: (body: C["MoodInput"]) =>
    content.put<C["MoodWrite"]>("/mood/today", body).then((r) => r.data),
  summary: (range: Range) =>
    content
      .get<C["MoodSummary"]>("/mood/summary", {
        params: { range, timezone: timezone() },
      })
      .then((r) => r.data),
  calendar: (month: string) =>
    content
      .get<C["MoodCalendar"]>("/mood/calendar", { params: { month } })
      .then((r) => r.data),
};
