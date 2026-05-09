'use strict';
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  await sb.from('members').select('id').limit(1);
  res.status(200).json({ ok: true, ping: new Date().toISOString() });
};
