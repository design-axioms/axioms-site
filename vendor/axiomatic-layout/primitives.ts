/**
 * Renders the controlled Composition tree as native boxes for
 * `primitives.css`, and names the boxes the Switcher coordinator observes.
 *
 * Each rendered box answers two separate questions with separate hooks:
 *
 * - What it is, for layout: `data-axiomatic` and the spacing metadata. The
 *   stylesheet uses only these, so measurement copies are styled exactly like
 *   the boxes they stand for.
 * - Which authored node it is, for selection and inspection: `.node`/`.leaf`,
 *   `data-kind` and `data-path`. Only real boxes carry these, so a consumer
 *   that queries them never meets a measurement box.
 *
 * Everything else under a `data-axiomatic-mechanical` element exists for
 * measurement. It is hidden from assistive technology and holds no authored
 * content of its own.
 */
import type { Composition } from "./composition.ts";
import {
  switcherCoordinator,
  type SwitcherCoordinator,
  type SwitcherRegistration,
} from "./switcher-coordinator.ts";

/** Matches the measurement boxes a Switcher owns, and nothing authored. */
export const mechanicalSelector = "[data-axiomatic-mechanical]";

/**
 * Structural spacing for a composition, computed when the tree changes.
 * `primitives.css` turns a level into a length.
 *
 * This is the provisional teaching policy: a leaf has no level; a group sits
 * one level above its most widely spaced member, up to a ceiling of three.
 * A group at the ceiling whose member is also there can no longer show the
 * difference with space, so its members are separated by a boundary cue.
 */
export interface SpacingLevels {
  readonly level: 0 | 1 | 2 | 3;
  readonly cue: boolean;
  readonly children: readonly SpacingLevels[];
}

export function spacingLevels(value: Composition): SpacingLevels {
  if (!("children" in value)) return { level: 0, cue: false, children: [] };
  const children = value.children.map(spacingLevels);
  const inner = Math.max(0, ...children.map((child) => child.level));
  return {
    level: Math.min(3, inner + 1) as SpacingLevels["level"],
    cue: inner >= 3,
    children,
  };
}

export interface RenderedComposition {
  /**
   * The root box. Place it where its container imposes an inline size that
   * cannot depend on this composition's block size. A scrolling host with
   * classic scrollbars needs `scrollbar-gutter: stable` to preserve that slot.
   */
  readonly element: HTMLElement;
  /** One registration per Switcher, outermost first. */
  readonly switchers: readonly SwitcherRegistration[];
}

/**
 * Builds the boxes for a composition without registering anything.
 *
 * A Switcher's requirement is the max-content size of its content on one
 * line, with every nested Switcher also on one line. The outermost Switcher
 * therefore owns a single hidden copy of its subtree, laid out that way by
 * CSS, and a nested Switcher's requirement is the size of its own copy inside
 * it. The copy is built from the composition, never cloned from live boxes,
 * so no current arrangement or teaching decoration can reach it.
 */
export function renderComposition(
  value: Composition,
  document: Document = globalThis.document,
): RenderedComposition {
  const switchers: SwitcherRegistration[] = [];

  function box(value: Composition, levels: SpacingLevels): HTMLElement {
    const branch = "children" in value;
    const element = document.createElement(
      branch ? "div" : value.kind === "Heading" ? "h3" : "p",
    );
    element.setAttribute("data-axiomatic", value.kind);
    if (branch) element.setAttribute("data-axiomatic-level", `${levels.level}`);
    else element.textContent = value.text;
    return element;
  }

  function mechanical(role: "slot" | "requirement", content: HTMLElement) {
    const element = document.createElement("div");
    element.setAttribute("data-axiomatic-mechanical", role);
    element.setAttribute("aria-hidden", "true");
    element.setAttribute("inert", "");
    element.append(content);
    return element;
  }

  /** `copy` is present when an enclosing Switcher mirrors this subtree. */
  function render(
    value: Composition,
    levels: SpacingLevels,
    path: string,
    mirrored: boolean,
  ): { real: HTMLElement; copy: HTMLElement | undefined } {
    const real = box(value, levels);
    real.setAttribute("data-kind", value.kind);
    real.setAttribute("data-path", path);
    if (!("children" in value)) {
      real.setAttribute("class", "leaf");
      return { real, copy: mirrored ? box(value, levels) : undefined };
    }
    real.setAttribute("class", "node");
    const decides = value.kind === "Switcher";
    const copy = mirrored || decides ? box(value, levels) : undefined;
    // The slot target sits one level below its mechanical parent on purpose:
    // that keeps it deeper than an enclosing Switcher's requirement copy.
    const slot = decides ? document.createElement("div") : undefined;
    if (slot && copy)
      switchers.push({ switcher: real, slot, requirement: copy });
    value.children.forEach((child, index) => {
      const member = render(
        child,
        levels.children[index]!,
        `${path}.${index}`,
        copy !== undefined,
      );
      if (levels.cue && index > 0)
        member.real.setAttribute("data-axiomatic-cue", `${levels.level}`);
      real.append(member.real);
      if (member.copy) copy?.append(member.copy);
    });
    if (slot && copy) {
      real.append(mechanical("slot", slot));
      if (!mirrored) real.append(mechanical("requirement", copy));
    }
    return { real, copy: mirrored ? copy : undefined };
  }

  const { real } = render(value, spacingLevels(value), "0", false);
  return { element: real, switchers };
}

export interface MountedComposition {
  /** The current root box. `update` replaces it. */
  readonly element: HTMLElement;
  /** The boxes each current Switcher is decided from, outermost first. */
  readonly switchers: readonly SwitcherRegistration[];
  /** Renders a changed composition in the same place. */
  update(value: Composition): void;
  /** Unregisters every Switcher and removes the boxes. */
  dispose(): void;
}

/**
 * Renders a composition into `host` and keeps its Switchers registered with
 * the document's shared coordinator for as long as it is mounted. The host
 * decides the available inline size; nothing here observes or sets it.
 */
export function mountComposition(
  host: Element,
  value: Composition,
  coordinator: SwitcherCoordinator = switcherCoordinator(host.ownerDocument),
): MountedComposition {
  let current: RenderedComposition;
  let unregister: readonly (() => void)[] = [];

  function show(value: Composition, place: (next: HTMLElement) => void) {
    const rendered = renderComposition(value, host.ownerDocument);
    for (const stop of unregister) stop();
    unregister = rendered.switchers.map((switcher) =>
      coordinator.register(switcher),
    );
    place(rendered.element);
    current = rendered;
  }

  show(value, (next) => host.append(next));
  return {
    get element() {
      return current.element;
    },
    get switchers() {
      return current.switchers;
    },
    update(value) {
      show(value, (next) => current.element.replaceWith(next));
    },
    dispose() {
      for (const stop of unregister) stop();
      unregister = [];
      current.element.remove();
    },
  };
}
