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
      frame_id,
      quantity,
      updated_at,
      frame_ids (
        model,
        color,
        sku,
        description,
        notes
      )
    `
    )
    .eq("tray_id", trayId)
    .order("frame_id", { ascending: true });

  if (error) throw error;
  return data;
}

export async function submitInventoryChanges({ changes, signedBy }) {
  const submittedResults = [];

  for (const change of changes) {
    const {
      contentId,
      trayId,
      frame_id,
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
        frame_id,
        change_amount: changeAmount,
        quantity_after: nextQuantity,
        signed_by: signedBy,
        action,
      });

    if (transactionError) throw transactionError;

    submittedResults.push({
      contentId,
      frame_id,
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
        tray_id,
        frame_id,
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
      frameCount: contents.length,
      totalQuantity,
    };
  });
}

export async function searchFrameLocations(searchTerm) {
  const trimmedSearch = searchTerm.trim();

  if (!trimmedSearch) return [];

  const pattern = `*${trimmedSearch}*`;

  const { data, error } = await supabase
    .from("frame_ids")
    .select(
      `
      frame_id,
      model,
      color,
      description,
      sku,
      tray_contents (
        id,
        quantity,
        tray_id,
        trays (
          tray_id,
          tray_name,
          location
        )
      )
    `
    )
    .or(
      [
        `frame_id.ilike.${pattern}`,
        `model.ilike.${pattern}`,
        `color.ilike.${pattern}`,
        `sku.ilike.${pattern}`
      ].join(",")
    )
    .order("frame_id", { ascending: true });

  if (error) throw error;

  const flattenedResults = [];

  for (const frame of data) {
    const contents = frame.tray_contents || [];

    for (const content of contents) {
      flattenedResults.push({
        id: content.id,
        quantity: content.quantity,
        frame_id: frame.frame_id,
        frame_ids: {
          frame_id: frame.frame_id,
          model: frame.model,
          color: frame.color,
          description: frame.description,
          sku: frame.sku,
        },
        trays: content.trays,
      });
    }
  }

  return flattenedResults;
}