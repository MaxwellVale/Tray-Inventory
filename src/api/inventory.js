import { supabase } from "../lib/supabase";

export async function getTray(trayId) {
  const { data, error } = await supabase
    .from("trays")
    .select("*")
    .eq("tray_id", trayId)
    .single();

  if (error) throw error;
  return data;
}

export async function getTrayContents(trayId) {
  const { data, error } = await supabase
    .from("tray_contents")
    .select(
      `
      id,
      tray_id,
      sku,
      quantity,
      updated_at,
      skus (
        model,
        color,
        description
      )
    `
    )
    .eq("tray_id", trayId)
    .order("sku", { ascending: true });

  if (error) throw error;
  return data;
}

export async function submitInventoryChanges({ changes, signedBy }) {
  const submittedResults = [];

  for (const change of changes) {
    const {
      contentId,
      trayId,
      sku,
      currentQuantity,
      changeAmount,
    } = change;

    const nextQuantity = Math.max(0, currentQuantity + changeAmount);
    const action = changeAmount < 0 ? "removed" : "added";

    const { error: updateError } = await supabase
      .from("tray_contents")
      .update({
        quantity: nextQuantity,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contentId);

    if (updateError) throw updateError;

    const { error: transactionError } = await supabase
      .from("transactions")
      .insert({
        tray_id: trayId,
        sku,
        change_amount: changeAmount,
        quantity_after: nextQuantity,
        signed_by: signedBy,
        action,
      });

    if (transactionError) throw transactionError;

    submittedResults.push({
      contentId,
      sku,
      quantity: nextQuantity,
      changeAmount,
    });
  }

  return submittedResults;
}

export async function getDashboardTrays() {
  const { data, error } = await supabase
    .from("trays")
    .select(
      `
      tray_id,
      tray_name,
      location,
      notes,
      tray_contents (
        id,
        sku,
        quantity
      )
    `
    )
    .order("tray_id", { ascending: true });

  if (error) throw error;

  return data.map((tray) => {
    const contents = tray.tray_contents || [];

    const totalQuantity = contents.reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0
    );

    return {
      ...tray,
      skuCount: contents.length,
      totalQuantity,
    };
  });
}