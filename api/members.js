'use strict';
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

async function sendInviteEmail(name, email) {
  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY not set — skipping invite email');
    return;
  }
  const siteUrl = process.env.SITE_URL || 'your workspace';
  const resend = new Resend(process.env.RESEND_API_KEY);

  const { error } = await resend.emails.send({
    from: 'Risk Universalis <onboarding@resend.dev>',
    to: email,
    subject: "You've been invited to Risk Universalis",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="margin:0 0 8px;font-size:20px;color:#111">You've been invited</h2>
        <p style="margin:0 0 24px;color:#555;font-size:15px">
          Hi ${name}, you've been invited to join the <strong>Risk Universalis</strong> workspace.
        </p>
        <a href="${siteUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600">
          Sign in to Workspace
        </a>
        <p style="margin:24px 0 0;color:#999;font-size:13px">
          Sign in using this email address: <strong>${email}</strong><br/>
          You'll receive a one-time code to verify your identity.
        </p>
      </div>
    `,
  });

  if (error) console.error('Resend error:', error);
}

module.exports = async (req, res) => {
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (req.method === 'POST') {
    const { name, email, role } = req.body || {};
    if (!name || !email) return res.status(400).json({ error: 'name and email required' });
    const { data, error } = await sb.from('members')
      .insert({ name, email, role: role || 'Member', join_date: new Date().toISOString().split('T')[0] })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });

    await sendInviteEmail(data.name, data.email);

    return res.status(200).json({ id: data.id, name: data.name, email: data.email, role: data.role, joinDate: data.join_date });
  }

  if (req.method === 'PATCH') {
    const { id, name, role } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (role !== undefined) updates.role = role;
    const { error } = await sb.from('members').update(updates).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const { error } = await sb.from('members').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
};
