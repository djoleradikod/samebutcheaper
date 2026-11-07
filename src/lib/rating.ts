/**
 * How a rating is stored, read and held to the floor. Pure, for the catalogue build, server and client.
 *
 * Every scale reduces to a share of 1. The owner's rule is nothing under 3 of 5 or 6 of 10, so the floor is 0.6.
 * German grades run backwards, 1.0 best: grade 1 reads as 5 stars and grade 5 as 1 star, so grade 3.0 sits exactly on the
 * floor, the same place as 3 stars. See "Ratings" in data/README.md.
 */
export const RATING_FLOOR = 0.6;

/** Below this many shoppers a rating says nothing, in either direction. A named test isn't a headcount, so it's exempt. See data/README.md. */
export const MIN_RATINGS = 5;

export function ratingCounts(r: { count?: number | null; publisher?: string | null }) {
  return Boolean(r.publisher) || (r.count ?? 0) >= MIN_RATINGS;
}

export const RATING_SCALES = ["stars-5", "out-of-10", "percent", "de-grade"] as const;
export type RatingScale = (typeof RATING_SCALES)[number];

const RANGE: Record<RatingScale, [number, number]> = {
  "stars-5": [0, 5],
  "out-of-10": [0, 10],
  percent: [0, 100],
  "de-grade": [1, 6],
};

export function inRange(score: number, scale: RatingScale) {
  const [low, high] = RANGE[scale];
  return score >= low && score <= high;
}

export function ratingShare(score: number, scale: RatingScale) {
  switch (scale) {
    case "stars-5":
      return score / 5;
    case "out-of-10":
      return score / 10;
    case "percent":
      return score / 100;
    case "de-grade":
      return (6 - score) / 5;
  }
}

/** "4.4 of 5", "75%" or "grade 1.5". */
function scoreText(score: number, scale: RatingScale) {
  switch (scale) {
    case "stars-5":
      return `${score.toFixed(1).replace(/\.0$/, "")} of 5`;
    case "out-of-10":
      return `${score.toFixed(1).replace(/\.0$/, "")} of 10`;
    case "percent":
      return `${Math.round(score)}%`;
    case "de-grade":
      return `grade ${score.toFixed(1)}`;
  }
}

/** What a shopper reads: "4.4 of 5", "4.4 of 5 from 1,253 ratings", "Which? 75%", "Öko-Test: very good". */
export function ratingLabel(r: { score: number; scale: RatingScale; publisher?: string; count?: number; wording?: string }) {
  if (r.wording) return r.publisher ? `${r.publisher}: ${r.wording}` : r.wording;
  const score = scoreText(r.score, r.scale);
  if (r.publisher) return `${r.publisher} ${score}`;
  return r.count ? `${score} from ${r.count.toLocaleString("en-US")} ratings` : score;
}

export const NO_RATING = "No rating found yet";
