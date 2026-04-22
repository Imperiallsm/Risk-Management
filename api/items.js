'use strict';
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (req.method === 'POST') {
    const { meetingId, name } = req.body || {};
    if (!meetingId || !name) return res.status(400).json({ error: 'meetingId and name required' });
    const { data, error } = await sb.from('meeting_items')
      .insert({ meeting_id: meetingId, name, done: false, has_timeline: false, deadline: null })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ id: data.id, name: data.name, done: false, hasTimeline: false, deadline: null });
  }

  if (req.method === 'PATCH') {
    const { id, done, hasTimeline, deadline, name } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const updates = {};
    if (done !== undefined) updates.done = done;
    if (hasTimeline !== undefined) updates.has_timeline = hasTimeline;
    if (deadline !== undefined) updates.deadline = deadline;
    if (name !== undefined) updates.name = name;
    const { error } = await sb.from('meeting_items').update(updates).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const { error } = await sb.from('meeting_items').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
};
