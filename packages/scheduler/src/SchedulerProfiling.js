/**
 * 该模块提供了一种机制来记录调度器和任务的生命周期事件，
 * 用于性能分析和调试。它定义了一套事件类型和用于记录这些事件的函数。
 * 
 * @flow
 */

// 引入类型定义
import type {PriorityLevel} from './SchedulerPriorities';
// 引入功能开关
import {enableProfiling} from './SchedulerFeatureFlags';

// 用于唯一标识运行的计数器
let runIdCounter: number = 0;
// 用于唯一标识主线程的计数器
let mainThreadIdCounter: number = 0;

// 事件日志初始大小，单位为字节
const INITIAL_EVENT_LOG_SIZE = 131072;
// 事件日志最大大小，单位为字节
const MAX_EVENT_LOG_SIZE = 524288; // Equivalent to 2 megabytes

// 当前事件日志大小
let eventLogSize = 0;
// 事件日志的Buffer，用于存储Int32Array
let eventLogBuffer = null;
// 事件日志的Int32Array视图
let eventLog = null;
// 当前事件日志的索引
let eventLogIndex = 0;

// 定义不同类型的事件常量
const TaskStartEvent = 1;
const TaskCompleteEvent = 2;
const TaskErrorEvent = 3;
const TaskCancelEvent = 4;
const TaskRunEvent = 5;
const TaskYieldEvent = 6;
const SchedulerSuspendEvent = 7;
const SchedulerResumeEvent = 8;

/**
 * 记录一个事件到事件日志。
 * 如果事件日志已满，将尝试扩容。如果超过最大大小，则停止记录并清理日志。
 * 
 * @param entries 一个包含事件数据的数组，可以包含PriorityLevel类型。
 */
function logEvent(entries: Array<number | PriorityLevel>) {
  if (eventLog !== null) {
    const offset = eventLogIndex;
    eventLogIndex += entries.length;
    if (eventLogIndex + 1 > eventLogSize) {
      eventLogSize *= 2;
      if (eventLogSize > MAX_EVENT_LOG_SIZE) {
        // Using console['error'] to evade Babel and ESLint
        console['error'](
          "Scheduler Profiling: Event log exceeded maximum size. Don't " +
            'forget to call `stopLoggingProfilingEvents()`.',
        );
        stopLoggingProfilingEvents();
        return;
      }
      const newEventLog = new Int32Array(eventLogSize * 4);
      // $FlowFixMe[incompatible-call] found when upgrading Flow
      newEventLog.set(eventLog);
      eventLogBuffer = newEventLog.buffer;
      eventLog = newEventLog;
    }
    eventLog.set(entries, offset);
  }
}

/**
 * 开始记录调度器事件。
 * 初始化事件日志的大小和缓冲区。
 */
export function startLoggingProfilingEvents(): void {
  eventLogSize = INITIAL_EVENT_LOG_SIZE;
  eventLogBuffer = new ArrayBuffer(eventLogSize * 4);
  eventLog = new Int32Array(eventLogBuffer);
  eventLogIndex = 0;
}

/**
 * 停止记录调度器事件，并返回当前的日志缓冲区。
 * 清空事件日志的状态，以便重新开始记录。
 * 
 * @returns 当前的事件日志缓冲区，或者在日志已清空时返回null。
 */
export function stopLoggingProfilingEvents(): ArrayBuffer | null {
  const buffer = eventLogBuffer;
  eventLogSize = 0;
  eventLogBuffer = null;
  eventLog = null;
  eventLogIndex = 0;
  return buffer;
}

/**
 * 记录一个任务开始的事件。
 * 如果性能分析启用，且事件日志不为空，则记录事件。
 * 
 * @param task 任务对象，包含任务的ID和优先级。
 * @param ms 事件发生的时间，单位为毫秒。
 */
export function markTaskStart(
  task: {
    id: number,
    priorityLevel: PriorityLevel,
    ...
  },
  ms: number,
) {
  if (enableProfiling) {
    if (eventLog !== null) {
      // performance.now returns a float, representing milliseconds. When the
      // event is logged, it's coerced to an int. Convert to microseconds to
      // maintain extra degrees of precision.
      logEvent([TaskStartEvent, ms * 1000, task.id, task.priorityLevel]);
    }
  }
}

/**
 * 记录一个任务完成的事件。
 * 如果性能分析启用，且事件日志不为空，则记录事件。
 * 
 * @param task 任务对象，包含任务的ID和优先级。
 * @param ms 事件发生的时间，单位为毫秒。
 */
export function markTaskCompleted(
  task: {
    id: number,
    priorityLevel: PriorityLevel,
    ...
  },
  ms: number,
) {
  if (enableProfiling) {
    if (eventLog !== null) {
      logEvent([TaskCompleteEvent, ms * 1000, task.id]);
    }
  }
}

/**
 * 记录一个任务取消的事件。
 * 如果性能分析启用，且事件日志不为空，则记录事件。
 * 
 * @param task 任务对象，包含任务的ID和优先级。
 * @param ms 事件发生的时间，单位为毫秒。
 */
export function markTaskCanceled(
  task: {
    id: number,
    priorityLevel: PriorityLevel,
    ...
  },
  ms: number,
) {
  if (enableProfiling) {
    if (eventLog !== null) {
      logEvent([TaskCancelEvent, ms * 1000, task.id]);
    }
  }
}

/**
 * 记录一个任务出错的事件。
 * 如果性能分析启用，且事件日志不为空，则记录事件。
 * 
 * @param task 任务对象，包含任务的ID和优先级。
 * @param ms 事件发生的时间，单位为毫秒。
 */
export function markTaskErrored(
  task: {
    id: number,
    priorityLevel: PriorityLevel,
    ...
  },
  ms: number,
) {
  if (enableProfiling) {
    if (eventLog !== null) {
      logEvent([TaskErrorEvent, ms * 1000, task.id]);
    }
  }
}

/**
 * 记录一个任务开始运行的事件。
 * 如果性能分析启用，且事件日志不为空，则记录事件。
 * 运行ID计数器用于标识同一个任务的多次运行。
 * 
 * @param task 任务对象，包含任务的ID和优先级。
 * @param ms 事件发生的时间，单位为毫秒。
 */
export function markTaskRun(
  task: {
    id: number,
    priorityLevel: PriorityLevel,
    ...
  },
  ms: number,
) {
  if (enableProfiling) {
    runIdCounter++;

    if (eventLog !== null) {
      logEvent([TaskRunEvent, ms * 1000, task.id, runIdCounter]);
    }
  }
}

/**
 * 记录一个任务暂停（yield）的事件。
 * 如果性能分析启用，且事件日志不为空，则记录事件。
 * 
 * @param task 任务对象，包含任务的ID。
 * @param ms 事件发生的时间，单位为毫秒。
 */
export function markTaskYield(task: {id: number, ...}, ms: number) {
  if (enableProfiling) {
    if (eventLog !== null) {
      logEvent([TaskYieldEvent, ms * 1000, task.id, runIdCounter]);
    }
  }
}

/**
 * 记录调度器暂停的事件。
 * 如果性能分析启用，且事件日志不为空，则记录事件。
 * 主线程ID计数器用于标识多次暂停事件。
 * 
 * @param ms 事件发生的时间，单位为毫秒。
 */
export function markSchedulerSuspended(ms: number) {
  if (enableProfiling) {
    mainThreadIdCounter++;

    if (eventLog !== null) {
      logEvent([SchedulerSuspendEvent, ms * 1000, mainThreadIdCounter]);
    }
  }
}

/**
 * 记录调度器恢复的事件。
 * 如果性能分析启用，且事件日志不为空，则记录事件。
 * 
 * @param ms 事件发生的时间，单位为毫秒。
 */
export function markSchedulerUnsuspended(ms: number) {
  if (enableProfiling) {
    if (eventLog !== null) {
      logEvent([SchedulerResumeEvent, ms * 1000, mainThreadIdCounter]);
    }
  }
}