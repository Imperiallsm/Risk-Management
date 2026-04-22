'use strict';
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (req.method === 'POST') {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Name required' });
    const { data, error } = await sb.from('projects').insert({ name }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ id: data.id, name: data.name, tasks: [] });
  }

  if (req.method === 'PATCH') {
    const { id, name } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const { error } = await sb.from('projects').update({ name }).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const { error } = await sb.from('projects').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
};
