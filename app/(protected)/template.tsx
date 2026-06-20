// Content-scoped route transition for the authenticated app.
//
// This template sits *below* the (protected) layout, so the persistent shell
// — sidebar, top bar, and AuthProvider — stays mounted across navigation while
// only the page content remounts and replays the entrance animation. That is
// what makes navigation feel like a fluid content swap rather than a full-page
// flicker (the old root-level app/template.tsx animated the whole shell).
//
// `.route-fade` is a transient GPU animation (no fill mode); modals/toasts use
// createPortal to document.body, so they live outside this wrapper and are
// unaffected by the brief transform.
export default function ProtectedTemplate({ children }: { children: React.ReactNode }) {
  return <div className="route-fade">{children}</div>;
}
