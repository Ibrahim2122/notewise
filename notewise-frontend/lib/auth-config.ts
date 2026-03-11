import { Configuration, LogLevel } from "@azure/msal-browser";

const TENANT_NAME = process.env.NEXT_PUBLIC_ENTRA_TENANT_NAME;
const TENANT_ID = process.env.NEXT_PUBLIC_ENTRA_TENANT_ID;
const SPA_CLIENT_ID = process.env.NEXT_PUBLIC_SPA_CLIENT_ID;
const API_CLIENT_ID = process.env.NEXT_PUBLIC_API_CLIENT_ID;
const REDIRECT_URI =
  process.env.NEXT_PUBLIC_REDIRECT_URI || "http://localhost:3000";

if (!TENANT_NAME || !TENANT_ID || !SPA_CLIENT_ID || !API_CLIENT_ID) {
  throw new Error("Missing required public environment variables");
}

export const msalConfig: Configuration = {
  auth: {
    clientId: SPA_CLIENT_ID,
    authority: `https://${TENANT_NAME}.ciamlogin.com/${TENANT_ID}`,
    knownAuthorities: [`${TENANT_NAME}.ciamlogin.com`],
    redirectUri: REDIRECT_URI,
  },
  cache: {
    cacheLocation: "sessionStorage",
  },
};

export const loginRequest = {
  scopes: [`api://${API_CLIENT_ID}/api.access`, "openid", "profile", "email"],
};
