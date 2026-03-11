"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import {
  AccountInfo,
  InteractionStatus,
  InteractionRequiredAuthError,
} from "@azure/msal-browser";
import { loginRequest } from "./auth-config";
import { setAccessTokenGetter } from "./api";

interface AuthContextValue {
  user: AccountInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const isLoading = inProgress !== InteractionStatus.None;
  const user = accounts[0] ?? null;

  useEffect(() => {
    setAccessTokenGetter(async () => {
      const account = instance.getAllAccounts()[0];
      if (!account) return null;

      try {
        const result = await instance.acquireTokenSilent({
          ...loginRequest,
          account,
        });
        return result.accessToken;
      } catch (err) {
        if (err instanceof InteractionRequiredAuthError) {
          // Refresh token expired — redirect to login
          await instance.acquireTokenRedirect({ ...loginRequest, account });
        }
        return null;
      }
    });
  }, [instance, user]);

  const signIn = async () => {
    await instance.loginRedirect({
      ...loginRequest,
      prompt: "select_account", // always show account picker, never silently reuse session
    });
  };

  const signOut = () => {
    instance.logoutRedirect({
      account: instance.getActiveAccount() ?? accounts[0], // tell Entra which session to kill
      postLogoutRedirectUri: "/",
    });
  };

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated, isLoading, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
