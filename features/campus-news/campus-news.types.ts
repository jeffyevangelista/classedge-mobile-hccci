export type FacebookPost = {
  message: string;
  createdTime: string;
  postedBy: string;
  profilePictureUrl: string;
  permalinkUrl: string;
  imageUrl: string;
};

export type FacebookPostsResponse = {
  posts: FacebookPost[];
};

/**
 * Resolve a post's imageUrl to a usable absolute URL, or return null when
 * the API returned a placeholder/relative path (e.g. "/static/...").
 * Callers should substitute a local placeholder when this returns null.
 */
export function resolvePostImage(url: string): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return null;
}

/**
 * Pick the first non-empty line of a post message to use as a visible title.
 * Falls back to the whole message if there are no line breaks.
 *
 * NFKC-normalizes first so FB-style stylized Unicode (Mathematical Bold/Italic
 * Latin in the U+1D400+ range, full-width, ligatures, etc.) collapses to plain
 * ASCII — otherwise those code points fall outside Poppins and trigger system
 * font fallback, breaking the card's typography.
 */
export function postTitle(message: string): string {
  if (!message) return "";
  const normalized = message.normalize("NFKC");
  const lines = normalized.split("\n").map((line) => line.trim());
  return lines.find((line) => line.length > 0) ?? normalized;
}
