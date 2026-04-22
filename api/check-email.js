'use strict';

const { createClient } = require('@supabase/supabase-js');

const WHITELIST = new Set([
  'alverzalexander0@gmail.com',
  'admin@riskuniversalis.com',
  'sarah@riskuniversalis.com',
  'james@riskuniversalis.com',
  'priya@riskuniversalis.com',
  'demo@riskuniversalis.com',
  'riskimperialist@gmail.com',
  'saltbear1project.rt@gmail.com',
]);

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

  if (!WHITELIST.has(normalized)) {
    // Return 403 but don't leak which emails ARE in the whitelist
    return res.status(403).json({ error: 'Email not authorized' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

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
