import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import ThemeToggle from "@/components/ThemeToggle";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
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