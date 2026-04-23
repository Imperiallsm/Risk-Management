'use strict';
const { createClient } = require('@supabase/supabase-js');

function mapEntry(e) {
  return {
    id: e.id,
    monthId: e.month_id,
    username: e.username,
    robloxId: e.roblox_id || '',
    department: e.department || '',
    observations: e.observations || 0,
    playtime: e.playtime || 0,
    applications: e.applications || 0,
    appeals: e.appeals || 0,
    banishments: e.banishments || 0,
    staffReports: e.staff_reports || 0,
    staffMeetings: e.staff_meetings || 0,
    messages: e.messages || 0,
    strikes: e.strikes || 0,
    status: e.status || 'N/A',
    robux: e.robux || 0,
    notes: e.notes || '',
  };
}

module.exports = async (req, res) => {
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (req.method === 'POST') {
    const { monthId, username } = req.body || {};
    if (!monthId || !username) return res.status(400).json({ error: 'monthId and username required' });
    const { data, error } = await sb.from('tracker_entries')
      .insert({ month_id: monthId, username, roblox_id: '', department: '', observations: 0, playtime: 0, applications: 0, appeals: 0, banishments: 0, staff_reports: 0, staff_meetings: 0, messages: 0, strikes: 0, status: 'N/A', robux: 0, notes: '' })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(mapEntry(data));
  }

  if (req.method === 'PATCH') {
    const { id, ...fields } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const allowed = ['username', 'roblox_id', 'department', 'observations', 'playtime', 'applications', 'appeals', 'banishments', 'staff_reports', 'staff_meetings', 'messages', 'strikes', 'status', 'robux', 'notes'];
    const updates = {};
    for (const key of allowed) {
      if (fields[key] !== undefined) updates[key] = fields[key];
    }
    const { error } = await sb.from('tracker_entries').update(updates).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const { error } = await sb.from('tracker_entries').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
};
