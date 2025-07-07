import Queue from 'bull';
import db from '../lib/db';
import { generateCertificateWithTemplate } from '../lib/certificate-generator';

const certificateQueue = new Queue('certificate-generation', {
  redis: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: 100,
  },
});

certificateQueue.on('error', (err) => {
  console.error('[REDIS QUEUE ERROR]', err);
});

console.log('[WORKER] certificateMultiWorker started, waiting for jobs...');

certificateQueue.process('generate-multi-certificate', 10, async (job) => {
  const { participantId, eventId, templates, templateIndex } = job.data;
  try {
    // Get participant data
    const [participantRows] = await db.execute(`
      SELECT p.*, t.token, e.name as event_name, e.start_time, e.end_time
      FROM participants p
      JOIN tickets t ON p.ticket_id = t.id
      JOIN events e ON t.event_id = e.id
      WHERE p.id = ? AND e.id = ?
    `, [participantId, eventId]);
    const participants = participantRows as any[];
    if (!participants || participants.length === 0) {
      throw new Error('Participant not found');
    }
    const participant = participants[0];
    const template = templates[templateIndex];
    if (!template) {
      throw new Error('Template not found');
    }
    // Prepare participant data with uppercase name
    const participantData = {
      ...participant,
      name: participant.name ? participant.name.toUpperCase() : '',
      certificate_number: `CERT-${participant.token}-${templateIndex + 1}`,
      date: new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    };
    // Generate certificate
    const certificatePath = await generateCertificateWithTemplate(
      template,
      participantData,
      eventId,
      `multi_template_${templateIndex + 1}`
    );
    // Save certificate record
    await db.execute(`
      INSERT INTO certificates (participant_id, template_id, path, sent, created_at)
      VALUES (?, ?, ?, FALSE, NOW())
      ON DUPLICATE KEY UPDATE
      path = VALUES(path),
      sent = FALSE,
      created_at = NOW()
    `, [participantId, templateIndex + 1, certificatePath]);
    await job.progress(100);
    return { success: true, certificatePath };
  } catch (error) {
    console.error('Error generating certificate:', error);
    throw error;
  }
});

certificateQueue.on('completed', (job, result) => {
  console.log(`[QUEUE] Job selesai: participantId=${job.data.participantId}, path=${result?.certificatePath}`);
});

certificateQueue.on('failed', (job, err) => {
  console.error(`[QUEUE] Job gagal: participantId=${job.data.participantId}, error=${err.message}`);
});

certificateQueue.on('active', (job) => {
  console.log(`[QUEUE] Mulai proses job: participantId=${job.data.participantId}`);
});

certificateQueue.on('waiting', (jobId) => {
  console.log(`[QUEUE] Job waiting: jobId=${jobId}`);
}); 