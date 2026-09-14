/** JSON Pointer (RFC 6901) helpers. */

export function parsePointer(pointer: string): string[] | undefined {
  if (pointer === "") return [];
  if (!pointer.startsWith("/")) return undefined;
  return pointer
    .slice(1)
    .split("/")
    .map((token) => token.replaceAll("~1", "/").replaceAll("~0", "~"));
}

export function escapeToken(token: string): string {
  return token.replaceAll("~", "~0").replaceAll("/", "~1");
}

export function toPointer(tokens: (string | number)[]): string {
  return tokens.map((token) => `/${escapeToken(String(token))}`).join("");
}

const ARRAY_INDEX = /^(0|[1-9][0-9]*)$/;

export function resolvePointer(document: unknown, pointer: string): { found: boolean; value?: unknown } {
  const tokens = parsePointer(pointer);
  if (tokens === undefined) return { found: false };

  let current: unknown = document;
  for (const token of tokens) {
    if (Array.isArray(current)) {
      if (!ARRAY_INDEX.test(token)) return { found: false };
      const index = Number(token);
      if (index >= current.length) return { found: false };
      current = current[index];
    } else if (current !== null && typeof current === "object") {
      if (!Object.hasOwn(current, token)) return { found: false };
      current = (current as Record<string, unknown>)[token];
    } else {
      return { found: false };
    }
  }
  return { found: true, value: current };
}
