import App from "./App.tsx";
import { type Root } from "react-dom/client";
import { BrowserRouter } from "react-router";

export async function loadApplication(root: Root) {
  console.log(__APP_VERSION__);
  console.log(__COMMIT_SHA__);
  root.render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}
