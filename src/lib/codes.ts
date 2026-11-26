export interface RedeemCode { id: string; code: string; reward?: string; expires?: string; redeemed: boolean; addedAt: string }

export const codesKey = (profileId: string) => `codes:${profileId}`;
/** Official redemption page; the code is prefilled and you confirm it there while logged in. */
export const redeemUrl = (code: string) => `https://hsr.hoyoverse.com/gift?code=${encodeURIComponent(code)}`;
/** Codes are upper-case letters and digits. */
export const cleanCode = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
