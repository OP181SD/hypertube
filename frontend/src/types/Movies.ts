export interface Movies {
  id: number;            
  title: string;             
  releaseYear?: number;      
  imdbRating?: number;        
  coverUrl: string;          
  watched: boolean;     
  genres?: number[];       
}