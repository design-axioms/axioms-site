import { expect, test } from "@playwright/test";

// Focus and notes belong to the application. Changing the space or colors can
// change its presentation without remounting any of its actions.
test("the same investigation survives width, mode, and atmosphere changes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const groups = page.locator('[data-axiomatic="Switcher"]');
  const follow = page.getByRole("button", { name: "Follow investigation" });
  const grip = page.getByRole("slider", { name: "Investigation card width" });
  const arrangement = async (outer: string, inner: string) => {
    await expect(groups.nth(0)).toHaveCSS("flex-direction", outer);
    await expect(groups.nth(1)).toHaveCSS("flex-direction", inner);
  };
  const atoms = page.locator("[data-axiomatic-atom]");
  const original = await atoms.elementHandles();
  await arrangement("row", "row");
  await follow.focus();
  await page.keyboard.press("Space");
  const following = page.getByRole("button", {
    name: "Unfollow investigation",
  });
  await expect(following).toBeFocused();

  for (const [width, outer, inner] of [
    [510, "column", "row"],
    [265, "column", "column"],
    [880, "row", "row"],
  ] as const) {
    const rect = (await grip.boundingBox())!;
    const x = rect.x + rect.width / 2,
      y = rect.y + rect.height / 2;
    const delta = width - Number(await grip.getAttribute("aria-valuenow"));
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + delta, y);
    await page.mouse.up();
    await expect(grip).toHaveAttribute("aria-valuenow", String(width));
    await arrangement(outer, inner);
    await expect(following).toBeFocused();
  }

  await page.getByRole("link", { name: "Open investigation session" }).click();
  const open = page.getByRole("button", { name: "Open investigation notes" });
  await open.click();
  const note = page.getByRole("textbox", { name: "Your working note" });
  await note.fill("Bound the query to this run.");
  await page.keyboard.press("Escape");
  await expect(open).toBeFocused();
  await page
    .getByRole("combobox", { name: "Mode", exact: true })
    .selectOption("dark");
  await page
    .getByRole("combobox", { name: "Atmosphere", exact: true })
    .selectOption({ label: "Teal" });
  await expect(following).toBeVisible();
  for (const [i, node] of original.entries()) {
    expect(
      await atoms
        .nth(i)
        .evaluate((current, before) => current === before, node),
    ).toBe(true);
  }
  await open.click();
  await expect(note).toHaveValue("Bound the query to this run.");
  await page.getByRole("button", { name: "Done" }).click();
  await expect(open).toBeFocused();
  await open.click();
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Open investigation session" }),
  ).toBeFocused();
  await page.setViewportSize({ width: 320, height: 800 });
  await arrangement("column", "column");
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1280, height: 900 });
  await grip.press("End");
  await arrangement("row", "row");
  expect(errors).toEqual([]);
});
