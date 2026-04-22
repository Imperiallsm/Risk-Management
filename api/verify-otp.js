'use strict';

const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { email, token } = req.body || {};
  if (!email || !token) {
    return res.status(400).json({ error: 'Email and token required' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: String(token).trim(),
    type: 'email',
  });

  if (error) {
    return res.status(401).json({ error: 'Invalid or expired code' });
  }

  return res.status(200).json({
    success: true,
    access_token: data.session?.access_token,
    expires_at: data.session?.expires_at,
  });
};
