# Edge Translate

一个面向 Edge 浏览器的划词翻译插件，支持接入你自己的大模型 API。当前默认适配 DashScope 的 OpenAI 兼容接口，并使用 `qwen-mt-flash` 进行翻译。

## 功能特性

- 支持网页划词翻译
- 支持自定义模型接口 `Base URL`
- 支持自定义 `API Key`
- 支持自定义模型名称
- 支持设置目标语言
- 支持两种结果展示模式
  - 悬浮窗模式
  - 侧边栏模式
- 支持快速设置弹窗
  - 点击浏览器工具栏中的插件图标即可快速修改模型、目标语言、显示模式
- 支持复制翻译结果
- 支持复制原文
- 支持固定翻译窗口
  - 固定后再次划词会直接刷新已有窗口内容

## 效果展示

### 悬浮窗模式

![悬浮窗翻译效果](imgs/Floating%20window.png)

### 侧边栏模式

![侧边栏翻译效果](imgs/sidebar.png)

## 适用接口

当前插件按 OpenAI 兼容的 `chat/completions` 请求方式调用模型，推荐直接使用 DashScope 兼容接口：

- Base URL: `https://dashscope.aliyuncs.com/compatible-mode/v1`
- Model: `qwen-mt-flash`

当前版本仅支持 `qwen-mt` 系列翻译模型：

- `qwen-mt-flash`
- `qwen-mt-lite`
- `qwen-mt-turbo`
- `qwen-mt-plus`

不建议在当前版本中配置普通对话模型或其他非 `qwen-mt` 模型，否则可能无法按预期返回翻译结果。

## 安装方式

### 方式一：本地加载开发版

1. 克隆或下载本项目到本地
2. 打开 Edge 浏览器，进入 `edge://extensions/`
3. 打开右上角“开发人员模式”
4. 点击“加载解压缩的扩展”
5. 选择当前项目目录
6. 插件加载完成后，点击扩展详情页中的“扩展选项”或工具栏图标进行配置

![在 Edge 扩展页中安装插件](imgs/install.png)

### 方式二：从源码目录直接加载

如果你已经拿到本仓库源码，也可以直接加载当前目录：

1. 打开 `edge://extensions/`
2. 开启“开发人员模式”
3. 点击“加载解压缩的扩展”
4. 选择仓库根目录

## 首次配置

加载完成后，请先配置模型参数：

1. 点击浏览器工具栏中的插件图标，打开“快速设置”
2. 或进入完整设置页
3. 填写以下信息：
   - `Base URL`
   - `API Key`
   - `Model`
   - `Target Language`
   - `Display Mode`

![插件设置页示意](imgs/setting.png)

推荐配置如下：

- Base URL: `https://dashscope.aliyuncs.com/compatible-mode/v1`
- Model: `qwen-mt-flash`
- Target Language: `Chinese`

## 使用说明

### 悬浮窗模式

1. 在网页中选中任意文本
2. 鼠标右下方会出现翻译按钮
3. 点击按钮后显示翻译结果
4. 可在窗口中：
   - 复制翻译结果
   - 复制原文
   - 打开设置页
   - 固定窗口

### 侧边栏模式

1. 在设置中将显示模式切换为“侧边窗口模式”
2. 在网页中选中文本后，会直接在页面右侧打开翻译侧栏
3. 默认是抽屉式侧栏，点击侧栏外区域会关闭
4. 点击“固定”后，侧栏会保持常驻，并为页面右侧预留空间
5. 固定状态下再次划词，翻译结果会直接刷新到当前侧栏中

## 工具栏弹窗

点击浏览器工具栏中的插件图标后，可以快速修改：

- 模型名称
- 目标语言
- 显示模式

如果需要修改 `Base URL` 和 `API Key`，请点击弹窗中的“完整设置”进入设置页。

## 项目结构

- `manifest.json`：扩展清单
- `background.js`：后台请求与配置读取
- `content.js`：网页划词交互、悬浮窗和侧边栏逻辑
- `content.css`：页面注入 UI 样式
- `options.html` / `options.js` / `options.css`：完整设置页
- `popup.html` / `popup.js` / `popup.css`：工具栏快速设置弹窗
- `imgs/`：README 展示图片
- `vendor/openai/`：随项目一起分发的 OpenAI SDK

## 本地调试

项目中还提供了一个独立测试脚本：

- `test-qwen-mt-flash.js`

可用于在本地直接测试 DashScope 翻译请求是否正常。

示例：

```powershell
$env:DASHSCOPE_API_KEY="sk-xxx"
node .\test-qwen-mt-flash.js "Hello world" Chinese
```

## 说明

- 当前项目主要面向 Edge 浏览器，也可尝试加载到其他 Chromium 内核浏览器
- 若修改了源码，请在 `edge://extensions/` 中点击刷新扩展后再测试
