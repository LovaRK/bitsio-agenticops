import "./globals.css";
import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { THEME_KEY } from "@/constants/theme";

export const metadata: Metadata = {
  title: "BitsIO AgenticOps",
  description: "Reasoning-first incident operations dashboard"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('${THEME_KEY}');
                  var theme = saved === 'light' ? 'light' : 'dark';
                  if (theme === 'dark') document.documentElement.classList.add('dark');
                  else document.documentElement.classList.remove('dark');
                } catch (e) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-on-surface">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
