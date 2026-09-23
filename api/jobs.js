import { publicJobs } from '../lib/jobs.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  return res.status(200).json({ jobs: publicJobs() });
}
