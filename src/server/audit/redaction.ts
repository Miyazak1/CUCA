const SENSITIVE_KEY_PATTERN = /password|passcode|secret|token|cookie|authorization|cvv|cvc|cardNumber|pan|apiKey|privateKey/i;
const PAN_LIKE_PATTERN = /\b(?:\d[ -]*?){13,19}\b/g;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function redactSensitive<T>(value: T): T {
  return redactValue(value) as T;
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? "[REDACTED]" : redactValue(entryValue),
      ]),
    );
  }

  if (typeof value === "string") {
    if (UUID_PATTERN.test(value)) return value;
    return value.replace(PAN_LIKE_PATTERN, "[REDACTED_PAN]");
  }

  return value;
}
