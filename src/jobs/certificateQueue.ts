import Bull from 'bull'

// Koneksi ke Redis (default: redis://redis:6379)
export const certificateQueue = new Bull('certificate-generation', {
  redis: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
})

export const addCertificateJob = (data: any) => certificateQueue.add(data, { attempts: 3, backoff: 5000 }) 