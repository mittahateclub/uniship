import React from "react";
import Navbar from "@/components/Navbar";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-56px)] bg-[#09090b]">
        {children}
      </main>
    </>
  );
}