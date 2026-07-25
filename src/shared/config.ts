/**
 * RLV — Application configuration.
 * Sensitive values like CLIENT_ID should be set via environment variables
 * or overridden in a local config file (not committed).
 */

export const CONFIG = {
  /** Microsoft Azure AD app client ID for OAuth login */
  MICROSOFT_CLIENT_ID: process.env.RLV_MICROSOFT_CLIENT_ID || '00000000-0000-0000-0000-000000000000',
} as const;
