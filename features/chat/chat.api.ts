import axios from "@/lib/axios";

export type DMCandidate = {
  id: number;
  fullName: string;
  role: string;
  photoUrl: string | null;
};

export type DMCandidateResponse = {
  results: DMCandidate[];
  next: string | null;
  previous: string | null;
  count: number;
};

/**
 * Server-authoritative DM gating. The picker calls this to populate
 * choices — share-a-subject + staff bypass is enforced server-side.
 * (axios snakeToCamel transform handles full_name → fullName etc.)
 */
export const searchDMCandidates = async (
  query: string,
  page = 1,
): Promise<DMCandidateResponse> => {
  const res = await axios.get<DMCandidateResponse>("/api/chat/dm_candidates/", {
    params: { q: query, page },
  });
  return res.data;
};

export const markConversationRead = async (
  conversationLocalId: string,
  lastReadMessageLocalId: string,
): Promise<void> => {
  await axios.post(
    `/api/chat/conversations/${conversationLocalId}/mark_read/`,
    { last_read_message_local_id: lastReadMessageLocalId },
  );
};
