import { registerAuthoredComposition } from "@design-axioms/layout";

const specimen = document.querySelector<HTMLElement>("#specimen")!;
const follow = document.querySelector<HTMLButtonElement>("#follow")!;
const openNotes = document.querySelector<HTMLButtonElement>("#open-notes")!;
const notes = document.querySelector<HTMLDialogElement>("#notes-dialog")!;
const mode = document.querySelector<HTMLSelectElement>("#mode")!;
const atmosphere = document.querySelector<HTMLSelectElement>("#atmosphere")!;

const actions = registerAuthoredComposition(
  document.querySelector<HTMLElement>("#actions")!,
);
let following = false;
follow.disabled = false;
follow.addEventListener("click", () => {
  following = !following;
  follow.textContent = following
    ? "Unfollow investigation"
    : "Follow investigation";
});
openNotes.disabled = false;
openNotes.addEventListener("click", () => notes.showModal());
const sessionLink = document.querySelector<HTMLAnchorElement>(
  '#actions a[href="#session"]',
)!;
notes.addEventListener("close", () => {
  const target = openNotes.checkVisibility() ? openNotes : sessionLink;
  target.focus({ preventScroll: true });
});
window.addEventListener("hashchange", () => {
  if (notes.open && !openNotes.checkVisibility()) notes.close();
});

function applyColors() {
  // System inherits the visitor’s preference from the page, including later changes.
  specimen.style.colorScheme = mode.value === "system" ? "" : mode.value;
  specimen.classList.toggle("hue-brand", atmosphere.value === "hue-brand");
  specimen.classList.toggle("hue-accent", atmosphere.value === "hue-accent");
}
applyColors();
mode.addEventListener("change", applyColors);
atmosphere.addEventListener("change", applyColors);
document.querySelector<HTMLElement>(".toolbar")!.hidden = false;

// The edge changes the card's available space. Layout observes its own groups.
const track = document.querySelector<HTMLElement>("#track")!;
const frame = document.querySelector<HTMLElement>("#frame")!;
const grip = document.querySelector<HTMLButtonElement>("#grip")!;
const widthLabel = document.querySelector<HTMLElement>("#width-label")!;
const largest = 880;
let requested = largest;
let available = track.clientWidth;
const upper = () => Math.min(largest, available);
const lower = () => Math.min(160, upper());
const clamp = (value: number) => Math.max(lower(), Math.min(value, upper()));
let actual = clamp(requested);
function applyWidth() {
  actual = clamp(requested);
  const whole = Math.round(actual);
  frame.style.setProperty("--card-width", actual + "px");
  widthLabel.textContent = whole + " px";
  grip.setAttribute("aria-valuemin", String(Math.round(lower())));
  grip.setAttribute("aria-valuemax", String(Math.round(upper())));
  grip.setAttribute("aria-valuenow", String(whole));
  grip.setAttribute("aria-valuetext", whole + " pixels");
}
const trackSize = new ResizeObserver(([entry]) => {
  const width = entry?.contentBoxSize[0]?.inlineSize;
  if (width !== undefined && width !== available) {
    available = width;
    applyWidth();
  }
});
// Observe a width-only box. The track itself grows taller when actions stack.
trackSize.observe(document.querySelector<HTMLElement>("#track-width")!);
applyWidth();
grip.hidden = false;

let drag:
  { id: number; x: number; startWidth: number; sign: number } | undefined;
let scheduled = 0;
grip.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || drag) return;
  drag = {
    id: event.pointerId,
    x: event.clientX,
    startWidth: actual,
    sign: getComputedStyle(frame).direction === "rtl" ? -1 : 1,
  };
  grip.setPointerCapture(event.pointerId);
  event.preventDefault(); // Resizing with the pointer preserves focus on the investigation.
});
function requestDrag(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.id) return;
  requested = clamp(drag.startWidth + (event.clientX - drag.x) * drag.sign);
  if (!scheduled)
    scheduled = requestAnimationFrame(() => {
      scheduled = 0;
      applyWidth();
    });
}
grip.addEventListener("pointermove", requestDrag);
grip.addEventListener("pointerup", (event) => {
  requestDrag(event);
  if (drag?.id === event.pointerId) drag = undefined;
});
grip.addEventListener("lostpointercapture", (event) => {
  if (drag?.id === event.pointerId) drag = undefined;
});
grip.addEventListener("keydown", (event) => {
  const step = event.shiftKey ? 32 : 8;
  switch (event.key) {
    case "ArrowLeft":
    case "ArrowDown":
      requested = clamp(actual - step);
      break;
    case "ArrowRight":
    case "ArrowUp":
      requested = clamp(actual + step);
      break;
    case "Home":
      requested = lower();
      break;
    case "End":
      requested = largest;
      break;
    default:
      return;
  }
  event.preventDefault();
  applyWidth();
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  trackSize.disconnect();
  actions.dispose();
  cancelAnimationFrame(scheduled);
});
