/** @odoo-module */

import { Component } from "@odoo/owl";

/**
 * @typedef {Object} Category
 * @property {number} id
 * @property {string?} name
 * @property {string?} icon
 * @property {string?} separator
 */
export class CategorySelector extends Component {
    static template = "point_of_sale.CategorySelector";
    static props = {
        categories: {
            type: Array,
            element: Object,
            shape: {
                id: Number,
                name: { type: String, optional: true },
                color: { type: Number, optional: true },
                imgSrc: String,
                icon: { type: String, optional: true },
                showSeparator: { type: Boolean, optional: true },
            },
        },
        class: { type: String, optional: true },
        onClick: { type: Function },
    };
    static defaultProps = {
        class: "",
    };
}
