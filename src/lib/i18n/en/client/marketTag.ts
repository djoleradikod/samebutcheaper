import { currencyName, MARKET_ADJECTIVE, rateDate, rateText } from "../../../localize";
import type { MarketCode } from "../../../markets";
import type { Currency } from "../../../format";

export const marketTag = {
  these: (m: string, converted: string) => `These are ${MARKET_ADJECTIVE[m as MarketCode]} prices${converted}.`,
  converted: (from: Currency, to: Currency) => `, shown in ${currencyName(to)} at the ECB rate of ${rateDate()} (${rateText(from, to)})`,
  lookFor: "What to look for where you are",
};
