'use strict';
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  const auth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const { data: { user }, error: authErr } = await auth.auth.getUser(req.headers.authorization?.replace('Bearer ', ''));
  if (authErr || !user) return res.status(401).end();

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (req.method === 'GET') {
    const { data, error } = await sb.from('stat_section_leaders').select('*');
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || []);
  }

  if (req.method === 'POST') {
    const { section, leaderEmail, leaderName } = req.body || {};
    if (!section) return res.status(400).json({ error: 'section required' });
    const { error } = await sb.from('stat_section_leaders')
      .upsert({ section, leader_email: leaderEmail || '', leader_name: leaderName || '' }, { onConflict: 'section' });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
};
