import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import localFont from "next/font/local";

const geist = localFont({
  src: "./fonts/Geist-Variable.ttf",
  weight: "100 900",
  variable: "--font-geist",
  display: "swap",
});

const bricolage = localFont({
  src: "./fonts/BricolageGrotesque-Variable.ttf",
  weight: "200 800",
  variable: "--font-bricolage",
  display: "swap",
});

const spaceMono = localFont({
  src: [
    { path: "./fonts/SpaceMono-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/SpaceMono-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-space-mono",
  display: "swap",
});

export const metadata = {
  title: "Uniship",
  description: "Your university career & internship platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geist.variable} ${bricolage.variable} ${spaceMono.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`,
          }}
        />
      </head>
      <body suppressHydrationWarning className="bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans">
        <a href="#main-content" className="skip-link">Skip to content</a>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
