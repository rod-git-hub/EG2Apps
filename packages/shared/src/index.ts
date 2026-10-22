// Code shared by EG2Notes and EG2Presentation.
export { onBridgeCall, serial } from "./bridge-queue.ts";
export { FlickAccelerator, rowsForStreak } from "./flick.ts";
export { askToExit, GlassesSession, REPEAT_MS, type GlassesSessionOptions } from "./glasses-session.ts";
export { EvenOutput, headerBoxWidth, pngFromBase64, toGesture, toLifecycle, type CornerImage, type Lifecycle, type PageBridge } from "./glasses-output.ts";
export { moveItem, removeItem } from "./list.ts";
export { MENU_CLOSE_WAIT_MS, MenuAfterClose } from "./menu-close.ts";
export type { Frame, FrameOutput, Gesture, GlassesMenu, ListScreen, ListStyle, Row, RowMenu, Screen, TextScreen } from "./model.ts";
export { fitHeader, LIST_HINT, Navigator, ROOT_LIST_HINT, splitHint, VISIBLE_ROWS, type NavigatorOptions } from "./navigator.ts";
export { MenuActions, MENU_IDS } from "./row-menu.ts";
export { bridgeKV, CHUNK_CHARS, evenStorageWorks, loadChunked, saveChunked, Store, type AsyncKV } from "./storage.ts";
export * from "./text.ts";
export * from "./doc.ts";
export { backupSection, button, confirmButton, el, moveButtons, Panel, privacyNote } from "./phone.ts";
export { applyTheme, listStyleSection, parseListStyle, parseTheme, themeSection, THEMES, watchSystemTheme, type Theme } from "./theme.ts";
export { layoutWordmark, wordmarkSvg } from "./wordmark.ts";
