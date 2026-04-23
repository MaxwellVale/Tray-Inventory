import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getTray,
  getTrayContents,
  submitInventoryChanges,
} from "../api/inventory";

export default function TrayPage() {
  const { trayId } = useParams();

  const [tray, setTray] = useState(null);
  const [contents, setContents] = useState([]);
  const [pendingChanges, setPendingChanges] = useState({});
  const [user, setUser] = useState("");
  const [changeAmount, setChangeAmount] = useState(1);
  const [changeAmountInput, setChangeAmountInput] = useState("1");
  const [status, setStatus] = useState("Loading...");
  const [isSaving, setIsSaving] = useState(false);

  async function loadTrayData() {
    try {
      setStatus("Loading...");
      const [trayData, contentsData] = await Promise.all([
        getTray(trayId),
        getTrayContents(trayId),
      ]);

      setTray(trayData);
      setContents(contentsData);
      setPendingChanges({});
      setStatus("Ready");
    } catch (error) {
      setStatus(error.message || "Could not load tray.");
    }
  }

  useEffect(() => {
    loadTrayData();
  }, [trayId]);

  const stagedChanges = useMemo(() => {
    return contents
      .map((item) => {
        const pendingChange = pendingChanges[item.id] || 0;

        return {
          contentId: item.id,
          trayId: item.tray_id,
          frame_id: item.frame_id,
          currentQuantity: item.quantity,
          changeAmount: pendingChange,
          nextQuantity: Math.max(0, item.quantity + pendingChange),
        };
      })
      .filter((change) => change.changeAmount !== 0);
  }, [contents, pendingChanges]);

  function stageChange(item, delta) {
    setPendingChanges((currentChanges) => {
      const currentPendingChange = currentChanges[item.id] || 0;
      const proposedPendingChange = currentPendingChange + delta;
      const proposedNextQuantity = item.quantity + proposedPendingChange;

      // Prevent staging a quantity below zero.
      if (proposedNextQuantity < 0) {
        setStatus(`Cannot reduce ${item.frame_id} below zero.`);
        return currentChanges;
      }

      return {
        ...currentChanges,
        [item.id]: proposedPendingChange,
      };
    });

    const sign = delta > 0 ? "+" : "";
    setStatus(`Staged ${sign}${delta} for ${item.frame_id}`);
  }

  function clearPendingChanges() {
    setPendingChanges({});
    setStatus("Pending changes cleared.");
  }

  async function submitChanges() {
    if (!user.trim()) {
      setStatus("Enter initials before submitting changes.");
      return;
    }

    if (stagedChanges.length === 0) {
      setStatus("No pending changes to submit.");
      return;
    }

    try {
      setIsSaving(true);
      setStatus("Submitting changes...");

      const results = await submitInventoryChanges({
        changes: stagedChanges,
        signedBy: user.trim(),
      });

      setContents((currentContents) =>
        currentContents.map((item) => {
          const submittedItem = results.find(
            (result) => result.contentId === item.id
          );

          if (!submittedItem) return item;

          return {
            ...item,
            quantity: submittedItem.quantity,
          };
        })
      );

      setPendingChanges({});

      const totalChanges = results.length;
      setStatus(
        `Submitted ${totalChanges} change${totalChanges === 1 ? "" : "s"}.`
      );
    } catch (error) {
      setStatus(error.message || "Could not submit changes.");
    } finally {
      setIsSaving(false);
    }
  }

    function handleChangeAmountInput(event) {
        setChangeAmountInput(event.target.value);
    }

    function commitChangeAmount() {
        const trimmedValue = changeAmountInput.trim();

        if (trimmedValue === "") {
            setChangeAmountInput(String(changeAmount));
            return;
        }

        const parsedValue = Number(trimmedValue);

        if (!Number.isFinite(parsedValue) || parsedValue < 1) {
            setChangeAmountInput(String(changeAmount));
            return;
        }

        const nextValue = Math.floor(parsedValue);
        setChangeAmount(nextValue);
        setChangeAmountInput(String(nextValue));
    }

    function handleChangeAmountKeyDown(event) {
        if (event.key === "Enter") {
            event.preventDefault();
            commitChangeAmount();
        }
    }

  if (!tray) {
    return (
      <main className="page">
        <section className="card">
          <p>{status}</p>
          <Link to="/" className="button-link">
            Back to dashboard
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="card">
        <Link to="/" className="back-link">
          ← Back
        </Link>

        <p className="eyebrow">Tray</p>
        <h1>{tray.tray_id}</h1>

        <div className="meta-grid">
          <div>
            <span>Name</span>
            <strong>{tray.tray_name || "—"}</strong>
          </div>

          <div>
            <span>Location</span>
            <strong>{tray.location || "—"}</strong>
          </div>

          <div>
            <span>SKUs in tray</span>
            <strong>{contents.length}</strong>
          </div>

          <div>
            <span>Pending changes</span>
            <strong>{stagedChanges.length}</strong>
          </div>
        </div>

        {tray.notes && <p>{tray.notes}</p>}

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
            value={changeAmountInput}
            onChange={handleChangeAmountInput}
            onBlur={commitChangeAmount}
            onKeyDown={handleChangeAmountKeyDown}
            />
        </label>

        <div className="sku-list">
          {contents.map((item) => {
            const pendingChange = pendingChanges[item.id] || 0;
            const nextQuantity = Math.max(0, item.quantity + pendingChange);
            const pendingSign = pendingChange > 0 ? "+" : "";

            return (
              <article key={item.id} className="sku-card">
                <div className="sku-main">
                  <div>
                    <p className="sku">{item.frame_id}</p>
                    <p className="sku-detail">
                      Model {item.frame_ids?.model || "—"} ·{" "}
                      {item.frame_ids?.color || "—"} ·{" "}
                      {item.frame_ids?.sku || "-"}
                    </p>
                  </div>

                  <div className="quantity-stack">
                    <div className="quantity-pill">
                      Current <strong>{item.quantity}</strong>
                    </div>

                    {pendingChange !== 0 && (
                      <div className="pending-pill">
                        Pending {pendingSign}
                        {pendingChange} → New {nextQuantity}
                      </div>
                    )}
                  </div>
                </div>

                <div className="button-row">
                  <button
                    disabled={isSaving}
                    onClick={() => stageChange(item, -changeAmount)}
                  >
                    Remove {changeAmount}
                  </button>

                  <button
                    disabled={isSaving}
                    onClick={() => stageChange(item, changeAmount)}
                  >
                    Add {changeAmount}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <div className="submit-panel">
          <h2>Pending submission</h2>

          {stagedChanges.length === 0 ? (
            <p>No pending changes.</p>
          ) : (
            <ul>
              {stagedChanges.map((change) => {
                const sign = change.changeAmount > 0 ? "+" : "";

                return (
                  <li key={change.contentId}>
                    {change.frame_id}: {sign}
                    {change.changeAmount} → {change.nextQuantity}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="button-row">
            <button
              className="secondary-button"
              disabled={isSaving}
              onClick={clearPendingChanges}
            >
              Clear
            </button>

            <button disabled={isSaving} onClick={submitChanges}>
              Submit Changes
            </button>
          </div>
        </div>

        <p className="status">{status}</p>

        <button className="secondary-button" onClick={loadTrayData}>
          Refresh from Database
        </button>
      </section>
    </main>
  );
}