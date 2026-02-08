export type Genders =
    | "Action"
    | "Comedy"
    | "Drama"
    | "Horror"
    | "Science Fiction"
    | "Thriller"
    | "Romance"


export const genres: Genders[] = [
    "Action",
    "Comedy",
    "Drama",
    "Horror",
    "Science Fiction",
    "Thriller",
    "Romance"
]

export type SortTypes = "Popular" | "Name" | "Year" | "Rating";
export const sortTypes: SortTypes[] = ["Popular", "Name", "Year", "Rating"];