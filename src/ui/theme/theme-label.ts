import type { Messages } from "../../i18n/catalogue";
import type { ThemeId } from "./themes";

/**
 * Task 037 Addendum B. A theme's name, in the reader's language. The catalogue
 * is the only place a theme is named: a theme added without an entry here does
 * not compile, rather than showing English to a reader who chose Chinese.
 */
export function themeLabel(id: ThemeId, messages: Messages): string {
  switch (id) {
    case "default":
      return messages.themeDefault();
    case "ocean":
      return messages.themeOcean();
    case "forest":
      return messages.themeForest();
    case "amber":
      return messages.themeAmber();
    case "graphite":
      return messages.themeGraphite();
    case "plum":
      return messages.themePlum();
  }
}
