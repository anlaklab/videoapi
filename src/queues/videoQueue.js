const { Queue, Worker } = require('bullmq');
const { bullMQConnection } = require('../config/redis');
const logger = require('../utils/logger');

// Configuración de la cola de videos
const VIDEO_QUEUE_NAME = 'video-processing';

// Crear la cola
const videoQueue = new Queue(VIDEO_QUEUE_NAME, {
  connection: bullMQConnection.connection,
  defaultJobOptions: {
    removeOnComplete: 50,  // Reducir uso de memoria
    removeOnFail: 25,      // Mantener menos trabajos fallidos
    attempts: 5,           // Más intentos de reintento
    backoff: {
      type: 'exponential',
      delay: 2000,         // Retraso inicial de 2 segundos
    },
    // TTL para trabajos (24 horas)
    ttl: 24 * 60 * 60 * 1000,
  },
});

// Tipos de trabajos
const JOB_TYPES = {
  RENDER_VIDEO: 'render-video',
  RENDER_TEMPLATE: 'render-template',
  VALIDATE_TIMELINE: 'validate-timeline',
  PROCESS_ASSETS: 'process-assets',
  GENERATE_THUMBNAIL: 'generate-thumbnail'
};

// Prioridades de trabajos
const JOB_PRIORITIES = {
  LOW: 1,
  NORMAL: 5,
  HIGH: 10,
  URGENT: 20
};

// Función para agregar trabajo de renderizado de video
async function addVideoRenderJob(timelineData, options = {}) {
  try {
    const jobData = {
      type: JOB_TYPES.RENDER_VIDEO,
      timeline: timelineData.timeline,
      output: timelineData.output,
      mergeFields: timelineData.mergeFields || {},
      clientId: options.clientId,
      apiKey: options.apiKey,
      callback: options.callback,
      metadata: {
        createdAt: new Date().toISOString(),
        userAgent: options.userAgent,
        ip: options.ip,
        estimatedDuration: calculateEstimatedDuration(timelineData.timeline)
      }
    };

    const jobOptions = {
      priority: options.priority || JOB_PRIORITIES.NORMAL,
      delay: options.delay || 0,
      jobId: options.jobId,
      ...options.jobOptions
    };

    const job = await videoQueue.add(JOB_TYPES.RENDER_VIDEO, jobData, jobOptions);
    
    logger.info(`Cola: Trabajo de video agregado - ID: ${job.id}`, {
      jobId: job.id,
      clientId: options.clientId,
      priority: jobOptions.priority
    });

    return {
      jobId: job.id,
      status: 'enqueued',
      estimatedDuration: jobData.metadata.estimatedDuration,
      queuePosition: await getQueuePosition(job.id)
    };

  } catch (error) {
    logger.error('Cola: Error agregando trabajo de video', error);
    throw error;
  }
}

// Función para agregar trabajo de template
async function addTemplateRenderJob(templateId, mergeFields, output, options = {}) {
  try {
    const jobData = {
      type: JOB_TYPES.RENDER_TEMPLATE,
      templateId,
      mergeFields,
      output,
      clientId: options.clientId,
      apiKey: options.apiKey,
      callback: options.callback,
      metadata: {
        createdAt: new Date().toISOString(),
        userAgent: options.userAgent,
        ip: options.ip
      }
    };

    const jobOptions = {
      priority: options.priority || JOB_PRIORITIES.NORMAL,
      delay: options.delay || 0,
      jobId: options.jobId,
      ...options.jobOptions
    };

    const job = await videoQueue.add(JOB_TYPES.RENDER_TEMPLATE, jobData, jobOptions);
    
    logger.info(`Cola: Trabajo de template agregado - ID: ${job.id}`, {
      jobId: job.id,
      templateId,
      clientId: options.clientId
    });

    return {
      jobId: job.id,
      status: 'enqueued',
      queuePosition: await getQueuePosition(job.id)
    };

  } catch (error) {
    logger.error('Cola: Error agregando trabajo de template', error);
    throw error;
  }
}

// Función para obtener estado de trabajo
async function getJobStatus(jobId) {
  try {
    const job = await videoQueue.getJob(jobId);
    
    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job.progress || 0;
    
    let status = state;
    if (state === 'waiting') status = 'enqueued';
    if (state === 'active') status = 'processing';
    if (state === 'completed') status = 'completed';
    if (state === 'failed') status = 'failed';

    const result = {
      jobId: job.id,
      status,
      progress,
      data: job.data,
      createdAt: new Date(job.timestamp).toISOString(),
      processedOn: job.processedOn ? new Date(job.processedOn).toISOString() : null,
      finishedOn: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
      failedReason: job.failedReason,
      returnvalue: job.returnvalue,
      attemptsMade: job.attemptsMade,
      opts: {
        priority: job.opts.priority,
        attempts: job.opts.attempts
      }
    };

    // Calcular ETA si está en procesamiento
    if (status === 'processing' && progress > 0) {
      const elapsed = Date.now() - job.processedOn;
      const estimated = (elapsed / progress) * (100 - progress);
      result.eta = Math.round(estimated / 1000); // En segundos
    }

    // Obtener posición en cola si está esperando
    if (status === 'enqueued') {
      result.queuePosition = await getQueuePosition(jobId);
    }

    return result;

  } catch (error) {
    logger.error(`Cola: Error obteniendo estado del trabajo ${jobId}`, error);
    return null;
  }
}

// Función para cancelar trabajo
async function cancelJob(jobId) {
  try {
    const job = await videoQueue.getJob(jobId);
    
    if (!job) {
      return { success: false, message: 'Trabajo no encontrado' };
    }

    const state = await job.getState();
    
    if (state === 'completed') {
      return { success: false, message: 'No se puede cancelar un trabajo completado' };
    }

    if (state === 'failed') {
      return { success: false, message: 'El trabajo ya falló' };
    }

    await job.remove();
    
    logger.info(`Cola: Trabajo cancelado - ID: ${jobId}`);
    
    return { 
      success: true, 
      message: 'Trabajo cancelado exitosamente',
      jobId 
    };

  } catch (error) {
    logger.error(`Cola: Error cancelando trabajo ${jobId}`, error);
    return { success: false, message: 'Error interno al cancelar' };
  }
}

// Función para obtener estadísticas de la cola
async function getQueueStats() {
  try {
    const waiting = await videoQueue.getWaiting();
    const active = await videoQueue.getActive();
    const completed = await videoQueue.getCompleted();
    const failed = await videoQueue.getFailed();
    const delayed = await videoQueue.getDelayed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      total: waiting.length + active.length + completed.length + failed.length + delayed.length
    };

  } catch (error) {
    logger.error('Cola: Error obteniendo estadísticas', error);
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      total: 0
    };
  }
}

// Función para limpiar trabajos antiguos
async function cleanOldJobs(olderThanMs = 24 * 60 * 60 * 1000) {
  try {
    const cleaned = await videoQueue.clean(olderThanMs, 100, 'completed');
    const cleanedFailed = await videoQueue.clean(olderThanMs, 50, 'failed');
    
    logger.info(`Cola: Limpieza completada - ${cleaned.length} completados, ${cleanedFailed.length} fallidos`);
    
    return {
      completed: cleaned.length,
      failed: cleanedFailed.length
    };

  } catch (error) {
    logger.error('Cola: Error en limpieza de trabajos', error);
    return { completed: 0, failed: 0 };
  }
}

// Función para obtener posición en cola
async function getQueuePosition(jobId) {
  try {
    const waiting = await videoQueue.getWaiting();
    const position = waiting.findIndex(job => job.id === jobId);
    return position >= 0 ? position + 1 : null;
  } catch (error) {
    logger.error(`Cola: Error obteniendo posición para ${jobId}`, error);
    return null;
  }
}

// Función para calcular duración estimada
function calculateEstimatedDuration(timeline) {
  try {
    let maxDuration = 0;
    
    timeline.tracks?.forEach(track => {
      track.clips?.forEach(clip => {
        const clipEnd = (clip.start || 0) + (clip.duration || clip.length || 0);
        if (clipEnd > maxDuration) {
          maxDuration = clipEnd;
        }
      });
    });

    return Math.max(maxDuration, 1);
  } catch (error) {
    logger.error('Cola: Error calculando duración estimada', error);
    return 1;
  }
}

// Función para pausar/reanudar cola
async function pauseQueue() {
  try {
    await videoQueue.pause();
    logger.info('Cola: Pausada');
    return true;
  } catch (error) {
    logger.error('Cola: Error pausando', error);
    return false;
  }
}

async function resumeQueue() {
  try {
    await videoQueue.resume();
    logger.info('Cola: Reanudada');
    return true;
  } catch (error) {
    logger.error('Cola: Error reanudando', error);
    return false;
  }
}

// Eventos de la cola
videoQueue.on('error', (error) => {
  logger.error('Cola: Error general', error);
});

videoQueue.on('waiting', (jobId) => {
  logger.debug(`Cola: Trabajo esperando - ${jobId}`);
});

videoQueue.on('active', (job) => {
  logger.info(`Cola: Trabajo iniciado - ${job.id}`);
});

videoQueue.on('completed', (job, result) => {
  logger.info(`Cola: Trabajo completado - ${job.id}`, { result });
});

videoQueue.on('failed', (job, err) => {
  logger.error(`Cola: Trabajo falló - ${job.id}`, { error: err.message });
});

videoQueue.on('progress', (job, progress) => {
  logger.debug(`Cola: Progreso - ${job.id}: ${progress}%`);
});

module.exports = {
  videoQueue,
  JOB_TYPES,
  JOB_PRIORITIES,
  addVideoRenderJob,
  addTemplateRenderJob,
  getJobStatus,
  cancelJob,
  getQueueStats,
  cleanOldJobs,
  pauseQueue,
  resumeQueue,
  getQueuePosition
}; 