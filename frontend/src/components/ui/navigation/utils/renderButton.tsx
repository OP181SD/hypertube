export const renderButton = (label: string | number, isActive = false) => (
  <button
    key={label}
    className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-medium backdrop-blur-sm transition-all duration-200 whitespace-nowrap ${
      isActive
        ? "bg-white text-black shadow-[0_2px_8px_rgba(255,255,255,0.15)]"
        : "bg-white/6 text-white/75 border border-white/12 hover:bg-white/12 hover:text-white hover:border-white/20"
    }`}
  >
    {label}
  </button>
);