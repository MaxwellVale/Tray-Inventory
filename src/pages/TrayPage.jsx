import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getTray,
  getTrayContents,
  submitInventoryChanges,
  getAllTraysBasic,
  moveFrameBetweenTrays,
} from "../api/inventory";
import { useAuth } from "../lib/AuthContext";

export default function TrayPage() {
  const { authUser } = useAuth();
  const { trayId } = useParams();

  const [tray, setTray] = useState(null);
  const [contents, setContents] = useState([]);
  const [pendingChanges, setPendingChanges] = useState({});
  const [changeAmount, setChangeAmount] = useState(1);
  const [changeAmountInput, setChangeAmountInput] = useState("1");
  const [status, setStatus] = useState("Loading...");
  const [isSaving, setIsSaving] = useState(false);

  const [allTrays, setAllTrays] = useState([]);
  const [moveFrameId, setMoveFrameId] = useState("");
  const [moveDestinationTrayId, setMoveDestinationTrayId] = useState("");
  const [moveQuantityInput, setMoveQuantityInput] = useState("1");
  const [isMoving, setIsMoving] = useState(false);

  async function loadTrayData() {
    try {
      setStatus("Loading...");
      const [trayData, contentsData, trayList] = await Promise.all([
        getTray(trayId),
        getTrayContents(trayId),
        getAllTraysBasic(),
      ]);

      setTray(trayData);
      setContents(contentsData);
      setAllTrays(trayList);
      setPendingChanges({});
      setStatus("Ready");
    } catch (error) {
      setStatus(error.message || "Could not load tray.");
    }
  }

  useEffect(() => {
    loadTrayData();
  }, [trayId]);

  async function handleMoveFrame() {
    if (!authUser) {
      setStatus("You must be signed in to move frames.");
      return;
    }

    if (!moveFrameId) {
      setStatus("Select a frame to move.");
      return;
    }

    if (!moveDestinationTrayId) {
      setStatus("Select a destination tray.");
      return;
    }

    const parsedMoveQuantity = Number(moveQuantityInput);

    if (!Number.isFinite(parsedMoveQuantity) || parsedMoveQuantity < 1) {
      setStatus("Move quantity must be at least 1.");
      return;
    }

    try {
      setIsMoving(true);
      setStatus("Moving frames...");

      await moveFrameBetweenTrays({
        sourceTrayId: trayId,
        destinationTrayId: moveDestinationTrayId,
        frameId: moveFrameId,
        moveQuantity: parsedMoveQuantity,
        signedBy: authUser.email,
      });

      setMoveFrameId("");
      setMoveDestinationTrayId("");
      setMoveQuantityInput("1");

      await loadTrayData();
      setStatus(`Moved ${parsedMoveQuantity} of ${moveFrameId} to ${moveDestinationTrayId}.`);
    } catch (error) {
      setStatus(error.message || "Could not move frame.");
    } finally {
      setIsMoving(false);
    }
  }

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
    if (!authUser) {
      setStatus("You must be signed in to submit changes.");
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
        signedBy: authUser.email,
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

        <p className="eyebrow">Tray ID</p>
        <h1>{tray.tray_id}</h1>

        <div className="meta-grid">
          <div>
            <span>Name</span>
            <strong>{tray.tray_name || "—"}</strong>
          </div>

          <div>
            <span>Location</span>
            <strong>{"Rack " + tray.rack + " / Shelf " + tray.shelf || "—"}</strong>
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
                    <div
                      className={`quantity-pill ${
                        pendingChange > 0
                          ? "quantity-pill-positive"
                          : pendingChange < 0
                          ? "quantity-pill-negative"
                          : ""
                      }`}
                    >
                      {pendingChange === 0 ? (
                        <>
                          Qty <strong>{item.quantity}</strong>
                        </>
                      ) : (
                        <>
                          <span>{item.quantity}</span> → <strong>{nextQuantity}</strong> <span>({pendingSign}{pendingChange})</span>
                        </>
                      )}
                    </div>
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
          {stagedChanges.length === 1 ? (
            <h2>Pending submission</h2>
          ) : (
            <h2>Pending submissions</h2>
          )}

          {stagedChanges.length === 0 ? (
            <p>No pending changes.</p>
          ) : (
            <ul style={{'listStyleType': 'None'}}>
              {stagedChanges.map((change) => {
                const sign = change.changeAmount > 0 ? "+" : "";

                return (
                  <li key={change.contentId}>
                    {change.frame_id}:{" "}
                    {change.currentQuantity} → {change.nextQuantity} ({sign} {change.changeAmount})
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

            <button
              className="secondary-button"
              disabled={isSaving || !authUser} 
              onClick={submitChanges}
            >
              {authUser ? "Submit Changes" : "Sign in to Submit"}
            </button>
          </div>
        </div>

        <div className="submit-panel">
          <h2>Relocate Frames</h2>

          {!authUser ? (
            <p>You must be signed in to move frames.</p>
          ) : (
            <>
              <label className="field">
                Frame to move
                <select
                  value={moveFrameId}
                  onChange={(event) => setMoveFrameId(event.target.value)}
                >
                  <option value="">Select a frame</option>
                  {contents.map((item) => (
                    <option key={item.id} value={item.frame_id}>
                      {item.frame_id} — Qty {item.quantity}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                Quantity to move
                <input
                  type="number"
                  min="1"
                  value={moveQuantityInput}
                  onChange={(event) => setMoveQuantityInput(event.target.value)}
                />
              </label>

              <label className="field">
                Destination tray
                <select
                  value={moveDestinationTrayId}
                  onChange={(event) => setMoveDestinationTrayId(event.target.value)}
                >
                  <option value="">Select destination tray</option>
                  {allTrays
                    .filter((trayOption) => trayOption.tray_id !== trayId)
                    .map((trayOption) => (
                      <option key={trayOption.tray_id} value={trayOption.tray_id}>
                        {trayOption.tray_id} — {trayOption.tray_name || "Unnamed tray"} — Rack{" "}
                        {trayOption.rack || "—"} / Shelf {trayOption.shelf ?? "—"}
                      </option>
                    ))}
                </select>
              </label>

              <button disabled={isMoving} onClick={handleMoveFrame}>
                {isMoving ? "Moving..." : "Move Frames"}
              </button>
            </>
          )}
        </div>

        <p className="status">{status}</p>

        <button className="secondary-button" onClick={loadTrayData}>
          Refresh
        </button>
      </section>
    </main>
  );
}