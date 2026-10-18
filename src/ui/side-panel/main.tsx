import { render } from "preact";
import { SidePanel } from "./SidePanel";
import "../shared/current-website-access.css";
import "../shared/toggle-switch.css";
import "../shared/scrollbars.css";
import "./side-panel.css";
import { applyAppearanceToDocument } from "../theme/apply-theme";

// The default palette lands before the first render, so no surface ever
// paints unstyled while the stored preference is being read (Task 034).
applyAppearanceToDocument(document);

const root = document.querySelector("#app");
if (!(root instanceof HTMLElement)) throw new Error("Side Panel root element is missing");
render(<SidePanel />, root);
