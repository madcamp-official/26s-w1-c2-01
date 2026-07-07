export function ToolBtn({
  children, onClick, disabled, title, active, danger,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={title}
        className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-25 disabled:cursor-not-allowed"
        style={{
          background: active
            ? "#EEF2FF"
            : danger
            ? "#FEF2F2"
            : "transparent",
          border: active
            ? "1px solid #C7D2FE"
            : danger
            ? "1px solid #FECACA"
            : "1px solid #E8E7EA",
        }}
      >
        {children}
      </button>
      {title && (
        <span
          className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#0D0D14] px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
        >
          {title}
        </span>
      )}
    </div>
  );
}