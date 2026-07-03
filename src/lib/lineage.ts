import type { Dispatch, SetStateAction } from "react";
import type { NewsData } from "../types";
import type { FilterState } from "./filter";
import type { Theme } from "./theme";

// Props every lineage receives from the App shell. Both themes render from
// the same state — divergence is presentation-only.
export type LineageProps = {
  data: NewsData | null;
  error: string | null;
  filterState: FilterState;
  setFilterState: (next: FilterState) => void;
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
  theme: Theme;
  setTheme: (next: Theme) => void;
};
