'use strict';
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).end();
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const [monthsRes, membersRes] = await Promise.all([
    sb.from('stat_tracker_months').select('*, entries:stat_tracker_entries(*)').order('created_at'),
    sb.from('members').select('*').order('join_date'),
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

  return res.status(200).json({ months, members });
};
