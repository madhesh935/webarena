import type { SourceId } from "../types/receipt";
import { BREAKPOINT_PX } from "./breakpoints";

export const PAGE_SIZE = 24;
export const SEARCH_DEBOUNCE_MS = 200;
export const SESSION_GAP_MS = 30 * 60 * 1000;
export const STORAGE_KEY = "life-in-receipts.saved.v1";
export const PRODUCT_NAME = "Life in Receipts";
export const FRAMING = "Separate sources, shared themes.";
export const SOURCE_ORDER: SourceId[] = ["spotify", "household", "customer"];

export const BREAKPOINTS = BREAKPOINT_PX;
