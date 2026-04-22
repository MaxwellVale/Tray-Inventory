import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { trays, trayContents } from "../data/inventory";

export default function TrayPage() {
  const { trayId } = useParams();

  const tray = trays.find((tray) => tray.trayId === trayId);

  const startingContents = useMemo(() => {
    return trayContents.filter((item) => item.trayId === trayId);
  }, [trayId]);

  const [contents, setContents] = useState(startingContents);
  const [user, setUser] = useState("");
  const [changeAmount, setChangeAmount] = useState(1);
  const [status, setStatus] = useState("Ready");

  if (!tray) {
    return (
      <main className="page">
        <section className="card">
          <h1>Tray not found</h1>
          <p>No tray exists with ID: {trayId}</p>
          <Link to="/" className="button-link">
            Back to dashboard
          </Link>
        </section>
      </main>
    );
  }

  function updateQuantity(sku, delta) {
    if (!user.trim()) {
      setStatus("Enter initials before making a change.");
      return;
    }

    setContents((currentContents) =>
      currentContents.map((item) => {
        if (item.sku !== sku) return item;

        const nextQuantity = Math.max(0, item.quantity + delta);

        return {
          ...item,
          quantity: nextQuantity,
        };
      })
    );

    const sign = delta > 0 ? "+" : "";
    setStatus(`${user.trim()} changed ${sku} by ${sign}${delta}`);
  }

  return (
    <main className="page">
      <section className="card">
        <Link to="/" className="back-link">
          ← Back
        </Link>

        <p className="eyebrow">Tray</p>
        <h1>{tray.trayId}</h1>

        <div className="meta-grid">
          <div>
            <span>Location</span>
            <strong>{tray.location}</strong>
          </div>

          <div>
            <span>SKUs in tray</span>
            <strong>{contents.length}</strong>
          </div>
        </div>

        <p>{tray.notes}</p>

        <label className="field">
          Initials / sign-off
          <input
            value={user}
            onChange={(event) => setUser(event.target.value)}
            placeholder="e.g. MV"
          />
        </label>

        <label className="field">
          Change amount
          <input
            type="number"
            min="1"
            value={changeAmount}
            onChange={(event) =>
              setChangeAmount(Math.max(1, Number(event.target.value)))
            }
          />
        </label>

        <div className="sku-list">
          {contents.map((item) => (
            <article key={item.sku} className="sku-card">
              <div className="sku-main">
                <div>
                  <p className="sku">{item.sku}</p>
                  <p className="sku-detail">
                    Model {item.model} · {item.color}
                  </p>
                </div>

                <div className="quantity-pill">
                  Qty <strong>{item.quantity}</strong>
                </div>
              </div>

              <div className="button-row">
                <button onClick={() => updateQuantity(item.sku, -changeAmount)}>
                  Remove {changeAmount}
                </button>

                <button onClick={() => updateQuantity(item.sku, changeAmount)}>
                  Add {changeAmount}
                </button>
              </div>
            </article>
          ))}
        </div>

        <p className="status">{status}</p>
      </section>
    </main>
  );
}