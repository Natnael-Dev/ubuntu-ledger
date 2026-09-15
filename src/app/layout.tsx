import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ward Proof-Line",
  description: "Closed-loop civic accountability engine",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
