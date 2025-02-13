import { beforeEach, expect, getFixture, test } from "@odoo/hoot";
import { manuallyDispatchProgrammaticEvent, press } from "@odoo/hoot-dom";
import { Deferred, animationFrame } from "@odoo/hoot-mock";
import { contains, makeMockEnv, mountWithCleanup, patchWithCleanup } from "../../web_test_helpers";

import { Component, reactive, xml } from "@odoo/owl";

import { useCommand } from "@web/core/commands/command_hook";
import { registry } from "@web/core/registry";
import { useActiveElement } from "@web/core/ui/ui_service";
import { HotkeyCommandItem } from "@web/core/commands/default_providers";
import { browser } from "@web/core/browser/browser";

class TestComponent extends Component {
    static template = xml`<div />`;
    static props = ["*"];
}

class Parent extends Component {
    static template = xml`
      <t t-component="props.componentInfo.Component" t-if="props.componentInfo.Component" />
    `;
    static props = ["*"];
}

const commandProviderRegistry = registry.category("command_provider");
const commandSetupRegistry = registry.category("command_setup");

let env;
beforeEach(async () => {
    commandProviderRegistry.getEntries().forEach(([key]) => {
        if (!["command", "data-hotkeys", "default"].includes(key)) {
            commandProviderRegistry.remove(key);
        }
    });
    commandSetupRegistry.getEntries().forEach(([key]) => {
        if (!["command", "data-hotkeys", "default"].includes(key)) {
            commandSetupRegistry.remove(key);
        }
    });
    env = await makeMockEnv();
    const commandCategoryRegistry = registry.category("command_categories");
    // Adding default last. The order of insertion of categories matters
    commandCategoryRegistry.remove("default");
    commandCategoryRegistry.add("custom-nolabel", {}).add("custom", {}).add("default", {});
});

test("commands evilness 👹", async () => {
    const command = env.services.command;
    function action() {}

    expect(function () {
        command.add();
    }).toThrow(/A Command must have a name and an action function/);
    expect(function () {
        command.add(null);
    }).toThrow(/A Command must have a name and an action function/);
    expect(function () {
        command.add("");
    }).toThrow(/A Command must have a name and an action function/);
    expect(function () {
        command.add("", action);
    }).toThrow(/A Command must have a name and an action function/);
    expect(function () {
        command.add("command", null);
    }).toThrow(/A Command must have a name and an action function/);
});

test("useCommand hook", async () => {
    class MyComponent extends TestComponent {
        setup() {
            useCommand("Take the throne", () => {
                expect.step("Hodor");
            });
        }
    }
    const componentInfo = reactive({ Component: MyComponent });
    await mountWithCleanup(Parent, { props: { componentInfo } });

    press("Control+k");
    await animationFrame();
    expect(".o_command").toHaveCount(1);
    expect(".o_command").toHaveText("Take the throne");

    await contains(".o_command").click();
    expect(["Hodor"]).toVerifySteps();

    componentInfo.Component = null;
    await animationFrame();

    press("Control+k");
    await animationFrame();
    expect(".o_command").toHaveCount(0);
});

test("useCommand hook when the activeElement change", async () => {
    class MyComponent extends TestComponent {
        setup() {
            useCommand("Take the throne", () => {});
            useCommand("Lose the throne", () => {}, { global: true });
        }
    }

    class OtherComponent extends Component {
        static template = xml`<div t-ref="active"><div tabindex="1">visible</div></div>`;
        static props = ["*"];
        setup() {
            useActiveElement("active");
            useCommand("I'm taking the throne", () => {});
        }
    }

    await mountWithCleanup(MyComponent);
    press("Control+k");
    await animationFrame();
    expect(".o_command").toHaveCount(2);
    expect([...getFixture().querySelectorAll(".o_command")].map((e) => e.textContent)).toEqual([
        "Take the throne",
        "Lose the throne",
    ]);
    press("escape");
    await animationFrame();

    await mountWithCleanup(OtherComponent, { noMainContainer: true });
    press("Control+k");
    await animationFrame();
    expect(".o_command").toHaveCount(2);
    expect([...getFixture().querySelectorAll(".o_command")].map((e) => e.textContent)).toEqual([
        "Lose the throne",
        "I'm taking the throne",
    ]);
});

test("useCommand hook with isAvailable", async () => {
    let available = false;
    class MyComponent extends TestComponent {
        setup() {
            useCommand("Take the throne", () => {}, {
                isAvailable: () => {
                    return available;
                },
            });
        }
    }
    await mountWithCleanup(MyComponent);

    press("Control+k");
    await animationFrame();
    expect(".o_command_palette").toHaveCount(1);
    expect(".o_command").toHaveCount(0);

    press("escape");
    await animationFrame();
    available = true;
    press("Control+k");
    await animationFrame();
    expect(".o_command_palette").toHaveCount(1);
    expect(".o_command").toHaveCount(1);
});

test("command with hotkey", async () => {
    const hotkey = "a";
    env.services.command.add("test", () => expect.step(hotkey), {
        hotkey,
    });
    await animationFrame();

    press("a");
    expect([hotkey]).toVerifySteps();
});

test("global command with hotkey", async () => {
    const globalHotkey = "a";
    env.services.command.add("testA", () => expect.step(globalHotkey), {
        global: true,
        hotkey: globalHotkey,
    });
    const hotkey = "b";
    env.services.command.add("testB", () => expect.step(hotkey), {
        hotkey,
    });
    await animationFrame();

    press("a");
    expect([globalHotkey]).toVerifySteps();
    press("b");
    expect([hotkey]).toVerifySteps();

    class MyComponent extends Component {
        static template = xml`<div t-ref="active"><button>visible</button></div>`;
        static props = ["*"];
        setup() {
            useActiveElement("active");
        }
    }
    await mountWithCleanup(MyComponent);

    press("a");
    press("b");
    expect([globalHotkey]).toVerifySteps();
});

test("command with hotkey and isAvailable", async () => {
    const hotkey = "a";
    let isAvailable = false;
    env.services.command.add("test", () => expect.step(hotkey), {
        hotkey,
        isAvailable: () => isAvailable,
    });

    press("a");
    await animationFrame();
    expect([]).toVerifySteps();

    isAvailable = true;
    press("a");
    await animationFrame();
    expect([hotkey]).toVerifySteps();
});

test("useCommand hook with hotkey and hotkeyOptions", async () => {
    const allowRepeatKey = "a";
    const disallowRepeatKey = "b";
    const defaultBehaviourKey = "c";
    class MyComponent extends TestComponent {
        setup() {
            useCommand("Allow repeat key", () => expect.step(allowRepeatKey), {
                hotkey: allowRepeatKey,
                hotkeyOptions: {
                    allowRepeat: true,
                },
            });
            useCommand("Disallow repeat key", () => expect.step(disallowRepeatKey), {
                hotkey: disallowRepeatKey,
                hotkeyOptions: {
                    allowRepeat: false,
                },
            });
            useCommand("Default repeat key", () => expect.step(defaultBehaviourKey), {
                hotkey: defaultBehaviourKey,
            });
        }
    }
    await mountWithCleanup(MyComponent);

    // Dispatch the three keys without repeat:
    press(allowRepeatKey);
    press(disallowRepeatKey);
    press(defaultBehaviourKey);
    await animationFrame();

    expect([allowRepeatKey, disallowRepeatKey, defaultBehaviourKey]).toVerifySteps();

    // Dispatch the three keys with repeat:
    const fixture = getFixture();
    manuallyDispatchProgrammaticEvent(fixture, "keydown", { repeat: true, key: allowRepeatKey });
    manuallyDispatchProgrammaticEvent(fixture, "keydown", { repeat: true, key: disallowRepeatKey });
    manuallyDispatchProgrammaticEvent(fixture, "keydown", {
        repeat: true,
        key: defaultBehaviourKey,
    });

    await animationFrame();

    expect([allowRepeatKey]).toVerifySteps();
});

test("useCommand hook with hotkey and isAvailable", async () => {
    const hotkeys = ["a", "b", "c", "d", "e"];
    class MyComponent extends TestComponent {
        setup() {
            useCommand("Command 1", () => expect.step(hotkeys[0]), {
                hotkey: hotkeys[0],
                isAvailable: () => true,
                hotkeyOptions: {
                    allowRepeat: true,
                    isAvailable: () => true,
                },
            });
            useCommand("Command 2", () => expect.step(hotkeys[1]), {
                hotkey: hotkeys[1],
                isAvailable: () => true,
                hotkeyOptions: {
                    allowRepeat: true,
                    isAvailable: () => false,
                },
            });
            useCommand("Command 3", () => expect.step(hotkeys[2]), {
                hotkey: hotkeys[2],
                isAvailable: () => false,
                hotkeyOptions: {
                    allowRepeat: true,
                    isAvailable: () => true,
                },
            });
            useCommand("Command 4", () => expect.step(hotkeys[3]), {
                hotkey: hotkeys[3],
                isAvailable: () => true,
                hotkeyOptions: {
                    allowRepeat: true,
                },
            });
            useCommand("Command 5", () => expect.step(hotkeys[4]), {
                hotkey: hotkeys[4],
                isAvailable: () => false,
                hotkeyOptions: {
                    allowRepeat: true,
                },
            });
        }
    }
    await mountWithCleanup(MyComponent);

    for (const hotkey of hotkeys) {
        press(hotkey);
    }
    await animationFrame();
    expect(["a", "d"]).toVerifySteps();

    press("Control+k");
    await animationFrame();
    expect(".o_command_palette").toHaveCount(1);
    expect(".o_command").toHaveCount(3);
    expect([...getFixture().querySelectorAll(".o_command")].map((el) => el.textContent)).toEqual([
        "Command 1A",
        "Command 2B",
        "Command 4D",
    ]);
});

test("open command palette with command config", async () => {
    const hotkey = "alt+a";
    const action = () => {};
    const provide = () => [
        {
            name: "Command1",
            action,
        },
    ];
    const providers = [{ provide }];
    env.services.command.add(
        "test",
        () => {
            return {
                providers,
            };
        },
        {
            hotkey,
        }
    );

    await mountWithCleanup(TestComponent);

    press("alt+a");
    await animationFrame();
    expect(".o_command").toHaveCount(1);
    expect(
        [...getFixture().querySelectorAll(".o_command span:first-child")].map(
            (el) => el.textContent
        )
    ).toEqual(["Command1"]);
});

test("data-hotkey added to command palette", async () => {
    class MyComponent extends Component {
        static components = { TestComponent };
        static template = xml`
            <div>
                <button title="Aria Stark" data-hotkey="a" t-on-click="onClick">visible</button>
                <input title="Bran Stark" type="text" data-hotkey="b" />
                <button title="Sansa Stark" data-hotkey="c" style="display: none;" />
                <TestComponent />
            </div>
        `;
        static props = ["*"];
        onClick() {
            expect.step("Hodor");
        }
    }
    await mountWithCleanup(MyComponent);

    // Open palette
    press("Control+k");
    await animationFrame();

    expect(".o_command").toHaveCount(2);
    expect(
        [...getFixture().querySelectorAll(".o_command span:first-child")].map(
            (el) => el.textContent
        )
    ).toEqual(["Aria stark", "Bran stark"]);

    // Click on first command
    await contains("#o_command_0").click();
    expect(".o_command_palette").toHaveCount(0);

    // Reopen palette
    press("Control+k");
    await animationFrame();

    // Click on second command
    expect(document.activeElement).not.toBe(
        getFixture().querySelector("input[title='Bran Stark']")
    );
    await contains("#o_command_1").click();
    expect(".o_command_palette").toHaveCount(0);
    expect(document.activeElement).toBe(getFixture().querySelector("input[title='Bran Stark']"));

    // only step should come from the first command execution
    expect(["Hodor"]).toVerifySteps();
});

test("access to hotkeys from the command palette", async () => {
    const hotkey = "a";
    env.services.command.add("A", () => expect.step("A"), {
        hotkey,
    });

    class MyComponent extends Component {
        static components = { TestComponent };
        static template = xml`
            <div>
                <button title="B" data-hotkey="b" t-on-click="onClickB">visible</button>
                <button title="C" data-hotkey="c" t-on-click="onClickC">visible</button>
                <TestComponent />
            </div>
        `;
        static props = ["*"];
        onClickB() {
            expect.step("B");
        }
        onClickC() {
            expect.step("C");
        }
    }
    await mountWithCleanup(MyComponent);

    // Open palette
    press("Control+k");
    await animationFrame();

    expect(".o_command").toHaveCount(3);
    expect(
        [...getFixture().querySelectorAll(".o_command span:first-child")].map(
            (el) => el.textContent
        )
    ).toEqual(["A", "B", "C"]);

    // Trigger the command a
    press("a");
    await animationFrame();
    expect(".o_command_palette").toHaveCount(0);

    // Reopen palette
    press("Control+k");
    await animationFrame();

    // Trigger the command b
    press("alt+b");
    await animationFrame();
    expect(".o_command_palette").toHaveCount(0);

    // Reopen palette
    press("Control+k");
    await animationFrame();

    // Trigger the command c
    press("alt+c");
    await animationFrame();
    expect(".o_command_palette").toHaveCount(0);

    expect(["A", "B", "C"]).toVerifySteps();
});

test("can be searched", async () => {
    await mountWithCleanup(TestComponent);

    // Register some commands
    function action() {}
    const names = ["Cersei Lannister", "Jaime Lannister", "Tyrion Lannister", "Tywin Lannister"];
    for (const name of names) {
        env.services.command.add(name, action);
    }
    await animationFrame();

    // Open palette
    press("Control+k");
    await animationFrame();

    expect(".o_command_palette_search input").toHaveValue("");

    expect([...getFixture().querySelectorAll(".o_command")].map((el) => el.textContent)).toEqual(
        names
    );

    // Search something
    await contains(".o_command_palette_search input").edit("jl", { confirm: false });
    await animationFrame();

    expect([...getFixture().querySelectorAll(".o_command")].map((el) => el.textContent)).toEqual([
        "Jaime Lannister",
    ]);

    // Clear search input
    await contains(".o_command_palette_search input").edit("", { confirm: false });
    await animationFrame();

    expect([...getFixture().querySelectorAll(".o_command")].map((el) => el.textContent)).toEqual(
        names
    );
});

test("configure the empty message based on the namespace", async () => {
    commandProviderRegistry.add(
        "default",
        {
            namespace: "default",
            provide: () => [],
        },
        { force: true }
    );

    commandProviderRegistry.add("@", {
        namespace: "@",
        provide: () => [],
    });

    commandSetupRegistry.add(
        "default",
        {
            emptyMessage: "Empty Default",
        },
        { force: true }
    );
    commandSetupRegistry.add("@", {
        emptyMessage: "Empty @",
    });
    await Promise.resolve();

    await mountWithCleanup(TestComponent);

    // Open palette
    press("Control+k");
    await animationFrame();

    expect(".o_command_palette_listbox_empty").toHaveText("Empty Default");

    await contains(".o_command_palette_search input").edit("@", { confirm: false });
    await animationFrame();
    expect(".o_command_palette_listbox_empty").toHaveText("Empty @");
});

test("footer displays the right tips", async () => {
    commandProviderRegistry.add(
        "default",
        {
            namespace: "default",
            provide: () => [],
        },
        { force: true }
    );

    commandProviderRegistry.add("@", {
        namespace: "@",
        provide: () => [],
    });

    commandProviderRegistry.add("!", {
        namespace: "!",
        provide: () => [],
    });

    commandProviderRegistry.add("#", {
        namespace: "#",
        provide: () => [],
    });

    commandSetupRegistry.remove("/");
    commandSetupRegistry.add("default", {}, { force: true });
    commandSetupRegistry.add("@", {
        name: "FirstName",
    });

    await mountWithCleanup(TestComponent);

    // Open palette
    press("Control+k");
    await animationFrame();
    expect(".o_command_palette_footer").toHaveText("TIP — search for @FirstName");

    // Close palette
    press("escape");
    commandSetupRegistry.add("!", {
        name: "SecondName",
    });
    // Open palette
    press("Control+k");
    await animationFrame();
    expect(".o_command_palette_footer").toHaveText("TIP — search for @FirstName and !SecondName");

    // Close palette
    press("escape");
    commandSetupRegistry.add("#", {
        name: "ThirdName",
    });
    // Open palette
    press("Control+k");
    await animationFrame();
    expect(".o_command_palette_footer").toHaveText(
        "TIP — search for @FirstName, !SecondName and #ThirdName"
    );
});

test("namespaces display in the footer are still clickable", async () => {
    const action = () => {};
    commandProviderRegistry.add("@", {
        namespace: "@",
        provide: () => [
            {
                name: "Command@",
                action,
            },
        ],
    });
    commandProviderRegistry.add("#", {
        namespace: "#",
        provide: () => [
            {
                name: "Command#",
                action,
            },
        ],
    });

    commandSetupRegistry.add("default", {}, { force: true });
    commandSetupRegistry.add("@", {
        name: "users",
    });
    commandSetupRegistry.add("#", {
        name: "channels",
    });
    await mountWithCleanup(TestComponent);

    // Open palette
    press("Control+k");
    await animationFrame();
    expect(".o_command_palette_footer").toHaveText("TIP — search for @users and #channels");
    expect([...getFixture().querySelectorAll(".o_command")].map((el) => el.textContent)).toEqual(
        []
    );

    await contains(".o_command_palette_footer .o_namespace").click();
    await animationFrame();
    expect(".o_command_palette_search .o_namespace").toHaveText("@");
    expect(".o_command_palette_search input").toHaveValue("");
    expect([...getFixture().querySelectorAll(".o_command")].map((el) => el.textContent)).toEqual([
        "Command@",
    ]);

    await contains(".o_command_palette_search input").edit("Com", { confirm: false });
    await contains(".o_command_palette_footer .o_namespace:eq(1)").click();
    await animationFrame();
    expect(".o_command_palette_search .o_namespace").toHaveText("#");
    expect(".o_command_palette_search input").toHaveValue("Com");
    expect([...getFixture().querySelectorAll(".o_command")].map((el) => el.textContent)).toEqual([
        "Command#",
    ]);

    await contains(".o_command_palette_footer .o_namespace:eq(0)").click();
    await animationFrame();
    expect(".o_command_palette_search .o_namespace").toHaveText("@");
    expect(".o_command_palette_search input").toHaveValue("Com");
    expect([...getFixture().querySelectorAll(".o_command")].map((el) => el.textContent)).toEqual([
        "Command@",
    ]);
});

test("defined multiple providers with the same namespace", async () => {
    const action = () => {};

    const defaultNames = ["John", "Snow"];
    commandProviderRegistry.add("default", {
        namespace: "default",
        provide: () =>
            defaultNames.map((name) => ({
                action,
                name,
            })),
    });

    const otherNames = ["Cersei", "Lannister"];
    commandProviderRegistry.add("other", {
        provide: () =>
            otherNames.map((name) => ({
                action,
                name,
            })),
    });

    await mountWithCleanup(TestComponent);

    // Open palette
    press("Control+k");
    await animationFrame();
    await animationFrame();
    expect(".o_command_palette_search input").toHaveValue("");

    expect([...getFixture().querySelectorAll(".o_command")].map((el) => el.textContent)).toEqual(
        defaultNames.concat(otherNames)
    );
});

test("can switch between command providers", async () => {
    const action = () => {};

    const defaultNames = ["John", "Snow"];
    commandProviderRegistry.add("default", {
        provide: () =>
            defaultNames.map((name) => ({
                action,
                name,
            })),
    });

    const otherNames = ["Cersei", "Lannister"];
    commandProviderRegistry.add("other", {
        namespace: "@",
        provide: () =>
            otherNames.map((name) => ({
                action,
                name,
            })),
    });

    await mountWithCleanup(TestComponent);

    // Open palette
    press("Control+k");
    await animationFrame();

    expect(".o_command_palette_search input").toHaveValue("");

    expect([...getFixture().querySelectorAll(".o_command")].map((el) => el.textContent)).toEqual(
        defaultNames
    );

    // Switch to the other provider
    await contains(".o_command_palette_search input").edit("@", { confirm: false });

    expect([...getFixture().querySelectorAll(".o_command")].map((el) => el.textContent)).toEqual(
        otherNames
    );

    // Press backspace to recover the default provider
    press("backspace");
    await animationFrame();

    expect([...getFixture().querySelectorAll(".o_command")].map((el) => el.textContent)).toEqual(
        defaultNames
    );
});

test("multi level commands", async () => {
    const defaultNames = ["John", "Snow"];
    const otherNames = ["Cersei", "Lannister"];
    const configByNamespace = {
        default: {
            placeholder: "Who is the next King ?",
        },
    };
    const action = () => ({
        configByNamespace,
        providers: [
            {
                provide: () =>
                    otherNames.map((name) => ({
                        name,
                        action: () => {},
                    })),
            },
        ],
    });

    commandProviderRegistry.add("default", {
        provide: () =>
            defaultNames.map((name) => ({
                action,
                name,
            })),
    });

    await mountWithCleanup(TestComponent);

    // Open palette
    press("Control+k");
    await animationFrame();

    expect(".o_command_palette_search input").toHaveValue("");
    expect(".o_command_palette_search input").toHaveProperty(
        "placeholder",
        "Search for a command..."
    );

    expect([...getFixture().querySelectorAll(".o_command")].map((el) => el.textContent)).toEqual(
        defaultNames
    );

    await contains(".o_command.focused").click();
    await animationFrame();

    expect(".o_command_palette_search input").toHaveProperty(
        "placeholder",
        "Who is the next King ?"
    );

    expect([...getFixture().querySelectorAll(".o_command")].map((el) => el.textContent)).toEqual(
        otherNames
    );
});

test("multi level commands with hotkey", async () => {
    const otherNames = ["Cersei", "Lannister"];
    const configByNamespace = {
        default: {
            placeholder: "Who is the next King ?",
        },
    };
    const action = () => ({
        configByNamespace,
        providers: [
            {
                provide: () =>
                    otherNames.map((name) => ({
                        name,
                        action: () => {},
                    })),
            },
        ],
    });

    const hotkey = "a";
    const name = "John";
    commandProviderRegistry.add("default", {
        provide: () => [
            {
                Component: HotkeyCommandItem,
                action,
                name,
                props: {
                    hotkey,
                },
            },
        ],
    });

    await mountWithCleanup(TestComponent);

    // Open palette
    press("Control+k");
    await animationFrame();
    expect(".o_command_palette_search input").toHaveValue("");
    expect(".o_command_palette_search input").toHaveProperty(
        "placeholder",
        "Search for a command..."
    );

    expect(
        [...getFixture().querySelectorAll(".o_command")].map((el) => el.textContent.toLowerCase())
    ).toEqual([(name + hotkey).toLowerCase()]);

    press("a");
    await animationFrame();

    expect(".o_command_palette_search input").toHaveProperty(
        "placeholder",
        "Who is the next King ?"
    );

    expect([...getFixture().querySelectorAll(".o_command")].map((el) => el.textContent)).toEqual(
        otherNames
    );
});

test("command categories", async () => {
    await mountWithCleanup(TestComponent);

    // Register some commands
    function action() {}
    env.services.command.add("a", action, { category: "custom-nolabel" });
    env.services.command.add("b", action, { category: "custom" });
    env.services.command.add("c", action);
    env.services.command.add("d", action, { category: "invalid-category" });
    await animationFrame();

    // Open palette
    press("Control+k");
    await animationFrame();

    expect(".o_command_category").toHaveCount(3);
    expect(
        [...getFixture().querySelectorAll(".o_command_category")].map((el) => el.textContent)
    ).toEqual(["a", "b", "cd"]);
});

test("data-command-category", async () => {
    class MyComponent extends Component {
        static components = { TestComponent };
        static template = xml`
            <div>
            <div>
                <button title="Aria Stark" data-hotkey="a">visible</button>
                <button title="Bran Stark" data-hotkey="b">visible</button>
            </div>
            <div data-command-category="custom">
                <button title="Robert Baratheon" data-hotkey="r">visible</button>
                <button title="Joffrey Baratheon" data-hotkey="j">visible</button>
            </div>
            <TestComponent />
            </div>
        `;
        static props = ["*"];
    }
    await mountWithCleanup(MyComponent);

    // Open palette
    press("Control+k");
    await animationFrame();

    expect(".o_command").toHaveCount(4);
    expect(
        [
            ...getFixture().querySelectorAll(
                ".o_command_category:nth-of-type(1) .o_command > a > div > span:first-child"
            ),
        ].map((el) => el.textContent)
    ).toEqual(["Robert baratheon", "Joffrey baratheon"]);
    expect(
        [
            ...getFixture().querySelectorAll(
                ".o_command_category:nth-of-type(2) .o_command > a > div > span:first-child"
            ),
        ].map((el) => el.textContent)
    ).toEqual(["Aria stark", "Bran stark"]);
});

test("display shortcuts correctly for non-MacOS ", async () => {
    class MyComponent extends Component {
        static components = { TestComponent };
        static template = xml`
            <div>
                <button title="Click" data-hotkey="f">visible</button>
                <TestComponent />
            </div>
        `;
        static props = ["*"];
    }

    await mountWithCleanup(MyComponent);

    // Register some commands
    function action() {}
    env.services.command.add("a", action);
    env.services.command.add("b", action, { hotkey: "alt+b" });
    env.services.command.add("c", action, { hotkey: "c" });
    env.services.command.add("d", action, {
        hotkey: "control+d",
    });
    env.services.command.add("e", action, {
        hotkey: "alt+control+e",
    });
    await animationFrame();

    // Open palette
    press("Control+k");
    await animationFrame();

    expect([...getFixture().querySelectorAll(".o_command")].map((el) => el.textContent)).toEqual([
        "a",
        "bALT + B",
        "cC",
        "dCONTROL + D",
        "eALT + CONTROL + E",
        "ClickALT + F",
    ]);
});

test("display shortcuts correctly for MacOS ", async () => {
    patchWithCleanup(window, {
        navigator: {
            userAgent: window.navigator.userAgent.replace(/\([^)]*\)/, "(MacOs)"),
        },
    });
    patchWithCleanup(browser, {
        navigator: {
            userAgent: window.navigator.userAgent.replace(/\([^)]*\)/, "(MacOs)"),
        },
    });
    class MyComponent extends Component {
        static components = { TestComponent };
        static template = xml`
            <div>
            <button title="Click" data-hotkey="f">visible</button>
            <TestComponent />
            </div>
        `;
        static props = ["*"];
    }

    await mountWithCleanup(MyComponent);

    // Register some commands
    function action() {}
    env.services.command.add("a", action);
    env.services.command.add("b", action, { hotkey: "alt+b" });
    env.services.command.add("c", action, { hotkey: "c" });
    env.services.command.add("d", action, {
        hotkey: "control+d",
    });
    env.services.command.add("e", action, {
        hotkey: "alt+control+e",
    });
    await animationFrame();

    // Open palette
    press("Control+k");
    await animationFrame();

    expect([...getFixture().querySelectorAll(".o_command")].map((el) => el.textContent)).toEqual([
        "a",
        "bCONTROL + B",
        "cC",
        "dCOMMAND + D",
        "eCONTROL + COMMAND + E",
        "ClickCONTROL + F",
    ]);
});

test("display shortcuts correctly for non-MacOS with a new overlayModifier", async () => {
    const hotkeyService = registry.category("services").get("hotkey");
    patchWithCleanup(hotkeyService, {
        overlayModifier: "alt+control",
    });

    class MyComponent extends Component {
        static components = { TestComponent };
        static template = xml`
                <div>
                <button title="Click" data-hotkey="a">visible</button>
                <TestComponent />
                </div>
            `;
        static props = ["*"];
    }

    await mountWithCleanup(MyComponent);
    // Open palette
    press("Control+k");
    await animationFrame();

    expect([...getFixture().querySelectorAll(".o_command")].map((el) => el.textContent)).toEqual([
        "ClickALT + CONTROL + A",
    ]);
});

test("display shortcuts correctly for MacOS with a new overlayModifier", async () => {
    patchWithCleanup(window, {
        navigator: {
            userAgent: window.navigator.userAgent.replace(/\([^)]*\)/, "(MacOs)"),
        },
    });
    patchWithCleanup(browser, {
        navigator: {
            userAgent: browser.navigator.userAgent.replace(/\([^)]*\)/, "(MacOs)"),
        },
    });

    const hotkeyService = registry.category("services").get("hotkey");
    patchWithCleanup(hotkeyService, {
        overlayModifier: "alt+control",
    });

    class MyComponent extends Component {
        static components = { TestComponent };
        static template = xml`
            <div>
            <button title="Click" data-hotkey="a">visible</button>
            <TestComponent />
            </div>
        `;
        static props = ["*"];
    }

    await mountWithCleanup(MyComponent);
    // Open palette
    press("Control+k");
    await animationFrame();

    expect([...getFixture().querySelectorAll(".o_command")].map((el) => el.textContent)).toEqual([
        "ClickCONTROL + COMMAND + A",
    ]);
});

test("openMainPalette with onClose", async () => {
    const command = env.services.command;
    command.openMainPalette({}, () => {
        expect.step("onClose");
    });
    await mountWithCleanup(TestComponent);

    await animationFrame();
    expect(".o_command_palette").toHaveCount(1);

    press("escape");
    await animationFrame();
    expect(["onClose"]).toVerifySteps();
});

test("uses openPalette to modify the config used by the command palette", async () => {
    const action = () => {};
    env.services.command.add("Command1", action);

    await mountWithCleanup(TestComponent);

    press("Control+k");
    await animationFrame();
    expect(".o_command_palette_search input").toHaveValue("");
    expect(".o_command").toHaveCount(1);
    expect(
        [...getFixture().querySelectorAll(".o_command span:first-child")].map(
            (el) => el.textContent
        )
    ).toEqual(["Command1"]);

    const provide = () => [
        {
            name: "Command2",
            action,
        },
    ];
    const providers = [{ provide }];
    const configCustom = {
        searchValue: "Command",
        providers,
    };
    env.services.command.openPalette(configCustom);
    await animationFrame();
    expect(".o_command").toHaveCount(1);
    expect(
        [...getFixture().querySelectorAll(".o_command span:first-child")].map(
            (el) => el.textContent
        )
    ).toEqual(["Command2"]);
    expect(".o_command_palette_search input").toHaveValue("Command");
});

test("ensure that calling openPalette multiple times successfully loads the last config for the command palette", async () => {
    const providePromise1 = new Deferred();
    const providePromise2 = new Deferred();
    const action = () => {};

    await mountWithCleanup(TestComponent);

    const provide = [
        async () => {
            await providePromise1;
            return [
                {
                    name: "Command1",
                    action,
                },
            ];
        },
        async () => {
            await providePromise2;
            return [
                {
                    name: "Command2",
                    action,
                },
            ];
        },
    ];
    const configCustom1 = {
        searchValue: "Command",
        providers: [{ provide: provide[0] }],
    };
    const configCustom2 = {
        searchValue: "Command",
        providers: [{ provide: provide[1] }],
    };

    env.services.command.openPalette(configCustom1);
    await animationFrame();
    expect(".o_command_palette").toHaveCount(0);
    env.services.command.openPalette(configCustom2);
    await animationFrame();
    expect(".o_command_palette").toHaveCount(0);
    providePromise1.resolve();
    await animationFrame();
    // First config should not be loaded since a second config was sent.
    expect(".o_command_palette").toHaveCount(0);
    providePromise2.resolve();
    await animationFrame();
    // Second config should be loaded properly.
    expect(".o_command").toHaveCount(1);
    expect(
        [...getFixture().querySelectorAll(".o_command span:first-child")].map(
            (el) => el.textContent
        )
    ).toEqual(["Command2"]);
    expect(".o_command_palette_search input").toHaveValue("Command");
});
