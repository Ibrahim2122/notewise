import React from "react";
import type { Metadata } from "next";
import { Inter, Space_Mono } from "next/font/google";
import { MsalProviderWrapper } from "@/components/providers/msal-provider-wrapper";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
});

export const metadata: Metadata = {
  title: "NoteWise - Study Smarter",
  description:
    "Collect sources and generate concise study artifacts with NoteWise. Workspaces, summary cards, quizzes, narration, and more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${spaceMono.variable} font-sans antialiased`}
      >
        <MsalProviderWrapper>
          <AuthProvider>{children}</AuthProvider>
        </MsalProviderWrapper>
      </body>
    </html>
  );
}
