import "./globals.css";
import localFont from "next/font/local";
import WebVitalsReporter from "@/components/WebVitalsReporter";

const geist = localFont({
  src: "./fonts/Geist-Variable.woff2",
  weight: "100 900",
  variable: "--font-geist",
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
    <html lang="en" className={geist.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`,
          }}
        />
      </head>
      <body suppressHydrationWarning className="bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans">
        <WebVitalsReporter />
        <a href="#main-content" className="skip-link">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
