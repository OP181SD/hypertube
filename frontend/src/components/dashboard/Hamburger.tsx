interface Props {
  menuOpen: boolean;
}

export function Hamburger({ menuOpen }: Props) {
  return (
    <div className="flex flex-col justify-center items-center w-5 h-5 sm:w-6 sm:h-6 gap-1 sm:gap-1.5">
      <span className={`bg-white h-0.5 w-5 sm:w-6 rounded transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-1.5 sm:translate-y-2' : 'opacity-100'}`}></span>
      <span className={`bg-white h-0.5 w-5 sm:w-6 rounded transition-all duration-300 ${menuOpen ? 'opacity-0' : 'opacity-100'}`}></span>
      <span className={`bg-white h-0.5 w-5 sm:w-6 rounded transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-1.5 sm:-translate-y-2' : 'opacity-100'}`}></span>
    </div>
  );
}