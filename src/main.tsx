import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import AdminApp from "./AdminApp";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<AdminApp />} />
      </Routes>
      <Toaster richColors position="top-right" />
    </BrowserRouter>
  </React.StrictMode>
);
