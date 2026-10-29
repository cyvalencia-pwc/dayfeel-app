import { identity } from "./client";
import type { I } from "../types";
export const circlesApi = {
  find: async (id: string) => {
    for (let page = 0; ; page++) {
      const { data } = await identity.get<I["Circle"][]>("/circles", {
        params: { page, size: 20 },
      });
      const circle = data.find((item) => item.id === id);
      if (circle) return circle;
      if (data.length < 20) return null;
    }
  },
  list: (page = 0) =>
    identity
      .get<I["Circle"][]>("/circles", { params: { page, size: 20 } })
      .then((r) => r.data),
  create: (name: string) =>
    identity.post<I["Circle"]>("/circles", { name }).then((r) => r.data),
  join: (id: string) =>
    identity
      .post<I["Membership"]>(`/circles/${id}/members/me`)
      .then((r) => r.data),
  leave: (id: string) => identity.delete(`/circles/${id}/members/me`),
};
