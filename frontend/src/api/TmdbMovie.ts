export interface TMDBMovie {
  id: number;
  title: string;
  release_date?: string;
  vote_average?: number;
  poster_path?: string;
  genre_ids?: number[];
}