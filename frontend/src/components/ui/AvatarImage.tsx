import { FC, useState } from "react";
import { getAvatarUrl } from "@/constants/avatar";
import { resolveMediaUrl } from "@/constants/media";

interface AvatarImageProps {
  profilePictureUrl?: string | null;
  username: string;
  alt?: string;
  className?: string;
}

export const AvatarImage: FC<AvatarImageProps> = ({
  profilePictureUrl,
  username,
  alt,
  className = "",
}) => {
  const [failed, setFailed] = useState(false);
  const resolved = resolveMediaUrl(profilePictureUrl);
  const src = failed || !resolved ? getAvatarUrl(username) : resolved;

  return (
    <img
      src={src}
      alt={alt ?? username}
      className={className}
      onError={() => setFailed(true)}
    />
  );
};
