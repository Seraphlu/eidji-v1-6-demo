# 美术资源接入说明

当前 Demo 的画面是灰盒占位。正式素材到位后，按以下方式接入。

## 推荐规格

- 基准分辨率：1920 × 1080，16:9。
- 第一章背景：PNG，保留远景 / 中景 / 近景分层文件；当前 Demo 可先接合并后的整图。
- 冬季背景：单独准备 `chapter1Winter`，D16 以后自动切换。
- 小游戏俯视背景：1920 × 1080 PNG，深色、低对比度，避免遮挡床位上方的需求图标。
- UI：正式版建议另做九宫格切图；当前 CSS 只负责灰盒可读性。

## 接入方式

在 `js/data.js` 的 `ART_MANIFEST` 中填写路径：

```js
const ART_MANIFEST = {
  chapter1Background: "assets/chapter1-background.png",
  chapter1Winter: "assets/chapter1-winter.png",
  finalSnow: "assets/final-snow.png",
  grasslandBackground: "assets/grassland-background.png",
  yurtNight: "assets/yurt-night.png",
  xiaowei: "assets/xiaowei.png",
  xiaonan: "assets/xiaonan.png",
  stone: "assets/stone.png",
  naren: "assets/naren.png",
  clothTiger: "assets/cloth-tiger.png"
};
```

图片路径相对 `index.html`。浏览器加载失败时会自动回退到灰盒绘制，不会中断玩法。

## 当前已使用键

- `chapter1Background`：D1–D15 的江南跑图卷轴背景，当前已接入 `assets/chapter1-run-background.jpg`。
- `chapter1Winter`：D16 起的冬季背景，当前使用 `assets/chapter1-winter-background.jpg`。
- `clothTiger`：第 2 天“布老虎”事件插图，当前使用 `assets/cloth-tiger-scene.png`。
- `barkScene`：剥树皮互动场景，当前使用 `assets/locust-bark-scene.jpg`。
- `fishingScene`：摸鱼小游戏场景，当前使用 `assets/fishing-scene.jpg`。
- `prayScene`：佛前祈祷凝神场景，当前使用 `assets/prayer-scene.png`。

其余键位已经保留，可在后续迭代中继续接入角色、终局雪景与草原场景。

## 替换原则

1. 先保持灰盒场景可玩，再逐张替换背景，便于快速对比。
2. 正式美术请避免把关键人物放在画面最下方，当前行动卡会占据底部区域。
3. 第一章与第二章需要维持策划案中的双视觉语言：江南低饱和、拥挤、冷；草原高饱和、逆光、开阔。
4. 布老虎是第一章唯一应保留暖红色的物件。
