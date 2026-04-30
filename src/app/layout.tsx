import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Game Authoring Tool",
  description: "Game Authoring Agentic Tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, backgroundColor: "#0f172a" }}>
        {children}
      </body>
    </html>
  );
}
