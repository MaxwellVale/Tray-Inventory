import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDashboardTrays, searchFrameLocations } from "../api/inventory";

export default function Dashboard() {
  const [trays, setTrays] = useState([]);
  const [traySearchTerm, setTraySearchTerm] = useState("");
  const [frameSearchTerm, setFrameSearchTerm] = useState("");
  const [frameResults, setFrameResults] = useState([]);
  const [status, setStatus] = useState("Loading trays...");
  const [frameStatus, setFrameStatus] = useState("Enter a frame search.");
  const [isSearchingFrames, setIsSearchingFrames] = useState(false);

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

  async function handleFrameSearch(event) {
    event.preventDefault();

    if (!frameSearchTerm.trim()) {
      setFrameResults([]);
      setFrameStatus("Enter a frame search.");
      return;
    }

    try {
      setIsSearchingFrames(true);
      setFrameStatus("Searching...");
      const results = await searchFrameLocations(frameSearchTerm);
      setFrameResults(results);
      setFrameStatus(
        results.length > 0
          ? `Found ${results.length} matching location${results.length === 1 ? "" : "s"}.`
          : "No matching frame locations found."
      );
    } catch (error) {
      setFrameStatus(error.message || "Could not search frame locations.");
    } finally {
      setIsSearchingFrames(false);
    }
  }

  const filteredTrays = trays.filter((tray) => {
    const search = traySearchTerm.toLowerCase();

    return (
      tray.tray_id?.toLowerCase().includes(search) ||
      tray.tray_name?.toLowerCase().includes(search) ||
      tray.rack?.toLowerCase().includes(search) ||
      tray.shelf?.toLowerCase().includes(search) ||
      tray.notes?.toLowerCase().includes(search)
    );
  });

  return (
    <main className="page">
      <section className="card">
        <p className="eyebrow">Inventory</p>
        <h1>Tray Inventory</h1>
        <p>Search trays or search for a frame to see where it is located.</p>

        <label className="field">
          Search trays
          <input
            value={traySearchTerm}
            onChange={(event) => setTraySearchTerm(event.target.value)}
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
                <span>{"Rack " + tray.rack + " / Shelf " + tray.shelf || "No location set"}</span>
              </div>

              <div className="tray-summary">
                {tray.frameCount} SKU{tray.frameCount === 1 ? "" : "s"} ·{" "}
                {tray.totalQuantity} frame{tray.totalQuantity === 1 ? "" : "s"}
              </div>
            </Link>
          ))}
        </div>

        {filteredTrays.length === 0 && (
          <p className="status">No trays match your search.</p>
        )}
      </section>

      <section className="card frame-search-card">
        <p className="eyebrow">Frame lookup</p>
        <h2>Find a frame in trays</h2>

        <form onSubmit={handleFrameSearch}>
          <label className="field">
            Search by frame ID, model, color, or SKU
            <input
              value={frameSearchTerm}
              onChange={(event) => setFrameSearchTerm(event.target.value)}
              placeholder="e.g. 9772-04 or 9772"
            />
          </label>

          <button disabled={isSearchingFrames} type="submit">
            Search Frames
          </button>
        </form>

        <p className="status">{frameStatus}</p>

        <div className="frame-results">
          {frameResults.map((result) => (
            <article key={result.id} className="frame-result-card">
              <div>
                <p className="sku">{result.frame_id}</p>
                <p className="sku-detail">
                  Model {result.frame_ids?.model || "—"} ·{" "}
                  {result.frame_ids?.color || "—"}
                </p>
                <p className="sku-detail">
                  SKU: {result.frame_ids?.sku || "—"}
                </p>
              </div>

              <div className="frame-location-meta">
                <div className="quantity-pill">
                  Qty <strong>{result.quantity}</strong>
                </div>

                <Link
                  className="button-link"
                  to={`/tray/${result.trays?.tray_id}`}
                >
                  {result.trays?.tray_id}
                </Link>

                <p className="sku-detail">
                  {result.trays?.tray_name || "Unnamed tray"}
                </p>
                <p className="sku-detail">
                  {result.trays?.rack + " / " + result.trays?.shelf || "No location set"}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}