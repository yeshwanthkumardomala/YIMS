import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use service role for scheduled tasks
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get low stock items
    const { data: lowStockItems, error: itemsError } = await supabaseAdmin
      .from("items")
      .select("id, name, code, current_stock, minimum_stock, category:categories(name), location:locations(name)")
      .eq("is_active", true)
      .filter("current_stock", "lte", "minimum_stock");

    if (itemsError) {
      console.error("Error fetching items:", itemsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch items" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!lowStockItems || lowStockItems.length === 0) {
      return new Response(
        JSON.stringify({ message: "No low stock items found", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get admin users
    const { data: adminRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    const adminUserIds = adminRoles?.map(r => r.user_id) || [];

    // Create notifications for admins
    let notificationsCreated = 0;

    for (const item of lowStockItems) {
      for (const userId of adminUserIds) {
        // Check if notification already exists in last 24 hours
        const { data: existingNotif } = await supabaseAdmin
          .from("notifications")
          .select("id")
          .eq("user_id", userId)
          .eq("category", "stock")
          .contains("metadata", { item_id: item.id })
          .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .limit(1);

        if (!existingNotif || existingNotif.length === 0) {
          const stockPercentage = Math.round((item.current_stock / item.minimum_stock) * 100);
          
          const categoryData = item.category as unknown as { name: string } | null;
          const locationData = item.location as unknown as { name: string } | null;
          
          await supabaseAdmin.from("notifications").insert({
            user_id: userId,
            title: "Low Stock Alert",
            message: `${item.name} (${item.code}) is ${item.current_stock === 0 ? 'out of stock' : 'running low'}: ${item.current_stock}/${item.minimum_stock} ${item.current_stock === 0 ? '' : `(${stockPercentage}%)`}`,
            type: item.current_stock === 0 ? "error" : "warning",
            category: "stock",
            action_url: "/items",
            metadata: {
              item_id: item.id,
              item_name: item.name,
              item_code: item.code,
              current_stock: item.current_stock,
              minimum_stock: item.minimum_stock,
              category: categoryData?.name || null,
              location: locationData?.name || null,
            },
          });
          notificationsCreated++;
        }
      }
    }

    // Log the check
    await supabaseAdmin.from("system_logs").insert({
      event_type: "low_stock_check",
      event_description: `Low stock check completed: ${lowStockItems.length} items found, ${notificationsCreated} notifications created`,
      metadata: {
        low_stock_count: lowStockItems.length,
        notifications_created: notificationsCreated,
        admin_count: adminUserIds.length,
      },
    });

    return new Response(
      JSON.stringify({
        message: "Low stock check completed",
        lowStockCount: lowStockItems.length,
        notificationsCreated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
