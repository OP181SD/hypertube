interface ProfileIconProps {
  onClick?: () => void;
}

export function ProfileIcon({ onClick }: ProfileIconProps) {
  return (
    <div
      onClick={onClick}
      className="relative group cursor-pointer"
    >
      <div className="absolute -inset-0.5 bg-lienar-to-r from-pink-600 to-purple-600 rounded-full opacity-0 group-hover:opacity-75 blur transition duration-200"></div>
      <img
        src="https://i.pravatar.cc/150?img=12"
        alt="Profil"
        className="relative w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-full object-cover border border-white/20"
      />
    </div>
  );
}
