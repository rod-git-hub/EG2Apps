// The glasses menu (Even's: tap, then press and hold) on lists and on an opened item: Move up, Move down, Select and
// Delete, acting on the row under the cursor (or on the item a text page shows). Every delete asks first and says what
// goes with it; Select marks rows (★ / ☆) and deletes them with one confirmation. There is no undo and no server
// backup: the phone page's Export is the safety net.

import type { GlassesMenu, Row, RowMenu, Screen } from "./model.ts";
import type { Navigator } from "./navigator.ts";

export const MENU_IDS = { moveUp: 2, moveDown: 3, delete: 4, select: 6 } as const;

const ITEM = {
  moveUp: { name: "Move up", id: MENU_IDS.moveUp },
  moveDown: { name: "Move down", id: MENU_IDS.moveDown },
  select: { name: "Select", id: MENU_IDS.select },
  delete: { name: "Delete", id: MENU_IDS.delete },
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export class MenuActions {
  private nav: Navigator | null = null;
  private selection: { key: string; ids: Set<string> } | null = null;
  private readonly onChange: () => void;

  /** `onChange` runs after every change to the data (save it, refresh the phone page). */
  constructor(onChange: () => void) {
    this.onChange = onChange;
  }

  attach(nav: Navigator): void {
    this.nav = nav;
  }

  /** True while a list is in select mode. */
  get selecting(): boolean {
    return this.selection !== null;
  }

  /**
   * The glasses menu for a screen: on lists with items, and on an opened item. Same items → no page rebuild. On Even's
   * list (`native`) a pick can't tell which row is highlighted, so its lists have no menu: open an item to use it.
   */
  menuFor(screen: Screen, native = false): GlassesMenu | undefined {
    const items = screen.kind === "list"
      ? !native && screen.rows.some((r) => r.menu) ? [ITEM.moveUp, ITEM.moveDown, ...(screen.selectKey ? [ITEM.select] : []), ITEM.delete] : []
      : screen.menu ? [ITEM.moveUp, ITEM.moveDown, ITEM.delete] : [];
    return items.length ? { key: items.map((i) => i.id).join(","), items } : undefined;
  }

  /** Select mode: the list shows only its items (★ selected, ☆ not) under "Delete N selected" and "Cancel". */
  decorate(screen: Screen): Screen {
    const sel = this.selection;
    if (screen.kind !== "list" || !sel || sel.key !== screen.selectKey) return screen;
    const items = screen.rows.filter((r): r is Row & { id: string; menu: RowMenu } => !!r.id && !!r.menu);
    const chosen = items.filter((r) => sel.ids.has(r.id));
    return {
      ...screen,
      header: `${screen.header} · SELECT`,
      hint: "tap = select · double tap = done",
      cursorOnly: true,
      onBack: () => {
        this.selection = null;
        return true; // leave select mode, stay on the list
      },
      rows: [
        { label: `■ Delete ${chosen.length} selected`, onSelect: () => this.confirmMany(chosen) },
        { label: "○ Cancel", onSelect: () => { this.selection = null; this.nav?.refresh(); } },
        { label: "", spacer: true },
        ...items.map((r) => ({
          label: `${sel.ids.has(r.id) ? "★" : "☆"} ${r.label}`,
          id: r.id,
          onSelect: () => {
            if (sel.ids.has(r.id)) sel.ids.delete(r.id);
            else sel.ids.add(r.id);
            this.nav?.refresh();
          },
        })),
      ],
    };
  }

  /** A pick from the glasses menu, with the screen on show and the row under the cursor. */
  handle(itemId: number, screen: Screen, row: Row | null): void {
    const nav = this.nav;
    if (!nav || this.selection) return; // select mode has its own rows
    const target = screen.kind === "list" ? row?.menu : screen.menu;
    if (!target) return; // e.g. the cursor is on "+ New"
    switch (itemId) {
      case MENU_IDS.moveUp:
      case MENU_IDS.moveDown: {
        const delta = itemId === MENU_IDS.moveUp ? -1 : 1;
        if (!target.move(delta)) return; // already first / last
        this.onChange();
        if (screen.kind === "list") nav.cursorBy(delta); // the cursor follows the item
        else nav.refresh();
        return;
      }
      case MENU_IDS.select: {
        if (screen.kind !== "list" || !screen.selectKey || !row?.id) return;
        this.selection = { key: screen.selectKey, ids: new Set([row.id]) };
        const items = screen.rows.filter((r) => r.id && r.menu);
        nav.setCursor(3 + Math.max(0, items.findIndex((r) => r.id === row.id))); // Delete, Cancel and a blank line first
        return;
      }
      case MENU_IDS.delete:
        this.confirm(`Delete "${target.name}"?${target.contains ? `\n(${target.contains} will be deleted too)` : ""}`, () => {
          target.remove();
          return screen.kind === "text"; // an opened item's page closes with it
        });
        return;
    }
  }

  private confirmMany(items: { menu: RowMenu }[]): void {
    if (!items.length) {
      this.nav?.push(() => ({ kind: "text", header: "SELECT", body: "Nothing selected yet: tap items to select them.\n\n(double tap = back)" }));
      return;
    }
    this.confirm(`Delete ${plural(items.length, "selected item")}?\n(anything inside them is deleted too)`, () => {
      for (const r of items) r.menu.remove();
      this.selection = null;
      return false;
    });
  }

  /** Asks first; `run` deletes and says whether the page under the question closes too. */
  private confirm(question: string, run: () => boolean): void {
    const nav = this.nav;
    if (!nav) return;
    nav.push(() => ({
      kind: "text",
      header: "DELETE?",
      body: `${question}\nThis can't be undone.`,
      hint: "tap = delete · double tap = cancel",
      onTap: () => {
        const closePage = run();
        this.onChange();
        nav.pop();
        if (closePage) nav.pop();
      },
    }));
  }
}
