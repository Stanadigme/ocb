import { EventBus } from "@odoo/owl";
import { browser } from "./browser/browser";

export const ScrollerBus = new EventBus();

browser.addEventListener("click", (ev) => {
    const href = ev.target.closest("a")?.getAttribute("href");
    if (href && href === "#") {
        ev.preventDefault(); // single hash in href are just a way to activate A-tags node
        return;
    }
});
