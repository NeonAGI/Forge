import { createRoot } from "react-dom/client";
import App from "./App";

// Ensure CSS is loaded properly with explicit path
import "./index.css";

import { ThemeProvider } from "@/components/ui/theme-provider";

// Mark the root element with a data attribute to confirm React is mounting
const rootElement = document.getElementById("root");
if (rootElement) {
  rootElement.setAttribute("data-app-loaded", "true");
}

createRoot(rootElement!).render(
  <ThemeProvider defaultTheme="light">
    <App />
  </ThemeProvider>
);
