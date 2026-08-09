import { createRoot } from "react-dom/client";
import App from "./App";

const container = document.getElementById("root");
const root = createRoot(container!);
// No React.StrictMode: its dev-only double-mount desyncs IonRouterOutlet/IonTabs' internal
// view stack (they track page visibility imperatively, not via React state), intermittently
// leaving a tab page stuck visible after switching tabs. StrictMode never runs in production,
// so this only affects local dev.
root.render(<App />);
