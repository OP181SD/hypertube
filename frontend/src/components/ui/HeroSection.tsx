import { FC } from "react";
import { HeroMovie } from "@/types/Heromovie";

interface HeroSectionProps {
    movies: HeroMovie[];
    activeIndex: number;
    setActiveIndex: (index: number) => void;
}

export const HeroSection: FC<HeroSectionProps> = ({
    movies,
    activeIndex,
    setActiveIndex,
}) => {
    if (!movies.length) return null;

    const movie = movies[activeIndex];
    const year = movie.release_date?.split("-")[0];
    const rating = movie.vote_average?.toFixed(1) ?? "N/A";


    const renderIndicators = () =>
        movies.map((_, index) => (
            <li
                key={index}
                onClick={() => setActiveIndex(index)}
                className={`${index === activeIndex
                    ? "w-2.5 h-2.5 sm:w-3 sm:h-3 bg-white"
                    : "w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white/40 hover:bg-white/60 cursor-pointer"
                    } rounded-full transition-all duration-300 ease-out`}
            />
        ));

    return (
        <section className="relative w-full">
            <div className="relative w-full group">

                <img
                    src={`https://image.tmdb.org/t/p/original${movie.backdrop_path}`}
                    alt={movie.title}
                    className="
                        w-full
                        h-[60vh]  sm:h-[55vh] md:h-[60vh] lg:h-[65vh] xl:h-[70vh] 2xl:h-[75vh]
                        object-cover
                    "
                />


                <div className="absolute inset-0 bg-linear-to-t from-black via-transparent to-transparent" />

            
                <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6 md:p-8 lg:p-10 text-white">
                    <h1 className="
                        text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl 2xl:text-4xl
                        font-semibold mb-2 drop-shadow-lg
                    ">
                        {movie.title}
                    </h1>

                    <div className="flex items-center gap-1 text-[9px] sm:text-[10px] md:text-sm text-white/70 mb-2">
                        <span>{year}</span>
                        <span>•</span>
                        <span className="text-white/80 font-medium">{rating}</span>
                    </div>

                    <p className="text-[8px] sm:text-[9px] md:text-xs lg:text-sm xl:text-base text-white/70 max-w-xl leading-snug mb-4">
                        {movie.overview}
                    </p>
                </div>

                <div className="absolute hidden xl:flex justify-center bottom-4 inset-x-0">
                    <ul className="flex gap-2 backdrop-blur-md items-center px-3 sm:px-4 py-1.5 sm:py-2 rounded-full">
                        {renderIndicators()}
                    </ul>
                </div>
            </div>
        </section>
    );
};