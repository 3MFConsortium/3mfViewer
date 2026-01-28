import React from "react";

import { ThreeMFLoaderProvider } from "./components/loaders/ThreeMFLoader.jsx";
import { ThemeProvider } from "./contexts/ThemeContext.jsx";
import ViewerBootstrap from "./app/ViewerBootstrap.jsx";

export default function App() {
  return (
    <ThemeProvider>
      <ThreeMFLoaderProvider>
        <ViewerBootstrap />
      </ThreeMFLoaderProvider>
    </ThemeProvider>
  );
}
