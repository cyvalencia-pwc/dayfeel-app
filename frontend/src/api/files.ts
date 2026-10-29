import axios from "axios";
import { identity } from "./client";
import type { I } from "../types";
export const filesApi = {
  avatar: (file: File) =>
    identity
      .post<I["Upload"]>("/me/avatar-upload", {
        contentType: file.type,
        size: file.size,
      })
      .then((r) => r.data),
  // A separate client sends no DayFeel bearer token to object storage.
  put: (url: string, file: File, headers: Record<string, string>) =>
    axios.put(url, file, { headers, timeout: 60000 }),
};
