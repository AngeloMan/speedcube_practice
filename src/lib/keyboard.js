/** Shared keyboard helpers for the cube viewer, the timer and the rebinder. */

/** Physical key for an event, so Shift/Alt never change which key was pressed. */
export function keyFromEvent(event) {
  if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3).toLowerCase();
  if (/^Digit\d$/.test(event.code)) return event.code.slice(5);
  if (/^Numpad\d$/.test(event.code)) return event.code.slice(6);
  return (event.key ?? "").toLowerCase();
}

// Only controls where a keystroke means "text" or "choose an option" should
// swallow shortcuts. A focused checkbox must not — otherwise clicking a toggle
// silently disables the spacebar until you click elsewhere.
const TEXT_ENTRY_TYPES = new Set([
  "text",
  "search",
  "email",
  "url",
  "tel",
  "password",
  "number",
  "date",
  "time",
]);

export const isTypingTarget = (target) => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target.tagName === "TEXTAREA" || target.tagName === "SELECT") return true;
  if (target.tagName === "INPUT") return TEXT_ENTRY_TYPES.has(target.type);
  return false;
};
