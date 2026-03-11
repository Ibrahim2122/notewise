"use client";

import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "@/lib/auth-config";

const msalInstance = new PublicClientApplication(msalConfig);

export function MsalProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MsalProvider instance={msalInstance}>{children}</MsalProvider>;
}
