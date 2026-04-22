import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import TrayPage from "./pages/TrayPage";
import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="app-header">
          <Link to="/" className="brand">
            Tray Inventory
          </Link>
        </header>

        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tray/:trayId" element={<TrayPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}