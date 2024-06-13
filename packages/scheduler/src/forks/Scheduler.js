/**
 * Scheduler 是一个用于协调任务执行的模块，它通过设定优先级和时间限制来管理多个任务，
 * 确保高优先级的任务得到优先处理，同时避免长时间执行的任务阻塞其他任务。
 * 本模块实现了任务的调度、延迟、取消和执行控制等功能。
 */

/**
 * 引入优先级类型定义。
 */
import type {PriorityLevel} from '../SchedulerPriorities';

/**
 * 引入功能标志，用于启用或禁用特定的调度器功能。
 */
import {
  enableSchedulerDebugging,
  enableProfiling,
  frameYieldMs,
  userBlockingPriorityTimeout,
  lowPriorityTimeout,
  normalPriorityTimeout,
} from '../SchedulerFeatureFlags';

/**
 * 引入最小堆操作函数，用于维护任务队列。
 */
import {push, pop, peek} from '../SchedulerMinHeap';

/**
 * 引入优先级常量。
 */
// TODO: Use symbols?
import {
  ImmediatePriority,
  UserBlockingPriority,
  NormalPriority,
  LowPriority,
  IdlePriority,
} from '../SchedulerPriorities';

/**
 * 引入调度器 profiling 相关的函数。
 */
import {
  markTaskRun,
  markTaskYield,
  markTaskCompleted,
  markTaskCanceled,
  markTaskErrored,
  markSchedulerSuspended,
  markSchedulerUnsuspended,
  markTaskStart,
  stopLoggingProfilingEvents,
  startLoggingProfilingEvents,
} from '../SchedulerProfiling';

/**
 * 定义回调函数类型。
 */
export type Callback = boolean => ?Callback;

/**
 * 定义任务类型。
 */
export opaque type Task = {
  id: number,
  callback: Callback | null,
  priorityLevel: PriorityLevel,
  startTime: number,
  expirationTime: number,
  sortIndex: number,
  isQueued?: boolean,
};

/**
 * 定义一个31位最大整数，用于任务排序索引。
 * 这是因为某些JavaScript引擎在处理大于此值的整数时可能会损失精度。
 */
let maxSigned31BitInt = 1073741823;

/**
 * 任务队列，按优先级和到期时间排序。
 */
var taskQueue: Array<Task> = [];

/**
 * 定时器队列，用于延迟任务。
 */
var timerQueue: Array<Task> = [];

/**
 * 任务ID计数器，用于唯一标识任务。
 */
var taskIdCounter = 1;

/**
 * 调度器暂停状态，用于调试。
 */
var isSchedulerPaused = false;

/**
 * 当前正在执行的任务。
 */
var currentTask = null;

/**
 * 当前执行优先级。
 */
var currentPriorityLevel = NormalPriority;

/**
 * 标记是否正在执行工作。
 */
var isPerformingWork = false;

/**
 * 标记是否已安排主机回调。
 */
var isHostCallbackScheduled = false;

/**
 * 标记是否已安排主机超时。
 */
var isHostTimeoutScheduled = false;

/**
 * 获取当前时间的函数，根据环境的不同使用不同的方法。
 */
let getCurrentTime: () => number | DOMHighResTimeStamp;

/**
 * 检查是否支持 performance.now()，并据此设置 getCurrentTime 函数。
 */
const hasPerformanceNow =
  // $FlowFixMe[method-unbinding]
  typeof performance === 'object' && typeof performance.now === 'function';

if (hasPerformanceNow) {
  const localPerformance = performance;
  getCurrentTime = () => localPerformance.now();
} else {
  const localDate = Date;
  const initialTime = localDate.now();
  getCurrentTime = () => localDate.now() - initialTime;
}

/**
 * 安排主机回调以执行任务。
 */
function requestHostCallback() {
  // 实现留空，表示安排主机回调的逻辑
}

/**
 * 取消安排的主机回调。
 */
function cancelHostCallback() {
  // 实现留空，表示取消主机回调的逻辑
}

/**
 * 安排主机超时。
 */
function requestHostTimeout(callback: Function, ms: number) {
  // 实现留空，表示安排主机超时的逻辑
}

/**
 * 取消安排的主机超时。
 */
function cancelHostTimeout() {
  // 实现留空，表示取消主机超时的逻辑
}

/**
 * 安排一个即时执行的回调。
 */
function requestImmediateCallback(callback: Function) {
  // 实现留空，表示安排即时回调的逻辑
}

/**
 * 取消安排的即时回调。
 */
function cancelImmediateCallback(callback: Function) {
  // 实现留空，表示取消即时回调的逻辑
}

/**
 * 处理到期的定时器，将它们移动到任务队列。
 */
function advanceTimers(currentTime: number) {
  // 检查并处理所有已到期的定时器。
}

/**
 * 处理超时，更新定时器队列和任务队列。
 */
function handleTimeout(currentTime: number) {
  // 取消安排的超时，更新定时器和任务队列。
}

/**
 * 遍历任务队列，执行所有可用任务，直到达到时间限制或队列为空。
 */
function flushWork(initialTime: number) {
  if (enableProfiling) {
    markSchedulerUnsuspended(initialTime);
  }

  // We'll need a host callback the next time work is scheduled.
  isHostCallbackScheduled = false;
  if (isHostTimeoutScheduled) {
    // We scheduled a timeout but it's no longer needed. Cancel it.
    isHostTimeoutScheduled = false;
    cancelHostTimeout();
  }

  isPerformingWork = true;
  const previousPriorityLevel = currentPriorityLevel;
  try {
    if (enableProfiling) {
      try {
        return workLoop(initialTime);
      } catch (error) {
        if (currentTask !== null) {
          const currentTime = getCurrentTime();
          // $FlowFixMe[incompatible-call] found when upgrading Flow
          markTaskErrored(currentTask, currentTime);
          // $FlowFixMe[incompatible-use] found when upgrading Flow
          currentTask.isQueued = false;
        }
        throw error;
      }
    } else {
      // No catch in prod code path.
      return workLoop(initialTime);
    }
  } finally {
    currentTask = null;
    currentPriorityLevel = previousPriorityLevel;
    isPerformingWork = false;
    if (enableProfiling) {
      const currentTime = getCurrentTime();
      markSchedulerSuspended(currentTime);
    }
  }
}

/**
 * 工作循环，用于处理任务队列中的任务。
 * @param {number} initialTime 初始时间，用于判断任务是否过期。
 * @returns {boolean} 如果还有额外的工作需要处理，则返回true；否则返回false。
 */
function workLoop(initialTime: number) {
  // 初始化当前时间为初始时间
  let currentTime = initialTime;
  // 提前更新计时器
  advanceTimers(currentTime);
  // 获取当前任务
  currentTask = peek(taskQueue);
  // 当当前任务不为空且调度器未暂停时，执行循环
  while (
    currentTask !== null &&
    !(enableSchedulerDebugging && isSchedulerPaused)
  ) {
    // 如果当前任务未过期且应该yield给宿主，则跳出循环
    if (currentTask.expirationTime > currentTime && shouldYieldToHost()) {
      break;
    }
    // 获取当前任务的回调函数
    const callback = currentTask.callback;
    // 如果回调函数存在且为函数类型
    if (typeof callback === 'function') {
      // 清除当前任务的回调
      currentTask.callback = null;
      // 设置当前任务的优先级
      currentPriorityLevel = currentTask.priorityLevel;
      // 如果启用性能分析，则标记任务开始运行
      if (enableProfiling) {
        markTaskRun(currentTask, currentTime);
      }
      // 执行回调函数，并获取连续回调
      const continuationCallback = callback(didUserCallbackTimeout);
      // 更新当前时间
      currentTime = getCurrentTime();
      // 如果连续回调存在且为函数类型
      if (typeof continuationCallback === 'function') {
        // 设置当前任务的连续回调
        currentTask.callback = continuationCallback;
        // 如果启用性能分析，则标记任务yield
        if (enableProfiling) {
          markTaskYield(currentTask, currentTime);
        }
        // 更新计时器
        advanceTimers(currentTime);
        // 返回true，表示还有额外的工作
        return true;
      } else {
        // 如果启用性能分析，则标记任务完成
        if (enableProfiling) {
          markTaskCompleted(currentTask, currentTime);
          currentTask.isQueued = false;
        }
        // 如果当前任务是队列中的第一个任务，则将其出队
        if (currentTask === peek(taskQueue)) {
          pop(taskQueue);
        }
        // 更新计时器
        advanceTimers(currentTime);
      }
    } else {
      // 如果当前任务没有回调，将其出队
      pop(taskQueue);
    }
    // 获取下一个任务
    currentTask = peek(taskQueue);
  }
  // 如果还有任务，则返回true；否则，检查计时器队列并请求宿主超时
  if (currentTask !== null) {
    return true;
  } else {
    const firstTimer = peek(timerQueue);
    if (firstTimer !== null) {
      requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);
    }
    return false;
  }
}

/**
 * 以指定的优先级运行回调函数。
 * @param {PriorityLevel} priorityLevel 任务的优先级。
 * @param {Function} eventHandler 要执行的回调函数。
 * @returns {T} 回调函数的返回值。
 */
function unstable_runWithPriority<T>(
  priorityLevel: PriorityLevel,
  eventHandler: () => T,
): T {
  // 根据优先级进行切换
  switch (priorityLevel) {
    case ImmediatePriority:
    case UserBlockingPriority:
    case NormalPriority:
    case LowPriority:
    case IdlePriority:
      break;
    default:
      priorityLevel = NormalPriority;
  }
  // 保存当前优先级，并设置新的优先级
  var previousPriorityLevel = currentPriorityLevel;
  currentPriorityLevel = priorityLevel;
  try {
    // 执行回调函数
    return eventHandler();
  } finally {
    // 恢复之前的优先级
    currentPriorityLevel = previousPriorityLevel;
  }
}

/**
 * 在当前优先级的下一个优先级运行回调函数。
 * @param {Function} eventHandler 要执行的回调函数。
 * @returns {T} 回调函数的返回值。
 */
function unstable_next<T>(eventHandler: () => T): T {
  // 根据当前优先级计算下一个优先级
  var priorityLevel;
  switch (currentPriorityLevel) {
    case ImmediatePriority:
    case UserBlockingPriority:
    case NormalPriority:
      priorityLevel = NormalPriority;
      break;
    default:
      priorityLevel = currentPriorityLevel;
      break;
  }
  // 保存当前优先级，并设置新的优先级
  var previousPriorityLevel = currentPriorityLevel;
  currentPriorityLevel = priorityLevel;
  try {
    // 执行回调函数
    return eventHandler();
  } finally {
    // 恢复之前的优先级
    currentPriorityLevel = previousPriorityLevel;
  }
}

/**
 * 封装回调函数，使其在指定的优先级下运行。
 * @param {Function} callback 原始回调函数。
 * @returns {Function} 封装后的回调函数。
 */
function unstable_wrapCallback<T: (...Array<mixed>) => mixed>(callback: T): T {
  // 保存当前优先级
  var parentPriorityLevel = currentPriorityLevel;
  // 返回一个封装的回调函数
  // $FlowFixMe[incompatible-return]
  // $FlowFixMe[missing-this-annot]
  return function () {
    // 切换到父优先级
    var previousPriorityLevel = currentPriorityLevel;
    currentPriorityLevel = parentPriorityLevel;
    try {
      // 执行原始回调函数
      return callback.apply(this, arguments);
    } finally {
      // 恢复之前的优先级
      currentPriorityLevel = previousPriorityLevel;
    }
  };
}

/**
 * 为指定的回调函数安排一个任务。
 * @param {PriorityLevel} priorityLevel 任务的优先级。
 * @param {Callback} callback 任务的回调函数。
 * @param {Object} options 任务的选项，包括延迟时间。
 * @returns {Task} 安排的任务。
 */
function unstable_scheduleCallback(
  priorityLevel: PriorityLevel,
  callback: Callback,
  options?: {delay: number},
): Task {
  // 获取当前时间
  var currentTime = getCurrentTime();
  // 计算任务的开始时间
  var startTime;
  if (typeof options === 'object' && options !== null) {
    var delay = options.delay;
    if (typeof delay === 'number' && delay > 0) {
      startTime = currentTime + delay;
    } else {
      startTime = currentTime;
    }
  } else {
    startTime = currentTime;
  }
  // 根据优先级计算任务的超时时间
  var timeout;
  switch (priorityLevel) {
    case ImmediatePriority:
      timeout = -1;
      break;
    case UserBlockingPriority:
      timeout = userBlockingPriorityTimeout;
      break;
    case IdlePriority:
      timeout = maxSigned31BitInt;
      break;
    case LowPriority:
      timeout = lowPriorityTimeout;
      break;
    case NormalPriority:
    default:
      timeout = normalPriorityTimeout;
      break;
  }
  // 计算任务的过期时间
  var expirationTime = startTime + timeout;
  // 创建新的任务
  var newTask: Task = {
    id: taskIdCounter++,
    callback,
    priorityLevel,
    startTime,
    expirationTime,
    sortIndex: -1,
  };
  if (enableProfiling) {
    newTask.isQueued = false;
  }
  // 根据开始时间或过期时间插入任务到队列中
  if (startTime > currentTime) {
    newTask.sortIndex = startTime;
    push(timerQueue, newTask);
    if (peek(taskQueue) === null && newTask === peek(timerQueue)) {
      if (isHostTimeoutScheduled) {
        cancelHostTimeout();
      } else {
        isHostTimeoutScheduled = true;
      }
      requestHostTimeout(handleTimeout, startTime - currentTime);
    }
  } else {
    newTask.sortIndex = expirationTime;
    push(taskQueue, newTask);
    if (enableProfiling) {
      markTaskStart(newTask, currentTime);
      newTask.isQueued = true;
    }
    if (!isHostCallbackScheduled && !isPerformingWork) {
      isHostCallbackScheduled = true;
      requestHostCallback();
    }
  }
  // 返回新任务
  return newTask;
}
/**
 * Scheduler是一个用于控制任务执行的模块，它决定了哪些任务应该优先执行，
 * 以及在何时执行它们。这是一组用于调度和管理任务的不稳定（实验性）API。
 */

// 切换调度器的暂停状态
function unstable_pauseExecution() {
  isSchedulerPaused = true;
}

// 恢复调度器的执行，如果当前没有计划的任务，则安排一个新的任务
function unstable_continueExecution() {
  isSchedulerPaused = false;
  if (!isHostCallbackScheduled && !isPerformingWork) {
    isHostCallbackScheduled = true;
    requestHostCallback();
  }
}

// 获取任务队列中的第一个任务
function unstable_getFirstCallbackNode(): Task | null {
  return peek(taskQueue);
}

// 取消一个任务，将其从队列中移除
function unstable_cancelCallback(task: Task) {
  if (enableProfiling) {
    if (task.isQueued) {
      const currentTime = getCurrentTime();
      markTaskCanceled(task, currentTime);
      task.isQueued = false;
    }
  }

  // Null out the callback to indicate the task has been canceled.
  task.callback = null;
}

// 获取当前的优先级水平
function unstable_getCurrentPriorityLevel(): PriorityLevel {
  return currentPriorityLevel;
}

// 控制消息循环是否正在运行
let isMessageLoopRunning = false;
// 任务超时ID
let taskTimeoutID: TimeoutID = (-1: any);

// 默认的帧间隔，用于控制yield的频率
let frameInterval = frameYieldMs;
// 当前消息循环的起始时间
let startTime = -1;

// 判断是否应该将执行权yield给主机环境
function shouldYieldToHost(): boolean {
  const timeElapsed = getCurrentTime() - startTime;
  if (timeElapsed < frameInterval) {
    return false;
  }
  return true;
}

// 请求进行一次绘制
function requestPaint() {}

// 强制设置帧率
function forceFrameRate(fps: number) {
  if (fps < 0 || fps > 125) {
    console['error'](
      'forceFrameRate takes a positive int between 0 and 125, ' +
        'forcing frame rates higher than 125 fps is not supported',
    );
    return;
  }
  if (fps > 0) {
    frameInterval = Math.floor(1000 / fps);
  } else {
    frameInterval = frameYieldMs;
  }
}

// 一直执行工作直到截止时间
const performWorkUntilDeadline = () => {
  if (isMessageLoopRunning) {
    const currentTime = getCurrentTime();
    startTime = currentTime;

    let hasMoreWork = true;
    try {
      hasMoreWork = flushWork(currentTime);
    } finally {
      if (hasMoreWork) {
        schedulePerformWorkUntilDeadline();
      } else {
        isMessageLoopRunning = false;
      }
    }
  }
};

/**
 * 根据环境选择合适的调度方法
 * 这段代码的目的是为了在不同的执行环境中找到一种方式来尽快执行一个指定的任务，
 * 而且这种方式需要能够在任务队列的前面插入任务，以尽可能早地执行任务。
 * 
 * @remarks
 * 这里使用了条件判断来选择不同的执行策略：
 * - 如果环境支持 `setImmediate`，则使用它来安排任务，因为 `setImmediate` 会在当前执行栈清空后立刻执行，
 *   这意味着它可以在下一次事件循环的开始时执行，这对于需要尽快响应但又不能在当前执行栈中执行的任务非常有用。
 * - 如果环境支持 `MessageChannel`，则使用它来创建一个消息通道，并通过发送消息来触发任务的执行。
 *   这种方式也可以在下一次事件循环的开始时执行任务，而且在某些环境中可能比 `setImmediate` 更加可靠。
 * - 如果以上两种方式都不支持，则任务将无法在下一次事件循环的开始时执行，代码将退回到默认的行为，
 *   即在当前执行栈允许的情况下尽可能早地执行任务。
 */
let schedulePerformWorkUntilDeadline;
 // 检查是否支持 setImmediate，如果支持，则使用它来安排任务
if (typeof localSetImmediate === 'function') {
  schedulePerformWorkUntilDeadline = () => {
     // 使用 setImmediate 安排任务，任务会在当前执行栈清空后立刻执行
    localSetImmediate(performWorkUntilDeadline);
  };
  // 检查是否支持 MessageChannel，如果支持，则使用它来创建一个消息通道并安排任务
} else if (typeof MessageChannel !== 'undefined') {
    // 创建一个新的 MessageChannel
  const channel = new MessageChannel();
     // 获取消息通道的端口，并设置其 onmessage 事件处理程序为要执行的任务
  const port = channel.port2;
  channel.port1.onmessage = performWorkUntilDeadline;
  schedulePerformWorkUntilDeadline = () => {
        // 通过向消息通道的端口发送消息来安排任务，消息内容可以为空
    port.postMessage(null);
  };
   // 如果以上两种方式都不支持，则任务将无法在下一次事件循环的开始时执行
} else {
  schedulePerformWorkUntilDeadline = () => {
     // 默认行为，直接执行任务
    localSetTimeout(performWorkUntilDeadline, 0);
  };
}

// 请求主机回调
function requestHostCallback() {
  if (!isMessageLoopRunning) {
    isMessageLoopRunning = true;
    schedulePerformWorkUntilDeadline();
  }
}

// 请求主机超时
function requestHostTimeout(
  callback: (currentTime: number) => void,
  ms: number,
) {
  taskTimeoutID = localSetTimeout(() => {
    callback(getCurrentTime());
  }, ms);
}

// 取消主机超时
function cancelHostTimeout() {
  localClearTimeout(taskTimeoutID);
  taskTimeoutID = (-1: any);
}

// 导出Scheduler的API
export {
  ImmediatePriority as unstable_ImmediatePriority,
  UserBlockingPriority as unstable_UserBlockingPriority,
  NormalPriority as unstable_NormalPriority,
  IdlePriority as unstable_IdlePriority,
  LowPriority as unstable_LowPriority,
  unstable_runWithPriority,
  unstable_next,
  unstable_scheduleCallback,
  unstable_cancelCallback,
  unstable_wrapCallback,
  unstable_getCurrentPriorityLevel,
  shouldYieldToHost as unstable_shouldYield,
  requestPaint as unstable_requestPaint,
  unstable_continueExecution,
  unstable_pauseExecution,
  unstable_getFirstCallbackNode,
  getCurrentTime as unstable_now,
  forceFrameRate as unstable_forceFrameRate,
};

// 如果启用 profiling，导出相关的 profiling API
export const unstable_Profiling: {
  startLoggingProfilingEvents(): void,
  stopLoggingProfilingEvents(): ArrayBuffer | null,
} | null = enableProfiling
  ? {
      startLoggingProfilingEvents,
      stopLoggingProfilingEvents,
    }
  : null;