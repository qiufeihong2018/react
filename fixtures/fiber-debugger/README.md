# Fiber Debugger

This is a debugger handy for visualizing how [Fiber](https://github.com/facebook/react/issues/6170) works internally.

**It is only meant to be used by React contributors, and not by React users.**

It is likely that it might get broken at some point. If it's broken, ping [Dan](https://twitter.com/dan_abramov).

### Running

First, `npm run build` in React root repo folder.

Then `npm install` and `npm start` in this folder.

Open `http://localhost:3000` in Chrome.

### Features

* Edit code that uses `ReactNoop` renderer
* Visualize how relationships between fibers change over time
* Current tree is displayed in green

![fiber debugger](https://d17oy1vhnax1f7.cloudfront.net/items/3R2W1H2M3a0h3p1l133r/Screen%20Recording%202016-10-21%20at%2020.41.gif?v=e4323e51)


# Fiber Debugger

# 使用说明
这个工具旨在帮助React贡献者可视化Fiber的工作原理。**它不是为React用户准备的。**

由于它主要用于内部调试，所以可能会在某些时候出现故障。如果发现问题，请联系[Dan](https://twitter.com/dan_abramov)。

## 运行
首先，在React的根目录下运行`npm run build`。
然后，在本目录中运行`npm install`和`npm start`。
最后，在Chrome中打开`http://localhost:3000`。

## 功能
* 可以编辑使用`ReactNoop`渲染器的代码。
* 可以可视化纤维之间的关系如何随时间变化。
* 当前的树以绿色显示。

![fiber debugger](https://d17oy1vhnax1f7.cloudfront.net/items/3R2W1H2M3a0h3p1l133r/Screen%20Recording%202016-10-21%20at%2020.41.gif?v=e4323e51)