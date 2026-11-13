/** Helpers the English client sections share. */
import { MARKETS, countryInSentence, type MarketCode } from "../../../markets";

/** "the UK": a market as the English pages name it in a sentence. */
export const market = (m: string) => MARKETS[m as MarketCode]?.short ?? m;
/** "the United Kingdom": any country, mid-sentence. */
export const country = (c: string) => countryInSentence(c);
export const swapsWord = (n: number) => `${n} swap${n === 1 ? "" : "s"}`;
export const s = (n: number) => (n === 1 ? "" : "s");
