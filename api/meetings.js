'use strict';
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (req.method === 'POST') {
    const { title, date } = req.body || {};
    if (!title) return res.status(400).json({ error: 'Title required' });
    const { data, error } = await sb.from('meetings')
      .insert({ title, date: date || new Date().toISOString().split('T')[0] })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ id: data.id, title: data.title, date: data.date, expanded: true, items: [] });
  }

  if (req.method === 'PATCH') {
    const { id, title, date } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (date !== undefined) updates.date = date;
    const { error } = await sb.from('meetings').update(updates).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const { error } = await sb.from('meetings').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
};
