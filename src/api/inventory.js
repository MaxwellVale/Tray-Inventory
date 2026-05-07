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
        line,
        model,
        color,
        sku,
        description
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

    if (nextQuantity === 0) {
      const { error: deleteError } = await supabase
        .from("tray_contents")
        .delete()
        .eq("id", contentId);
      
      if (deleteError) throw deleteError;
    } else {
      const { error: updateError } = await supabase
        .from("tray_contents")
        .update({
          quantity: nextQuantity,
          updated_at: new Date().toISOString(),
        })
        .eq("id", contentId);

      if (updateError) throw updateError;
    }

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
      rack,
      shelf,
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
      line,
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
          rack, 
          shelf
        )
      )
    `
    )
    .or(
      [
        `frame_id.ilike.${pattern}`,
        `line.ilike.${pattern}`,
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
          line: frame.line,
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

export async function getAllTraysBasic() {
  const { data, error } = await supabase
    .from("trays")
    .select("tray_id, tray_name, rack, shelf")
    .order("tray_id", { ascending: true });

  if (error) throw error;
  return data;
}

export async function getAllFrameIdsBasic() {
  const { data, error } = await supabase
    .from("frame_ids")
    .select("frame_id, model, color, sku")
    .order("frame_id", { ascending: true });

  if (error) throw error;
  return data;
}

export async function moveFrameBetweenTrays({
  sourceTrayId,
  destinationTrayId,
  frameId,
  moveQuantity,
  signedBy,
}) {
  if (!sourceTrayId || !destinationTrayId || !frameId || !signedBy) {
    throw new Error("Missing required move fields.");
  }

  if (sourceTrayId === destinationTrayId) {
    throw new Error("Source and destination trays must be different.");
  }

  if (!Number.isFinite(moveQuantity) || moveQuantity < 1) {
    throw new Error("Move quantity must be at least 1.");
  }

  // 1. get source row
  const { data: sourceRow, error: sourceError } = await supabase
    .from("tray_contents")
    .select("id, tray_id, frame_id, quantity")
    .eq("tray_id", sourceTrayId)
    .eq("frame_id", frameId)
    .single();

  if (sourceError) throw sourceError;

  if (sourceRow.quantity < moveQuantity) {
    throw new Error("Cannot move more than the available quantity.");
  }

  const sourceNextQuantity = sourceRow.quantity - moveQuantity;

  // 2. check destination row
  const { data: destinationRows, error: destinationLookupError } = await supabase
    .from("tray_contents")
    .select("id, tray_id, frame_id, quantity")
    .eq("tray_id", destinationTrayId)
    .eq("frame_id", frameId);

  if (destinationLookupError) throw destinationLookupError;

  const destinationRow = destinationRows?.[0] ?? null;

  // 3. update source
  if (sourceNextQuantity === 0) {
    const { error: deleteSourceError } = await supabase
      .from("tray_contents")
      .delete()
      .eq("id", sourceRow.id);

    if (deleteSourceError) throw deleteSourceError;
  } else {
    const { error: updateSourceError } = await supabase
      .from("tray_contents")
      .update({
        quantity: sourceNextQuantity,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sourceRow.id);

    if (updateSourceError) throw updateSourceError;
  }

  // 4. update or insert destination
  let destinationNextQuantity = moveQuantity;

  if (destinationRow) {
    destinationNextQuantity = destinationRow.quantity + moveQuantity;

    const { error: updateDestinationError } = await supabase
      .from("tray_contents")
      .update({
        quantity: destinationNextQuantity,
        updated_at: new Date().toISOString(),
      })
      .eq("id", destinationRow.id);

    if (updateDestinationError) throw updateDestinationError;
  } else {
    const { error: insertDestinationError } = await supabase
      .from("tray_contents")
      .insert({
        tray_id: destinationTrayId,
        frame_id: frameId,
        quantity: moveQuantity,
      });

    if (insertDestinationError) throw insertDestinationError;
  }

  // 5. log both transactions
  const transactionRows = [
    {
      tray_id: sourceTrayId,
      frame_id: frameId,
      change_amount: -moveQuantity,
      quantity_after: sourceNextQuantity,
      signed_by: signedBy,
      action: "moved_out",
    },
    {
      tray_id: destinationTrayId,
      frame_id: frameId,
      change_amount: moveQuantity,
      quantity_after: destinationNextQuantity,
      signed_by: signedBy,
      action: "moved_in",
    },
  ];

  const { error: transactionError } = await supabase
    .from("transactions")
    .insert(transactionRows);

  if (transactionError) throw transactionError;

  return {
    sourceNextQuantity,
    destinationNextQuantity,
  };
}

export async function addNewFrameToTray({
  trayId,
  frameId,
  quantity,
  signedBy,
}) {
  if (!trayId || !frameId || !signedBy) {
    throw new Error("Missing required fields.");
  }

  if (!Number.isFinite(quantity) || quantity < 1) {
    throw new Error("Quantity must be at least 1.");
  }

  const { data: existingRows, error: existingLookupError } = await supabase
    .from("tray_contents")
    .select("id, quantity")
    .eq("tray_id", trayId)
    .eq("frame_id", frameId);

  if (existingLookupError) throw existingLookupError;

  if (existingRows && existingRows.length > 0) {
    throw new Error("This frame is already in the tray. Use quantity changes or move frames instead.");
  }

  const { error: insertError } = await supabase
    .from("tray_contents")
    .insert({
      tray_id: trayId,
      frame_id: frameId,
      quantity,
    });

  if (insertError) throw insertError;

  const { error: transactionError } = await supabase
    .from("transactions")
    .insert({
      tray_id: trayId,
      frame_id: frameId,
      change_amount: quantity,
      quantity_after: quantity,
      signed_by: signedBy,
      action: "new_frame",
    });

  if (transactionError) throw transactionError;

  return true;
}