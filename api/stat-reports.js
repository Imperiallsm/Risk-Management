'use strict';
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  const auth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const { data: { user }, error: authErr } = await auth.auth.getUser(req.headers.authorization?.replace('Bearer ', ''));
  if (authErr || !user) return res.status(401).end();

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (req.method === 'GET') {
    const { author } = req.query || {};
    let query = sb.from('stat_reports').select('*').order('created_at', { ascending: false });
    if (author) query = query.eq('author_email', author);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || []);
  }

  if (req.method === 'POST') {
    const { section, authorEmail, authorName, title, body, fileUrl, fileName } = req.body || {};
    if (!section || !title || !body) return res.status(400).json({ error: 'section, title and body required' });
    const { data, error } = await sb.from('stat_reports')
      .insert({ section, author_email: authorEmail, author_name: authorName, title, body, file_url: fileUrl || '', file_name: fileName || '' })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'PATCH') {
    const { id, status, adminReply, readByAdmin, readByAuthor } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const updates = {};
    if (status !== undefined) updates.status = status;
    if (adminReply !== undefined) updates.admin_reply = adminReply;
    if (readByAdmin !== undefined) updates.read_by_admin = readByAdmin;
    if (readByAuthor !== undefined) updates.read_by_author = readByAuthor;
    const { error } = await sb.from('stat_reports').update(updates).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    // Fetch report to get file path before deleting
    const { data: report } = await sb.from('stat_reports').select('file_url').eq('id', id).single();
    if (report?.file_url) {
      // Extract storage path from public URL
      const match = report.file_url.match(/\/reports\/(.+)$/);
      if (match) await sb.storage.from('reports').remove([match[1]]);
    }
    const { error } = await sb.from('stat_reports').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
};
