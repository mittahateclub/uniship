import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import ThemeToggle from "@/components/ThemeToggle";
import localFont from "next/font/local";

const inter = localFont({
  src: [
    { path: "./fonts/Inter-400.ttf", weight: "400", style: "normal" },
    { path: "./fonts/Inter-500.ttf", weight: "500", style: "normal" },
    { path: "./fonts/Inter-600.ttf", weight: "600", style: "normal" },
    { path: "./fonts/Inter-700.ttf", weight: "700", style: "normal" },
    { path: "./fonts/Inter-800.ttf", weight: "800", style: "normal" },
  ],
  variable: "--font-inter",
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
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`,
          }}
        />
      </head>
      <body suppressHydrationWarning style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'var(--font-inter), system-ui, sans-serif' }}>
        <AuthProvider>
          {children}
          <ThemeToggle />
        </AuthProvider>
      </body>
    </html>
  );
}
