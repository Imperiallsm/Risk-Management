'use strict';

const { createClient } = require('@supabase/supabase-js');

const ADMIN_EMAIL = 'alverzalexander0@gmail.com';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { email } = req.body || {};
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email required' });
  }

  const normalized = email.trim().toLowerCase();

  // Admin is always authorized
  if (normalized !== ADMIN_EMAIL) {
    // Everyone else must be in the members table (invited by admin)
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data } = await sb.from('members').select('id').eq('email', normalized).maybeSingle();
    if (!data) {
      return res.status(403).json({ error: 'Email not authorized' });
    }
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const { error } = await supabase.auth.signInWithOtp({
    email: normalized,
    options: { shouldCreateUser: true },
  });

  if (error) {
    console.error('Supabase OTP error:', error.message);
    return res.status(500).json({ error: 'Failed to send code. Try again.' });
  }

  return res.status(200).json({ success: true });
};
