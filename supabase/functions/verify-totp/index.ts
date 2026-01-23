import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as OTPAuth from "https://esm.sh/otpauth@9.2.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { code, isSetup } = await req.json();

    if (!code || typeof code !== "string" || code.length !== 6) {
      return new Response(
        JSON.stringify({ error: "Invalid code format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's 2FA secret
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("two_factor_secret, two_factor_enabled, backup_codes")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile?.two_factor_secret) {
      return new Response(
        JSON.stringify({ error: "2FA not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate TOTP code
    const totp = new OTPAuth.TOTP({
      issuer: "YIMS",
      label: "User",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(profile.two_factor_secret),
    });

    const delta = totp.validate({ token: code, window: 1 });
    const isValidTotp = delta !== null;

    // If TOTP fails, check backup codes
    let usedBackupCode = false;
    if (!isValidTotp && profile.backup_codes?.length) {
      const codeIndex = profile.backup_codes.indexOf(code.toUpperCase());
      if (codeIndex !== -1) {
        usedBackupCode = true;
        // Remove used backup code
        const newBackupCodes = [...profile.backup_codes];
        newBackupCodes.splice(codeIndex, 1);
        
        await supabaseClient
          .from("profiles")
          .update({ backup_codes: newBackupCodes })
          .eq("user_id", user.id);
      }
    }

    if (!isValidTotp && !usedBackupCode) {
      return new Response(
        JSON.stringify({ error: "Invalid code", valid: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If this is setup verification, enable 2FA
    if (isSetup) {
      const { error: enableError } = await supabaseClient
        .from("profiles")
        .update({
          two_factor_enabled: true,
          two_factor_verified_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (enableError) {
        return new Response(
          JSON.stringify({ error: "Failed to enable 2FA" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        valid: true,
        usedBackupCode,
        remainingBackupCodes: usedBackupCode ? profile.backup_codes.length - 1 : undefined,
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
