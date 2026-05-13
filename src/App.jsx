import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import TrayPage from "./pages/TrayPage";
import LoginPage from "./pages/LoginPage";
import { useAuth } from "./lib/AuthContext";
import { signOutUser } from "./lib/auth";
import "./App.css";

export default function App() {
  const { authUser, authLoading } = useAuth();

  async function handleSignOut() {
    await signOutUser();
  }

  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="app-header">
          <div className="app-header-inner">
            <Link to="/" className="brand">
              Tray Inventory
            </Link>

            <div className="header-actions"> {/* User Login Header */}
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
                <Link to="/login" className="button-link">
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
      </div>
    </BrowserRouter>
  );
}