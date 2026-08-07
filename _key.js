/** Accepts either name so keys can be scoped per property.
    ANTHROPIC_API_KEY_NEWSDESK wins when both are present. */
export function anthropicKey() {
  const raw = process.env.ANTHROPIC_API_KEY_NEWSDESK || process.env.ANTHROPIC_API_KEY || "";
  return { raw, clean: raw.trim().replace(/^["']|["']$/g, "") };
}

export const keySource = () =>
  process.env.ANTHROPIC_API_KEY_NEWSDESK ? "ANTHROPIC_API_KEY_NEWSDESK"
  : process.env.ANTHROPIC_API_KEY ? "ANTHROPIC_API_KEY"
  : null;
