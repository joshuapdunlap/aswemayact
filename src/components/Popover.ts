// Progressive enhancement for in-page anchors marked `data-popover-target="<id>"`.
//
// The markup already works without JavaScript: the trigger is an <a href="#id"> that
// jumps to its target. This script turns the target into a popover that the trigger
// toggles. It uses the native Popover API (popover="auto": Esc and light dismiss come
// from the browser) when HTMLElement.prototype.togglePopover exists, and otherwise a
// minimal ARIA toggle on the `hidden` attribute with Esc handled here.
//
// `data-popover-media="<media query>"` limits the enhancement to while that query
// matches (sidenotes: below 900px only; in the margin above it they need no popover).

const NATIVE = typeof HTMLElement !== "undefined" && "togglePopover" in HTMLElement.prototype;

function isOpen(target: HTMLElement): boolean {
  return NATIVE ? target.matches(":popover-open") : !target.hidden;
}

function enhance(trigger: HTMLElement, target: HTMLElement): void {
  const media = trigger.dataset.popoverMedia ? matchMedia(trigger.dataset.popoverMedia) : null;
  let active = false;
  // Light dismiss closes a native popover on pointerup, before the trigger's click;
  // remember whether it was open so that click does not reopen it.
  let openAtPointerDown = false;

  function setExpanded(open: boolean): void {
    trigger.setAttribute("aria-expanded", String(open));
  }

  function open(): void {
    if (NATIVE) target.showPopover();
    else target.hidden = false;
    setExpanded(true);
    target.focus();
  }

  function close(returnFocus: boolean): void {
    if (NATIVE) target.hidePopover();
    else target.hidden = true;
    setExpanded(false);
    if (returnFocus) trigger.focus();
  }

  function enable(): void {
    trigger.setAttribute("aria-controls", target.id);
    setExpanded(false);
    target.tabIndex = -1;
    if (NATIVE) target.setAttribute("popover", "auto");
    else target.hidden = true;
  }

  function disable(): void {
    if (isOpen(target)) close(false);
    trigger.removeAttribute("aria-controls");
    trigger.removeAttribute("aria-expanded");
    target.removeAttribute("tabindex");
    if (NATIVE) target.removeAttribute("popover");
    else target.hidden = false;
  }

  function apply(): void {
    const want = !media || media.matches;
    if (want === active) return;
    active = want;
    if (want) enable();
    else disable();
  }

  trigger.addEventListener("pointerdown", () => {
    openAtPointerDown = active && isOpen(target);
  });

  trigger.addEventListener("click", (event) => {
    if (!active) return; // plain anchor jump
    event.preventDefault();
    if (isOpen(target) || openAtPointerDown) close(false);
    else open();
    openAtPointerDown = false;
  });

  if (NATIVE) {
    // Esc and light dismiss close the popover without our code: keep aria-expanded in
    // step, and hand focus back to the trigger if it was inside the note.
    target.addEventListener("toggle", (event) => {
      const opened = (event as ToggleEvent).newState === "open";
      setExpanded(opened);
      if (!opened && (target.contains(document.activeElement) || document.activeElement === document.body)) {
        trigger.focus();
      }
    });
  } else {
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && active && isOpen(target)) close(true);
    });
  }

  media?.addEventListener("change", apply);
  apply();
}

/** Enhance every `[data-popover-target]` trigger under `root` (once each). */
export function enhancePopovers(root: ParentNode = document): void {
  for (const trigger of root.querySelectorAll<HTMLElement>("[data-popover-target]")) {
    if (trigger.dataset.popoverReady !== undefined) continue;
    const target = document.getElementById(trigger.dataset.popoverTarget ?? "");
    if (!target) continue;
    trigger.dataset.popoverReady = "";
    enhance(trigger, target);
  }
}
