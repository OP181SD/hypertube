import { useTranslation } from "react-i18next";

export default function MainContent() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="flex flex-col items-center text-center max-w-4xl">

        <h1
          className="
            font-extrabold
            uppercase
            tracking-wide
            text-white
            leading-tight
            text-[32px]
            sm:text-[40px]
            md:text-[56px]
            lg:text-[64px]
          "
        >
          {t("streaming")}
          <span className="colors-title-gradient"> {t("reinvented")}</span>
        </h1>

        <p
          className="
            mt-3
            sm:mt-4
            text-[14px]
            sm:text-[15px]
            md:text-[18px]
            lg:text-[20px]
            max-w-70
            sm:max-w-md
            md:max-w-lg
            font-medium
            leading-relaxed
            text-white/90
          "
        >
          {t("simple_fluid_fast")}
          <span className="colors-title-gradient">
            {" "}{t("new_experience")}
          </span>
        </p>
      </div>
    </div>
  );
}
