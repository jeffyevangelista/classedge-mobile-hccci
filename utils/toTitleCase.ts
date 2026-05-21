export const toTitleCase = (input: string | null | undefined) => {
  if (!input) return "";
  return input.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
};
