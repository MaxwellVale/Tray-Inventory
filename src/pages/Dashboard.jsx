import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDashboardTrays } from "../api/inventory";

export default function Dashboard() {
  const [trays, setTrays] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [status, setStatus] = useState("Loading trays...");

  async function loadDashboard() {
    try {
      setStatus("Loading trays...");
      const trayData = await getDashboardTrays();

      setTrays(trayData);
      setStatus("Ready");
    } catch (error) {
      setStatus(error.message || "Could not load trays.");
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const filteredTrays = trays.filter((tray) => {
    const search = searchTerm.toLowerCase();

    return (
      tray.tray_id?.toLowerCase().includes(search) ||
      tray.tray_name?.toLowerCase().includes(search) ||
      tray.location?.toLowerCase().includes(search) ||
      tray.notes?.toLowerCase().includes(search)
    );
  });

  return (
    <main className="page">
      <section className="card">
        <p className="eyebrow">Proof of concept</p>
        <h1>Tray Inventory</h1>
        <p>
          Open a tray below to view the SKUs inside and stage quantity changes.
        </p>

        <label className="field">
          Search trays
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by tray ID, name, location, or notes"
          />
        </label>

        <button className="secondary-button" onClick={loadDashboard}>
          Refresh Dashboard
        </button>

        <p className="status">{status}</p>

        <div className="tray-list">
          {filteredTrays.map((tray) => (
            <Link
              key={tray.tray_id}
              className="tray-link"
              to={`/tray/${tray.tray_id}`}
            >
              <div>
                <strong>{tray.tray_id}</strong>
                <span>{tray.tray_name || "Unnamed tray"}</span>
                <span>{tray.location || "No location set"}</span>
              </div>

              <div className="tray-summary">
                {tray.skuCount} SKU{tray.skuCount === 1 ? "" : "s"} ·{" "}
                {tray.totalQuantity} total
              </div>
            </Link>
          ))}
        </div>

        {filteredTrays.length === 0 && (
          <p className="status">No trays match your search.</p>
        )}
      </section>
    </main>
  );
}