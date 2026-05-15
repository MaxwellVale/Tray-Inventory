import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getTray,
  getTrayContents,
  submitInventoryChanges,
  getAllTraysBasic,
  getAllFrameIdsBasic,
  moveFrameBetweenTrays,
  addNewFrameToTray,
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
  const [isMoveMode, setIsMoveMode] = useState(false);
  const [moveFrameId, setMoveFrameId] = useState("");
  const [moveDestinationTrayId, setMoveDestinationTrayId] = useState("");
  const [moveQuantityInput, setMoveQuantityInput] = useState("1");
  const [isMoving, setIsMoving] = useState(false);
  const [pendingMoves, setPendingMoves] = useState([]);

  const [allFrames, setAllFrames] = useState([]);
  const [showAddFrameModal, setShowAddFrameModal] = useState(false);
  const [newFrameId, setNewFrameId] = useState("");
  const [newFrameQuantity, setNewFrameQuantity] = useState("1");
  const [newFrameSearch, setNewFrameSearch] = useState("");
  const [isAddingFrame, setIsAddingFrame] = useState(false);
  const [pendingAdds, setPendingAdds] = useState([]);

  async function loadTrayData() {
    try {
      setStatus("Loading...");
      const [trayData, contentsData, trayList, frameList] = await Promise.all([
        getTray(trayId),
        getTrayContents(trayId),
        getAllTraysBasic(),
        getAllFrameIdsBasic(),
      ]);

      setTray(trayData);
      setContents(contentsData);
      setAllTrays(trayList);
      setAllFrames(frameList)
      setPendingChanges({});
      setStatus("Ready");
    } catch (error) {
      setStatus(error.message || "Could not load tray.");
    }
  }

  useEffect(() => {
    loadTrayData();
  }, [trayId]);

  const filteredFrameOptions = allFrames.filter((frame) => {
    const search = newFrameSearch.trim().toLowerCase();
    if (!search) return true;

    return (
      frame.frame_id?.toLowerCase().includes(search) ||
      frame.model?.toLowerCase().includes(search) ||
      frame.color?.toLowerCase().includes(search) ||
      frame.sku?.toLowerCase().includes(search)
    );
  });

  function toggleMoveMode() {
    const next = !isMoveMode;
    setIsMoveMode(next);

    if (!next) {
      setMoveFrameId("");
      setMoveDestinationTrayId("");
      setMoveQuantityInput("1");
      setStatus("Move mode cancelled.");
    } else {
      setStatus("Move mode enabled. Select a frame below.");
    }
  }

  function handleMoveFrame() {
    if (!authUser) {
      setStatus("You must be signed in to stage a move.");
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

    const sourceItem = contents.find((item) => item.frame_id === moveFrameId);

    if (!sourceItem) {
      setStatus("Selected frame is not in this tray.");
      return;
    }

    const alreadyStagedOut = pendingMoves
      .filter((move) => move.frameId === moveFrameId)
      .reduce((sum, move) => sum + move.quantity, 0);

    const availableToMove = sourceItem.quantity - alreadyStagedOut;

    if (parsedMoveQuantity > availableToMove) {
      setStatus("Cannot stage moving more than the available quantity.");
      return;
    }

    setPendingMoves((current) => [
      ...current,
      {
        sourceTrayId: trayId,
        destinationTrayId: moveDestinationTrayId,
        frameId: moveFrameId,
        quantity: parsedMoveQuantity,
      },
    ]);

    setMoveFrameId("");
    setMoveDestinationTrayId("");
    setMoveQuantityInput("1");
    setIsMoveMode(false);
    setStatus(
      `Staged move of ${parsedMoveQuantity} ${moveFrameId} to ${moveDestinationTrayId}.`
    );
  }

  function handleAddNewFrame() {
    if (!authUser) {
      setStatus("You must be signed in to stage a frame addition.");
      return;
    }

    if (!newFrameId) {
      setStatus("Select a frame to add.");
      return;
    }

    const parsedQuantity = Number(newFrameQuantity);

    if (!Number.isFinite(parsedQuantity) || parsedQuantity < 1) {
      setStatus("New frame quantity must be at least 1.");
      return;
    }

    const alreadyInTray = contents.some((item) => item.frame_id === newFrameId);
    const alreadyPendingAdd = pendingAdds.some((item) => item.frameId === newFrameId);

    if (alreadyInTray || alreadyPendingAdd) {
      setStatus(
        "That frame is already in this tray or already staged to be added."
      );
      return;
    }

    setPendingAdds((current) => [
      ...current,
      {
        trayId,
        frameId: newFrameId,
        quantity: parsedQuantity,
      },
    ]);

    setNewFrameId("");
    setNewFrameQuantity("1");
    setNewFrameSearch("");
    setShowAddFrameModal(false);
    setStatus(`Staged addition of ${newFrameId} to ${trayId}.`);
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

  async function stageChange(item, delta) {
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

    const hasQuantityChanges = stagedChanges.length > 0;
    const hasMoves = pendingMoves.length > 0;
    const hasAdds = pendingAdds.length > 0;

    if (!hasQuantityChanges && !hasMoves && !hasAdds) {
      setStatus("No pending changes to submit.");
      return;
    }

    try {
      setIsSaving(true);
      setStatus("Submitting changes...");

      if (hasQuantityChanges) {
        await submitInventoryChanges({
          changes: stagedChanges,
          signedBy: authUser.email,
        });
      }

      if (hasMoves) {
        for (const move of pendingMoves) {
          await moveFrameBetweenTrays({
            sourceTrayId: move.sourceTrayId,
            destinationTrayId: move.destinationTrayId,
            frameId: move.frameId,
            moveQuantity: move.quantity,
            signedBy: authUser.email,
          });
        }
      }

      if (hasAdds) {
        for (const add of pendingAdds) {
          await addNewFrameToTray({
            trayId: add.trayId,
            frameId: add.frameId,
            quantity: add.quantity,
            signedBy: authUser.email,
          });
        }
      }

      setPendingChanges({});
      setPendingMoves([]);
      setPendingAdds([]);

      await loadTrayData();
      setStatus("Submitted all staged changes.");
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

  async function resetTrayView() {
    const hasPending =
      Object.keys(pendingChanges).length > 0 ||
      pendingMoves.length > 0 ||
      pendingAdds.length > 0;

    if (hasPending) {
      const confirmed = window.confirm(
        "Discard all staged changes and reload the tray?"
      );

      if (!confirmed) return;
    }

    setPendingChanges({});
    setPendingMoves([]);
    setPendingAdds([]);
    setMoveFrameId("");
    setMoveDestinationTrayId("");
    setMoveQuantityInput("1");
    setIsMoveMode(false);
    setNewFrameId("");
    setNewFrameQuantity("1");
    setNewFrameSearch("");
    setShowAddFrameModal(false);
    console.log("Reset Tray View start");
    setStatus("Resetting tray...");
    console.log("First setStatus called");

    try {
      await loadTrayData();
    }
    catch (error) {
      setStatus(error.message || "Could not reset tray.");
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

        <div className="tray-actions-shell">
          <div className="tray-actions-grid">
            <div className="action-card small-action-card">
              <h2>Change Amount</h2>
              <label className="field compact-field">
                Quantity step
                <input
                  type="number"
                  min="1"
                  value={changeAmountInput}
                  onChange={handleChangeAmountInput}
                  onBlur={commitChangeAmount}
                  onKeyDown={handleChangeAmountKeyDown}
                />
              </label>
            </div>

            <div className="action-card">
              <h2>Move Frames</h2>

              {!authUser ? (
                <p>You must be signed in to move frames.</p>
              ) : (
                <>
                  <button
                    className={isMoveMode ? "secondary-button" : ""}
                    onClick={toggleMoveMode}
                  >
                    {isMoveMode ? "Cancel Move Mode" : "Move Frames"}
                  </button>

                  <p className="move-mode-status">
                    {isMoveMode
                      ? moveFrameId
                        ? `Selected: ${moveFrameId}`
                        : "Select a frame from the list below."
                      : "Click to enable move mode."}
                  </p>

                  {isMoveMode && (
                    <>
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

                      <button disabled={isMoving || !moveFrameId} onClick={handleMoveFrame}>
                        {isMoving ? "Moving..." : "Confirm Move"}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>

            <div className="action-card icon-action-card">
              <button
                className="icon-add-button"
                onClick={() => setShowAddFrameModal(true)}
                aria-label="Add new frame"
                title="Add new frame"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {showAddFrameModal && (
          <div className="modal-overlay" onClick={() => setShowAddFrameModal(false)}>
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
              <h2>Add New Frame to Tray</h2>

              {!authUser ? (
                <p>You must be signed in to add frames.</p>
              ) : (
                <>
                  <label className="field">
                    Search frame
                    <input
                      value={newFrameSearch}
                      onChange={(event) => setNewFrameSearch(event.target.value)}
                      placeholder="Search by frame ID, model, color, SKU"
                    />
                  </label>

                  <label className="field">
                    Frame to add
                    <select
                      value={newFrameId}
                      onChange={(event) => setNewFrameId(event.target.value)}
                    >
                      <option value="">Select a frame</option>
                      {filteredFrameOptions.map((frame) => (
                        <option key={frame.frame_id} value={frame.frame_id}>
                          {frame.frame_id} — {frame.model || "—"} — {frame.color || "—"} — SKU {frame.sku || "—"}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    Starting quantity
                    <input
                      type="number"
                      min="1"
                      value={newFrameQuantity}
                      onChange={(event) => setNewFrameQuantity(event.target.value)}
                    />
                  </label>

                  <div className="button-row">
                    <button
                      className="secondary-button"
                      onClick={() => setShowAddFrameModal(false)}
                    >
                      Cancel
                    </button>

                    <button disabled={isAddingFrame} onClick={handleAddNewFrame}>
                      {isAddingFrame ? "Adding..." : "Add Frame"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="sku-list">
          {contents.map((item) => {
            const pendingChange = pendingChanges[item.id] || 0;
            const nextQuantity = Math.max(0, item.quantity + pendingChange);
            const pendingSign = pendingChange > 0 ? "+" : "";

            return (
              <article
                key={item.id}
                className={`sku-card ${
                  isMoveMode ? "sku-card-move-mode" : ""
                } ${moveFrameId === item.frame_id ? "sku-card-selected" : ""}`}
                onClick={() => {
                  if (isMoveMode) {
                    setMoveFrameId(item.frame_id);
                    setStatus(`Selected ${item.frame_id} for moving.`);
                  }
                }}
              >
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

        <div className="submit-review-card">
          <h2>Pending Submission</h2>

          {stagedChanges.length === 0 && pendingMoves.length === 0 && pendingAdds.length === 0 ? (
            <p>No pending changes.</p>
          ) : (
            <ul>
              {stagedChanges.map((change) => {
                const sign = change.changeAmount > 0 ? "+" : "";

                return (
                  <li key={`change-${change.contentId}`}>
                    Modify {change.frameId}: {sign}
                    {change.changeAmount} → {change.nextQuantity}
                  </li>
                );
              })}

              {pendingMoves.map((move, index) => (
                <li key={`move-${index}`}>
                  Move {move.frameId}: -{move.quantity} from {move.sourceTrayId} to {move.destinationTrayId}
                </li>
              ))}

              {pendingAdds.map((add, index) => (
                <li key={`add-${index}`}>
                  Add new {add.frameId}: +{add.quantity} to {add.trayId}
                </li>
              ))}
            </ul>
          )}

          <p className="status">{status}</p>

          <div className="button-row">
            <button
              className="secondary-button"
              disabled={isSaving}
              onClick={resetTrayView}
            >
              Reset
            </button>

            <button
              className="primary-button"
              disabled={isSaving || !authUser}
              onClick={submitChanges}
            >
              {authUser ? "Submit Changes" : "Sign in to Submit"}
            </button>
          </div>

          {/* <button className="secondary-button" onClick={loadTrayData}>
            Refresh
          </button> */}
        </div>

      </section>
    </main>
  );
}