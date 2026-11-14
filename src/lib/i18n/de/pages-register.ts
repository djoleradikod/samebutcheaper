/** Makes the German page sections available to clientT() on the server, as ./client-register does for the shared ones. */
import { registerPageSections } from "../client-dict";
import * as dePages from "./pages";

registerPageSections("de", dePages);

export const registered = true;
