export async function hashPinBrowser(pin) {
  const normalizedPin = String(pin || "").trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalizedPin);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export function formatAuthMode(authMode) {
  if (authMode === "online-token") {
    return "Live session";
  }

  if (authMode === "offline-proof") {
    return "Offline proof";
  }

  return "Session";
}

