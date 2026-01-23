import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
  signature?: string;
}

async function createHmacSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { event, data } = await req.json();

    if (!event || !data) {
      return new Response(
        JSON.stringify({ error: "Event and data are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get active webhooks that subscribe to this event
    const { data: webhooks, error: webhooksError } = await supabaseAdmin
      .from("webhook_configs")
      .select("id, url, secret, headers, timeout_seconds")
      .eq("is_active", true)
      .contains("events", [event]);

    if (webhooksError) {
      console.error("Error fetching webhooks:", webhooksError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch webhook configs" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!webhooks || webhooks.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active webhooks for this event", dispatched: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    // Dispatch to all matching webhooks
    const results = await Promise.all(
      webhooks.map(async (webhook) => {
        const payloadString = JSON.stringify(payload);
        const webhookHeaders = (webhook.headers || {}) as Record<string, string>;
        
        // Add signature if secret is configured
        let signature: string | undefined;
        if (webhook.secret) {
          signature = `sha256=${await createHmacSignature(payloadString, webhook.secret)}`;
        }

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "User-Agent": "YIMS-Webhook/1.0",
          ...webhookHeaders,
        };

        if (signature) {
          headers["X-YIMS-Signature"] = signature;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), (webhook.timeout_seconds || 30) * 1000);

        try {
          const response = await fetch(webhook.url, {
            method: "POST",
            headers,
            body: payloadString,
            signal: controller.signal,
          });

          clearTimeout(timeout);
          const responseBody = await response.text();

          // Log the delivery
          await supabaseAdmin.from("webhook_logs").insert({
            webhook_id: webhook.id,
            event_type: event,
            payload: payload,
            response_status: response.status,
            response_body: responseBody.substring(0, 1000),
            success: response.ok,
          });

          return { success: response.ok, status: response.status };
        } catch (error) {
          clearTimeout(timeout);
          const errorMessage = error instanceof Error ? error.message : "Unknown error";

          await supabaseAdmin.from("webhook_logs").insert({
            webhook_id: webhook.id,
            event_type: event,
            payload: payload,
            error_message: errorMessage,
            success: false,
          });

          return { success: false, error: errorMessage };
        }
      })
    );

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({
        message: "Webhooks dispatched",
        dispatched: webhooks.length,
        successful: successCount,
        failed: failureCount,
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
