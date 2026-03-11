import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import ThemeToggle from "@/components/ThemeToggle";

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`,
          }}
        />
      </head>
      <body style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        <AuthProvider>
          {children}
          <ThemeToggle />
        </AuthProvider>
      </body>
    </html>
  );
}