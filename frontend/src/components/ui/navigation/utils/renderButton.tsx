export const renderButton = (label: string | number, isActive = false) => (
  <button
    key={label}
    className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-medium 
               ${isActive 
                 ? 'bg-white text-black' 
                 : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
               }
               backdrop-blur-md transition-all duration-300 whitespace-nowrap`}
  >
    {label}
  </button>
);