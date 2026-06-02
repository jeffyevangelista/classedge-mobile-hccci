import api from "@/lib/axios";
import type { FacebookPostsResponse } from "./campus-news.types";

export const getFacebookPosts = async (): Promise<FacebookPostsResponse> => {
  return (await api.get<FacebookPostsResponse>("/facebook-posts/")).data;
};
