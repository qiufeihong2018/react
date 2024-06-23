/**
 * 注册和管理事件插件的顺序和映射。
 * 此模块负责确定事件插件的执行顺序，以及将事件名称映射到相应的处理函数。
 * 它提供了注入插件顺序和插件映射的功能，以便在不同环境中灵活配置插件行为。
 */
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {DispatchConfig} from './ReactSyntheticEventType';
import type {
  AnyNativeEvent,
  PluginName,
  LegacyPluginModule,
} from './PluginModuleType';
import type {TopLevelType} from './TopLevelEventTypes';

type NamesToPlugins = {
  [key: PluginName]: LegacyPluginModule<AnyNativeEvent>,
};
type EventPluginOrder = null | Array<PluginName>;

/**
 * Injectable ordering of event plugins.
 */
/**
 * 注册一个事件插件的顺序列表。
 * 这个变量用于存储插件的执行顺序。插件的执行顺序是非常重要的，因为它决定了
 * 事件处理的优先级和流程。
 */
let eventPluginOrder: EventPluginOrder = null;

/**
 * Injectable mapping from names to event plugin modules.
 */
/**
 * 存储插件名称到插件模块的映射。
 * 这个映射用于快速查找和访问特定插件模块，根据插件的名称。
 */
const namesToPlugins: NamesToPlugins = {};

/**
 * Recomputes the plugin list using the injected plugins and plugin ordering.
 *
 * @private
 */
/**
 * 重新计算插件的执行顺序。
 * 当插件顺序被注入或修改时，这个函数被调用以重新计算和确定插件的执行顺序。
 * 它确保了插件顺序的一致性和有效性。
 */
function recomputePluginOrdering(): void {
  if (!eventPluginOrder) {
    // Wait until an `eventPluginOrder` is injected.
    return;
  }
  for (const pluginName in namesToPlugins) {
    const pluginModule = namesToPlugins[pluginName];
    // $FlowFixMe[incompatible-use] found when upgrading Flow
    const pluginIndex = eventPluginOrder.indexOf(pluginName);

    if (pluginIndex <= -1) {
      throw new Error(
        'EventPluginRegistry: Cannot inject event plugins that do not exist in ' +
          `the plugin ordering, \`${pluginName}\`.`,
      );
    }

    if (plugins[pluginIndex]) {
      continue;
    }

    if (!pluginModule.extractEvents) {
      throw new Error(
        'EventPluginRegistry: Event plugins must implement an `extractEvents` ' +
          `method, but \`${pluginName}\` does not.`,
      );
    }

    plugins[pluginIndex] = pluginModule;
    const publishedEvents = pluginModule.eventTypes;
    for (const eventName in publishedEvents) {
      if (
        !publishEventForPlugin(
          publishedEvents[eventName],
          pluginModule,
          eventName,
        )
      ) {
        throw new Error(
          `EventPluginRegistry: Failed to publish event \`${eventName}\` for plugin \`${pluginName}\`.`,
        );
      }
    }
  }
}

/**
 * Publishes an event so that it can be dispatched by the supplied plugin.
 *
 * @param {object} dispatchConfig Dispatch configuration for the event.
 * @param {object} PluginModule Plugin publishing the event.
 * @return {boolean} True if the event was successfully published.
 * @private
 */
/**
 * 为特定事件发布插件。
 * 这个函数负责将特定事件与插件关联起来，使得插件能够处理该事件。
 * 它检查并确保事件和插件的合法性，然后注册事件处理函数。
 * 
 * @param {DispatchConfig} dispatchConfig 事件的分发配置。
 * @param {LegacyPluginModule} pluginModule 发布事件的插件模块。
 * @param {string} eventName 事件名称。
 * @return {boolean} 如果事件发布成功，则返回true；否则返回false。
 */
function publishEventForPlugin(
  dispatchConfig: DispatchConfig,
  pluginModule: LegacyPluginModule<AnyNativeEvent>,
  eventName: string,
): boolean {
  if (eventNameDispatchConfigs.hasOwnProperty(eventName)) {
    throw new Error(
      'EventPluginRegistry: More than one plugin attempted to publish the same ' +
        `event name, \`${eventName}\`.`,
    );
  }

  eventNameDispatchConfigs[eventName] = dispatchConfig;

  const phasedRegistrationNames = dispatchConfig.phasedRegistrationNames;
  if (phasedRegistrationNames) {
    for (const phaseName in phasedRegistrationNames) {
      if (phasedRegistrationNames.hasOwnProperty(phaseName)) {
        const phasedRegistrationName = phasedRegistrationNames[phaseName];
        publishRegistrationName(
          phasedRegistrationName,
          pluginModule,
          eventName,
        );
      }
    }
    return true;
  } else if (dispatchConfig.registrationName) {
    publishRegistrationName(
      dispatchConfig.registrationName,
      pluginModule,
      eventName,
    );
    return true;
  }
  return false;
}

/**
 * Publishes a registration name that is used to identify dispatched events.
 *
 * @param {string} registrationName Registration name to add.
 * @param {object} PluginModule Plugin publishing the event.
 * @private
 */
/**
 * 注册一个用于事件分发的插件。
 * 这个函数用于注册一个插件，并将其与特定的事件相关联。它确保了插件的唯一性，
 * 并且如果插件没有提供必要的方法，则会抛出错误。
 * 
 * @param {string} registrationName 注册名称。
 * @param {object} PluginModule 插件模块。
 * @param {string} eventName 事件名称。
 */
function publishRegistrationName(
  registrationName: string,
  pluginModule: LegacyPluginModule<AnyNativeEvent>,
  eventName: string,
): void {
  if (registrationNameModules[registrationName]) {
    throw new Error(
      'EventPluginRegistry: More than one plugin attempted to publish the same ' +
        `registration name, \`${registrationName}\`.`,
    );
  }

  registrationNameModules[registrationName] = pluginModule;
  registrationNameDependencies[registrationName] =
    pluginModule.eventTypes[eventName].dependencies;

  if (__DEV__) {
    const lowerCasedName = registrationName.toLowerCase();
    possibleRegistrationNames[lowerCasedName] = registrationName;

    if (registrationName === 'onDoubleClick') {
      possibleRegistrationNames.ondblclick = registrationName;
    }
  }
}

/**
 * Registers plugins so that they can extract and dispatch events.
 */

/**
 * Ordered list of injected plugins.
 */
/**
 * 插件注册和管理的主要模块。
 * 这个模块提供了插件注入、事件发布和注册名称管理的功能。
 * 它是事件系统的核心部分，负责维护插件的顺序和行为。
 */
export const plugins: Array<LegacyPluginModule<AnyNativeEvent>> = [];

/**
 * Mapping from event name to dispatch config
 */
/**
 * 存储事件名称到其对应的分发配置的映射。
 * 这个映射用于快速访问特定事件的分发配置，以便进行事件处理。
 */
export const eventNameDispatchConfigs: {
  [eventName: string]: DispatchConfig,
} = {};

/**
 * Mapping from registration name to plugin module
 */
/**
 * 存储注册名称到其对应的插件模块的映射。
 * 这个映射用于快速查找和访问特定注册名称所对应的插件模块。
 */
export const registrationNameModules: {
  [registrationName: string]: LegacyPluginModule<AnyNativeEvent>,
} = {};

/**
 * Mapping from registration name to event name
 */
/**
 * 存储注册名称到其依赖事件的映射。
 * 这个映射用于管理注册名称和它们所依赖的事件之间的关系，以便在处理事件时正确执行插件。
 */
export const registrationNameDependencies: {
  [registrationName: string]: Array<TopLevelType> | void,
} = {};

/**
 * Mapping from lowercase registration names to the properly cased version,
 * used to warn in the case of missing event handlers. Available
 * only in __DEV__.
 * @type {Object}
 */
/**
 * 注入事件插件的执行顺序。
 * 这个函数用于设置事件插件的执行顺序。它确保了顺序只被设置一次，并且
 * 可以处理多次注入尝试的情况，以避免错误。
 * 
 * @param {EventPluginOrder} injectedEventPluginOrder 注入的事件插件顺序。
 */
export const possibleRegistrationNames: {
  [lowerCasedName: string]: string,
} = __DEV__ ? {} : (null: any);
// Trust the developer to only use possibleRegistrationNames in __DEV__

/**
 * Injects an ordering of plugins (by plugin name). This allows the ordering
 * to be decoupled from injection of the actual plugins so that ordering is
 * always deterministic regardless of packaging, on-the-fly injection, etc.
 *
 * @param {array} InjectedEventPluginOrder
 * @internal
 */
/**
 * 根据名称注入事件插件。
 * 这个函数允许根据名称注入事件插件，并更新插件的映射和顺序信息。
 * 它确保了插件名称的唯一性，并且可以处理插件的动态注入。
 * 
 * @param {NamesToPlugins} injectedNamesToPlugins 注入的插件名称到插件模块的映射。
 */
export function injectEventPluginOrder(
  injectedEventPluginOrder: EventPluginOrder,
): void {
  if (eventPluginOrder) {
    throw new Error(
      'EventPluginRegistry: Cannot inject event plugin ordering more than ' +
        'once. You are likely trying to load more than one copy of React.',
    );
  }

  // Clone the ordering so it cannot be dynamically mutated.
  // $FlowFixMe[method-unbinding] found when upgrading Flow
  eventPluginOrder = Array.prototype.slice.call(injectedEventPluginOrder);
  recomputePluginOrdering();
}

/**
 * Injects plugins to be used by plugin event system. The plugin names must be
 * in the ordering injected by `injectEventPluginOrder`.
 *
 * Plugins can be injected as part of page initialization or on-the-fly.
 *
 * @param {object} injectedNamesToPlugins Map from names to plugin modules.
 * @internal
 */
export function injectEventPluginsByName(
  injectedNamesToPlugins: NamesToPlugins,
): void {
  let isOrderingDirty = false;
  for (const pluginName in injectedNamesToPlugins) {
    if (!injectedNamesToPlugins.hasOwnProperty(pluginName)) {
      continue;
    }
    const pluginModule = injectedNamesToPlugins[pluginName];
    if (
      !namesToPlugins.hasOwnProperty(pluginName) ||
      namesToPlugins[pluginName] !== pluginModule
    ) {
      if (namesToPlugins[pluginName]) {
        throw new Error(
          'EventPluginRegistry: Cannot inject two different event plugins ' +
            `using the same name, \`${pluginName}\`.`,
        );
      }

      namesToPlugins[pluginName] = pluginModule;
      isOrderingDirty = true;
    }
  }
  if (isOrderingDirty) {
    recomputePluginOrdering();
  }
}
