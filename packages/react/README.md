# `react`

React is a JavaScript library for creating user interfaces.

The `react` package contains only the functionality necessary to define React components. It is typically used together with a React renderer like `react-dom` for the web, or `react-native` for the native environments.

**Note:** by default, React will be in development mode. The development version includes extra warnings about common mistakes, whereas the production version includes extra performance optimizations and strips all error messages. Don't forget to use the [production build](https://reactjs.org/docs/optimizing-performance.html#use-the-production-build) when deploying your application.

## Usage

```js
import { useState } from 'react';
import { createRoot } from 'react-dom/client';

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <>
      <h1>{count}</h1>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(<Counter />);
```

## Documentation

See https://react.dev/

## API

See https://react.dev/reference/react
# `react`

React 是一个用于构建用户界面的 JavaScript 库。

React 包只包含定义 React 组件所需的功能。它通常与像 `react-dom`（用于 web）或 `react-native`（用于原生环境）这样的 React 渲染器一起使用。

**注意：** 默认情况下，React 处于开发模式。开发版本包含对常见错误的额外警告，而生产版本则包含额外的性能优化，并去除了所有错误消息。在部署应用程序时，不要忘记使用 [生产构建](https://reactjs.org/docs/optimizing-performance.html#use-the-production-build)。

## 使用
```js
import { useState } from 'react';
import { createRoot } from 'react-dom/client';

function Counter() {
  // 使用 useState 钩子管理计数器状态
  const [count, setCount] = useState(0);
  return (
    <>
      <h1>{count}</h1>
      <button onClick={() => setCount(count + 1)}>
        增加
      </button>
    </>
  );
}

// 创建根组件实例，并在 DOM 元素上渲染 Counter 组件
const root = createRoot(document.getElementById('root'));
root.render(<Counter />);