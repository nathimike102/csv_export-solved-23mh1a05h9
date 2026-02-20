const logger = require('../utils/logger');

class JobQueue {
  constructor() {
    this.jobs = new Map();
    this.workers = new Map();
    this.maxConcurrentJobs = 5;
    this.activeJobs = 0;
  }

  async addJob(jobId, jobData) {
    this.jobs.set(jobId, {
      id: jobId,
      ...jobData,
      status: 'pending',
      createdAt: new Date(),
      progress: {
        totalRows: 0,
        processedRows: 0,
        percentage: 0
      }
    });

    this.processQueue();
    return jobId;
  }

  getJob(jobId) {
    return this.jobs.get(jobId);
  }

  updateProgress(jobId, processedRows, totalRows) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.progress.processedRows = processedRows;
      job.progress.totalRows = totalRows;
      job.progress.percentage = totalRows > 0 ? Math.round((processedRows / totalRows) * 100) : 0;
    }
  }

  completeJob(jobId, filePath) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'completed';
      job.filePath = filePath;
      job.completedAt = new Date();
      job.progress.percentage = 100;
    }
  }

  failJob(jobId, error) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'failed';
      job.error = error.message || error;
      job.completedAt = new Date();
    }
  }

  cancelJob(jobId) {
    const job = this.jobs.get(jobId);
    if (job && (job.status === 'pending' || job.status === 'processing')) {
      job.status = 'cancelled';
      job.completedAt = new Date();

      if (this.workers.has(jobId)) {
        this.workers.get(jobId).cancelled = true;
        this.workers.delete(jobId);
      }
      
      return true;
    }
    return false;
  }

  startJob(jobId) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'processing';
      job.startedAt = new Date();
    }
  }

  registerWorker(jobId, workerData) {
    this.workers.set(jobId, workerData);
  }

  getWorker(jobId) {
    return this.workers.get(jobId);
  }

  removeJob(jobId) {
    this.jobs.delete(jobId);
    this.workers.delete(jobId);
  }

  processQueue() {
    // Placeholder for queue processing logic
  }
}

module.exports = new JobQueue();
