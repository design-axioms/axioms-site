/**
 * Arranges elements an application already owns.
 *
 * The application marks its own elements: a group with
 * `data-axiomatic="Stack" | "Shelf" | "Switcher"`, and each other member with
 * `data-axiomatic-atom`. This module adds what `primitives.css` needs to lay
 * those groups out and what the shared coordinator needs to decide each
 * Switcher. It never creates, replaces, clones, moves or reorders an authored
 * element, so focus, state, values and listeners are untouched by an
 * arrangement change or a refresh.
 *
 * An atom is a member whose width is its own: it does not wrap, shrink or
 * stretch (`authored-elements.css`), so its border box is the same in a row
 * and in a column. That is what lets a Switcher's requirement come from the
 * real boxes, with no copy of them:
 *
 * - an atom requires its border-box inline size;
 * - a Stack requires its widest member;
 * - a Shelf or Switcher requires its members side by side with its row gap
 *   between them, whatever arrangement it currently has.
 *
 * CSS cannot add those up, so the sums are made here from sizes the shared
 * ResizeObserver reports. Nothing here reads a rectangle or a computed style,
 * and nothing is placed by script: the sum is one side of the coordinator's
 * comparison.
 *
 * What this adds to the application's elements, and removes on disposal:
 *
 * - `data-axiomatic-level` on each group, the structural spacing level;
 * - the coordinator's arrangement attribute on each Switcher;
 * - appended children marked `data-axiomatic-mechanical`, hidden from
 *   assistive technology and inert. A Switcher gets a `slot`. Every group at
 *   or below a Switcher gets a `ruler`, which reports the group's row gap and
 *   whether the group is rendered.
 *
 * Those names, and every other attribute beginning `data-axiomatic-`, are
 * reserved: the application sets only `data-axiomatic` and
 * `data-axiomatic-atom`.
 *
 * ## What the sums assume
 *
 * The requirement is right only while these hold. None is checked at run
 * time unless it says so; a composition outside them is unsupported, and
 * what it does is not specified.
 *
 * - Every child of a group is a group or an atom. Text placed directly in a
 *   group would be a member the sums cannot see, so it is refused (checked).
 * - An atom keeps the stylesheet's contract: no wrapping, shrinking,
 *   stretching or margin. Application CSS that overrides one of those
 *   declarations breaks the sum without any error.
 * - A rendered atom has a size. A box reported as 0x0 is taken to be not
 *   rendered, because that is all the browser reports for `display: none`,
 *   so a visible atom with no size at all takes no gap.
 * - An atom's width does not depend on any Switcher's arrangement. An atom
 *   that contains another composition is outside this.
 * - A group inside a Switcher has no inline padding, border or margin. The
 *   outermost Switcher may have padding and a border: its slot is its
 *   content box.
 * - A group's `column-gap` is a length, not a percentage.
 *
 * Still open, and neither supported nor ruled out: wrapping prose, images
 * and late-loading content, members with a size bound of their own,
 * vertical writing, and a composition that crosses a shadow boundary.
 */
import {
  arrangementAttribute,
  switcherCoordinator,
  type DerivedSwitcher,
  type SwitcherCoordinator,
} from "./switcher-coordinator.ts";

/** Marks a group, with the name of its primitive. */
export const groupAttribute = "data-axiomatic";
/** Marks a member that is not a group and meets the atom contract. */
export const atomAttribute = "data-axiomatic-atom";
/** Marks the boxes this module adds. Skip them when listing members. */
export const mechanicalAttribute = "data-axiomatic-mechanical";
const levelAttribute = "data-axiomatic-level";

type Kind = "Stack" | "Shelf" | "Switcher";

function kindOf(element: Element): Kind | undefined {
  const value = element.getAttribute(groupAttribute);
  return value === "Stack" || value === "Shelf" || value === "Switcher"
    ? value
    : undefined;
}

/** The marked structure as found, before anything is changed. */
type Outline =
  | { readonly kind: "Atom"; readonly element: Element }
  | {
      readonly kind: Kind;
      readonly element: Element;
      readonly members: readonly Outline[];
    };
type GroupOutline = Exclude<Outline, { readonly kind: "Atom" }>;

interface Atom {
  readonly element: Element;
  parent: Group;
  /** Border-box inline size. `undefined` while it is not rendered. */
  inline: number | undefined;
  /** Present while the atom is at or below a Switcher, and so measured. */
  stop: (() => void) | undefined;
}

const stale = Symbol("stale");

interface Group {
  readonly element: Element;
  kind: Kind;
  parent: Group | undefined;
  members: readonly (Atom | Group)[];
  ruler: { readonly holder: Element; stop(): void } | undefined;
  slot:
    | {
        readonly holder: Element;
        /** How many levels below the Switcher the observed target sits. */
        readonly below: number;
        readonly registration: DerivedSwitcher;
      }
    | undefined;
  /** The separation between members of a row, as the ruler reports it.
   * `undefined` while the group is not rendered. */
  gap: number | undefined;
  /** The row requirement of the group's content, cached until a size below
   * it changes. `undefined` while the group is not rendered. */
  requirement: number | undefined | typeof stale;
}

export interface AuthoredComposition {
  /**
   * Reads the marked structure again. Call it after inserting or moving a
   * member, adding a group, or changing a `data-axiomatic` attribute, and
   * after removing a member so that the element is released. Changes of
   * size, text, font, spacing and visibility need no call: the browser
   * reports them.
   *
   * Call it where the application changes its elements: an event handler,
   * a task or an animation frame. A member added here is counted when the
   * browser first reports it, which is before the next paint from any of
   * those. Inside an observer callback that report can come a frame late.
   *
   * Throws, before changing anything, on the conditions
   * {@link registerAuthoredComposition} names. The registration is then as
   * it was, and a later call can succeed.
   */
  refresh(): void;
  /** Stops deciding and removes everything this module added. */
  dispose(): void;
}

/**
 * Each group and atom belongs to one registration at a time. An element that
 * moves between two compositions is released by refreshing or disposing the
 * one it left, and only then taken up by refreshing the one it joined.
 */
const owners = new WeakMap<Element, object>();

/**
 * Starts arranging the authored composition whose outermost group is `root`.
 * The host decides the available inline size, as it does for a rendered
 * composition; nothing here observes or sets it.
 *
 * Throws, before changing anything, if `root` is not a group, if a group or
 * atom still belongs to another registration, or if a group has a child that
 * is neither a group nor an atom: another element, or text of its own.
 */
export function registerAuthoredComposition(
  root: HTMLElement,
  coordinator: SwitcherCoordinator = switcherCoordinator(root.ownerDocument),
): AuthoredComposition {
  const owner = {};
  const document = root.ownerDocument;
  const atoms = new Map<Element, Atom>();
  const groups = new Map<Element, Group>();
  let disposed = false;

  function claimed(element: Element): boolean {
    const claim = owners.get(element);
    return claim !== undefined && claim !== owner;
  }

  /** Everything that can refuse a composition is found here, so that a
   * refusal leaves the elements and this registration untouched. */
  function read(element: Element): GroupOutline {
    const kind = kindOf(element);
    if (!kind)
      throw new Error(
        `An authored composition starts at a group: ${groupAttribute}="Stack", "Shelf" or "Switcher"`,
      );
    if (claimed(element))
      throw new Error(
        "This group already belongs to another authored composition. Refresh or dispose that one first",
      );
    const members: Outline[] = [];
    for (const node of Array.from(element.childNodes)) {
      // Text in a flex container is a member of its own, unless it is only
      // the white space the browser leaves out.
      if (node.nodeType === 3 && /[^ \t\n\r\f]/.test(node.nodeValue ?? ""))
        throw new Error(
          `A member of an authored ${kind} is a group or an atom (${atomAttribute}), not text of its own: "${(node.nodeValue ?? "").trim().slice(0, 40)}"`,
        );
      if (node.nodeType !== 1) continue;
      const child = node as Element;
      if (child.hasAttribute(mechanicalAttribute)) continue;
      if (kindOf(child)) {
        members.push(read(child));
        continue;
      }
      if (!child.hasAttribute(atomAttribute))
        throw new Error(
          `A member of an authored ${kind} is a group or an atom (${atomAttribute}): <${child.tagName.toLowerCase()}>`,
        );
      if (claimed(child))
        throw new Error(
          "This atom already belongs to another authored composition. Refresh or dispose that one first",
        );
      members.push({ kind: "Atom", element: child });
    }
    return { kind, element, members };
  }

  function mechanical(role: "slot" | "ruler") {
    const element = document.createElement("div");
    element.setAttribute(mechanicalAttribute, role);
    element.setAttribute("aria-hidden", "true");
    element.setAttribute("inert", "");
    return element;
  }

  /** Any size below `group` changed: it and every group above need new sums. */
  function invalidate(group: Group) {
    for (let each: Group | undefined = group; each; each = each.parent) {
      each.requirement = stale;
      each.slot?.registration.invalidate();
    }
  }

  function requirementOf(group: Group): number | undefined {
    if (group.requirement === stale) group.requirement = required(group);
    return group.requirement;
  }

  function required(group: Group): number | undefined {
    if (group.gap === undefined) return undefined;
    // A member that is not rendered takes no room and no gap. An empty group
    // that is rendered takes a gap, as it does in the browser's row.
    const sizes: number[] = [];
    for (const member of group.members) {
      const size = "members" in member ? requirementOf(member) : member.inline;
      if (size !== undefined) sizes.push(size);
    }
    if (group.kind === "Stack") return Math.max(0, ...sizes);
    const between = group.gap * Math.max(0, sizes.length - 1);
    return sizes.reduce((sum, size) => sum + size, between);
  }

  function measureAtom(atom: Atom, measured: boolean) {
    if (!measured) {
      atom.stop?.();
      atom.stop = undefined;
      atom.inline = undefined;
      return;
    }
    // The border box, because an atom's padding and border take room in the
    // row. Observing that box also reports a change of padding alone.
    atom.stop ??= coordinator.measure(
      atom.element,
      (entry) => {
        const size = entry.borderBoxSize[0];
        if (!size) return;
        const rendered = size.inlineSize > 0 || size.blockSize > 0;
        const inline = rendered ? size.inlineSize : undefined;
        if (inline === atom.inline) return;
        atom.inline = inline;
        invalidate(atom.parent);
      },
      { box: "border-box" },
    );
  }

  /** The ruler is a row of two empty boxes with the group's own column gap,
   * so its width is the gap that row uses. It is 1px tall whenever the group
   * is rendered, which tells "hidden" from "empty". */
  function rule(group: Group, measured: boolean) {
    if (!measured) {
      group.ruler?.stop();
      group.ruler?.holder.remove();
      group.ruler = undefined;
      group.gap = undefined;
      return;
    }
    if (!group.ruler) {
      const holder = mechanical("ruler");
      const row = document.createElement("div");
      row.append(document.createElement("div"), document.createElement("div"));
      holder.append(row);
      const stop = coordinator.measure(row, (entry) => {
        const size = entry.contentBoxSize[0];
        if (!size) return;
        const rendered = size.inlineSize > 0 || size.blockSize > 0;
        const gap = rendered ? size.inlineSize : undefined;
        if (gap === group.gap) return;
        group.gap = gap;
        invalidate(group);
      });
      group.ruler = { holder, stop };
    }
    // The application may have emptied the group since.
    if (group.ruler.holder.parentElement !== group.element)
      group.element.append(group.ruler.holder);
  }

  function removeSlot(group: Group) {
    group.slot?.registration.unregister();
    group.slot?.holder.remove();
    group.slot = undefined;
  }

  /**
   * Gives a Switcher, itself `own` levels below the root, a slot whose
   * target is `depth` levels below the root. Reports whether the
   * registration is new.
   *
   * The slot is the Switcher's content-box inline size at zero height. Its
   * depth is the coordinator's dependency contract: the observer redelivers,
   * within a frame, only targets deeper than the shallowest one it just
   * delivered. A decision above this Switcher can follow from any atom or
   * ruler below that Switcher, so this slot sits deeper than all of them and
   * deeper than the slot of every Switcher around it.
   *
   * A slot travels with its Switcher when the application moves it, so it
   * is kept only while it still reaches the depth wanted from where the
   * Switcher is now.
   */
  function placeSlot(group: Group, own: number, depth: number): boolean {
    const below = depth - own;
    const kept = group.slot?.below === below;
    if (!kept) {
      removeSlot(group);
      const holder = mechanical("slot");
      let target: Element = holder;
      for (let level = 1; level < below; level++) {
        const next = document.createElement("div");
        target.append(next);
        target = next;
      }
      const registration = coordinator.registerDerived({
        switcher: group.element,
        slot: target,
        requirement: () => requirementOf(group),
      });
      group.slot = { holder, below, registration };
    }
    const { holder } = group.slot!;
    if (holder.parentElement !== group.element) group.element.append(holder);
    return !kept;
  }

  function release(group: Group) {
    rule(group, false);
    removeSlot(group);
    group.element.removeAttribute(levelAttribute);
    group.element.removeAttribute(arrangementAttribute);
    owners.delete(group.element);
  }

  function refresh() {
    if (disposed) return;
    const outline = read(root);
    const current = new Set<Atom | Group>();
    const switchers: { group: Group; own: number; enclosing: number }[] = [];
    // The depth, below the root, of the deepest measured atom or ruler.
    let deepest = 0;

    /** `enclosing` counts the Switchers around this group. Returns the
     * group with its structural spacing level. */
    function place(
      outline: GroupOutline,
      parent: Group | undefined,
      own: number,
      enclosing: number,
    ): { group: Group; level: number } {
      const { element, kind } = outline;
      let group = groups.get(element);
      if (!group) {
        group = {
          element,
          kind,
          parent,
          members: [],
          ruler: undefined,
          slot: undefined,
          gap: undefined,
          requirement: stale,
        };
        groups.set(element, group);
      }
      const placed = group;
      current.add(placed);
      placed.kind = kind;
      placed.parent = parent;
      const measured = enclosing > 0 || kind === "Switcher";
      let inner = 0;
      placed.members = outline.members.map((member) => {
        if (member.kind !== "Atom") {
          const below = place(
            member,
            placed,
            own + 1,
            enclosing + (kind === "Switcher" ? 1 : 0),
          );
          inner = Math.max(inner, below.level);
          return below.group;
        }
        let atom = atoms.get(member.element);
        if (!atom) {
          atom = {
            element: member.element,
            parent: placed,
            inline: undefined,
            stop: undefined,
          };
          atoms.set(member.element, atom);
        }
        current.add(atom);
        atom.parent = placed;
        measureAtom(atom, measured);
        if (measured) deepest = Math.max(deepest, own + 1);
        return atom;
      });
      // The provisional teaching policy: one level above the most widely
      // spaced member, to a ceiling of three. `primitives.css` gives a level
      // its length. No boundary cue is drawn on authored elements.
      const level = Math.min(3, inner + 1);
      if (element.getAttribute(levelAttribute) !== `${level}`)
        element.setAttribute(levelAttribute, `${level}`);
      rule(placed, measured);
      if (measured) deepest = Math.max(deepest, own + 2);
      if (kind === "Switcher")
        switchers.push({ group: placed, own, enclosing });
      else if (placed.slot) {
        removeSlot(placed);
        element.removeAttribute(arrangementAttribute);
      }
      return { group: placed, level };
    }
    place(outline, undefined, 0, 0);

    for (const [element, atom] of atoms)
      if (!current.has(atom)) {
        measureAtom(atom, false);
        atoms.delete(element);
        owners.delete(element);
      }
    for (const [element, group] of groups)
      if (!current.has(group)) {
        release(group);
        groups.delete(element);
      }
    // After the releases: an element may have changed from atom to group.
    for (const { element } of current) owners.set(element, owner);

    const kept: Group[] = [];
    for (const { group, own, enclosing } of switchers)
      if (!placeSlot(group, own, deepest + 1 + enclosing)) kept.push(group);

    // Membership may have changed under any group. A Switcher that keeps its
    // slot is decided now from the sizes already held, because removing a
    // member produces no report. A new slot is decided when it first reports.
    for (const group of groups.values()) group.requirement = stale;
    for (const group of kept) group.slot?.registration.invalidate();
  }

  refresh();
  return {
    refresh,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const atom of atoms.values()) {
        measureAtom(atom, false);
        owners.delete(atom.element);
      }
      for (const group of groups.values()) release(group);
      atoms.clear();
      groups.clear();
    },
  };
}
