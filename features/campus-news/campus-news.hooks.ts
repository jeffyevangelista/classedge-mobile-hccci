import { useQuery } from "@tanstack/react-query";
import { getFacebookPosts } from "./campus-news.apis";

/**
 * Fetches campus news (Facebook page posts) for the HomeScreen banner.
 *
 * Caching: 30-minute staleTime so most HomeScreen opens reuse cached data.
 * 1-hour gcTime so we drop the cache well before FB CDN image URLs expire
 * (their `oe=` query param expiry is typically ~6h from request time).
 * HomeScreen's pull-to-refresh invalidates all stale queries, which picks
 * this up automatically — no per-feature wiring needed.
 */
export const useFacebookPosts = () => {
  return useQuery({
    queryKey: ["facebook-posts"],
    queryFn: getFacebookPosts,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
  });
};
