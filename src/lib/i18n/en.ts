/**
 * The English dictionary, which sets the shape every other language must match (see t.ts). Each namespace lives in
 * en/<area>.ts; client.ts holds the few shared ones that run in the browser and pages.ts the page sections their own
 * client components load. Server code reads this through getT() in index.ts.
 */
import * as client from "./en/client";
import * as email from "./en/email";
import * as kit from "./en/kit";
import * as pages from "./en/pages";
import * as site from "./en/site";
import * as swap from "./en/swap";
import * as tools from "./en/tools";

export const en = { ...swap, ...client, ...pages, ...kit, ...tools, ...email, ...site };

export type Dictionary = typeof en;
export type ClientDictionary = typeof client;
export type PageClientDictionary = typeof pages;
