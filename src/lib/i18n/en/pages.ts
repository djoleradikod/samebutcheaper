/**
 * Page sections: the words of one page's client components (the basket stepper, the buying list, the shopping-list
 * check, my list, search, the product check's form). A component imports only its own (./pages/<section>.ts) and hands
 * it to useT() with its German loader, so neither language ships to a page that doesn't use it. Names start with
 * "page", which is how useT() tells them from the shared client sections (./client.ts).
 */
export { pageBasket } from "./pages/basket";
export { pageCheckout } from "./pages/checkout";
export { pageKitWhere } from "./pages/kitWhere";
