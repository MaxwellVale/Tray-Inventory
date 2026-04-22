import { Link } from "react-router-dom";
import { trays, trayContents } from "../data/inventory";

export default function Dashboard() {
  return (
    <main className="page">
      <section className="card">
        <p className="eyebrow">Proof of concept</p>
        <h1>Tray Inventory</h1>
        <p>
          Scan a tray tag or open a tray below to view the SKUs inside and make
          quantity changes.
        </p>

        <div className="tray-list">
          {trays.map((tray) => {
            const contents = trayContents.filter(
              (item) => item.trayId === tray.trayId
            );

            const totalQuantity = contents.reduce(
              (sum, item) => sum + item.quantity,
              0
            );

            return (
              <Link
                key={tray.trayId}
                className="tray-link"
                to={`/tray/${tray.trayId}`}
              >
                <div>
                  <strong>{tray.trayId}</strong>
                  <span>{tray.location}</span>
                </div>

                <div className="tray-summary">
                  {contents.length} SKU{contents.length === 1 ? "" : "s"} ·{" "}
                  {totalQuantity} total
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}