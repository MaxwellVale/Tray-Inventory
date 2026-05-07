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

export default function Dashboard() {
  const [trays, setTrays] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
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

  const isSearchMode = searchTerm.trim() !== "";

  return (
    <main className="page">
      <section className="card">
        <p className="eyebrow">Inventory</p>
        <h1>Tray Inventory</h1>
        <p>
          Search trays or frames from one bar. Leave it blank to browse by rack
          and shelf.
        </p>

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
          <div className="rack-groups">
            {Object.keys(groupedTrays)
              .sort()
              .map((rackKey) => (
                <details key={rackKey} className="rack-group" open>
                  <summary className="rack-summary">Rack {rackKey}</summary>

                  <div className="rack-group-body">
                    {Object.keys(groupedTrays[rackKey])
                      .sort((a, b) => String(a).localeCompare(String(b)))
                      .map((shelfKey) => (
                        <details key={shelfKey} className="shelf-group">
                          <summary className="shelf-summary">Shelf {shelfKey}</summary>

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
                                    {tray.frameCount} frame
                                    {tray.frameCount === 1 ? "" : "s"} · {tray.totalQuantity} total
                                  </div>
                                </Link>
                              ))}
                            </div>
                          </div>
                        </details>
                      ))}
                  </div>
                </details>
              ))}
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
                {frameResults.map((result) => (
                  <article key={result.id} className="frame-result-card">
                    <div>
                      <p className="sku">{highlightMatch(result.frame_id, searchTerm)}</p>
                      <p className="sku-detail">
                        SKU: {highlightMatch(result.frame_ids?.sku || "—", searchTerm)}
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
                        Rack {result.trays?.rack || "—"} / Shelf{" "}
                        {result.trays?.shelf ?? "—"}
                      </p>
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
//   const filteredTrays = trays.filter((tray) => {
//     const search = traySearchTerm.toLowerCase();

//     return (
//       tray.tray_id?.toLowerCase().includes(search) ||
//       tray.tray_name?.toLowerCase().includes(search) ||
//       tray.rack?.toLowerCase().includes(search) ||
//       tray.shelf?.toLowerCase().includes(search) ||
//       tray.notes?.toLowerCase().includes(search)
//     );
//   });

//   return (
//     <main className="page">
//       <section className="card">
//         {/* <p className="eyebrow">Inventory</p> */}
//         <h1>Tray Inventory</h1>
//         <p>Search trays or search for a frame to see where it is located.</p>

//         <label className="field">
//           Search trays
//           <input
//             value={traySearchTerm}
//             onChange={(event) => setTraySearchTerm(event.target.value)}
//             placeholder="Search by tray ID, name, location, or notes"
//           />
//         </label>

//         <button className="secondary-button" onClick={loadDashboard}>
//           Refresh Dashboard
//         </button>

//         <p className="status">{status}</p>

//         <div className="tray-list">
//           {filteredTrays.map((tray) => (
//             <Link
//               key={tray.tray_id}
//               className="tray-link"
//               to={`/tray/${tray.tray_id}`}
//             >
//               <div className="tray-info">
//                 <strong>{tray.tray_id}</strong>
//                 <span>{tray.tray_name || "Unnamed tray"}</span>
//                 <span>{"Rack " + tray.rack + " / Shelf " + tray.shelf || "No location set"}</span>
//               </div>

//               <div className="tray-summary">
//                 {tray.frameCount} SKU{tray.frameCount === 1 ? "" : "s"} ·{" "}
//                 {tray.totalQuantity} frame{tray.totalQuantity === 1 ? "" : "s"}
//               </div>
//             </Link>
//           ))}
//         </div>

//         {filteredTrays.length === 0 && (
//           <p className="status">No trays match your search.</p>
//         )}
//       </section>

//       <section className="card frame-search-card">
//         <p className="eyebrow">Frame lookup</p>
//         <h2>Find a frame in trays</h2>

//         <form onSubmit={handleFrameSearch}>
//           <label className="field">
//             Search by frame ID, model, color, or SKU
//             <input
//               value={frameSearchTerm}
//               onChange={(event) => setFrameSearchTerm(event.target.value)}
//               placeholder="e.g. 9772-04 or 9772"
//             />
//           </label>

//           <button disabled={isSearchingFrames} type="submit">
//             Search Frames
//           </button>
//         </form>

//         <p className="status">{frameStatus}</p>

//         <div className="frame-results">
//           {frameResults.map((result) => (
//             <article key={result.id} className="frame-result-card">
//               <div>
//                 <p className="sku">{result.frame_id}</p>
//                 <p className="sku-detail">
//                   Model {result.frame_ids?.model || "—"} ·{" "}
//                   {result.frame_ids?.color || "—"}
//                 </p>
//                 <p className="sku-detail">
//                   SKU: {result.frame_ids?.sku || "—"}
//                 </p>
//               </div>

//               <div className="frame-location-meta">
//                 <div className="quantity-pill">
//                   Qty <strong>{result.quantity}</strong>
//                 </div>

//                 <Link
//                   className="button-link"
//                   to={`/tray/${result.trays?.tray_id}`}
//                 >
//                   {result.trays?.tray_id}
//                 </Link>

//                 <p className="sku-detail">
//                   {result.trays?.tray_name || "Unnamed tray"}
//                 </p>
//                 <p className="sku-detail">
//                   {"Rack " + result.trays?.rack + " / Shelf " + result.trays?.shelf || "No location set"}
//                 </p>
//               </div>
//             </article>
//           ))}
//         </div>
//       </section>
//     </main>
//   );
// }