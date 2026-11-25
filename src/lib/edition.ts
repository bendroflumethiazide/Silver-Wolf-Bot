/**
 * Web edition = the app built as a static website (GitHub Pages). There is no server, so features
 * that need one (Claude chat, HoYoLAB sync, Enka showcase fetch) are switched off with a notice.
 */
export const WEB_EDITION = process.env.NEXT_PUBLIC_WEB_EDITION === "1";
export const WEB_EDITION_NOTE = "Not available in the web version (it has no server). Use the desktop app or run it on your PC.";

/** Phones and tablets: don't start a 1 GB download by themselves. */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  return !!ua.userAgentData?.mobile || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
}
