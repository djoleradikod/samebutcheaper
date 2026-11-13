/**
 * Each network's feed columns, mapped onto FeedRow (row.ts). NO REAL FEED WAS READ for any of these: the
 * container can't reach the networks and the accounts aren't approved yet. Column names come from the
 * networks' public documentation, cited per format below, and the tests run against synthetic fixtures written
 * from that documentation (scripts/prices/fixtures/feeds/). Where a network's documentation couldn't be read,
 * the format says so, and a column map (PRICE_FEED_COLUMNS, docs/feeds.md) corrects it without code.
 *
 * Column names are matched without regard to case or surrounding spaces. Where a format lists several names
 * for one field, the first non-empty one wins.
 */
import type { FeedRow } from "./row";
import { currencyIn, gtinsOf, isoDayOf, nonEmpty, parsePrice, stockOf, urlOrNull } from "./row";

/** One row as read: lower-cased column name -> text. */
export type RawRow = Record<string, string>;

/** Our fields a column map can set. Several source columns may be named for one field, first non-empty wins. */
export const MAP_FIELDS = ["name", "brand", "gtin", "sku", "price", "salePrice", "currency", "pack", "stock", "link", "url", "image", "updated", "merchant"] as const;
export type MapField = (typeof MAP_FIELDS)[number];
export type ColumnMap = Partial<Record<MapField, string[]>>;

export type FeedFormat = {
  id: string;
  /** Where the column names come from. */
  docs: string[];
  /** "auto" looks at the first character: { or [ is JSON, anything else delimited text. */
  parse: "csv" | "json" | "auto";
  /** Feeds without a header row (Rakuten): the column names by position. */
  positional?: string[];
  /** Records to skip by their first field (Rakuten's HDR and TRL lines). */
  skipFirstField?: RegExp;
  map: ColumnMap;
};

const lc = (s: string) => s.trim().toLowerCase();

function pick(r: RawRow, names: string[] | undefined) {
  for (const n of names ?? []) {
    const v = r[lc(n)];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

/** The destination inside a tracked link, when the network puts it in the query (u, url, murl, ued, destination). */
export function destinationOf(link: string | null): string | null {
  if (!link) return null;
  try {
    const u = new URL(link);
    for (const k of ["u", "url", "murl", "ued", "destination", "dest"]) {
      const v = u.searchParams.get(k);
      if (v && /^https?:\/\//i.test(v)) return v;
    }
    // CJ deep links: /links/<pid>/type/dlg/[sid/<sid>/]https://store/...
    const m = /\/type\/dlg\/(?:sid\/[^/]+\/)?(https?:\/\/.+)$/i.exec(u.pathname + u.search);
    if (m) return m[1];
  } catch {}
  return null;
}

/** A raw row through a column map into our shape. */
export function rowFromMap(r: RawRow, map: ColumnMap, feed: { retailer: string; market: string }, fileUpdated: string | null = null): FeedRow {
  const link = urlOrNull(pick(r, map.link));
  const priceText = pick(r, map.price);
  const saleText = pick(r, map.salePrice);
  // A sale price below the list price is what a shopper pays today.
  const list = parsePrice(priceText);
  const sale = parsePrice(saleText);
  const price = sale !== null && (list === null || sale < list) ? sale : list;
  return {
    retailer: feed.retailer,
    market: feed.market,
    name: pick(r, map.name) ?? "",
    brand: pick(r, map.brand),
    gtins: gtinsOf(...(map.gtin ?? []).map((n) => r[lc(n)])),
    skus: nonEmpty(...(map.sku ?? []).map((n) => r[lc(n)])),
    price,
    currency: (pick(r, map.currency) ?? currencyIn(saleText ?? priceText))?.toUpperCase() ?? null,
    packText: pick(r, map.pack),
    inStock: stockOf(pick(r, map.stock)),
    deepLink: link,
    productUrl: urlOrNull(pick(r, map.url)) ?? destinationOf(link),
    imageUrl: urlOrNull(pick(r, map.image)),
    updated: isoDayOf(pick(r, map.updated)) ?? fileUpdated,
    merchant: pick(r, map.merchant),
  };
}

export const FORMATS: Record<string, FeedFormat> = {
  /**
   * Awin publisher feeds (Create-a-Feed, CSV). aw_deep_link is the tracked link and merchant_deep_link (or
   * deep_link) the plain product page, per Awin's "PM Feed Column Descriptions":
   * https://cdn.document360.io/ec9ead62-8ecc-46ef-aac7-9b0a9081b40b/Images/Documentation/PM-FeedColumnDescriptions(1).pdf
   * and https://help.awin.com/developers/docs/hosting-feeds (in_stock: 1 in stock, 0 none; last_updated a date
   * time). search_price is the publisher name for the advertiser's `price`. Advertiser-side names are read too.
   */
  awin: {
    id: "awin",
    docs: ["https://help.awin.com/developers/docs/hosting-feeds", "https://cdn.document360.io/ec9ead62-8ecc-46ef-aac7-9b0a9081b40b/Images/Documentation/PM-FeedColumnDescriptions(1).pdf"],
    parse: "csv",
    map: {
      name: ["product_name"],
      brand: ["brand_name"],
      gtin: ["product_GTIN", "ean", "upc"],
      sku: ["merchant_product_id", "product_id", "aw_product_id"],
      price: ["search_price", "price", "display_price"],
      currency: ["currency"],
      pack: ["product_short_description"],
      stock: ["in_stock", "stock_status", "is_for_sale"],
      link: ["aw_deep_link"],
      url: ["merchant_deep_link", "deep_link"],
      image: ["merchant_image_url", "aw_image_url", "image_url"],
      updated: ["last_updated"],
      merchant: ["merchant_id", "merchant_name"],
    },
  },
  /**
   * Impact catalogue items: the Catalogs API (GET /Mediapartners/{AccountSID}/Catalogs/{CatalogId}/Items, JSON
   * under "Items") or a catalogue file with the same field names. Fields from "The catalog item object":
   * https://integrations.impact.com/impact-publisher/reference/the-catalog-item-object and the endpoints from
   * https://integrations.impact.com/partner-api-reference/reference/catalogs/catalogs. Url is the partner's
   * tracked link; StockAvailability is InStock, OutOfStock or PreOrder. Items carry no update date, so the
   * day the feed was read stands in.
   */
  impact: {
    id: "impact",
    docs: ["https://integrations.impact.com/impact-publisher/reference/the-catalog-item-object", "https://integrations.impact.com/partner-api-reference/reference/catalogs/catalogs"],
    parse: "auto",
    map: {
      name: ["Name"],
      brand: ["Manufacturer", "Brand"],
      gtin: ["Gtin", "Upc", "Ean"],
      sku: ["CatalogItemId", "ParentSku"],
      price: ["OriginalPrice", "CurrentPrice"],
      salePrice: ["CurrentPrice"],
      currency: ["Currency"],
      pack: ["MultiPack", "Size"],
      stock: ["StockAvailability"],
      link: ["Url"],
      image: ["ImageUrl"],
      merchant: ["CampaignName", "CampaignId"],
    },
  },
  /**
   * CJ product feeds. CJ's developer pages (https://developers.cj.com/docs/data-imports/product-feeds and the
   * Product Feed GraphQL reference) need JavaScript and could not be read from here, so these names are NOT
   * confirmed from CJ: they are the Google-style attribute names CJ's feeds follow (id, title, link, image_link,
   * availability, price as "15.00 USD", sale_price, gtin, mpn, brand) in either case, plus the older CJ
   * columns (SKU, NAME, BUYURL, UPC, SALEPRICE, INSTOCK, LASTUPDATED). Check them against the first real file
   * and correct with PRICE_FEED_COLUMNS if they differ.
   */
  cj: {
    id: "cj",
    docs: ["https://developers.cj.com/docs/data-imports/product-feeds (not readable without JavaScript; names unconfirmed)"],
    parse: "auto",
    map: {
      name: ["TITLE", "NAME"],
      brand: ["BRAND", "MANUFACTURER"],
      gtin: ["GTIN", "UPC", "EAN", "ISBN"],
      sku: ["ID", "SKU", "MPN", "MANUFACTURERID"],
      price: ["PRICE", "RETAILPRICE"],
      salePrice: ["SALE_PRICE", "SALEPRICE"],
      currency: ["CURRENCY"],
      pack: ["SIZE", "UNIT_PRICING_MEASURE"],
      stock: ["AVAILABILITY", "INSTOCK"],
      link: ["LINK", "BUYURL"],
      image: ["IMAGE_LINK", "IMAGEURL"],
      updated: ["LAST_UPDATED", "LASTUPDATED"],
      merchant: ["ADVERTISER_ID", "PROGRAM_NAME", "ADVERTISERNAME", "PROGRAMNAME"],
    },
  },
  /**
   * Rakuten Advertising product catalogue, pipe-delimited, no header row: an HDR line, product lines by
   * position, a TRL line. Positions from Rakuten's specification:
   * https://pubhelp.rakutenadvertising.com/hc/en-us/article_attachments/22365119792013 . Product URL (6) is
   * the tracked link; Availability (23) is in-stock, out-of-stock, preorder or backorder; Universal Product
   * Code (24) holds a UPC, EAN or JAN. Rows carry no update date, so the HDR line's deposit time stands in.
   */
  rakuten: {
    id: "rakuten",
    docs: ["https://pubhelp.rakutenadvertising.com/hc/en-us/article_attachments/22365119792013"],
    parse: "csv",
    skipFirstField: /^(HDR|TRL)$/,
    positional: [
      "product id", "product name", "sku number", "primary category", "secondary category", "product url", "product image url",
      "buy url", "short product description", "long product description", "discount", "discount type", "sale price", "retail price",
      "begin date", "end date", "brand", "shipping", "keywords", "manufacturer part #", "manufacturer name", "shipping information",
      "availability", "universal product code", "class id", "currency", "m1", "pixel",
    ],
    map: {
      name: ["product name"],
      brand: ["brand", "manufacturer name"],
      gtin: ["universal product code"],
      sku: ["sku number", "product id"],
      price: ["retail price"],
      salePrice: ["sale price"],
      currency: ["currency"],
      stock: ["availability"],
      link: ["product url", "buy url"],
      image: ["product image url"],
      merchant: [],
    },
  },
  /**
   * FlexOffers product feed (the /products/full web service, JSON). FlexOffers documents its API only to
   * signed-in publishers; the public pages (https://www.flexoffers.com/new-features/sales-reports-deep-links-and-product-feeds-api-updates,
   * https://flexoffers.com/new-features/new-deep-linking-url-structure) name the endpoint and the
   * track.flexlinks.com link but no field names. These names are ASSUMED and unconfirmed: check them against
   * the first real response and correct with PRICE_FEED_COLUMNS.
   */
  flexoffers: {
    id: "flexoffers",
    docs: ["https://www.flexoffers.com/new-features/sales-reports-deep-links-and-product-feeds-api-updates (field names unconfirmed)"],
    parse: "auto",
    map: {
      name: ["name", "productName"],
      brand: ["brand", "manufacturer"],
      gtin: ["gtin", "upc", "ean"],
      sku: ["sku", "pid", "productId", "mpn"],
      price: ["price", "retailPrice"],
      salePrice: ["salePrice", "finalPrice"],
      currency: ["currency", "priceCurrency"],
      pack: ["size"],
      stock: ["stockAvailability", "availability", "inStock", "isInStock"],
      link: ["deepLinkURL", "deepLinkUrl", "linkUrl", "trackingUrl"],
      url: ["productUrl", "merchantUrl"],
      image: ["imageUrl", "imageURL"],
      updated: ["lastUpdated", "lastModified"],
      merchant: ["advertiserId", "advertiserName"],
    },
  },
  /** Any other network: delimited text or JSON, read entirely through PRICE_FEED_COLUMNS. */
  generic: {
    id: "generic",
    docs: ["docs/feeds.md, 'Another network'"],
    parse: "auto",
    map: {},
  },
};

/** Old entries without a network meant Awin; "csv" and "json" are names for the generic reader. */
export const NETWORK_ALIASES: Record<string, string> = { csv: "generic", json: "generic", tsv: "generic" };

/**
 * PRICE_FEED_COLUMNS: one line per feed, `<retailer>@<MARKET>: field=Column; field=Column|Other column`.
 * A line replaces only the fields it names, so it can fix one wrong column of a network's defaults.
 */
export function parseColumnMaps(value: string | undefined): { maps: Map<string, ColumnMap>; problems: string[] } {
  const maps = new Map<string, ColumnMap>();
  const problems: string[] = [];
  for (const [i, line] of (value ?? "").split(/\n+/).map((s) => s.trim()).filter(Boolean).entries()) {
    const m = /^([a-z0-9-]+@[A-Z]{2})\s*:\s*(.+)$/.exec(line);
    if (!m) {
      problems.push(`column map ${i + 1}: expected retailer@MARKET: field=Column; ...`);
      continue;
    }
    const map: ColumnMap = {};
    for (const part of m[2].split(";").map((s) => s.trim()).filter(Boolean)) {
      const eq = part.indexOf("=");
      const field = part.slice(0, eq).trim() as MapField;
      if (eq < 1 || !(MAP_FIELDS as readonly string[]).includes(field)) {
        problems.push(`column map ${i + 1}: unknown field "${part.slice(0, Math.max(eq, 0)) || part}" (known: ${MAP_FIELDS.join(", ")})`);
        continue;
      }
      map[field] = part.slice(eq + 1).split("|").map((s) => s.trim()).filter(Boolean);
    }
    maps.set(m[1], map);
  }
  return { maps, problems };
}

/** A network's map with a feed's own corrections on top. */
export function mapFor(format: FeedFormat, override?: ColumnMap): ColumnMap {
  return { ...format.map, ...(override ?? {}) };
}

/** What a generic feed must name before it can price anything. */
export function missingFields(map: ColumnMap) {
  return (["name", "price", "link"] as const).filter((f) => !map[f]?.length);
}
