// Screen model for the glasses. Every screen is either a list (rows you move through with the text cursor and pick
// with a tap) or a text page (a note, a topic's details, a message), shown a page at a time.

/** The glasses-menu actions on a row (or on what a text page shows). */
export interface RowMenu {
  /** Name shown in confirmations, e.g. "Groceries". */
  name: string;
  /** Moves the item up (-1) or down (+1); false at the edges. */
  move: (delta: -1 | 1) => boolean;
  remove: () => void;
  /** What a delete also removes, for the confirmation (e.g. "3 topics inside"). */
  contains?: string;
}

export interface Row {
  label: string;
  /** The record behind a data row; action rows have none. */
  id?: string;
  /** A blank line between groups of rows; the cursor skips it. */
  spacer?: boolean;
  /** Runs on a tap when the cursor is on this row. */
  onSelect?: () => void;
  /** Glasses-menu actions for data rows; action rows have none. */
  menu?: RowMenu;
}

export interface ListScreen {
  kind: "list";
  header: string;
  rows: Row[];
  /** Shown when there are no rows (never a blank page). */
  empty?: string;
  /** Runs on double tap; return true to stay on this screen (e.g. leave select mode instead). */
  onBack?: () => boolean | void;
  /** Identifies a list whose rows can be selected for deleting several at once (glasses menu → Select). */
  selectKey?: string;
  /** The gesture line under the frame; lists get a standard one when absent. */
  hint?: string;
  /** Redrawn every second while on show (the talk stopwatch). */
  ticks?: boolean;
  /**
   * Always drawn with the text cursor, even when Even's select box is chosen: checklists (a tick changes the list, and
   * Even's list then jumps back to the top) and select mode.
   */
  cursorOnly?: boolean;
}

export interface TextScreen {
  kind: "text";
  header: string;
  /** The text, split into pages of whole lines; a swipe turns the page. */
  body: string;
  /** Runs on a tap (e.g. tick or untick a topic). */
  onTap?: () => void;
  /** Runs on double tap before going back; return true to stay. */
  onBack?: () => boolean | void;
  /** A swipe down on the last page (e.g. on to the next topic); without it the swipe does nothing. */
  onPastEnd?: () => void;
  /** A swipe up on the first page. */
  onPastStart?: () => void;
  /** Glasses-menu actions for what this page shows (a note, a topic). */
  menu?: RowMenu;
  hint?: string;
  ticks?: boolean;
}

export type Screen = ListScreen | TextScreen;

/**
 * The page's glasses menu (Even's: tap, then press and hold): our items in order, at most 10, names up to 32 bytes.
 * `key` changes when the items do (the page is rebuilt: Even sets menus only then).
 */
export interface GlassesMenu {
  key: string;
  items: { name: string; id: number }[];
}

/** What the navigator tells every output (the glasses, the phone page's preview) to show. */
export interface Frame {
  header: string;
  body: string;
  /** The cursor's row on a list, otherwise null. */
  cursor: number | null;
  /** The gesture line under the frame ("" for none). */
  hint: string;
  menu?: GlassesMenu;
  /** Even's native list (its select box) instead of the body: the glasses draw the highlight and scroll it. */
  list?: string[];
}

/** How lists look on the glasses: the app's text cursor, or Even's own select box (a phone setting). */
export type ListStyle = "cursor" | "native";

export interface FrameOutput {
  show(frame: Frame): void | Promise<void>;
}

/** Normalised input. */
export type Gesture =
  /** `rows`: how many rows to move (ring flicks speed up in ring mode; default 1). */
  | { type: "up"; rows?: number }
  | { type: "down"; rows?: number }
  /** `row`: the row Even's list reported (its select box); absent for taps on the text cursor's lists. */
  | { type: "tap"; row?: number }
  | { type: "double-tap" }
  | { type: "menu"; itemId: number };
