// Crypto-free constants shared by the Node (require-admin) and edge (middleware)
// admin-session verifiers. Kept separate so the edge middleware never imports
// node:crypto transitively.
export const ADMIN_COOKIE_NAME = "ll_admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60; // 8h
export const ADMIN_SESSION_VERSION = 1;
