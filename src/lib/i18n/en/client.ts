/**
 * Words used by client components and by pure helpers they share with the server. These sections and their German twin
 * (../de/client.ts) are the only dictionary text that reaches the browser, so keep them to what runs there.
 *
 * One file per section (./client/<section>.ts). A client component imports only the sections it uses and hands them to
 * useT() or clientT() (../client-dict.ts), so a page ships only its own components' English. This file gathers them for
 * the whole dictionary's type and for server code.
 *
 * Countries and markets are passed as codes ("GB"), so each language can put them in its own grammar ("in the UK",
 * "im Vereinigten Königreich").
 */
export { shared } from "./client/shared";
export { picker } from "./client/picker";
export { marketTag } from "./client/marketTag";
export { where } from "./client/where";
export { yearly } from "./client/yearly";
export { calculator } from "./client/calculator";
export { save } from "./client/save";
export { feedback } from "./client/feedback";
export { unitPrice } from "./client/unitPrice";
export { cards } from "./client/cards";
export { delivery } from "./client/delivery";
export { newsletter } from "./client/newsletter";
export { kits } from "./client/kits";
export { browse } from "./client/browse";
export { myList } from "./client/myList";
export { search } from "./client/search";
