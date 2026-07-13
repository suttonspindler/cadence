import type { Era } from "@cadence/db";

// Curated set of major composers across all eras. MusicBrainz supplies canonical
// dates/nationality, Wikipedia supplies bio + portrait. The 6 seed composers are
// included and upsert by slug (no duplicates).
export const COMPOSER_LIST: { name: string; era: Era }[] = [
  // Baroque
  { name: "Claudio Monteverdi", era: "BAROQUE" },
  { name: "Arcangelo Corelli", era: "BAROQUE" },
  { name: "Henry Purcell", era: "BAROQUE" },
  { name: "Antonio Vivaldi", era: "BAROQUE" },
  { name: "Georg Philipp Telemann", era: "BAROQUE" },
  { name: "Jean-Philippe Rameau", era: "BAROQUE" },
  { name: "Johann Sebastian Bach", era: "BAROQUE" },
  { name: "Domenico Scarlatti", era: "BAROQUE" },
  { name: "George Frideric Handel", era: "BAROQUE" },
  // Classical
  { name: "Christoph Willibald Gluck", era: "CLASSICAL" },
  { name: "Joseph Haydn", era: "CLASSICAL" },
  { name: "Wolfgang Amadeus Mozart", era: "CLASSICAL" },
  { name: "Ludwig van Beethoven", era: "CLASSICAL" },
  // Romantic
  { name: "Franz Schubert", era: "ROMANTIC" },
  { name: "Hector Berlioz", era: "ROMANTIC" },
  { name: "Felix Mendelssohn", era: "ROMANTIC" },
  { name: "Frédéric Chopin", era: "ROMANTIC" },
  { name: "Robert Schumann", era: "ROMANTIC" },
  { name: "Franz Liszt", era: "ROMANTIC" },
  { name: "Richard Wagner", era: "ROMANTIC" },
  { name: "Giuseppe Verdi", era: "ROMANTIC" },
  { name: "Johannes Brahms", era: "ROMANTIC" },
  { name: "Camille Saint-Saëns", era: "ROMANTIC" },
  { name: "Pyotr Ilyich Tchaikovsky", era: "ROMANTIC" },
  { name: "Antonín Dvořák", era: "ROMANTIC" },
  { name: "Edvard Grieg", era: "ROMANTIC" },
  // Late Romantic
  { name: "Anton Bruckner", era: "LATE_ROMANTIC" },
  { name: "Gabriel Fauré", era: "LATE_ROMANTIC" },
  { name: "Edward Elgar", era: "LATE_ROMANTIC" },
  { name: "Gustav Mahler", era: "LATE_ROMANTIC" },
  { name: "Richard Strauss", era: "LATE_ROMANTIC" },
  { name: "Jean Sibelius", era: "LATE_ROMANTIC" },
  { name: "Sergei Rachmaninoff", era: "LATE_ROMANTIC" },
  // Modern
  { name: "Claude Debussy", era: "MODERN" },
  { name: "Arnold Schoenberg", era: "MODERN" },
  { name: "Maurice Ravel", era: "MODERN" },
  { name: "Béla Bartók", era: "MODERN" },
  { name: "Igor Stravinsky", era: "MODERN" },
  { name: "Sergei Prokofiev", era: "MODERN" },
  { name: "Aaron Copland", era: "MODERN" },
  { name: "Dmitri Shostakovich", era: "MODERN" },
  { name: "Benjamin Britten", era: "MODERN" },
  // Contemporary
  { name: "Philip Glass", era: "CONTEMPORARY" },
  { name: "Arvo Pärt", era: "CONTEMPORARY" },
  { name: "John Adams", era: "CONTEMPORARY" },
];
