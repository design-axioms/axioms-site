/**
 * Typed boundary for the pinned Axiomatic Color and Layout runtimes used by
 * axioms.design. Importing both here keeps the dependency contract verified by
 * `pnpm check` even before the showcase UI mounts them.
 */
import "../vendor/axiomatic-layout/primitives.css";
import "../vendor/axiomatic-layout/authored-elements.css";

export {
  DEFAULT_CONFIG,
  contrastForPair,
  generateCSS,
  parseKeyColor,
  solve,
} from "@design-axioms/color";
export {
  createReactiveTheme,
  createThemeBuilder,
  getSystemStyleSheet,
  registerColorSlider,
} from "@design-axioms/color/browser";
export type { ReactiveTheme } from "@design-axioms/color/browser";

export {
  Shelf,
  Stack,
  Switcher,
  declaration,
  type Composition,
  type Group,
  type LeafKind,
  type Primitive,
} from "../vendor/axiomatic-layout/composition.ts";
export {
  mountComposition,
  renderComposition,
  spacingLevels,
  type MountedComposition,
  type RenderedComposition,
  type SpacingLevels,
} from "../vendor/axiomatic-layout/primitives.ts";
export {
  atomAttribute,
  groupAttribute,
  mechanicalAttribute,
  registerAuthoredComposition,
  type AuthoredComposition,
} from "../vendor/axiomatic-layout/authored-elements.ts";
export {
  SwitcherCoordinator,
  arrangementAttribute,
  switcherCoordinator,
  type Arrangement,
} from "../vendor/axiomatic-layout/switcher-coordinator.ts";
