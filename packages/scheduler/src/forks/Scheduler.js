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

function unstable_pauseExecution() {
  isSchedulerPaused = true;
}

function unstable_continueExecution() {
  isSchedulerPaused = false;
  if (!isHostCallbackScheduled && !isPerformingWork) {
    isHostCallbackScheduled = true;
    requestHostCallback();
  }
}

function unstable_getFirstCallbackNode(): Task | null {
  return peek(taskQueue);
}

function unstable_cancelCallback(task: Task) {
  if (enableProfiling) {
    if (task.isQueued) {
      const currentTime = getCurrentTime();
      markTaskCanceled(task, currentTime);
      task.isQueued = false;
    }
  }

  // Null out the callback to indicate the task has been canceled. (Can't
  // remove from the queue because you can't remove arbitrary nodes from an
  // array based heap, only the first one.)
  task.callback = null;
}

function unstable_getCurrentPriorityLevel(): PriorityLevel {
  return currentPriorityLevel;
}

let isMessageLoopRunning = false;
let taskTimeoutID: TimeoutID = (-1: any);

// Scheduler periodically yields in case there is other work on the main
// thread, like user events. By default, it yields multiple times per frame.
// It does not attempt to align with frame boundaries, since most tasks don't
// need to be frame aligned; for those that do, use requestAnimationFrame.
let frameInterval = frameYieldMs;
let startTime = -1;

function shouldYieldToHost(): boolean {
  const timeElapsed = getCurrentTime() - startTime;
  if (timeElapsed < frameInterval) {
    // The main thread has only been blocked for a really short amount of time;
    // smaller than a single frame. Don't yield yet.
    return false;
  }
  // Yield now.
  return true;
}

function requestPaint() {}

function forceFrameRate(fps: number) {
  if (fps < 0 || fps > 125) {
    // Using console['error'] to evade Babel and ESLint
    console['error'](
      'forceFrameRate takes a positive int between 0 and 125, ' +
        'forcing frame rates higher than 125 fps is not supported',
    );
    return;
  }
  if (fps > 0) {
    frameInterval = Math.floor(1000 / fps);
  } else {
    // reset the framerate
    frameInterval = frameYieldMs;
  }
}

const performWorkUntilDeadline = () => {
  if (isMessageLoopRunning) {
    const currentTime = getCurrentTime();
    // Keep track of the start time so we can measure how long the main thread
    // has been blocked.
    startTime = currentTime;

    // If a scheduler task throws, exit the current browser task so the
    // error can be observed.
    //
    // Intentionally not using a try-catch, since that makes some debugging
    // techniques harder. Instead, if `flushWork` errors, then `hasMoreWork` will
    // remain true, and we'll continue the work loop.
    let hasMoreWork = true;
    try {
      hasMoreWork = flushWork(currentTime);
    } finally {
      if (hasMoreWork) {
        // If there's more work, schedule the next message event at the end
        // of the preceding one.
        schedulePerformWorkUntilDeadline();
      } else {
        isMessageLoopRunning = false;
      }
    }
  }
};

let schedulePerformWorkUntilDeadline;
if (typeof localSetImmediate === 'function') {
  // Node.js and old IE.
  // There's a few reasons for why we prefer setImmediate.
  //
  // Unlike MessageChannel, it doesn't prevent a Node.js process from exiting.
  // (Even though this is a DOM fork of the Scheduler, you could get here
  // with a mix of Node.js 15+, which has a MessageChannel, and jsdom.)
  // https://github.com/facebook/react/issues/20756
  //
  // But also, it runs earlier which is the semantic we want.
  // If other browsers ever implement it, it's better to use it.
  // Although both of these would be inferior to native scheduling.
  schedulePerformWorkUntilDeadline = () => {
    localSetImmediate(performWorkUntilDeadline);
  };
} else if (typeof MessageChannel !== 'undefined') {
  // DOM and Worker environments.
  // We prefer MessageChannel because of the 4ms setTimeout clamping.
  const channel = new MessageChannel();
  const port = channel.port2;
  channel.port1.onmessage = performWorkUntilDeadline;
  schedulePerformWorkUntilDeadline = () => {
    port.postMessage(null);
  };
} else {
  // We should only fallback here in non-browser environments.
  schedulePerformWorkUntilDeadline = () => {
    // $FlowFixMe[not-a-function] nullable value
    localSetTimeout(performWorkUntilDeadline, 0);
  };
}

function requestHostCallback() {
  if (!isMessageLoopRunning) {
    isMessageLoopRunning = true;
    schedulePerformWorkUntilDeadline();
  }
}

function requestHostTimeout(
  callback: (currentTime: number) => void,
  ms: number,
) {
  // $FlowFixMe[not-a-function] nullable value
  taskTimeoutID = localSetTimeout(() => {
    callback(getCurrentTime());
  }, ms);
}

function cancelHostTimeout() {
  // $FlowFixMe[not-a-function] nullable value
  localClearTimeout(taskTimeoutID);
  taskTimeoutID = ((-1: any): TimeoutID);
}

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

export const unstable_Profiling: {
  startLoggingProfilingEvents(): void,
  stopLoggingProfilingEvents(): ArrayBuffer | null,
} | null = enableProfiling
  ? {
      startLoggingProfilingEvents,
      stopLoggingProfilingEvents,
    }
  : null;
