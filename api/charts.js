'use strict';
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (req.method === 'POST') {
    const { channelId, title, chartType, data } = req.body || {};
    if (!channelId || !title) return res.status(400).json({ error: 'channelId and title required' });
    const { data: row, error } = await sb.from('stat_charts')
      .insert({ channel_id: channelId, title, chart_type: chartType || 'bar', data: data || [] })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({
      id: row.id,
      channelId: row.channel_id,
      title: row.title,
      chartType: row.chart_type,
      data: row.data || [],
    });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const { error } = await sb.from('stat_charts').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
};
