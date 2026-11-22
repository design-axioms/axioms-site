/**
 * The shared decision for atomic Switchers.
 *
 * CSS lays a Switcher out as one row or one column. It cannot compare the
 * row's intrinsic requirement with the space the Switcher's slot provides, so
 * this module makes that one comparison and publishes the result as an
 * attribute. It reads no geometry itself: the browser reports both numbers
 * through a single ResizeObserver, and the decision is written inside the
 * observer callback, before the frame paints.
 *
 * The module knows nothing about how a Switcher is rendered. A registration
 * names the two boxes that carry its numbers; `primitives.ts` builds them for
 * the controlled Composition tree. Where no one box can carry the
 * requirement, a registrant derives it from several reported sizes instead:
 * `authored-elements.ts` does so for elements an application owns.
 *
 * Dependencies between Switchers are carried by the browser, not by a tree
 * walk here. Within a frame, ResizeObserver delivers in rounds, and after a
 * round it redelivers only targets deeper than the shallowest target that
 * round delivered, for any observer in the document. That places two
 * obligations on tree depth:
 *
 * - A nested Switcher's slot is deeper than the slot and requirement of every
 *   enclosing Switcher (see {@link SwitcherRegistration.slot}).
 * - Any other observer of a box that a published arrangement can resize
 *   watches from deeper than that Switcher's slot and requirement. Otherwise
 *   its notification waits a frame and the browser reports a loop error.
 * - A nested Switcher's slot is also deeper than every box whose report can
 *   change the decision of a Switcher around it. A derived requirement is
 *   made from boxes throughout the subtree, so this is a real constraint
 *   there (see {@link SwitcherCoordinator.measure}).
 */

export type Arrangement = "row" | "column";

/** Where the decision is published. CSS may still derive a row from the host
 * (see `primitives.css`), so read `flex-direction` for the effective mode. */
export const arrangementAttribute = "data-axiomatic-arrangement";

/**
 * A row that exactly fits is a row. Engines keep layout sizes in fixed-point
 * units (1/64px in Blink and WebKit, 1/60px in Gecko), so two boxes laid out
 * from the same content can report sizes one unit apart. The tolerance is
 * four Blink units: above that noise, and far below a device pixel.
 */
export const fitTolerance = 1 / 16;

/** The whole decision: a function of two numbers and no history. */
export function arrangementFor(requirement: number, slot: number): Arrangement {
  return requirement <= slot + fitTolerance ? "row" : "column";
}

export interface SwitcherRegistration {
  /** Receives {@link arrangementAttribute}. */
  readonly switcher: Element;
  /**
   * Its inline size is the space available to the row. The published
   * arrangement must not be able to resize this box in a host that imposes a
   * width, and it must sit deeper in the tree than the slot and requirement
   * boxes of every enclosing registered Switcher, so that an ancestor's
   * decision reaches it in the same frame.
   */
  readonly slot: Element;
  /**
   * Its inline size is the row requirement, laid out independently of every
   * Switcher's current arrangement. Its block size is non-zero whenever it is
   * rendered, so a 0×0 report means "not rendered" rather than "needs no room".
   */
  readonly requirement: Element;
}

/**
 * A Switcher whose requirement the registrant derives from several reported
 * sizes, where no single box can carry it. The slot is as in
 * {@link SwitcherRegistration}.
 */
export interface DerivedSwitcherRegistration {
  readonly switcher: Element;
  readonly slot: Element;
  /**
   * The row requirement now, or `undefined` while the Switcher is not
   * rendered. It is asked for when the Switcher is decided, and must answer
   * from numbers the registrant already holds: it must not read layout, and
   * it must not depend on any Switcher's current arrangement.
   */
  requirement(): number | undefined;
}

export interface DerivedSwitcher {
  /**
   * Says the requirement may have changed. Inside a delivery the Switcher is
   * decided with the rest of that delivery; otherwise it is decided now.
   */
  invalidate(): void;
  unregister(): void;
}

/** What one decision concluded for one Switcher. */
export interface SwitcherDecision {
  readonly switcher: Element;
  readonly slot: number;
  /** `undefined` while the requirement is not rendered. */
  readonly requirement: number | undefined;
  /** `undefined` when the previous arrangement was kept for lack of a requirement. */
  readonly arrangement: Arrangement | undefined;
  readonly written: boolean;
}

interface Deciding {
  readonly switcher: Element;
  /** Starts at zero, as an unreported ResizeObserver size does. */
  slot: number;
  readonly requirement: () => number | undefined;
}

type Receive = (entry: ResizeObserverEntry) => void;

export class SwitcherCoordinator {
  /** Diagnostic hook for fixtures: receives every round of decisions. */
  trace: ((decisions: readonly SwitcherDecision[]) => void) | undefined;

  readonly #observer: ResizeObserver;
  // Owners must stop what they start: native observation retains targets.
  // `size` exposes outstanding registrations for lifecycle qualification.
  readonly #receivers = new WeakMap<Element, Receive>();
  #size = 0;
  /** The Switchers to decide at the end of the delivery in progress. */
  #affected: Set<Deciding> | undefined;

  constructor(Observer: typeof ResizeObserver) {
    this.#observer = new Observer((entries) => this.#receive(entries));
  }

  /** Switcher registrations not yet unregistered. */
  get size(): number {
    return this.#size;
  }

  /** Starts deciding for a Switcher. Call the returned function to stop. */
  register(registration: SwitcherRegistration): () => void {
    const { switcher, slot, requirement } = registration;
    if (this.#receivers.has(slot) || this.#receivers.has(requirement))
      throw new Error("This Switcher is already registered");
    let reported: number | undefined;
    const deciding = this.#decide(switcher, slot, () => reported);
    const stop = this.measure(requirement, (entry) => {
      const size = entry.contentBoxSize[0];
      if (!size) return;
      const rendered = size.inlineSize > 0 || size.blockSize > 0;
      reported = rendered ? size.inlineSize : undefined;
      this.#affected?.add(deciding.state);
    });
    return () => {
      deciding.stop();
      stop();
    };
  }

  /** Starts deciding for a Switcher whose requirement the registrant holds. */
  registerDerived(registration: DerivedSwitcherRegistration): DerivedSwitcher {
    const { switcher, slot } = registration;
    if (this.#receivers.has(slot))
      throw new Error("This Switcher is already registered");
    const deciding = this.#decide(switcher, slot, () =>
      registration.requirement(),
    );
    let registered = true;
    return {
      invalidate: () => {
        if (!registered) return;
        if (this.#affected) this.#affected.add(deciding.state);
        else this.#conclude([deciding.state]);
      },
      unregister: () => {
        registered = false;
        deciding.stop();
      },
    };
  }

  /**
   * Reports a box through the shared observer: the numbers a derived
   * requirement is made from. Every report in a delivery is received before
   * any Switcher in it is decided. Call the returned function to stop.
   *
   * A target that a published arrangement can resize carries the depth
   * obligation described at the top of this module.
   */
  measure(
    target: Element,
    receive: Receive,
    options?: ResizeObserverOptions,
  ): () => void {
    if (this.#receivers.has(target))
      throw new Error("This box is already observed");
    this.#receivers.set(target, receive);
    this.#observer.observe(target, options);
    let measuring = true;
    return () => {
      if (!measuring) return;
      measuring = false;
      this.#observer.unobserve(target);
      this.#receivers.delete(target);
    };
  }

  #decide(
    switcher: Element,
    slot: Element,
    requirement: () => number | undefined,
  ) {
    const state: Deciding = { switcher, slot: 0, requirement };
    const stop = this.measure(slot, (entry) => {
      const size = entry.contentBoxSize[0];
      if (!size) return;
      state.slot = size.inlineSize;
      this.#affected?.add(state);
    });
    this.#size++;
    let registered = true;
    return {
      state,
      stop: () => {
        if (!registered) return;
        registered = false;
        stop();
        this.#size--;
      },
    };
  }

  #receive(entries: readonly ResizeObserverEntry[]) {
    // Receive every delivered number before deciding, so the result cannot
    // depend on the order of entries within a delivery.
    const affected = (this.#affected = new Set());
    try {
      for (const entry of entries) this.#receivers.get(entry.target)?.(entry);
    } finally {
      this.#affected = undefined;
    }
    this.#conclude(affected);
  }

  #conclude(affected: Iterable<Deciding>) {
    const decisions: SwitcherDecision[] = [];
    for (const { switcher, slot, requirement: required } of affected) {
      const requirement = required();
      // Without a rendered requirement there is nothing to compare. Keeping
      // the last arrangement lets a hidden Switcher reappear undisturbed.
      const arrangement =
        requirement === undefined
          ? undefined
          : arrangementFor(requirement, slot);
      const written =
        arrangement !== undefined &&
        switcher.getAttribute(arrangementAttribute) !== arrangement;
      if (written) switcher.setAttribute(arrangementAttribute, arrangement);
      decisions.push({ switcher, slot, requirement, arrangement, written });
    }
    this.trace?.(decisions);
  }
}

const coordinators = new WeakMap<Document, SwitcherCoordinator>();

/** The one coordinator, and so the one ResizeObserver, for a document. It
 * serves Switchers in the document and in any of its shadow roots. */
export function switcherCoordinator(document: Document): SwitcherCoordinator {
  let coordinator = coordinators.get(document);
  if (!coordinator) {
    const view = document.defaultView;
    if (!view) throw new Error("Switchers need a document with a window");
    coordinator = new SwitcherCoordinator(view.ResizeObserver);
    coordinators.set(document, coordinator);
  }
  return coordinator;
}
