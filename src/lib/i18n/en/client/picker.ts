import { MARKET_ADJECTIVE } from "../../../localize";
import { MARKET_LABEL, type MarketCode } from "../../../markets";

export const picker = {
  country: "Country",
  label: "Country you shop in",
  choose: "Choose your country",
  /** A country's name in a list. */
  name: (_code: string, english: string) => english,
  pricesCheckedIn: (m: string) => `Prices checked in ${MARKET_LABEL[m as MarketCode]} stores`,
  marketPrices: (m: string) => `${MARKET_ADJECTIVE[m as MarketCode]} prices`,
};
