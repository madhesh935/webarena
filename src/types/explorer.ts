import type { ExplorerQuery, SortKey } from "../lib/filters";
import type { SourceId } from "./receipt";

export type BreakpointName = "mobile" | "tablet" | "desktop" | "wide";

export type ExplorerViewState = ExplorerQuery & {
  page: number;
  receipt: string | null;
};

export type StoryViewState = {
  step: number;
  receipt: string | null;
};

export type SortOption = {
  value: SortKey;
  label: string;
};

export type SourceFilterChip = {
  id: SourceId;
  pressed: boolean;
};
