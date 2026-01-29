import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ExportRequest {
  action: "get_auth_url" | "exchange_code" | "export" | "disconnect" | "check_connection";
  code?: string;
  redirectUri?: string;
  exportMode?: "overwrite" | "versioned";
  existingSpreadsheetId?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate secrets
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return new Response(
        JSON.stringify({ error: "Google OAuth credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: ExportRequest = await req.json();
    const { action } = body;

    switch (action) {
      case "get_auth_url": {
        const { redirectUri } = body;
        const scopes = [
          "https://www.googleapis.com/auth/spreadsheets",
          "https://www.googleapis.com/auth/drive.file",
        ].join(" ");

        const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
        authUrl.searchParams.set("redirect_uri", redirectUri || "");
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("scope", scopes);
        authUrl.searchParams.set("access_type", "offline");
        authUrl.searchParams.set("prompt", "consent");

        return new Response(
          JSON.stringify({ authUrl: authUrl.toString() }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "exchange_code": {
        const { code, redirectUri } = body;
        if (!code || !redirectUri) {
          return new Response(
            JSON.stringify({ error: "Missing code or redirectUri" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Exchange code for tokens
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
          }),
        });

        const tokenData = await tokenResponse.json();
        if (!tokenResponse.ok) {
          console.error("Token exchange error:", tokenData);
          return new Response(
            JSON.stringify({ error: "Failed to exchange code", details: tokenData.error_description }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get user info
        const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const userInfo = await userInfoResponse.json();

        // Store tokens
        const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
        const { error: upsertError } = await supabase
          .from("google_oauth_tokens")
          .upsert({
            user_id: userId,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            token_type: tokenData.token_type,
            expires_at: expiresAt.toISOString(),
            scope: tokenData.scope,
            connected_email: userInfo.email,
          }, { onConflict: "user_id" });

        if (upsertError) {
          console.error("Token storage error:", upsertError);
          return new Response(
            JSON.stringify({ error: "Failed to store tokens" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, email: userInfo.email }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "check_connection": {
        const { data: tokenData } = await supabase
          .from("google_oauth_tokens")
          .select("connected_email, expires_at")
          .eq("user_id", userId)
          .single();

        return new Response(
          JSON.stringify({
            connected: !!tokenData,
            email: tokenData?.connected_email || null,
            expiresAt: tokenData?.expires_at || null,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "disconnect": {
        const { error: deleteError } = await supabase
          .from("google_oauth_tokens")
          .delete()
          .eq("user_id", userId);

        if (deleteError) {
          return new Response(
            JSON.stringify({ error: "Failed to disconnect" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "export": {
        const { exportMode = "versioned", existingSpreadsheetId } = body;

        // Get stored tokens
        const { data: tokenData } = await supabase
          .from("google_oauth_tokens")
          .select("*")
          .eq("user_id", userId)
          .single();

        if (!tokenData) {
          return new Response(
            JSON.stringify({ error: "Google account not connected" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Refresh token if expired
        let accessToken = tokenData.access_token;
        if (new Date(tokenData.expires_at) < new Date()) {
          if (!tokenData.refresh_token) {
            return new Response(
              JSON.stringify({ error: "Token expired, please reconnect" }),
              { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: GOOGLE_CLIENT_ID,
              client_secret: GOOGLE_CLIENT_SECRET,
              refresh_token: tokenData.refresh_token,
              grant_type: "refresh_token",
            }),
          });

          const refreshData = await refreshResponse.json();
          if (!refreshResponse.ok) {
            return new Response(
              JSON.stringify({ error: "Failed to refresh token, please reconnect" }),
              { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          accessToken = refreshData.access_token;
          const expiresAt = new Date(Date.now() + refreshData.expires_in * 1000);
          await supabase
            .from("google_oauth_tokens")
            .update({
              access_token: accessToken,
              expires_at: expiresAt.toISOString(),
            })
            .eq("user_id", userId);
        }

        // Fetch all data
        const [itemsRes, locationsRes, transactionsRes, profilesRes, systemLogsRes] = await Promise.all([
          supabase.from("items").select("*, category:categories(name), location:locations(name)").eq("is_active", true),
          supabase.from("locations").select("*").eq("is_active", true),
          supabase.from("stock_transactions").select("*, item:items(code, name)").order("created_at", { ascending: false }).limit(5000),
          supabase.from("profiles").select("id, username, full_name, is_active, created_at"),
          supabase.from("system_logs").select("*").order("created_at", { ascending: false }).limit(1000),
        ]);

        const items = itemsRes.data || [];
        const locations = locationsRes.data || [];
        const transactions = transactionsRes.data || [];
        const profiles = profilesRes.data || [];
        const systemLogs = systemLogsRes.data || [];

        // Prepare sheets data
        const timestamp = new Date().toISOString();
        const spreadsheetName = exportMode === "versioned"
          ? `YIMS Export - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`
          : "YIMS Export";

        // Create or update spreadsheet
        let spreadsheetId: string;
        let spreadsheetUrl: string;

        if (exportMode === "overwrite" && existingSpreadsheetId) {
          spreadsheetId = existingSpreadsheetId;
          spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

          // Clear existing sheets
          const clearResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                requests: [
                  { updateSpreadsheetProperties: { properties: { title: spreadsheetName }, fields: "title" } },
                ],
              }),
            }
          );
          await clearResponse.text();
        } else {
          // Create new spreadsheet
          const createResponse = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              properties: { title: spreadsheetName },
              sheets: [
                { properties: { title: "Items", index: 0 } },
                { properties: { title: "Locations", index: 1 } },
                { properties: { title: "Transactions", index: 2 } },
                { properties: { title: "Users", index: 3 } },
                { properties: { title: "System Logs", index: 4 } },
                { properties: { title: "Metadata", index: 5 } },
              ],
            }),
          });

          const createData = await createResponse.json();
          if (!createResponse.ok) {
            console.error("Spreadsheet creation error:", createData);
            return new Response(
              JSON.stringify({ error: "Failed to create spreadsheet", details: createData.error?.message }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          spreadsheetId = createData.spreadsheetId;
          spreadsheetUrl = createData.spreadsheetUrl;
        }

        // Prepare data for batch update
        const batchData = [
          {
            range: "Items!A1",
            values: [
              ["Code", "Name", "Description", "Category", "Location", "Current Stock", "Minimum Stock", "Unit", "Has Variants", "Created At"],
              ...items.map((item: Record<string, unknown>) => [
                item.code,
                item.name,
                item.description || "",
                (item.category as { name: string } | null)?.name || "",
                (item.location as { name: string } | null)?.name || "",
                item.current_stock,
                item.minimum_stock,
                item.unit,
                item.has_variants ? "Yes" : "No",
                new Date(item.created_at as string).toLocaleString(),
              ]),
            ],
          },
          {
            range: "Locations!A1",
            values: [
              ["Code", "Name", "Type", "Description", "Is Active", "Created At"],
              ...locations.map((loc: Record<string, unknown>) => [
                loc.code,
                loc.name,
                loc.location_type,
                loc.description || "",
                loc.is_active ? "Yes" : "No",
                new Date(loc.created_at as string).toLocaleString(),
              ]),
            ],
          },
          {
            range: "Transactions!A1",
            values: [
              ["Date", "Item Code", "Item Name", "Type", "Quantity", "Balance Before", "Balance After", "Recipient", "Notes"],
              ...transactions.map((tx: Record<string, unknown>) => [
                new Date(tx.created_at as string).toLocaleString(),
                (tx.item as { code: string; name: string } | null)?.code || "",
                (tx.item as { code: string; name: string } | null)?.name || "",
                tx.transaction_type,
                tx.quantity,
                tx.balance_before,
                tx.balance_after,
                tx.recipient || "",
                tx.notes || "",
              ]),
            ],
          },
          {
            range: "Users!A1",
            values: [
              ["ID", "Username", "Full Name", "Is Active", "Created At"],
              ...profiles.map((p: Record<string, unknown>) => [
                p.id,
                p.username,
                p.full_name || "",
                p.is_active ? "Yes" : "No",
                new Date(p.created_at as string).toLocaleString(),
              ]),
            ],
          },
          {
            range: "System Logs!A1",
            values: [
              ["Date", "Event Type", "Description", "User ID", "IP Address"],
              ...systemLogs.map((log: Record<string, unknown>) => [
                new Date(log.created_at as string).toLocaleString(),
                log.event_type,
                log.event_description,
                log.user_id || "",
                log.ip_address || "",
              ]),
            ],
          },
          {
            range: "Metadata!A1",
            values: [
              ["Property", "Value"],
              ["Exported At", timestamp],
              ["Export Type", exportMode],
              ["Items Count", items.length.toString()],
              ["Locations Count", locations.length.toString()],
              ["Transactions Count", transactions.length.toString()],
              ["Users Count", profiles.length.toString()],
              ["System Logs Count", systemLogs.length.toString()],
              ["Version", "1.0.0"],
            ],
          },
        ];

        // Batch update values
        const updateResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              valueInputOption: "RAW",
              data: batchData,
            }),
          }
        );

        const updateData = await updateResponse.json();
        if (!updateResponse.ok) {
          console.error("Batch update error:", updateData);
          return new Response(
            JSON.stringify({ error: "Failed to write data", details: updateData.error?.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Log the export
        await supabase.from("google_sheets_exports").insert({
          user_id: userId,
          spreadsheet_id: spreadsheetId,
          spreadsheet_url: spreadsheetUrl,
          spreadsheet_name: spreadsheetName,
          export_type: exportMode,
          record_counts: {
            items: items.length,
            locations: locations.length,
            transactions: transactions.length,
            users: profiles.length,
            systemLogs: systemLogs.length,
          },
        });

        // Log system event
        await supabase.from("system_logs").insert({
          event_type: "google_sheets_export",
          event_description: `Exported data to Google Sheets: ${spreadsheetName}`,
          user_id: userId,
          metadata: {
            spreadsheet_id: spreadsheetId,
            export_mode: exportMode,
            record_counts: {
              items: items.length,
              locations: locations.length,
              transactions: transactions.length,
            },
          },
        });

        return new Response(
          JSON.stringify({
            success: true,
            spreadsheetId,
            spreadsheetUrl,
            spreadsheetName,
            recordCounts: {
              items: items.length,
              locations: locations.length,
              transactions: transactions.length,
              users: profiles.length,
              systemLogs: systemLogs.length,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
