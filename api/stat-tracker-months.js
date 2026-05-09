'use strict';
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (req.method === 'POST') {
    const { section, name, duplicateFrom } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });

    let columns = [];
    if (duplicateFrom) {
      const { data: src } = await sb.from('stat_tracker_months').select('columns,section').eq('id', duplicateFrom).single();
      columns = src?.columns || [];
      const usedSection = section || src?.section;
      const { data, error } = await sb.from('stat_tracker_months')
        .insert({ section: usedSection, name, columns }).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ id: data.id, section: data.section, name: data.name, columns: data.columns || [], entries: [] });
    }

    if (!section) return res.status(400).json({ error: 'section required' });
    const { data, error } = await sb.from('stat_tracker_months')
      .insert({ section, name, columns: [] }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ id: data.id, section: data.section, name: data.name, columns: [], entries: [] });
  }

  if (req.method === 'PATCH') {
    const { id, name, columns } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (columns !== undefined) updates.columns = columns;
    const { error } = await sb.from('stat_tracker_months').update(updates).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const { error } = await sb.from('stat_tracker_months').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
};
