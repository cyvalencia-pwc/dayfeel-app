import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./hooks/queries";
import { useAuth } from "./store/auth";
import { App } from "./routes/App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./styles.css";
useAuth.subscribe((state, previous) => {
  if (state.generation !== previous.generation) queryClient.clear();
});
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
