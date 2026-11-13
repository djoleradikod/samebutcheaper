/**
 * The typed `t()`. A dictionary is a tree of namespaces whose leaves are strings or functions (for numbers, plurals,
 * names and links). The English dictionary sets the shape; every other language is typed `Shape<typeof en>`, so a
 * missing key, an extra key or a function with other arguments fails `tsc`.
 *
 *   const t = getT("de");
 *   t("swap.shelf.brand")                 // "Die Marke"
 *   t("swap.verdict.identical_active", "Ratiopharm", "Aspirin")
 *
 * Keys are dotted paths, checked by the compiler; arguments are the leaf function's own.
 */

/** A leaf: a string, or a function that builds one (or a node with links in it). */
type Leaf = string | ((...args: never[]) => unknown);

/** Another language's dictionary: the same keys, strings for strings, the same function types. */
export type Shape<T> = {
  [K in keyof T]: T[K] extends string ? string : T[K] extends (...args: infer A) => infer R ? (...args: A) => R : Shape<T[K]>;
};

/** Every dotted path to a leaf. */
export type Key<T> = {
  [K in keyof T & string]: T[K] extends Leaf ? K : `${K}.${Key<T[K]>}`;
}[keyof T & string];

/** The leaf at a dotted path. */
export type At<T, P extends string> = P extends `${infer H}.${infer R}`
  ? H extends keyof T
    ? At<T[H], R>
    : never
  : P extends keyof T
    ? T[P]
    : never;

type ArgsOf<L> = L extends (...args: infer A) => unknown ? A : [];
type ResultOf<L> = L extends (...args: never[]) => infer R ? R : string;

export type TFn<D> = <P extends Key<D>>(key: P, ...args: ArgsOf<At<D, P>>) => ResultOf<At<D, P>>;

/** A `t()` over one dictionary. A key the dictionary lacks throws, which typecheck already rules out. */
export function makeT<D>(dict: D): TFn<D> {
  return ((key: string, ...args: unknown[]) => {
    let node: unknown = dict;
    for (const part of key.split(".")) node = (node as Record<string, unknown> | undefined)?.[part];
    if (typeof node === "function") return (node as (...a: unknown[]) => unknown)(...args);
    if (typeof node === "string") return node;
    throw new Error(`No text for "${key}"`);
  }) as TFn<D>;
}
