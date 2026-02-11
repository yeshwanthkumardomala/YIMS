import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResetRequest {
  approval_request_id: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's token
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify the user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: authUser }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !authUser) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = authUser.id;
    console.log('Data reset requested by user:', userId);

    // Use service role client for admin operations
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Check if user is primary admin using database function
    const { data: isPrimaryAdmin, error: adminCheckError } = await serviceClient
      .rpc('is_primary_admin', { _user_id: userId });

    if (adminCheckError) {
      console.error('Primary admin check error:', adminCheckError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify admin status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isPrimaryAdmin) {
      console.log('User is not primary admin, rejecting request');
      return new Response(
        JSON.stringify({ error: 'Only the primary admin can execute data reset' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: ResetRequest = await req.json();
    const { approval_request_id } = body;

    if (!approval_request_id) {
      return new Response(
        JSON.stringify({ error: 'Missing approval_request_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the approval request exists and is pending
    const { data: approvalRequest, error: approvalError } = await serviceClient
      .from('approval_requests')
      .select('*')
      .eq('id', approval_request_id)
      .eq('request_type', 'data_reset')
      .eq('status', 'pending')
      .single();

    if (approvalError || !approvalRequest) {
      console.error('Approval request not found:', approvalError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired reset request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if request is expired (24 hours)
    const createdAt = new Date(approvalRequest.created_at);
    const now = new Date();
    const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceCreation > 24) {
      // Mark as expired
      await serviceClient
        .from('approval_requests')
        .update({ status: 'rejected', review_notes: 'Expired after 24 hours' })
        .eq('id', approval_request_id);

      return new Response(
        JSON.stringify({ error: 'Reset request has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Executing data reset...');

    // Tables to clear in order (respecting foreign key constraints)
    const tablesToClear = [
      'stock_transactions',
      'usage_history',
      'scan_logs',
      'webhook_logs',
      'item_variants',
      'items',
      'locations',
      'categories',
      'notifications',
    ];

    const deletionResults: Record<string, number> = {};

    // Delete data from each table
    for (const table of tablesToClear) {
      try {
        const { count, error } = await serviceClient
          .from(table)
          .delete({ count: 'exact' })
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows
        
        if (error) {
          console.error(`Error clearing ${table}:`, error);
          throw new Error(`Failed to clear ${table}: ${error.message}`);
        }
        
        deletionResults[table] = count || 0;
        console.log(`Cleared ${table}: ${count || 0} rows`);
      } catch (err) {
        console.error(`Error clearing ${table}:`, err);
        throw err;
      }
    }

    // Clear approval requests except the current one
    const { count: approvalCount } = await serviceClient
      .from('approval_requests')
      .delete({ count: 'exact' })
      .neq('id', approval_request_id);
    
    deletionResults['approval_requests'] = approvalCount || 0;

    // Update the approval request to approved
    await serviceClient
      .from('approval_requests')
      .update({
        status: 'approved',
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        review_notes: 'Data reset completed successfully'
      })
      .eq('id', approval_request_id);

    // Log the reset completion
    await serviceClient
      .from('system_logs')
      .insert({
        event_type: 'data_reset_completed',
        event_description: 'Factory reset completed by primary admin',
        user_id: userId,
        metadata: {
          approval_request_id,
          requested_by: approvalRequest.requested_by,
          reason: approvalRequest.reason,
          deletion_results: deletionResults
        }
      });

    // Notify all admins about the reset
    const { data: adminUsers } = await serviceClient
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (adminUsers) {
      const notifications = adminUsers.map(admin => ({
        user_id: admin.user_id,
        title: 'Data Reset Completed',
        message: 'The system data has been reset. All inventory data has been cleared.',
        type: 'warning',
        category: 'system',
        action_url: '/settings',
        metadata: { approval_request_id }
      }));

      await serviceClient.from('notifications').insert(notifications);
    }

    console.log('Data reset completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Data reset completed successfully',
        deletion_results: deletionResults
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Data reset error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to execute data reset', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
