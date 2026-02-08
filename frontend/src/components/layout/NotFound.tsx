import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

export function NotFound() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black text-center px-4">
      <h1
        className="
          font-extrabold
          uppercase
          tracking-wide
          leading-tight
          text-[64px]
          sm:text-[64px]
          md:text-[80px]
          lg:text-[96px]
          colors-title-gradient
        "
      >
        404
      </h1>

      <p
        className="
          mt-4
          text-[16px]
          sm:text-[18px]
          md:text-[20px]
          lg:text-[22px]
          font-medium
          leading-relaxed
          text-white/80
          max-w-2xl
        "
      >
        {t("page_not_found_detail")}
      </p>

      <button
        onClick={() => navigate("/")}
        className="
          mt-6
          px-6
          py-3
          rounded-full
          bg-[#0071e3]
          hover:bg-[#0077ed]
          text-white
          font-medium
          transition-colors
        "
      >
        {t("back_to_home")}
      </button>
    </div>
  );
}

export default NotFound;
