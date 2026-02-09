import { useAuth } from "@/contexts/AuthContext";

interface ProfileIconProps {
  onClick?: () => void;
}

export function ProfileIcon({ onClick }: ProfileIconProps) {
  const { user } = useAuth();

  return (
    <div
      onClick={onClick}
      className="relative group cursor-pointer"
    >
      <div className="absolute -inset-0.5 bg-lienar-to-r from-pink-600 to-purple-600 rounded-full opacity-0 group-hover:opacity-75 blur transition duration-200"></div>
      {user?.profilePictureUrl ? (
        <img
          src={user.profilePictureUrl}
          alt={user.username}
          className="relative w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-full object-cover border border-white/20"
        />
      ) : (
        <div className="relative w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-full bg-white/20 border border-white/20 flex items-center justify-center text-white text-xs font-medium">
          {user?.username?.charAt(0).toUpperCase() || "?"}
        </div>
      )}
    </div>
  );
}
