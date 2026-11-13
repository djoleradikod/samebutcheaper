import { Fragment, type ReactNode } from "react";

/**
 * A sentence from a dictionary with pieces of the page in it: rich("Delivery {fee}.", { fee: <Money ... /> }). The
 * dictionaries stay plain strings, each language puts the pieces where its grammar wants them, and the text around
 * them reads exactly as written. A name with no piece given is left out.
 */
export function rich(text: string, nodes: Record<string, ReactNode>): ReactNode {
  return text.split(/\{(\w+)\}/).map((part, i) => (i % 2 ? <Fragment key={i}>{nodes[part]}</Fragment> : part));
}
