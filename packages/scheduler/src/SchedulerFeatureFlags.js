/**
 * 设置启用调度器调试的标志。
 * 调用者可以根据这个标志来决定是否开启调度器的调试功能。
 * @type {boolean}
 */
export const enableSchedulerDebugging = false;

/**
 * 设置启用性能分析的标志。
 * 当这个标志为真时，将启用额外的性能分析逻辑。
 * @type {boolean}
 */
export const enableProfiling = false;

/**
 * 定义每一帧的yield时间（以毫秒为单位）。
 * 这个值决定了在执行一帧的JavaScript代码之前，应该让出多少时间给其他任务。
 * @type {number}
 */
export const frameYieldMs = 5;

/**
 * 定义用户阻塞优先级任务的超时时间（以毫秒为单位）。
 * 超时后，这些任务将降级为正常优先级。
 * @type {number}
 */
export const userBlockingPriorityTimeout = 250;

/**
 * 定义正常优先级任务的超时时间（以毫秒为单位）。
 * 超时后，这些任务将降级为低优先级。
 * @type {number}
 */
export const normalPriorityTimeout = 5000;

/**
 * 定义低优先级任务的超时时间（以毫秒为单位）。
 * 这个超时时间用于控制低优先级任务的最长等待时间。
 * @type {number}
 */
export const lowPriorityTimeout = 10000;