export const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
export const apiBaseUrl = `${appUrl}/api/v1`;
