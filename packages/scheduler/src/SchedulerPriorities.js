/**
 * 定义了任务的优先级级别。
 * 
 * 这些常量用于标识不同类型的任务的优先级。优先级越低，任务越不紧急，
 * 会在其他更高优先级的任务之后执行。优先级的设置有助于调度系统合理安排任务执行的顺序，
 * 以确保高优先级的任务能够得到及时处理。
 * 
 * @enum {number}
 */
export type PriorityLevel = 0 | 1 | 2 | 3 | 4 | 5;

// 无优先级，用于表示一个没有特定优先级的任务。
// TODO: Use symbols?
export const NoPriority = 0;
// 立即执行的优先级，用于非常紧急的任务。
export const ImmediatePriority = 1;
// 用户阻塞优先级，用于需要立即响应用户操作的任务。
export const UserBlockingPriority = 2;
// 正常优先级，用于大多数常规任务。
export const NormalPriority = 3;
// 低优先级，用于可以稍后执行而不影响用户体验的任务。
export const LowPriority = 4;
// 闲置优先级，用于在系统处于闲置状态时执行的任务。
export const IdlePriority = 5;