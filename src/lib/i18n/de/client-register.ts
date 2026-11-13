/** Makes the German client text available to clientT(). Imported by ../index on the server and loaded by `Html` on German pages. */
import { registerClientDict } from "../client-dict";
import * as deClient from "./client";

registerClientDict("de", deClient);

export const registered = true;
