/**
 * Performance monitoring utilities for parallel assessment operations
 */

export interface PerformanceMetrics {
  startTime: number
  endTime?: number
  duration?: number
  throughput?: number
  memoryUsage?: {
    used: number
    total: number
    percentage: number
  }
  errorRate?: number
  averageResponseTime?: number
}

export interface BatchMetrics {
  batchNumber: number
  batchSize: number
  startTime: number
  endTime?: number
  duration?: number
  successCount: number
  errorCount: number
  timeoutCount: number
  averageProcessingTime: number
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics
  private batchMetrics: BatchMetrics[] = []
  private questionTimings: number[] = []

  constructor() {
    this.metrics = {
      startTime: Date.now()
    }
  }

  /**
   * Start monitoring a new batch
   */
  startBatch(batchNumber: number, batchSize: number): void {
    this.batchMetrics.push({
      batchNumber,
      batchSize,
      startTime: Date.now(),
      successCount: 0,
      errorCount: 0,
      timeoutCount: 0,
      averageProcessingTime: 0
    })
  }

  /**
   * End monitoring for the current batch
   */
  endBatch(batchNumber: number, results: any[]): void {
    const batch = this.batchMetrics.find(b => b.batchNumber === batchNumber)
    if (!batch) return

    batch.endTime = Date.now()
    batch.duration = batch.endTime - batch.startTime
    
    // Count results
    batch.successCount = results.filter(r => r.success).length
    batch.errorCount = results.filter(r => !r.success && !r.timeoutOccurred).length
    batch.timeoutCount = results.filter(r => r.timeoutOccurred).length
    
    // Calculate average processing time
    const processingTimes = results
      .filter(r => r.processingTimeMs)
      .map(r => r.processingTimeMs)
    
    batch.averageProcessingTime = processingTimes.length > 0 
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
      : 0

    // Add to overall question timings
    this.questionTimings.push(...processingTimes)
  }

  /**
   * Record individual question timing
   */
  recordQuestionTiming(timeMs: number): void {
    this.questionTimings.push(timeMs)
  }

  /**
   * End overall monitoring and calculate final metrics
   */
  end(totalQuestions: number, successfulQuestions: number): PerformanceMetrics {
    this.metrics.endTime = Date.now()
    this.metrics.duration = this.metrics.endTime - this.metrics.startTime
    
    // Calculate throughput (questions per second)
    this.metrics.throughput = totalQuestions > 0 
      ? Math.round((totalQuestions / this.metrics.duration) * 1000 * 100) / 100
      : 0

    // Calculate error rate
    this.metrics.errorRate = totalQuestions > 0 
      ? Math.round(((totalQuestions - successfulQuestions) / totalQuestions) * 100 * 100) / 100
      : 0

    // Calculate average response time
    this.metrics.averageResponseTime = this.questionTimings.length > 0
      ? Math.round((this.questionTimings.reduce((sum, time) => sum + time, 0) / this.questionTimings.length) * 100) / 100
      : 0

    // Get memory usage if available
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage()
      this.metrics.memoryUsage = {
        used: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100, // MB
        total: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100, // MB
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100 * 100) / 100
      }
    }

    return this.metrics
  }

  /**
   * Get current performance snapshot
   */
  getSnapshot(): {
    metrics: PerformanceMetrics
    batchMetrics: BatchMetrics[]
    questionTimings: number[]
  } {
    const currentTime = Date.now()
    return {
      metrics: {
        ...this.metrics,
        duration: currentTime - this.metrics.startTime
      },
      batchMetrics: [...this.batchMetrics],
      questionTimings: [...this.questionTimings]
    }
  }

  /**
   * Get detailed performance report
   */
  getDetailedReport(totalQuestions: number): {
    summary: {
      totalDurationMs: number
      averageQuestionTimeMs: number
      throughputQuestionsPerSec: number
      peakMemoryUsageMB: number
      totalBatches: number
    }
    batchAnalysis: {
      fastest: BatchMetrics | null
      slowest: BatchMetrics | null
      mostEfficient: BatchMetrics | null
      averageBatchTime: number
    }
    timingAnalysis: {
      fastest: number
      slowest: number
      median: number
      percentile95: number
      standardDeviation: number
    }
  } {
    const finalMetrics = this.end(totalQuestions, totalQuestions)
    
    // Batch analysis
    const completedBatches = this.batchMetrics.filter(b => b.duration !== undefined)
    const fastest = completedBatches.reduce((min, batch) => 
      (batch.duration || 0) < (min?.duration || Infinity) ? batch : min, null as BatchMetrics | null)
    
    const slowest = completedBatches.reduce((max, batch) => 
      (batch.duration || 0) > (max?.duration || 0) ? batch : max, null as BatchMetrics | null)
    
    const mostEfficient = completedBatches.reduce((best, batch) => {
      const efficiency = batch.successCount / (batch.duration || 1)
      const bestEfficiency = (best?.successCount || 0) / (best?.duration || 1)
      return efficiency > bestEfficiency ? batch : best
    }, null as BatchMetrics | null)

    const averageBatchTime = completedBatches.length > 0 
      ? completedBatches.reduce((sum, batch) => sum + (batch.duration || 0), 0) / completedBatches.length
      : 0

    // Timing analysis
    const sortedTimings = [...this.questionTimings].sort((a, b) => a - b)
    const median = sortedTimings.length > 0 
      ? sortedTimings[Math.floor(sortedTimings.length / 2)]
      : 0
    
    const percentile95 = sortedTimings.length > 0
      ? sortedTimings[Math.floor(sortedTimings.length * 0.95)]
      : 0

    const mean = this.questionTimings.length > 0
      ? this.questionTimings.reduce((sum, time) => sum + time, 0) / this.questionTimings.length
      : 0

    const variance = this.questionTimings.length > 0
      ? this.questionTimings.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / this.questionTimings.length
      : 0

    const standardDeviation = Math.sqrt(variance)

    return {
      summary: {
        totalDurationMs: finalMetrics.duration || 0,
        averageQuestionTimeMs: finalMetrics.averageResponseTime || 0,
        throughputQuestionsPerSec: finalMetrics.throughput || 0,
        peakMemoryUsageMB: finalMetrics.memoryUsage?.used || 0,
        totalBatches: this.batchMetrics.length
      },
      batchAnalysis: {
        fastest,
        slowest,
        mostEfficient,
        averageBatchTime: Math.round(averageBatchTime)
      },
      timingAnalysis: {
        fastest: Math.min(...this.questionTimings) || 0,
        slowest: Math.max(...this.questionTimings) || 0,
        median: Math.round(median || 0),
        percentile95: Math.round(percentile95 || 0),
        standardDeviation: Math.round(standardDeviation * 100) / 100
      }
    }
  }
}

/**
 * Simple performance utility functions
 */
export const Performance = {
  /**
   * Time a function execution
   */
  time: async <T>(fn: () => Promise<T>): Promise<{ result: T; timeMs: number }> => {
    const start = Date.now()
    const result = await fn()
    const timeMs = Date.now() - start
    return { result, timeMs }
  },

  /**
   * Create a simple timer
   */
  timer: () => {
    const start = Date.now()
    return {
      elapsed: () => Date.now() - start,
      stop: () => Date.now() - start
    }
  },

  /**
   * Format timing for display
   */
  formatTime: (ms: number): string => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${Math.round(ms / 100) / 10}s`
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
  },

  /**
   * Calculate throughput
   */
  calculateThroughput: (count: number, timeMs: number): number => {
    return Math.round((count / timeMs) * 1000 * 100) / 100
  }
}
