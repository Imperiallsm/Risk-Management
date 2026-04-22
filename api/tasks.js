'use strict';
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (req.method === 'POST') {
    const { projectId, name, dueDate } = req.body || {};
    if (!projectId || !name) return res.status(400).json({ error: 'projectId and name required' });
    const { data, error } = await sb.from('project_tasks')
      .insert({ project_id: projectId, name, due_date: dueDate || null, status: 'To Do', done: false })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ id: data.id, name: data.name, status: data.status, dueDate: data.due_date, done: data.done });
  }

  if (req.method === 'PATCH') {
    const { id, done, status } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const updates = {};
    if (done !== undefined) updates.done = done;
    if (status !== undefined) updates.status = status;
    const { error } = await sb.from('project_tasks').update(updates).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
};
