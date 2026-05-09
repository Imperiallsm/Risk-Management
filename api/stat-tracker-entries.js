'use strict';
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  const auth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const { data: { user }, error: authErr } = await auth.auth.getUser(req.headers.authorization?.replace('Bearer ', ''));
  if (authErr || !user) return res.status(401).end();

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (req.method === 'POST') {
    const { monthId, username } = req.body || {};
    if (!monthId || !username) return res.status(400).json({ error: 'monthId and username required' });
    const { data, error } = await sb.from('stat_tracker_entries')
      .insert({ month_id: monthId, username, values: {} }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ id: data.id, monthId: data.month_id, username: data.username, values: data.values || {} });
  }

  if (req.method === 'PATCH') {
    const { id, username, values } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const updates = {};
    if (username !== undefined) updates.username = username;
    if (values !== undefined) updates.values = values;
    const { error } = await sb.from('stat_tracker_entries').update(updates).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const { error } = await sb.from('stat_tracker_entries').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
};
