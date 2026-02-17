import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-device-api-key',
}

interface ScanRequest {
  code: string
  device_id: string
}

interface ItemData {
  id: string
  name: string
  code: string
  current_stock: number
  minimum_stock: number
  unit: string
  description: string | null
  location_name: string | null
  category_name: string | null
}

interface LocationData {
  id: string
  name: string
  code: string
  location_type: string
  description: string | null
  parent_name: string | null
}

// Simple rate limiting: track requests per device_id
const rateLimitMap = new Map<string, { count: number; windowStart: number }>()
const RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute
const RATE_LIMIT_MAX = 30 // max 30 requests per minute per device

function isRateLimited(deviceId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(deviceId)
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(deviceId, { count: 1, windowStart: now })
    return false
  }
  entry.count++
  return entry.count > RATE_LIMIT_MAX
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // --- Device API Key Authentication ---
    const ESP32_API_KEY = Deno.env.get('ESP32_API_KEY')
    if (ESP32_API_KEY) {
      const deviceApiKey = req.headers.get('x-device-api-key')
      if (!deviceApiKey || deviceApiKey !== ESP32_API_KEY) {
        console.warn('ESP32 scan rejected: invalid or missing API key')
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized: invalid device API key' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Parse request body
    const body: ScanRequest = await req.json()
    const { code, device_id } = body

    // Validate required fields
    if (!code || !device_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: code and device_id are required' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate input lengths to prevent abuse
    if (code.length > 100 || device_id.length > 100) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid input: fields too long' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Rate limiting per device
    if (isRateLimited(device_id)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Rate limit exceeded. Try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`ESP32 scan received - Device: ${device_id}, Code: ${code}`)

    // Create Supabase client with service role key for database access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse the YIMS code format: YIMS:<TYPE>:<ID>
    const parts = code.split(':')
    
    if (parts.length < 2 || parts[0] !== 'YIMS') {
      // Log the scan attempt even if code format is invalid
      await supabase.from('scan_logs').insert({
        code_scanned: code,
        code_type: 'unknown',
        scanned_by: null,
        action_taken: `esp32_scan:${device_id}:invalid_format`,
      })

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid code format. Expected YIMS:<TYPE>:<ID>',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const codeType = parts[1].toLowerCase()
    
    // Log the scan
    await supabase.from('scan_logs').insert({
      code_scanned: code,
      code_type: codeType,
      scanned_by: null,
      action_taken: `esp32_scan:${device_id}`,
    })

    // Handle item lookup
    if (codeType === 'item') {
      const { data: item, error } = await supabase
        .from('items')
        .select(`
          id,
          name,
          code,
          current_stock,
          minimum_stock,
          unit,
          description,
          category:categories(name),
          location:locations(name)
        `)
        .eq('code', code)
        .eq('is_active', true)
        .maybeSingle()

      if (error) {
        console.error('Database error:', error)
        return new Response(
          JSON.stringify({ success: false, error: 'Database error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!item) {
        return new Response(
          JSON.stringify({ success: false, error: 'Item not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const itemData: ItemData = {
        id: item.id,
        name: item.name,
        code: item.code,
        current_stock: item.current_stock,
        minimum_stock: item.minimum_stock,
        unit: item.unit,
        description: item.description,
        location_name: item.location && typeof item.location === 'object' && 'name' in item.location ? (item.location as { name: string }).name : null,
        category_name: item.category && typeof item.category === 'object' && 'name' in item.category ? (item.category as { name: string }).name : null,
      }

      console.log(`Item found: ${item.name} (Stock: ${item.current_stock})`)

      return new Response(
        JSON.stringify({ success: true, type: 'item', data: itemData }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle location lookup (building, room, shelf, box, drawer)
    if (['building', 'room', 'shelf', 'box', 'drawer'].includes(codeType)) {
      const { data: location, error } = await supabase
        .from('locations')
        .select(`
          id,
          name,
          code,
          location_type,
          description,
          parent:locations!parent_id(name)
        `)
        .eq('code', code)
        .eq('is_active', true)
        .maybeSingle()

      if (error) {
        console.error('Database error:', error)
        return new Response(
          JSON.stringify({ success: false, error: 'Database error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!location) {
        return new Response(
          JSON.stringify({ success: false, error: 'Location not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const locationData: LocationData = {
        id: location.id,
        name: location.name,
        code: location.code,
        location_type: location.location_type,
        description: location.description,
        parent_name: location.parent && typeof location.parent === 'object' && 'name' in location.parent ? (location.parent as { name: string }).name : null,
      }

      console.log(`Location found: ${location.name} (Type: ${location.location_type})`)

      return new Response(
        JSON.stringify({ success: true, type: 'location', data: locationData }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Unknown code type
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Unknown code type: ${codeType}`,
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error processing ESP32 scan:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
