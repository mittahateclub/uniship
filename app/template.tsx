// Route-level transition: a quiet rise + fade on every navigation.
// template.tsx remounts per navigation, so the CSS animation replays.
// The transform is transient (no fill mode), so position:fixed
// descendants are unaffected once the entrance completes.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
