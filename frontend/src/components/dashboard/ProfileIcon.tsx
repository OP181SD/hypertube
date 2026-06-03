import { useAuth } from "@/contexts/AuthContext";
import { API_BASE_URL } from "@/constants/api";
import { getAvatarUrl } from "@/constants/avatar";

interface ProfileIconProps {
  onClick?: () => void;
}

export function ProfileIcon({ onClick }: ProfileIconProps) {
  const { user } = useAuth();

  const profileSrc = user?.profilePictureUrl
    ? `${API_BASE_URL}${user.profilePictureUrl}`
    : getAvatarUrl(user?.username ?? "guest");

  return (
    <div onClick={onClick} className="relative group cursor-pointer">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-600 to-purple-600 rounded-full opacity-0 group-hover:opacity-75 blur transition duration-200"></div>

      <img
        src={profileSrc}
        alt={user?.username || "Guest"}
        className="relative w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-full object-cover border border-white/20"
      />
    </div>
  );
}