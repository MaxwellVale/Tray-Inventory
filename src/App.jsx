import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import TrayPage from "./pages/TrayPage";
import LoginPage from "./pages/LoginPage";
import { useAuth } from "./lib/AuthContext";
import { signOutUser } from "./lib/auth";
import "./App.css";
import { Analytics } from "@vercel/analytics/react";

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

// split App and AppContent to make use of the useLocation() hook 
function AppContent() {
  const { authUser, authLoading } = useAuth();
  const location = useLocation();

  async function handleSignOut() {
    await signOutUser();
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <Link to="/" className="brand">
            Tray Inventory
          </Link>

          <div className="header-actions">
            {authLoading ? (
              <span>Loading...</span>
            ) : authUser ? (
              <>
                <span className="user-label">{authUser.email}</span>
                <button className="secondary-button" onClick={handleSignOut}>
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                to="/login"
                state={{ from: location }}
                className="button-link"
              >
                Staff Login
              </Link>
            )}
          </div>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tray/:trayId" element={<TrayPage />} />
        <Route path="/login" element={<LoginPage />} />
      </Routes>

      <Analytics />
    </div>
  );
}