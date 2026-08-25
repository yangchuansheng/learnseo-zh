import type { Metadata } from "next";
import { Mukta } from "next/font/google";
import "./globals.css";

const mukta = Mukta({
  variable: "--font-mukta",
  subsets: ["latin"],
  weight: ["300", "400", "700", "800"],
});

export const metadata: Metadata = {
  title: "Learn SEO with a Free Roadmap of Reliable Guides & Tools",
  description:
    "LearningSEO.io offers you the most comprehensive roadmap of reliable free resources, tools and tips to accelerate your SEO learning process.",
  icons: {
    icon: "/sites/learningseo-io-071dae18/shared/favicon-32x32.jpg",
    apple: "/sites/learningseo-io-071dae18/shared/apple-touch-icon.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-US" className={`${mukta.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
