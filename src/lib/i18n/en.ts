/**
 * The English dictionary, which sets the shape every other language must match (see t.ts). Each namespace lives in
 * en/<area>.ts; client.ts holds the few that run in the browser. Server code reads this through getT() in index.ts.
 */
import * as client from "./en/client";
import * as site from "./en/site";
import * as swap from "./en/swap";

export const en = { ...swap, ...client, ...site };

export type Dictionary = typeof en;
export type ClientDictionary = typeof client;
