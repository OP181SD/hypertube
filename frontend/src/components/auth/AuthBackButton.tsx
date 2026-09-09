import React from "react";

type AuthBackButtonProps = {
  onClick: () => void;
  label: string;
  className?: string;
};

const BackChevron = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

export const AuthBackButton: React.FC<AuthBackButtonProps> = ({
  onClick,
  label,
  className = "",
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`text-[#0071e3] text-sm hover:underline flex items-center gap-2 cursor-pointer ${className}`}
  >
    <BackChevron />
    {label}
  </button>
);
