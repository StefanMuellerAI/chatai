function base64UrlToBase64(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "+");
  const padding = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  return base64 + padding;
}

function base64ToBase64Url(input: string): string {
  return input.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function encodeBase64UrlUtf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return base64ToBase64Url(btoa(binary));
}

export function decodeBase64UrlUtf8(input: string): string {
  const binary = atob(base64UrlToBase64(input));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

