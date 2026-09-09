import { FC, useState } from "react";
import { useTranslation } from "react-i18next";

interface PosterImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  placeholderClassName?: string;

  placeholder?: "label" | "silent";
}

export const PosterImage: FC<PosterImageProps> = ({
  src,
  alt,
  className = "",
  placeholderClassName,
  placeholder = "label",
}) => {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    if (placeholder === "silent") {
      return (
        <div
          role="img"
          aria-label={alt}
          className={
            placeholderClassName ??
            `bg-gray-900 ${className}`
          }
        />
      );
    }

    return (
      <div
        role="img"
        aria-label={alt}
        className={
          placeholderClassName ??
          `flex items-center justify-center bg-gray-800 text-white/40 text-sm ${className}`
        }
      >
        {t("no_poster")}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
};
