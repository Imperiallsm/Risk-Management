'use strict';
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).end();

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const [proj, meet, inv, mem, chan] = await Promise.all([
    sb.from('projects').select('*, tasks:project_tasks(*)').order('created_at'),
    sb.from('meetings').select('*, items:meeting_items(*)').order('created_at', { ascending: false }),
    sb.from('invoices').select('*').order('created_at', { ascending: false }),
    sb.from('members').select('*').order('join_date'),
    sb.from('stat_channels').select('*, charts:stat_charts(*)').order('created_at'),
  ]);

  const projects = (proj.data || []).map(p => ({
    id: p.id,
    name: p.name,
    tasks: (p.tasks || []).map(t => ({
      id: t.id,
      name: t.name,
      status: t.status,
      dueDate: t.due_date,
      done: t.done,
    })),
  }));

  const meetings = (meet.data || []).map(m => ({
    id: m.id,
    title: m.title,
    date: m.date,
    expanded: false,
    items: (m.items || []).map(i => ({
      id: i.id,
      name: i.name,
      done: i.done,
      hasTimeline: i.has_timeline,
      deadline: i.deadline,
    })),
  }));

  const invoices = (inv.data || []).map(i => ({
    id: i.id,
    recipient: i.recipient,
    amount: i.amount,
    reason: i.reason,
    date: i.date,
    status: i.status,
    paidBy: i.paid_by,
    attachments: [],
  }));

  const members = (mem.data || []).map(m => ({
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role,
    joinDate: m.join_date,
  }));

  const channels = (chan.data || []).map(c => ({
    id: c.id,
    name: c.name,
    charts: (c.charts || []).map(ch => ({
      id: ch.id,
      channelId: ch.channel_id,
      title: ch.title,
      chartType: ch.chart_type,
      data: ch.data || [],
    })),
  }));

  return res.status(200).json({ projects, meetings, invoices, members, channels });
};
