'use client';

// Small accessible switch used for boolean settings (e.g. "Allow reattempts").
export function Toggle({ checked, onChange, disabled, label }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-[20px] w-[34px] shrink-0 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? 'bg-[var(--accent-orange)]' : 'bg-[var(--bg-elevated)] border border-[var(--border-subtle)]'
      }`}
    >
      <span
        className={`absolute top-1/2 -translate-y-1/2 h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-all duration-150 ${
          checked ? 'left-[17px]' : 'left-[3px]'
        }`}
      />
    </button>
  );
}
