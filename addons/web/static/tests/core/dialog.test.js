import { expect, test, describe } from "@odoo/hoot";
import { keyDown, queryAll, queryOne, keyUp, press, drag, resize } from "@odoo/hoot-dom";
import { animationFrame } from "@odoo/hoot-mock";
import { contains, mountWithCleanup } from "@web/../tests/web_test_helpers";
import { makeDialogMockEnv } from "@web/../tests/_framework/env_test_helpers";

import { useService } from "@web/core/utils/hooks";
import { Dialog } from "@web/core/dialog/dialog";

import { Component, useState, onMounted, xml } from "@odoo/owl";

describe.current.tags("desktop");

test("simple rendering", async () => {
    expect.assertions(8);
    class Parent extends Component {
        static components = { Dialog };
        static template = xml`
            <Dialog title="'Wow(l) Effect'">
                Hello!
            </Dialog>
        `;
        static props = ["*"];
    }
    await makeDialogMockEnv();
    await mountWithCleanup(Parent);
    expect(".o_dialog").toHaveCount(1);
    expect(".o_dialog header .modal-title").toHaveCount(1, {
        message: "the header is rendered by default",
    });
    expect(queryOne("header .modal-title").textContent).toBe("Wow(l) Effect");
    expect(".o_dialog main").toHaveCount(1, { message: "a dialog has always a main node" });
    expect(queryOne("main").textContent).toBe(" Hello! ");
    expect(".o_dialog footer").toHaveCount(1, { message: "the footer is rendered by default" });
    expect(".o_dialog footer button").toHaveCount(1, {
        message: "the footer is rendered with a single button 'Ok' by default",
    });
    expect(queryOne("footer button").textContent).toBe("Ok");
});

test("hotkeys work on dialogs", async () => {
    class Parent extends Component {
        static components = { Dialog };
        static template = xml`
            <Dialog title="'Wow(l) Effect'">
                Hello!
            </Dialog>
        `;
        static props = ["*"];
    }
    const env = await makeDialogMockEnv();
    env.dialogData.close = () => expect.step("close");
    env.dialogData.dismiss = () => expect.step("dismiss");
    await mountWithCleanup(Parent);
    expect(queryOne("header .modal-title").textContent).toBe("Wow(l) Effect");
    expect(queryOne("footer button").textContent).toBe("Ok");
    // Same effect as clicking on the x button
    press("escape");
    await animationFrame();
    expect(["dismiss", "close"]).toVerifySteps();
    // Same effect as clicking on the Ok button
    keyDown("control+enter");
    keyUp("ctrl+enter");
    expect(["close"]).toVerifySteps();
});

test("simple rendering with two dialogs", async () => {
    expect.assertions(3);
    class Parent extends Component {
        static template = xml`
            <div>
                <Dialog title="'First Title'">
                    Hello!
                </Dialog>
                <Dialog title="'Second Title'">
                    Hello again!
                </Dialog>
            </div>
        `;
        static props = ["*"];
        static components = { Dialog };
    }
    await makeDialogMockEnv();
    await mountWithCleanup(Parent);
    expect(".o_dialog").toHaveCount(2);
    expect([...queryAll("header .modal-title")].map((el) => el.textContent)).toEqual([
        "First Title",
        "Second Title",
    ]);
    expect([...queryAll(".o_dialog .modal-body")].map((el) => el.textContent)).toEqual([
        " Hello! ",
        " Hello again! ",
    ]);
});

test("click on the button x triggers the service close", async () => {
    expect.assertions(2);
    class Parent extends Component {
        static template = xml`
            <Dialog>
                Hello!
            </Dialog>
        `;
        static props = ["*"];
        static components = { Dialog };
    }
    const env = await makeDialogMockEnv();
    env.dialogData.close = () => expect.step("close");
    env.dialogData.dismiss = () => expect.step("dismiss");
    await mountWithCleanup(Parent);
    expect(".o_dialog").toHaveCount(1);
    await contains(".o_dialog header button.btn-close").click();
    expect(["dismiss", "close"]).toVerifySteps();
});

test("click on the button x triggers the close and dismiss defined by a Child component", async () => {
    expect.assertions(2);
    class Child extends Component {
        static template = xml`<div>Hello</div>`;
        static props = ["*"];

        setup() {
            this.env.dialogData.close = () => expect.step("close");
            this.env.dialogData.dismiss = () => expect.step("dismiss");
        }
    }
    class Parent extends Component {
        static template = xml`
            <Dialog>
                <Child/>
            </Dialog>
        `;
        static props = ["*"];
        static components = { Child, Dialog };
    }
    await makeDialogMockEnv();
    await mountWithCleanup(Parent);
    expect(".o_dialog").toHaveCount(1);

    await contains(".o_dialog header button.btn-close").click();
    expect(["dismiss", "close"]).toVerifySteps();
});

test("click on the default footer button triggers the service close", async () => {
    expect.assertions(2);
    class Parent extends Component {
        static template = xml`
            <Dialog>
                Hello!
            </Dialog>
        `;
        static props = ["*"];
        static components = { Dialog };
    }
    const env = await makeDialogMockEnv();
    env.dialogData.close = () => expect.step("close");
    env.dialogData.dismiss = () => expect.step("dismiss");
    await mountWithCleanup(Parent);
    expect(".o_dialog").toHaveCount(1);

    await contains(".o_dialog footer button").click();
    expect(["close"]).toVerifySteps();
});

test("render custom footer buttons is possible", async () => {
    expect.assertions(2);
    class SimpleButtonsDialog extends Component {
        static components = { Dialog };
        static template = xml`
            <Dialog>
                content
                <t t-set-slot="footer">
                    <div>
                        <button class="btn btn-primary">The First Button</button>
                        <button class="btn btn-primary">The Second Button</button>
                    </div>
                </t>
            </Dialog>
        `;
        static props = ["*"];
    }
    class Parent extends Component {
        static template = xml`
              <div>
                  <SimpleButtonsDialog/>
              </div>
          `;
        static props = ["*"];
        static components = { SimpleButtonsDialog };
        setup() {
            super.setup();
            this.state = useState({
                displayDialog: true,
            });
        }
    }
    await makeDialogMockEnv();
    await mountWithCleanup(Parent);
    expect(".o_dialog").toHaveCount(1);
    expect(".o_dialog footer button").toHaveCount(2);
});

test("embed an arbitrary component in a dialog is possible", async () => {
    expect.assertions(4);
    class SubComponent extends Component {
        static template = xml`
            <div class="o_subcomponent" t-esc="props.text" t-on-click="_onClick"/>
        `;
        static props = ["*"];
        _onClick() {
            expect.step("subcomponent-clicked");
            this.props.onClicked();
        }
    }
    class Parent extends Component {
        static components = { Dialog, SubComponent };
        static template = xml`
            <Dialog>
                <SubComponent text="'Wow(l) Effect'" onClicked="_onSubcomponentClicked"/>
            </Dialog>
        `;
        static props = ["*"];
        _onSubcomponentClicked() {
            expect.step("message received by parent");
        }
    }
    await makeDialogMockEnv();
    await mountWithCleanup(Parent);
    expect(".o_dialog").toHaveCount(1);
    expect(".o_dialog main .o_subcomponent").toHaveCount(1);
    expect(queryOne(".o_subcomponent").textContent).toBe("Wow(l) Effect");
    await contains(".o_subcomponent").click();
    expect(["subcomponent-clicked", "message received by parent"]).toVerifySteps();
});

test("dialog without header/footer", async () => {
    expect.assertions(4);
    class Parent extends Component {
        static components = { Dialog };
        static template = xml`
            <Dialog header="false" footer="false">content</Dialog>
        `;
        static props = ["*"];
    }
    await makeDialogMockEnv();
    await mountWithCleanup(Parent);
    expect(".o_dialog").toHaveCount(1);
    expect(".o_dialog header").toHaveCount(0);
    expect("main").toHaveCount(1, { message: "a dialog has always a main node" });
    expect(".o_dialog footer").toHaveCount(0);
});

test("dialog size can be chosen", async () => {
    expect.assertions(5);
    class Parent extends Component {
        static template = xml`
            <div>
                <Dialog contentClass="'xl'" size="'xl'">content</Dialog>
                <Dialog contentClass="'lg'">content</Dialog>
                <Dialog contentClass="'md'" size="'md'">content</Dialog>
                <Dialog contentClass="'sm'" size="'sm'">content</Dialog>
            </div>
        `;
        static props = ["*"];
        static components = { Dialog };
    }
    await makeDialogMockEnv();
    await mountWithCleanup(Parent);
    expect(".o_dialog").toHaveCount(4);
    expect(".o_dialog .modal-dialog.modal-xl .xl").toHaveCount(1);
    expect(".o_dialog .modal-dialog.modal-lg .lg").toHaveCount(1);
    expect(".o_dialog .modal-dialog.modal-md .md").toHaveCount(1);
    expect(".o_dialog .modal-dialog.modal-sm .sm").toHaveCount(1);
});

test("dialog can be rendered on fullscreen", async () => {
    expect.assertions(2);
    class Parent extends Component {
        static template = xml`
            <Dialog fullscreen="true">content</Dialog>
        `;
        static props = ["*"];
        static components = { Dialog };
    }
    await makeDialogMockEnv();
    await mountWithCleanup(Parent);
    expect(".o_dialog").toHaveCount(1);
    expect(".o_dialog .modal").toHaveClass("o_modal_full");
});

test("can be the UI active element", async () => {
    expect.assertions(4);
    class Parent extends Component {
        static template = xml`<Dialog>content</Dialog>`;
        static props = ["*"];
        static components = { Dialog };
        setup() {
            this.ui = useService("ui");
            expect(this.ui.activeElement).toBe(document, {
                message:
                    "UI active element should be the default (document) as Parent is not mounted yet",
            });
            onMounted(() => {
                expect(".modal").toHaveCount(1);
                expect(this.ui.activeElement).toBe(
                    queryOne(".modal", { message: "UI active element should be the dialog modal" })
                );
            });
        }
    }
    const env = await makeDialogMockEnv();
    const parent = await mountWithCleanup(Parent);
    parent.__owl__.app.destroy();
    expect(env.services.ui.activeElement).toBe(document, {
        message: "UI owner should be reset to the default (document)",
    });
});

test("dialog can be moved", async () => {
    class Parent extends Component {
        static template = xml`<Dialog>content</Dialog>`;
        static props = ["*"];
        static components = { Dialog };
    }
    await makeDialogMockEnv();
    await mountWithCleanup(Parent);
    expect(".modal-content").toHaveStyle({
        top: "0px",
        left: "0px",
    });

    const header = queryOne(".modal-header");
    const headerRect = header.getBoundingClientRect();
    drag(header).drop(".modal-content", {
        position: {
            // the util function sets the source coordinates at (x; y) + (w/2; h/2)
            // so we need to move the dialog based on these coordinates.
            x: headerRect.x + headerRect.width / 2 + 20,
            y: headerRect.y + headerRect.height / 2 + 50,
        },
    });
    await animationFrame();
    expect(".modal-content").toHaveStyle({
        top: "50px",
        left: "20px",
    });
});

test("dialog's position is reset on resize", async () => {
    class Parent extends Component {
        static template = xml`<Dialog>content</Dialog>`;
        static props = ["*"];
        static components = { Dialog };
    }
    await makeDialogMockEnv();
    await mountWithCleanup(Parent);
    expect(".modal-content").toHaveStyle({
        top: "0px",
        left: "0px",
    });

    const header = queryOne(".modal-header");
    const headerRect = header.getBoundingClientRect();
    drag(header).drop(".modal-content", {
        position: {
            // the util function sets the source coordinates at (x; y) + (w/2; h/2)
            // so we need to move the dialog based on these coordinates.
            x: headerRect.x + headerRect.width / 2 + 20,
            y: headerRect.y + headerRect.height / 2 + 50,
        },
    });
    await animationFrame();
    expect(".modal-content").toHaveStyle({
        top: "50px",
        left: "20px",
    });

    resize(window, "resize");
    await animationFrame();
    expect(".modal-content").toHaveStyle({
        top: "0px",
        left: "0px",
    });
});
