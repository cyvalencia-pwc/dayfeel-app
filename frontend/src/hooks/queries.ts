import { QueryClient, useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { journalApi, type JournalFilters } from "../api/journal";
import { moodApi } from "../api/mood";
import { postsApi } from "../api/posts";
import type { Range } from "../types";
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});
export const useJournal = (filters: JournalFilters = {}) =>
  useQuery({
    queryKey: ["journal", filters],
    queryFn: () => journalApi.list(filters),
  });
export const useMoodSummary = (range: Range) =>
  useQuery({
    queryKey: ["mood", "summary", range],
    queryFn: () => moodApi.summary(range),
  });
export const usePosts = (circleId: string) =>
  useInfiniteQuery({
    queryKey: ["posts", circleId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => postsApi.list(circleId, pageParam),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
export async function invalidateJournal() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["journal"] }),
    queryClient.invalidateQueries({ queryKey: ["mood"] }),
  ]);
}
