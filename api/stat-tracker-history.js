'use strict';
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  const auth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const { data: { user }, error: authErr } = await auth.auth.getUser(req.headers.authorization?.replace('Bearer ', ''));
  if (authErr || !user) return res.status(401).end();

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (req.method === 'GET') {
    const { data, error } = await sb.from('stat_tracker_history')
      .select('*').order('created_at', { ascending: false }).limit(200);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || []);
  }

  if (req.method === 'POST') {
    const { actorEmail, actorName, action, entityType, entityLabel, monthName, section, detail } = req.body || {};
    if (!actorEmail || !action) return res.status(400).json({ error: 'actorEmail and action required' });
    const { error } = await sb.from('stat_tracker_history').insert({
      actor_email: actorEmail,
      actor_name: actorName || '',
      action,
      entity_type: entityType || '',
      entity_label: entityLabel || '',
      month_name: monthName || '',
      section: section || '',
      detail: detail || '',
    });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
};
