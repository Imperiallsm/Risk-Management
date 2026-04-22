'use strict';
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (req.method === 'POST') {
    const { name, email, role } = req.body || {};
    if (!name || !email) return res.status(400).json({ error: 'name and email required' });
    const { data, error } = await sb.from('members')
      .insert({ name, email, role: role || 'Member', join_date: new Date().toISOString().split('T')[0] })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ id: data.id, name: data.name, email: data.email, role: data.role, joinDate: data.join_date });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const { error } = await sb.from('members').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
};
