'use strict';
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (req.method === 'POST') {
    const { recipient, amount, reason, date, status, paidBy } = req.body || {};
    if (!recipient || !amount) return res.status(400).json({ error: 'recipient and amount required' });
    const { data, error } = await sb.from('invoices')
      .insert({ recipient, amount, reason: reason || null, date, status: status || 'Pending', paid_by: paidBy || null })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ id: data.id, recipient: data.recipient, amount: data.amount, reason: data.reason, date: data.date, status: data.status, paidBy: data.paid_by, attachments: [] });
  }

  if (req.method === 'PATCH') {
    const { id, status, recipient, amount, reason, date, paidBy } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const updates = {};
    if (status !== undefined) updates.status = status;
    if (recipient !== undefined) updates.recipient = recipient;
    if (amount !== undefined) updates.amount = amount;
    if (reason !== undefined) updates.reason = reason;
    if (date !== undefined) updates.date = date;
    if (paidBy !== undefined) updates.paid_by = paidBy;
    const { error } = await sb.from('invoices').update(updates).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const { error } = await sb.from('invoices').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
};
