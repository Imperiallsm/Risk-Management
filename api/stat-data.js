'use strict';
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).end();
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const [monthsRes, membersRes, chanRes, profRes] = await Promise.all([
    sb.from('stat_tracker_months').select('*, entries:stat_tracker_entries(*)').order('created_at'),
    sb.from('members').select('*').order('join_date'),
    sb.from('stat_channels').select('*, charts:stat_charts(*)').order('created_at'),
    sb.from('profiles').select('*'),
  ]);

  const months = (monthsRes.data || []).map(m => ({
    id: m.id,
    section: m.section,
    name: m.name,
    columns: m.columns || [],
    entries: (m.entries || [])
      .map(e => ({ id: e.id, monthId: e.month_id, username: e.username, values: e.values || {} }))
      .sort((a, b) => a.username.localeCompare(b.username)),
  }));

  const members = (membersRes.data || []).map(m => ({
    id: m.id, name: m.name, email: m.email, role: m.role,
    access: m.access || 'directory', joinDate: m.join_date,
  }));

  const channels = (chanRes.data || []).map(c => ({
    id: c.id,
    name: c.name,
    charts: (c.charts || []).map(ch => ({
      id: ch.id, channelId: ch.channel_id, title: ch.title,
      chartType: ch.chart_type, data: ch.data || [],
    })),
  }));

  const profiles = {};
  (profRes.data || []).forEach(p => { profiles[p.email] = p.avatar_url; });

  return res.status(200).json({ months, members, channels, profiles });
};
