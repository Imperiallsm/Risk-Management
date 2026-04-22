'use strict';
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (req.method === 'GET') {
    const { email } = req.query || {};
    if (!email) return res.status(400).json({ error: 'email required' });
    const { data } = await sb.from('profiles').select('*').eq('email', email).single();
    return res.status(200).json(data || { email, avatar_url: null });
  }

  if (req.method === 'POST') {
    const { email, avatarUrl } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email required' });
    const { data, error } = await sb.from('profiles')
      .upsert({ email, avatar_url: avatarUrl, updated_at: new Date().toISOString() }, { onConflict: 'email' })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ email: data.email, avatarUrl: data.avatar_url });
  }

  return res.status(405).end();
};
