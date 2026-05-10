'use strict';
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const auth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const { data: { user }, error: authErr } = await auth.auth.getUser(req.headers.authorization?.replace('Bearer ', ''));
  if (authErr || !user) return res.status(401).end();

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { base64, name, type } = req.body || {};
  if (!base64 || !name) return res.status(400).json({ error: 'base64 and name required' });

  const buffer = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ''), 'base64');
  const ext = name.split('.').pop();
  const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await sb.storage.from('reports').upload(path, buffer, {
    contentType: type || 'application/octet-stream',
    upsert: true,
  });
  if (error) return res.status(500).json({ error: error.message });

  const { data: { publicUrl } } = sb.storage.from('reports').getPublicUrl(path);
  return res.status(200).json({ url: publicUrl, name });
};
