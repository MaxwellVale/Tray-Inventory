import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getDashboardTrays, searchFrameLocations } from "../api/inventory";

function highlightMatch(text, searchTerm) {
  if (!text) return text;

  const query = searchTerm.trim();
  if (!query) return text;

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escapedQuery})`, "ig");

  const parts = String(text).split(regex);

  return parts.map((part, index) =>
    regex.test(part) ? <mark key={index}>{part}</mark> : part
  );
}

const rackOrder = ["AA", "Z2", "Z1", "Y", "X", "W", "V", "U", "T", "S", "Test"];

export default function Dashboard() {
  const [trays, setTrays] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [frameResults, setFrameResults] = useState([]);
  const [status, setStatus] = useState("Loading trays...");
  const [frameStatus, setFrameStatus] = useState("Enter a frame search.");
  const [isSearchingFrames, setIsSearchingFrames] = useState(false);
  const [selectedRack, setSelectedRack] = useState("AA");

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

  useEffect(() => {
    const trimmedSearch = searchTerm.trim();

    if (!trimmedSearch) {
      setFrameResults([]);
      setFrameStatus("");
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setIsSearchingFrames(true);
        setFrameStatus("Searching frames...");
        const results = await searchFrameLocations(trimmedSearch);
        setFrameResults(results);
        setFrameStatus(
          results.length > 0
            ? `Found ${results.length} matching frame location${results.length === 1 ? "" : "s"}.`
            : 'No matching frame locations found.'
        );
      } catch (error) {
        setFrameResults([]);
        setFrameStatus(error.message || "Could not search frame locations.");
      } finally {
        setIsSearchingFrames(false);
      }
    }, 250);
    return () => clearTimeout(timeoutId);
  }, [searchTerm])

  const filteredTrays = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    if (!search) return trays;

    return trays.filter((tray) => {
      return (
        tray.tray_id?.toLowerCase().includes(search) ||
        tray.tray_name?.toLowerCase().includes(search) ||
        tray.rack?.toLowerCase().includes(search) ||
        String(tray.shelf ?? "").toLowerCase().includes(search) ||
        tray.location?.toLowerCase().includes(search) ||
        tray.notes?.toLowerCase().includes(search)
      );
    });
  }, [trays, searchTerm]);

  const groupedTrays = useMemo(() => {
    const grouped = {};

    for (const tray of filteredTrays) {
      const rackKey = tray.rack || "Unassigned Rack";
      const shelfKey = tray.shelf ?? "Unassigned Shelf";

      if (!grouped[rackKey]) grouped[rackKey] = {};
      if (!grouped[rackKey][shelfKey]) grouped[rackKey][shelfKey] = [];

      grouped[rackKey][shelfKey].push(tray);
    }

    // sort trays within each shelf
    for (const rackKey of Object.keys(grouped)) {
      for (const shelfKey of Object.keys(grouped[rackKey])) {
        grouped[rackKey][shelfKey].sort((a, b) =>
          a.tray_id.localeCompare(b.tray_id)
        );
      }
    }

    return grouped;
  }, [filteredTrays]);

  const groupedFrameResults = useMemo(() => {
    const grouped = {};

    for (const result of frameResults) {
      const key = result.frame_id;

      if (!grouped[key]) {
        grouped[key] = {
          frame_id: result.frame_id,
          frame_ids: result.frame_ids,
          totalQuantity: 0,
          trayLocations: [],
        };
      }

      grouped[key].totalQuantity += Number(result.quantity || 0);

      grouped[key].trayLocations.push({
        tray_id: result.trays?.tray_id,
        tray_name: result.trays?.tray_name,
        rack: result.trays?.rack,
        shelf: result.trays?.shelf,
        quantity: result.quantity,
      });
    }

    return Object.values(grouped).sort((a, b) =>
      a.frame_id.localeCompare(b.frame_id)
    );
  }, [frameResults]);

  const rackNavigatorData = useMemo(() => {
    return rackOrder
      .filter((rackKey) => groupedTrays[rackKey])
      .map((rackKey) => {
        const shelves = groupedTrays[rackKey];
        const shelfKeys = Object.keys(shelves);

        const trayCount = shelfKeys.reduce(
          (sum, shelfKey) => sum + shelves[shelfKey].length,
          0
        );

        const frameCount = shelfKeys.reduce(
          (sum, shelfKey) =>
            sum +
            shelves[shelfKey].reduce(
              (traySum, tray) => traySum + Number(tray.totalQuantity || 0),
              0
            ),
          0
        );

        return {
          rackKey,
          trayCount,
          frameCount,
        };
      });
  }, [groupedTrays]);

  const isSearchMode = searchTerm.trim() !== "";

  // console.log("dashboard trays length", trays.length);

  return (
    <main className="page">
      <section className="card">
        <p className="eyebrow">Inventory</p>
        <h1>Tray Inventory</h1>
        {/* <p>
          Search trays or frames from one bar. Leave it blank to browse by rack
          and shelf.
        </p> */}

        <label className="field">
          Search trays, frame IDs, models, colors, SKU, rack, shelf...
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="e.g. TRAY-014, 9772-04, 9772, BOX, Rack A"
          />
        </label>

        <button className="secondary-button" onClick={loadDashboard}>
          Refresh Dashboard
        </button>

        <p className="status">{status}</p>

        {!isSearchMode ? (
          <div className="dashboard-rack-layout">
            <div className="dashboard-rack-nav-column">
              <div className="rack-navigator">
                <p className="eyebrow">Rack Navigator</p>

                <div className="rack-navigator-layout">
                  <div className="rack-navigator-vertical">
                    {rackNavigatorData.slice(0, 8).map((rack) => (
                      <button
                        key={rack.rackKey}
                        className={`rack-nav-tile rack-nav-tile-vertical ${
                          selectedRack === rack.rackKey ? "rack-nav-tile-active" : ""
                        }`}
                        onClick={() => setSelectedRack(rack.rackKey)}
                      >
                        <span className="rack-nav-name">{rack.rackKey}</span>
                        {/* <span className="rack-nav-meta">
                          {rack.trayCount} tray{rack.trayCount === 1 ? "" : "s"} ·{" "}
                          {rack.frameCount} frame{rack.frameCount === 1 ? "" : "s"}
                        </span> */}
                      </button>
                    ))}
                  </div>

                  <div className="rack-navigator-horizontal">
                    {rackNavigatorData.slice(8).map((rack) => (
                      <button
                        key={rack.rackKey}
                        className={`rack-nav-tile rack-nav-tile-horizontal ${
                          selectedRack === rack.rackKey ? "rack-nav-tile-active" : ""
                        }`}
                        onClick={() => setSelectedRack(rack.rackKey)}
                      >
                        <span className="rack-nav-name">{rack.rackKey}</span>
                        {/* <span className="rack-nav-meta">
                          {rack.trayCount} tray{rack.trayCount === 1 ? "" : "s"} ·{" "}
                          {rack.frameCount} frame{rack.frameCount === 1 ? "" : "s"}
                        </span> */}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="dashboard-rack-detail-column">
              <div className="rack-groups">
                {rackOrder
                  .filter((rackKey) => rackKey === selectedRack && groupedTrays[rackKey])
                  .map((rackKey) => {
                    const rackTrayCount = Object.values(groupedTrays[rackKey]).reduce(
                      (sum, shelfTrays) => sum + shelfTrays.length,
                      0
                    );

                    const rackFrameCount = Object.values(groupedTrays[rackKey]).reduce(
                      (sum, shelfTrays) =>
                        sum +
                        shelfTrays.reduce(
                          (traySum, tray) => traySum + Number(tray.totalQuantity || 0),
                          0
                        ),
                      0
                    );

                    return (
                      <details key={rackKey} id={`rack-${rackKey}`} className="rack-group" open>
                        <summary className="rack-summary">
                          <span>Rack {rackKey}</span>
                          <span className="group-count">
                            {rackTrayCount} tray{rackTrayCount === 1 ? "" : "s"} · {" "}
                            {rackFrameCount} frame{rackFrameCount === 1 ? "" : "s"}
                          </span>
                        </summary>

                        <div className="rack-group-body">
                          {Object.keys(groupedTrays[rackKey])
                            .sort((a, b) => String(a).localeCompare(String(b)))
                            .map((shelfKey) => {
                              const shelfTrayCount = groupedTrays[rackKey][shelfKey].length;

                              const shelfFrameCount = groupedTrays[rackKey][shelfKey].reduce(
                                (sum, tray) => sum + Number(tray.totalQuantity || 0),
                                0
                              );

                              return (
                                <details key={shelfKey} className="shelf-group">
                                  <summary className="shelf-summary">
                                    <span>Shelf {shelfKey}</span>
                                    <span className="group-count">
                                      {shelfTrayCount} tray{shelfTrayCount === 1 ? "" : "s"} ·{" "}
                                      {shelfFrameCount} frame{shelfFrameCount === 1 ? "" : "s"}
                                    </span>
                                  </summary>

                                  <div className="shelf-group-body">
                                    <div className="tray-list">
                                      {groupedTrays[rackKey][shelfKey].map((tray) => (
                                        <Link
                                          key={tray.tray_id}
                                          className="tray-link"
                                          to={`/tray/${tray.tray_id}`}
                                        >
                                          <div className="tray-info">
                                            <strong>{highlightMatch(tray.tray_id, searchTerm)}</strong>
                                            <span>
                                              {highlightMatch(
                                                tray.tray_name || "Unnamed tray",
                                                searchTerm
                                              )}
                                            </span>
                                            <span>
                                              Rack {highlightMatch(tray.rack || "—", searchTerm)} / Shelf{" "}
                                              {highlightMatch(String(tray.shelf ?? "—"), searchTerm)}
                                            </span>
                                          </div>

                                          <div className="tray-summary">
                                            <span>
                                              {tray.frameCount} frame
                                              {tray.frameCount === 1 ? "" : "s"}
                                            </span>
                                            <span>
                                              {tray.totalQuantity} total
                                            </span>
                                          </div>
                                        </Link>
                                      ))}
                                    </div>
                                  </div>
                                </details>
                              );
                            })}
                        </div>
                      </details>
                    );
                  })}
              </div>
            </div>
          </div>
        ) : (
          <div className="search-results">
            <section className="card frame-search-card">
              <p className="eyebrow">Matching trays</p>
              <h2>Tray Results</h2>

              {filteredTrays.length === 0 ? (
                <p className="status">No matching trays.</p>
              ) : (
                <div className="tray-list">
                  {filteredTrays.map((tray) => (
                    <Link
                      key={tray.tray_id}
                      className="tray-link"
                      to={`/tray/${tray.tray_id}`}
                    >
                      <div className="tray-info">
                        <strong>{highlightMatch(tray.tray_id, searchTerm)}</strong>
                        <span>{highlightMatch(tray.tray_name || "Unnamed tray", searchTerm)}</span>
                        <span>
                          Rack {highlightMatch(tray.rack || "—", searchTerm)} / Shelf {highlightMatch(String(tray.shelf ?? "—"), searchTerm)}
                        </span>
                      </div>

                      <div className="tray-summary">
                        {tray.frameCount} frame{tray.frameCount === 1 ? "" : "s"} ·{" "}
                        {tray.totalQuantity} total
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="card frame-search-card">
              <p className="eyebrow">Matching frames</p>
              <h2>Frame Location Results</h2>

              <p className="status">
                {isSearchingFrames ? "Searching frames..." : frameStatus}
              </p>

              <div className="frame-results">
                {groupedFrameResults.map((result) => (
                  <article key={result.frame_id} className="frame-result-card">
                    <div>
                      <p className="sku">{highlightMatch(result.frame_id, searchTerm)}</p>
                      <p className="sku-detail">
                        Model {highlightMatch(result.frame_ids?.model || "—", searchTerm)} ·{" "}
                        {highlightMatch(result.frame_ids?.color || "—", searchTerm)}
                      </p>
                      <p className="sku-detail">
                        SKU: {highlightMatch(result.frame_ids?.sku || "—", searchTerm)}
                      </p>
                    </div>

                    <div className="frame-location-meta">
                      <div className="quantity-pill">
                        Total <strong>{result.totalQuantity}</strong>
                      </div>

                      <div className="tray-location-buttons">
                        {result.trayLocations.map((location, index) => (
                          <Link
                            key={`${location.tray_id}-${index}`}
                            className="button-link tray-location-button"
                            to={`/tray/${location.tray_id}`}
                          >
                            {highlightMatch(location.tray_id, searchTerm)} · Qty {location.quantity}
                          </Link>
                        ))}
                      </div>

                      <div className="tray-location-list">
                        {result.trayLocations.map((location, index) => (
                          <p key={`${location.tray_id}-meta-${index}`} className="sku-detail">
                            {highlightMatch(location.tray_name || "Unnamed tray", searchTerm)} — Rack{" "}
                            {highlightMatch(location.rack || "—", searchTerm)} / Shelf{" "}
                            {highlightMatch(String(location.shelf ?? "—"), searchTerm)}
                          </p>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}