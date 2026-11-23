(function () {
  "use strict";

  const DATA = window.EIDJI_DATA;
  const SAVE_KEY = "eidji_demo_save_v1";
  const SETTINGS_KEY = "eidji_demo_settings_v1";
  const ACHIEVEMENT_KEY = "eidji_demo_achievements_v1";
  const DEBUG_FAST = new URLSearchParams(location.search).get("fast") === "1";
  const SKILL_XP_PER_LEVEL = 100;
  const ACTIONS_PER_DAY = 2;
  const EXPLORE_DAY_SECONDS = 60;
  const EXPLORE_WORLD_WIDTH = 3900;
  const EXPLORE_START_X = 900;
  const PANORAMA_HALL_WORLD_X = 2060;
  const PANORAMA_HALL_IMAGE_RATIO = 2250 / 4382;
  const EXPLORE_LOCATION_LAYOUT = {
    canteen: { x: 260, bottom: 27 },
    hall: { x: 2060, bottom: 35 },
    dorm: { x: 1120, bottom: 27 },
    field: { x: 1520, bottom: 22 },
    river: { x: 1800, bottom: 19 },
    iceRiver: { x: 1860, bottom: 19 },
    elm: { x: 2300, bottom: 30 },
    supply: { x: 2570, bottom: 25 },
    town: { x: 2760, bottom: 26 },
    market: { x: 3050, bottom: 25 },
    hill: { x: 3370, bottom: 31 },
    grassStack: { x: 3620, bottom: 20 }
  };
  const ACHIEVEMENT_NAMES = {
    honest: "诚实的答卷",
    "next-light": "第 n 束光",
    "half-bowl": "半碗粥",
    "white-plain": "白原尽头",
    "all-faces": "全家福",
    "witness": "见证者",
    "smoke-and-song": "人间烟火"
  };

  const dom = {};
  let state = null;
  let settings = loadSettings();
  let currentScreen = "title";
  let modalCleanup = null;
  let modalDismissible = false;
  let toastTimer = null;
  let sceneWhisperTimer = null;
  let chapterRaf = null;
  let chapterStartedAt = 0;
  let interludeTimers = [];
  let endingIndex = 0;
  let paused = false;
  let artImages = {};
  let savedAchievements = loadAchievements();
  let eidji = createEidjiRuntime();
  let dreamReturnCallback = null;
  let dreamIsFinal = false;
  let dreamTransitioning = false;
  let audioContext = null;
  let explore = {
    active: false,
    x: EXPLORE_START_X,
    targetX: null,
    pendingActionId: null,
    keys: { left: false, right: false, sprint: false },
    hotspots: [],
    pickups: [],
    timeLeft: EXPLORE_DAY_SECONDS,
    warned: false,
    forcedDusk: false,
    cameraX: 0,
    viewWidth: 0,
    raf: null,
    lastTimestamp: 0
  };

  function $(selector) {
    return document.querySelector(selector);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function ensureAudio() {
    if (!settings.sound) return null;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    if (!audioContext) audioContext = new AudioCtor();
    if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
    return audioContext;
  }

  function playTone(frequency, duration, type, volume, delay) {
    const context = ensureAudio();
    if (!context) return;
    const when = context.currentTime + (delay || 0);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type || "sine";
    oscillator.frequency.setValueAtTime(frequency, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume || 0.035), when + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(when);
    oscillator.stop(when + duration + 0.03);
  }

  function playFeedback(kind) {
    if (!settings.sound) return;
    if (kind === "pickup") {
      playTone(660, 0.09, "sine", 0.025);
      playTone(990, 0.12, "sine", 0.018, 0.065);
    } else if (kind === "success") {
      playTone(392, 0.1, "triangle", 0.025);
      playTone(587, 0.18, "triangle", 0.02, 0.08);
    } else if (kind === "fail") {
      playTone(180, 0.18, "sawtooth", 0.018);
      playTone(132, 0.24, "sine", 0.02, 0.08);
    } else if (kind === "warn") {
      playTone(240, 0.08, "square", 0.014);
      playTone(210, 0.1, "square", 0.012, 0.12);
    } else {
      playTone(320, 0.055, "triangle", 0.012);
    }
  }
  function shuffle(array) {
    const copy = array.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return copy;
  }

  function getBondLevel(points) {
    const value = clamp(Number(points) || 0, 0, 5);
    return DATA.BOND_LEVELS.reduce((found, level) => (value >= level.min ? level : found), DATA.BOND_LEVELS[0]);
  }

  function adjustBond(id, delta) {
    if (!state || !(id in state.bonds)) return;
    state.bonds[id] = clamp(state.bonds[id] + delta, 0, 5);
  }

  function adjustCommunity(delta) {
    if (!state) return;
    Object.keys(delta || {}).forEach((key) => {
      if (!(key in state.community)) return;
      state.community[key] = clamp(state.community[key] + delta[key], 0, 100);
    });
  }

  function getSkillLevel(xp) {
    return Math.min(3, 1 + Math.floor((Number(xp) || 0) / SKILL_XP_PER_LEVEL));
  }

  function addSkillXp(skill, amount) {
    if (!state || !(skill in state.skills) || !amount) return;
    const before = getSkillLevel(state.skills[skill]);
    state.skills[skill] = clamp(state.skills[skill] + amount, 0, 300);
    const after = getSkillLevel(state.skills[skill]);
    if (after > before) {
      const definition = DATA.SKILL_DEFINITIONS[skill];
      showToast(definition.label + "升到 " + after + " 级。");
      pushLog("石头的生存手札又厚了一页：" + definition.label + "更熟练了。");
    }
  }

  function getCommunityWord(value, kind) {
    if (kind === "smoke") {
      if (value >= 70) return "正旺";
      if (value <= 30) return "将熄";
      return "微温";
    }
    if (value >= 70) return "热闹";
    if (value <= 30) return "沉默";
    return "有声";
  }

  function getStatuses() {
    if (!state) return [];
    const statuses = [];
    if (state.stats.satiety <= 25) statuses.push({ label: "饿得发慌", tone: "danger" });
    if (state.stats.warmth <= 30) statuses.push({ label: "手脚冻僵", tone: "cold" });
    if (state.stats.health <= 30) statuses.push({ label: "病弱", tone: "danger" });
    if (state.stats.spirit <= 20) statuses.push({ label: "精神恍惚", tone: "cold" });
    if (state.flags.wet) statuses.push({ label: "湿透", tone: "cold" });
    if (state.flags.bloated) statuses.push({ label: "腹胀", tone: "danger" });
    if (state.community.smoke <= 30) statuses.push({ label: "灶火将熄", tone: "danger" });
    if (state.community.popularity <= 30) statuses.push({ label: "人心沉默", tone: "cold" });
    return statuses.length ? statuses.slice(0, 5) : [{ label: "还撑得住", tone: "safe" }];
  }

  function getDailyRumor() {
    if (!state || !DATA.DAILY_RUMORS.length) return "";
    const index = (state.day - 1 + Math.floor(state.kindness / 3) + DATA.DAILY_RUMORS.length) % DATA.DAILY_RUMORS.length;
    return "今日风声：" + DATA.DAILY_RUMORS[index];
  }

  function getLocation(id) {
    return DATA.MAP_LOCATIONS.find((location) => location.id === id) || null;
  }

  function isLocationUnlocked(location) {
    if (!state || !location) return false;
    if (location.unlockDay && state.day < location.unlockDay) return false;
    if (location.unlockBond) {
      const points = state.bonds[location.unlockBond.id] || 0;
      if (points < location.unlockBond.level) return false;
    }
    return true;
  }

  function safeStorageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function safeStorageSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  function safeStorageRemove(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      // File-origin storage can be unavailable; the session still works in memory.
    }
  }

  function loadSettings() {
    try {
      const raw = safeStorageGet(SETTINGS_KEY);
      return raw ? Object.assign({ gentle: false, sound: true }, JSON.parse(raw)) : { gentle: false, sound: true };
    } catch (error) {
      return { gentle: false, sound: true };
    }
  }

  function saveSettings() {
    safeStorageSet(SETTINGS_KEY, JSON.stringify(settings));
  }

  function loadAchievements() {
    try {
      const raw = safeStorageGet(ACHIEVEMENT_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (error) {
      return [];
    }
  }

  function saveAchievements() {
    safeStorageSet(ACHIEVEMENT_KEY, JSON.stringify(savedAchievements));
  }

  function createState() {
    return {
      version: 2,
      checkpoint: "prologue",
      prologueIndex: 0,
      prologueAnswers: [],
      day: 1,
      phase: "story",
      actionsToday: 0,
      usedActionsToday: [],
      stats: {
        satiety: 58,
        warmth: 63,
        health: 76,
        spirit: 56
      },
      inventory: {
        porridge: 0,
        greens: 0,
        bark: 0,
        fish: 0,
        sweetPotato: 0,
        wildBun: 0,
        barkPaste: 0,
        fishSoup: 0,
        mixedPorridge: 0
      },
      skills: { gather: 0, fish: 0, identify: 0, weave: 0 },
      community: { smoke: 54, popularity: 52 },
      bonds: { huiming: 0, shitou: 1, xiaonan: 0, chen: 0, citou: 0 },
      locationsSeen: ["canteen", "hall", "dorm", "field", "river", "elm", "town", "market", "hill", "grassStack"],
      dreams: 0,
      kindness: 0,
      bond: 0,
      sickDays: 0,
      stoneDead: false,
      flags: {},
      log: [],
      archiveUnlocked: [],
      achievements: [],
      startedAt: Date.now(),
      savedAt: Date.now()
    };
  }

  function archiveUnlocked(id) {
    return Boolean(state && state.archiveUnlocked.includes(id));
  }

  function unlockArchive(id) {
    if (!state) return;
    if (!state.archiveUnlocked.includes(id)) {
      state.archiveUnlocked.push(id);
      const entry = DATA.ARCHIVE_ENTRIES.find((item) => item.id === id);
      if (entry) showToast("档案解锁：" + entry.title);
    }
  }

  function unlockArchiveForDay(day) {
    DATA.ARCHIVE_ENTRIES.forEach((entry) => {
      if (day >= entry.unlockDay) unlockArchive(entry.id);
    });
  }

  function addAchievement(id) {
    if (!state) return;
    if (!state.achievements.includes(id)) state.achievements.push(id);
    if (!savedAchievements.includes(id)) {
      savedAchievements.push(id);
      saveAchievements();
    }
  }

  function getStatName(key) {
    return {
      satiety: "饱食",
      warmth: "体温",
      health: "健康",
      spirit: "心力"
    }[key];
  }

  function applyStats(delta) {
    if (!state) return;
    Object.keys(delta || {}).forEach((key) => {
      if (!(key in state.stats)) return;
      state.stats[key] = clamp(state.stats[key] + delta[key], 0, 100);
    });
  }

  function inventoryCount() {
    if (!state) return 0;
    return Object.values(state.inventory).reduce((total, count) => total + count, 0);
  }

  function addFood(type, amount) {
    if (!state || !DATA.FOODS[type]) return;
    state.inventory[type] = Math.max(0, (state.inventory[type] || 0) + amount);
  }

  function consumeFood(type, amount) {
    if (!state || !DATA.FOODS[type]) return false;
    if ((state.inventory[type] || 0) < amount) return false;
    state.inventory[type] -= amount;
    return true;
  }

  function eatFood(type) {
    if (!consumeFood(type, 1)) return false;
    const food = DATA.FOODS[type];
    applyStats({
      satiety: food.satiety,
      warmth: food.warmth,
      health: food.health,
      spirit: food.spirit
    });
    pushLog("你吃下了" + food.label + "。");
    return true;
  }

  function pushLog(text) {
    if (!state) return;
    state.log.push({ day: state.day, text });
    if (state.log.length > 80) state.log.shift();
  }

  function saveGame() {
    if (!state) return;
    state.savedAt = Date.now();
    safeStorageSet(SAVE_KEY, JSON.stringify(state));
    updateTitleMeta();
  }

  function loadGame() {
    try {
      const raw = safeStorageGet(SAVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || (parsed.version !== 1 && parsed.version !== 2)) return null;
      const fresh = createState();
      return Object.assign(fresh, parsed, {
        version: 2,
        stats: Object.assign(fresh.stats, parsed.stats || {}),
        inventory: Object.assign(fresh.inventory, parsed.inventory || {}),
        skills: Object.assign(fresh.skills, parsed.skills || {}),
        community: Object.assign(fresh.community, parsed.community || {}),
        bonds: Object.assign(fresh.bonds, parsed.bonds || {}),
        locationsSeen: Array.from(new Set(fresh.locationsSeen.concat(parsed.locationsSeen || []))),
        flags: Object.assign({}, parsed.flags || {}),
        usedActionsToday: Array.isArray(parsed.usedActionsToday) ? parsed.usedActionsToday : [],
        actionsToday: Number(parsed.actionsToday) || 0,
        achievements: Array.isArray(parsed.achievements) ? parsed.achievements : []
      });
    } catch (error) {
      return null;
    }
  }

  function hasSave() {
    return Boolean(safeStorageGet(SAVE_KEY));
  }

  function formatSaveMeta() {
    const saved = loadGame();
    if (!saved) return "尚无存档";
    const checkpoint = saved.checkpoint === "chapter"
      ? "第 " + saved.day + " 天"
      : saved.checkpoint === "dream"
        ? "白原"
        : saved.checkpoint === "eidji"
          ? "额吉体验"
          : saved.checkpoint === "ending"
            ? "终章"
            : "序章问卷";
    const date = new Date(saved.savedAt || Date.now());
    return "存档：" + checkpoint + " · " + date.toLocaleString("zh-CN", { hour12: false });
  }

  function updateTitleMeta() {
    if (!dom.saveMeta) return;
    dom.saveMeta.textContent = formatSaveMeta();
    if (dom.btnContinue) dom.btnContinue.disabled = !hasSave();
  }

  function showToast(message) {
    if (!dom.toast) return;
    dom.toast.textContent = message;
    dom.toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => dom.toast.classList.remove("is-visible"), 2600);
  }

  function showSceneWhisper(text, duration) {
    if (!dom.sceneWhisper || !text) return;
    dom.sceneWhisper.textContent = text;
    dom.sceneWhisper.classList.add("is-visible");
    clearTimeout(sceneWhisperTimer);
    sceneWhisperTimer = setTimeout(() => dom.sceneWhisper.classList.remove("is-visible"), duration || 4800);
  }

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach((screen) => {
      screen.classList.toggle("is-active", screen.id === id);
    });
    currentScreen = id;
    if (id !== "chapter-screen" && chapterRaf) {
      cancelAnimationFrame(chapterRaf);
      chapterRaf = null;
    }
    if (id !== "eidji-screen" && eidji.active) {
      stopNightLoop();
    }
  }

  function fadeTo(callback, hold) {
    const duration = typeof hold === "number" ? hold : 520;
    if (!dom.fadeOverlay) {
      callback();
      return;
    }
    dom.fadeOverlay.classList.add("is-active");
    setTimeout(() => {
      callback();
      setTimeout(() => dom.fadeOverlay.classList.remove("is-active"), 90);
    }, duration);
  }

  function closeModal() {
    if (typeof modalCleanup === "function") {
      modalCleanup();
      modalCleanup = null;
    }
    if (!dom.modalLayer) return;
    dom.modalLayer.classList.add("is-hidden");
    dom.modalLayer.setAttribute("aria-hidden", "true");
    if (dom.modalBody) dom.modalBody.innerHTML = "";
    if (dom.modalActions) dom.modalActions.innerHTML = "";
    modalDismissible = false;
  }

  function openModal(options) {
    const config = Object.assign({
      eyebrow: "",
      title: "",
      body: "",
      actions: [],
      dismissible: false
    }, options || {});

    closeModal();
    modalDismissible = Boolean(config.dismissible);
    dom.modalEyebrow.textContent = config.eyebrow || "";
    dom.modalTitle.textContent = config.title || "";
    dom.modalBody.innerHTML = "";

    if (typeof config.body === "string") {
      dom.modalBody.textContent = config.body;
    } else if (config.body instanceof Node) {
      dom.modalBody.appendChild(config.body);
    }

    dom.modalActions.innerHTML = "";
    const actions = config.actions || [];
    let inlineRow = null;
    actions.forEach((action) => {
      if (action.inline) {
        if (!inlineRow) {
          inlineRow = document.createElement("div");
          inlineRow.className = "modal-actions-row";
          dom.modalActions.appendChild(inlineRow);
        }
      } else {
        inlineRow = null;
      }

      const wrapper = action.inline ? inlineRow : document.createElement("div");
      if (!action.inline) {
        wrapper.className = "modal-actions";
        dom.modalActions.appendChild(wrapper);
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "menu-button" + (action.primary ? " menu-button-primary" : "");
      button.textContent = action.label;
      if (action.disabled) button.disabled = true;
      if (typeof action.onClick === "function") {
        button.addEventListener("click", action.onClick);
      }
      wrapper.appendChild(button);
    });

    if (typeof config.onMount === "function") config.onMount(dom.modalBody, dom.modalActions);
    if (typeof config.cleanup === "function") modalCleanup = config.cleanup;

    dom.modalLayer.classList.remove("is-hidden");
    dom.modalLayer.setAttribute("aria-hidden", "false");
  }

  function openSettings() {
    const body = document.createElement("div");
    const gentleButton = document.createElement("button");
    gentleButton.type = "button";
    gentleButton.className = "menu-button";
    gentleButton.textContent = "温柔模式：" + (settings.gentle ? "开" : "关");
    gentleButton.addEventListener("click", () => {
      settings.gentle = !settings.gentle;
      saveSettings();
      gentleButton.textContent = "温柔模式：" + (settings.gentle ? "开" : "关");
      showToast(settings.gentle ? "已开启温柔模式：属性消耗 -30%" : "已关闭温柔模式");
    });

    const soundButton = document.createElement("button");
    soundButton.type = "button";
    soundButton.className = "menu-button";
    soundButton.textContent = "操作音效：" + (settings.sound ? "开" : "关");
    soundButton.addEventListener("click", () => {
      settings.sound = !settings.sound;
      saveSettings();
      soundButton.textContent = "操作音效：" + (settings.sound ? "开" : "关");
      if (settings.sound) playFeedback("success");
    });
    body.appendChild(soundButton);
    const note = document.createElement("p");
    note.style.margin = "0 0 1rem";
    note.style.color = "var(--ink-faint)";
    note.style.fontSize = "0.78rem";
    note.style.lineHeight = "1.7";
    note.textContent = "温柔模式只降低第一章的属性消耗，不改变剧情与抉择。";

    body.appendChild(gentleButton);
    body.appendChild(note);

    openModal({
      eyebrow: "设置",
      title: "让风雪轻一点",
      body,
      dismissible: true,
      actions: [{ label: "关闭", primary: true, onClick: closeModal }]
    });
  }

  function openArchive() {
    const unlocked = state ? state.archiveUnlocked : [];
    const body = document.createElement("div");
    body.style.display = "grid";
    body.style.gap = "0.75rem";

    DATA.ARCHIVE_ENTRIES.forEach((entry) => {
      const card = document.createElement("article");
      card.style.padding = "1rem";
      card.style.border = "1px solid rgba(231,223,207,0.16)";
      card.style.background = unlocked.includes(entry.id)
        ? "rgba(183,106,74,0.06)"
        : "rgba(231,223,207,0.025)";

      const title = document.createElement("h3");
      title.style.margin = "0 0 0.55rem";
      title.style.fontFamily = "var(--serif)";
      title.style.fontSize = "1.06rem";
      title.style.fontWeight = "500";
      title.textContent = unlocked.includes(entry.id) ? entry.title : "尚未解锁";

      const copy = document.createElement("p");
      copy.style.margin = "0";
      copy.style.color = "var(--ink-dim)";
      copy.style.fontSize = "0.8rem";
      copy.style.lineHeight = "1.75";
      copy.textContent = unlocked.includes(entry.id)
        ? entry.summary + "\n\n" + entry.body + "\n\n来源：" + entry.source
        : "继续游玩第一章以解锁这条历史档案。";

      card.appendChild(title);
      card.appendChild(copy);
      if (unlocked.includes(entry.id) && entry.url) {
        const link = document.createElement("a");
        link.className = "archive-link";
        link.href = entry.url;
        link.target = "_blank";
        link.rel = "noreferrer";
        link.textContent = "查看公开报道";
        card.appendChild(link);
      }
      body.appendChild(card);
    });

    const achievementTitle = document.createElement("h3");
    achievementTitle.className = "journal-section-title";
    achievementTitle.textContent = "隐藏成就";
    body.appendChild(achievementTitle);
    const achievementList = document.createElement("div");
    achievementList.className = "achievement-list";
    const unlockedAchievements = Array.from(new Set((state ? state.achievements : []).concat(savedAchievements)));
    if (!unlockedAchievements.length) {
      const empty = document.createElement("p");
      empty.textContent = "还没有解锁隐藏成就。";
      achievementList.appendChild(empty);
    } else {
      unlockedAchievements.forEach((id) => {
        const item = document.createElement("span");
        item.textContent = ACHIEVEMENT_NAMES[id] || id;
        achievementList.appendChild(item);
      });
    }
    body.appendChild(achievementList);

    openModal({
      eyebrow: "档案室",
      title: "数字展陈占位",
      body,
      dismissible: true,
      actions: [{ label: "关闭", primary: true, onClick: closeModal }]
    });
  }

  function openControlsHelp() {
    openModal({
      eyebrow: "操作说明 · v1.5",
      title: "场景化引导，不弹出教程面板",
      body: "移动：A / D 或 ← / →\n交互：E、空格或鼠标左键\n地图：M\n手札：J\n暂停：Esc\n\n第一章：每天有 2 次行动。在慈云庵里走动，靠近亮起的地点后按 E 互动；手机可直接点击地点、用左右按钮移动。路上会散落干柴、炭笔和野菜，走近会自动拾取。帮陈婶需要按住锅底左右擦洗，祈祷需要按住凝神。点“回庵”可提前结束当天。\n\n黄昏时把食物拖给自己、小囡或石头。手札里可以查看技能、灶台配方、五名人物与植物图鉴。\n\n额吉体验：WASD / 方向键移动，也可直接点击亮起的小床。",
      dismissible: true,
      actions: [{ label: "知道了", primary: true, onClick: closeModal }]
    });
  }

  function openMap() {
    if (!state) return;
    const body = document.createElement("div");
    body.className = "map-panel";
    const intro = document.createElement("p");
    intro.className = "panel-intro";
    intro.textContent = "牛皮纸地图 · 今日情报。行动会在黄昏前结算；危险地点往往有更高的产出或更深的记忆。";
    body.appendChild(intro);

    const grid = document.createElement("div");
    grid.className = "map-grid";
    DATA.MAP_LOCATIONS.forEach((location) => {
      const unlocked = isLocationUnlocked(location);
      const card = document.createElement("article");
      card.className = "map-card" + (unlocked ? "" : " is-locked");
      const head = document.createElement("div");
      head.className = "map-card-head";
      head.innerHTML = "<span class=\"map-icon\">" + location.icon + "</span><strong>" + location.name + "</strong><small>危险 " + location.danger + "</small>";
      const copy = document.createElement("p");
      copy.textContent = unlocked ? location.intel : "尚未解锁。继续和庵里的人相处，或等到第一场雪。";
      card.appendChild(head);
      card.appendChild(copy);

      if (unlocked && !state.locationsSeen.includes(location.id)) state.locationsSeen.push(location.id);
      if (unlocked && location.actions.length) {
        const actionRow = document.createElement("div");
        actionRow.className = "map-actions";
        location.actions.forEach((actionId) => {
          const action = DATA.ACTION_LIBRARY[actionId];
          if (!action || !(DATA.DAILY_ACTIONS[state.day] || []).includes(actionId)) return;
          if (state.phase !== "action" || state.actionsToday >= ACTIONS_PER_DAY || state.usedActionsToday.includes(actionId)) return;
          const button = document.createElement("button");
          button.type = "button";
          button.className = "mini-button";
          button.textContent = action.short || action.label;
          button.addEventListener("click", () => {
            closeModal();
            setTimeout(() => runAction(action), 80);
          });
          actionRow.appendChild(button);
        });
        if (actionRow.childNodes.length) card.appendChild(actionRow);
      }
      if (unlocked) {
        const seen = document.createElement("span");
        seen.className = "map-seen";
        seen.textContent = state.locationsSeen.includes(location.id) ? "已踏足" : "未踏足";
        card.appendChild(seen);
      }
      grid.appendChild(card);
    });
    body.appendChild(grid);

    openModal({
      eyebrow: "地图 · M",
      title: "慈云庵与高邮镇",
      body,
      dismissible: true,
      actions: [{ label: "收好地图", primary: true, onClick: closeModal }]
    });
  }

  function recipeCanCraft(recipe) {
    if (!state) return false;
    return Object.keys(recipe.materials || {}).every((type) => (state.inventory[type] || 0) >= recipe.materials[type]);
  }

  function craftRecipe(recipe) {
    if (!state || !recipeCanCraft(recipe)) {
      showToast("材料还不够。");
      return;
    }
    Object.keys(recipe.materials).forEach((type) => consumeFood(type, recipe.materials[type]));
    addFood(recipe.result, 1);
    addSkillXp("weave", 5);
    pushLog("你在破灶上做了一份" + recipe.name + "。");
    showToast("做好了：" + recipe.name);
    closeModal();
    setTimeout(openJournal, 80);
  }

  function openJournal() {
    if (!state) return;
    const body = document.createElement("div");
    body.className = "journal-book";

    const header = document.createElement("div");
    header.className = "journal-book-header";
    header.innerHTML = "<p>石头的生存手札</p><strong>字迹越来越厚，页角也越来越软。</strong>";
    body.appendChild(header);

    const tabs = [
      { id: "today", label: "今日" },
      { id: "skills", label: "技能" },
      { id: "recipes", label: "灶台" },
      { id: "people", label: "人" },
      { id: "guide", label: "图鉴" }
    ];
    const tabRow = document.createElement("div");
    tabRow.className = "journal-tabs";
    const pane = document.createElement("div");
    pane.className = "journal-tab-pane";

    function renderTab(tabId) {
      Array.from(tabRow.querySelectorAll("button")).forEach((button) => {
        button.classList.toggle("is-active", button.dataset.tab === tabId);
      });
      pane.innerHTML = "";

      if (tabId === "today") {
        const intro = document.createElement("p");
        intro.className = "panel-intro";
        intro.textContent = "今天的天气、状态、物资与人物关系都收在这里，不再常驻占用场景。";
        pane.appendChild(intro);

        const grid = document.createElement("div");
        grid.className = "today-grid";

        const makeCard = (title) => {
          const card = document.createElement("article");
          card.className = "today-card";
          const heading = document.createElement("h3");
          heading.textContent = title;
          card.appendChild(heading);
          grid.appendChild(card);
          return card;
        };

        const event = DATA.DAILY_EVENTS[state.day] || {};
        const weatherCard = makeCard("第 " + state.day + " 天 · " + (event.weather || "天气未定"));
        const forecast = document.createElement("p");
        const nextEvent = DATA.DAILY_EVENTS[Math.min(25, state.day + 1)];
        forecast.textContent = "明日预兆：" + (nextEvent ? nextEvent.weather : "风雪未定");
        weatherCard.appendChild(forecast);
        const statusRow = document.createElement("div");
        statusRow.className = "today-status-row";
        getStatuses().forEach((status) => {
          const chip = document.createElement("span");
          chip.className = "status-chip is-" + status.tone;
          chip.textContent = status.label;
          statusRow.appendChild(chip);
        });
        weatherCard.appendChild(statusRow);

        const communityCard = makeCard("庵里的气息");
        const smokeLine = document.createElement("p");
        smokeLine.textContent = "炊烟：" + getCommunityWord(state.community.smoke, "smoke");
        const peopleLine = document.createElement("p");
        peopleLine.textContent = "人气：" + getCommunityWord(state.community.popularity, "people");
        communityCard.appendChild(smokeLine);
        communityCard.appendChild(peopleLine);

        const inventoryCard = makeCard("手里带着的东西");
        const inventoryEntries = Object.keys(DATA.FOODS).filter((type) => (state.inventory[type] || 0) > 0);
        if (!inventoryEntries.length) {
          const empty = document.createElement("p");
          empty.textContent = "空着。";
          inventoryCard.appendChild(empty);
        } else {
          inventoryEntries.forEach((type) => {
            const line = document.createElement("p");
            line.textContent = DATA.FOODS[type].label + " × " + state.inventory[type];
            inventoryCard.appendChild(line);
          });
        }

        const noteCard = makeCard("风声与手记");
        const rumor = document.createElement("p");
        rumor.className = "today-rumor";
        rumor.textContent = getDailyRumor();
        const note = document.createElement("blockquote");
        note.textContent = event.note || "";
        noteCard.appendChild(rumor);
        noteCard.appendChild(note);

        const bondCard = makeCard("被记住的人");
        DATA.NPC_PROFILES.forEach((profile) => {
          const line = document.createElement("p");
          line.className = "today-bond-row";
          const points = state.bonds[profile.id] || 0;
          line.textContent = profile.name + " · " + getBondLevel(points).name;
          bondCard.appendChild(line);
        });

        const recentCard = makeCard("刚刚发生");
        const recent = state.log.slice(-4).reverse();
        if (!recent.length) {
          const empty = document.createElement("p");
          empty.textContent = "还没有写下什么。";
          recentCard.appendChild(empty);
        } else {
          recent.forEach((entry) => {
            const line = document.createElement("p");
            line.className = "today-event";
            line.textContent = "D" + entry.day + " · " + entry.text;
            recentCard.appendChild(line);
          });
        }

        pane.appendChild(grid);
      } else if (tabId === "skills") {
        const intro = document.createElement("p");
        intro.className = "panel-intro";
        intro.textContent = "行动成功会留下经验。生手 → 熟练 → 行家，每级产量 +25%。";
        pane.appendChild(intro);
        Object.keys(DATA.SKILL_DEFINITIONS).forEach((id) => {
          const definition = DATA.SKILL_DEFINITIONS[id];
          const xp = state.skills[id] || 0;
          const level = getSkillLevel(xp);
          const row = document.createElement("div");
          row.className = "skill-row";
          const head = document.createElement("div");
          head.className = "skill-row-head";
          head.innerHTML = "<span>" + definition.icon + " " + definition.label + "</span><strong>" + ["", "生手", "熟练", "行家"][level] + "</strong>";
          const track = document.createElement("div");
          track.className = "skill-track";
          const fill = document.createElement("span");
          fill.style.width = Math.min(100, (xp % SKILL_XP_PER_LEVEL) || (level >= 3 ? 100 : 0)) + "%";
          track.appendChild(fill);
          const note = document.createElement("small");
          note.textContent = definition.description + " · " + xp + " XP";
          row.appendChild(head);
          row.appendChild(track);
          row.appendChild(note);
          pane.appendChild(row);
        });
      } else if (tabId === "recipes") {
        const intro = document.createElement("p");
        intro.className = "panel-intro";
        intro.textContent = "把采集物在破灶上简单加工。现吃，还是留成明天的储备？";
        pane.appendChild(intro);
        const grid = document.createElement("div");
        grid.className = "recipe-grid";
        DATA.RECIPES.forEach((recipe) => {
          const card = document.createElement("article");
          card.className = "recipe-card";
          const title = document.createElement("h3");
          title.textContent = recipe.name;
          const materials = Object.keys(recipe.materials).map((type) => DATA.FOODS[type].label + " ×" + recipe.materials[type]).join(" + ");
          const detail = document.createElement("p");
          detail.textContent = materials + "\n" + recipe.note;
          const result = DATA.FOODS[recipe.result];
          const effect = document.createElement("small");
          effect.textContent = "饱食 +" + result.satiety + " · 体温 +" + result.warmth + " · 健康 " + result.health + " · 心力 " + result.spirit;
          const button = document.createElement("button");
          button.type = "button";
          button.className = "mini-button";
          button.textContent = recipeCanCraft(recipe) ? "做实一份" : "材料不足";
          button.disabled = !recipeCanCraft(recipe);
          button.addEventListener("click", () => craftRecipe(recipe));
          card.appendChild(title);
          card.appendChild(detail);
          card.appendChild(effect);
          card.appendChild(button);
          grid.appendChild(card);
        });
        pane.appendChild(grid);

        const toolTitle = document.createElement("h3");
        toolTitle.className = "journal-section-title";
        toolTitle.textContent = "工具图纸";
        pane.appendChild(toolTitle);
        const toolGrid = document.createElement("div");
        toolGrid.className = "tool-list";
        DATA.TOOL_RECIPES.forEach((tool) => {
          const row = document.createElement("div");
          row.className = "tool-row";
          row.innerHTML = "<strong>" + tool.name + "</strong><span>" + tool.materials + " · " + tool.unlock + "</span><small>" + tool.effect + "</small>";
          toolGrid.appendChild(row);
        });
        pane.appendChild(toolGrid);
      } else if (tabId === "people") {
        const intro = document.createElement("p");
        intro.className = "panel-intro";
        intro.textContent = "牵绊不显示进度条。你只会从他们后来怎么看你，知道自己被记住了多少。";
        pane.appendChild(intro);
        DATA.NPC_PROFILES.forEach((profile) => {
          const points = state.bonds[profile.id] || 0;
          const level = getBondLevel(points);
          const card = document.createElement("article");
          card.className = "npc-card";
          const head = document.createElement("div");
          head.className = "npc-card-head";
          head.innerHTML = "<span class=\"npc-mark\">" + profile.mark + "</span><div><strong>" + profile.name + "</strong><small>" + profile.role + "</small></div><em>" + level.name + "</em>";
          const truth = document.createElement("p");
          truth.className = "npc-truth";
          truth.textContent = points >= 3 ? profile.truth : "有些事，他还没有说出口。";
          const routine = document.createElement("p");
          routine.textContent = profile.routine;
          card.appendChild(head);
          card.appendChild(truth);
          card.appendChild(routine);
          const memories = profile.memories.filter((memory) => points >= memory.at);
          if (memories.length) {
            const memoryList = document.createElement("div");
            memoryList.className = "npc-memories";
            memories.forEach((memory) => {
              const item = document.createElement("p");
              item.textContent = memory.text;
              memoryList.appendChild(item);
            });
            card.appendChild(memoryList);
          }
          pane.appendChild(card);
        });
      } else {
        const intro = document.createElement("p");
        intro.className = "panel-intro";
        intro.textContent = "石头教过的植物。认不准的，宁可饿着。";
        pane.appendChild(intro);
        const plantList = document.createElement("div");
        plantList.className = "plant-guide";
        DATA.PLANT_QUIZ.forEach((quiz) => {
          const block = document.createElement("article");
          block.className = "plant-guide-card";
          const prompt = document.createElement("h3");
          prompt.textContent = quiz.prompt;
          block.appendChild(prompt);
          quiz.options.forEach((option) => {
            const row = document.createElement("p");
            row.className = option.safe ? "is-safe" : "is-toxic";
            row.textContent = (option.safe ? "可食 · " : "有毒 · ") + option.name + "：" + option.hint;
            block.appendChild(row);
          });
          plantList.appendChild(block);
        });
        pane.appendChild(plantList);
      }
    }

    tabs.forEach((tab) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.tab = tab.id;
      button.textContent = tab.label;
      button.addEventListener("click", () => renderTab(tab.id));
      tabRow.appendChild(button);
    });
    body.appendChild(tabRow);
    body.appendChild(pane);
    renderTab("today");

    openModal({
      eyebrow: "生存手札 · J",
      title: "一页一页，走到北边",
      body,
      dismissible: true,
      actions: [{ label: "合上手札", primary: true, onClick: closeModal }]
    });
  }

  function preloadArt() {
    artImages = {};
    Object.keys(DATA.ART_MANIFEST).forEach((key) => {
      const path = DATA.ART_MANIFEST[key];
      if (!path) return;
      const image = new Image();
      image.onload = () => {
        artImages[key] = image;
      };
      image.onerror = () => {
        console.warn("Art asset failed to load:", key, path);
      };
      image.src = path;
    });
  }

  function drawCover(ctx, image, x, y, w, h) {
    if (!image || !image.complete || !image.naturalWidth) return false;
    const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
    const sw = w / scale;
    const sh = h / scale;
    const sx = (image.naturalWidth - sw) / 2;
    const sy = (image.naturalHeight - sh) / 2;
    ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
    return true;
  }

  function drawChapterPanorama(ctx, image, width, height, cameraX) {
    if (!image || !image.complete || !image.naturalWidth) return false;
    const scale = height / image.naturalHeight;
    const drawWidth = image.naturalWidth * scale;
    const viewWidth = explore.viewWidth || width;
    const maxWorldCamera = Math.max(0, EXPLORE_WORLD_WIDTH - viewWidth);
    const ratio = maxWorldCamera > 0
      ? clamp((cameraX == null ? explore.cameraX : cameraX) / maxWorldCamera, 0, 1)
      : 0.5;
    const maxOffset = Math.max(0, drawWidth - width);
    const hallCamera = maxWorldCamera > 0
      ? clamp(PANORAMA_HALL_WORLD_X - viewWidth / 2, 0, maxWorldCamera)
      : 0;
    const hallRatio = maxWorldCamera > 0 ? hallCamera / maxWorldCamera : 0.5;
    const imageFocusX = image.naturalWidth * PANORAMA_HALL_IMAGE_RATIO;
    const desiredHallOffset = imageFocusX * scale - width / 2;
    const calibration = desiredHallOffset - maxOffset * hallRatio;
    const offset = clamp(maxOffset * ratio + calibration, 0, maxOffset);
    ctx.drawImage(image, -offset, 0, drawWidth, height);
    return true;
  }

  function prepareCanvas(canvas) {
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, width: rect.width, height: rect.height, dpr };
  }
  function startNewGame() {
    state = createState();
    state.checkpoint = "prologue";
    saveGame();
    showScreen("prologue-screen");
    renderPrologue();
  }

  function startQuickPlay() {
    state = createState();
    state.prologueAnswers = makeSamplePrologueAnswers();
    state.prologueIndex = DATA.PROLOGUE_QUESTIONS.length;
    state.checkpoint = "chapter";
    state.day = 1;
    state.phase = "action";
    state.flags["event-seen-1"] = true;
    state.flags.quickPlay = true;
    explore.x = EXPLORE_START_X;
    explore.timeLeft = EXPLORE_DAY_SECONDS;
    explore.warned = false;
    explore.forcedDusk = false;
    explore.pickups = createExplorePickups(1);
    saveGame();
    showScreen("chapter-screen");
    renderChapterUI();
    ensureChapterLoop();
    playFeedback("success");
    showToast("慧明师父把半个窝头塞进你手里。趁天黑前，去两个地方。");
  }
  function continueGame() {
    const loaded = loadGame();
    if (!loaded) {
      showToast("没有找到可继续的存档。");
      updateTitleMeta();
      return;
    }
    state = loaded;
    if (state.checkpoint === "prologue") {
      showScreen("prologue-screen");
      renderPrologue();
      return;
    }
    if (state.checkpoint === "chapter") {
      showScreen("chapter-screen");
      state.phase = "story";
      beginDay();
      return;
    }
    if (state.checkpoint === "interlude") {
      startInterlude();
      return;
    }
    if (state.checkpoint === "dream") {
      // A reload while on the dream screen should resume at the next day,
      // not replay the same dream and make the chapter look stuck.
      if (state.flags.dreamFinal) {
        showFinalDream(showEidji);
      } else {
        state.checkpoint = "chapter";
        state.phase = "story";
        saveGame();
        showScreen("chapter-screen");
        beginDay();
      }
      return;
    }
    if (state.checkpoint === "eidji") {
      showEidji();
      return;
    }
    if (state.checkpoint === "ending") {
      startEnding();
      return;
    }
    showScreen("prologue-screen");
    renderPrologue();
  }

  function renderPrologue() {
    if (!state) return;
    if (state.prologueIndex >= DATA.PROLOGUE_QUESTIONS.length) {
      finishPrologue();
      return;
    }

    const question = DATA.PROLOGUE_QUESTIONS[state.prologueIndex];
    dom.prologueProgressText.textContent = "第 " + (state.prologueIndex + 1) + " / " + DATA.PROLOGUE_QUESTIONS.length + " 题";
    dom.prologueProgressBar.style.width = ((state.prologueIndex / DATA.PROLOGUE_QUESTIONS.length) * 100) + "%";
    dom.prologueQuestion.textContent = question.question;
    dom.prologueOptions.innerHTML = "";

    const order = shuffle(question.options);
    order.forEach((option, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "prologue-option";
      const letter = document.createElement("span");
      letter.className = "option-letter";
      letter.textContent = String.fromCharCode(65 + index) + ".";
      const label = document.createElement("span");
      label.className = "option-label";
      label.textContent = option.text;
      button.appendChild(letter);
      button.appendChild(label);
      button.addEventListener("click", () => {
        if (button.disabled) return;
        Array.from(dom.prologueOptions.querySelectorAll("button")).forEach((item) => {
          item.disabled = true;
        });
        state.prologueAnswers.push({
          questionId: question.id,
          optionId: option.id,
          text: option.text,
          rational: Boolean(option.rational)
        });
        state.prologueIndex += 1;
        saveGame();
        setTimeout(renderPrologue, 360);
      });
      dom.prologueOptions.appendChild(button);
    });
  }

  function finishPrologue() {
    state.checkpoint = "chapter";
    state.day = 1;
    state.phase = "story";
    if (state.prologueAnswers.length === DATA.PROLOGUE_QUESTIONS.length && state.prologueAnswers.every((answer) => answer.rational)) {
      addAchievement("honest");
    }
    saveGame();
    fadeTo(() => {
      showScreen("chapter-screen");
      beginDay();
      showToast("什么也没有发生。");
    }, 650);
  }

  function enterChapter() {
    if (!state) return;
    state.checkpoint = "chapter";
    saveGame();
    showScreen("chapter-screen");
    beginDay();
  }

  function beginDay() {
    if (!state) return;
    if (state.day > 25) {
      startEnding();
      return;
    }

    state.phase = "story";
    state.flags["resolved-day-" + state.day] = false;
    state.actionsToday = 0;
    state.usedActionsToday = [];
    explore.x = EXPLORE_START_X;
    explore.targetX = null;
    explore.pendingActionId = null;
    explore.keys.left = false;
    explore.keys.right = false;
    explore.pickups = createExplorePickups(state.day);
    explore.timeLeft = EXPLORE_DAY_SECONDS;
    explore.warned = false;
    explore.forcedDusk = false;
    unlockArchiveForDay(state.day);
    renderChapterUI();
    ensureChapterLoop();

    const event = DATA.DAILY_EVENTS[state.day];
    if (!event) {
      state.phase = "action";
      showActionPhase();
      return;
    }

    const eventSeen = Boolean(state.flags["event-seen-" + state.day]);
    if (eventSeen && !event.choices && !event.final) {
      state.phase = "action";
      showActionPhase();
      return;
    }

    const alreadyApplied = state.flags["event-applied-" + state.day];
    if (state.day === 18 && !alreadyApplied) {
      state.flags["event-applied-18"] = true;
      state.stoneDead = true;
      applyStats({ spirit: -18 });
      pushLog("石头再也没醒来。");
    }
    if (state.day === 19 && !alreadyApplied) {
      state.flags["event-applied-19"] = true;
      state.stats.health = Math.min(state.stats.health, 32);
      pushLog("你病倒了，一天没能出门。");
    }
    if (state.day === 25 && !state.flags["final-bowl-added"]) {
      state.flags["final-bowl-added"] = true;
      addFood("porridge", 1);
      pushLog("陈婶把最后一点粥底塞进你手里。");
    }
    if (state.day === 14 && !alreadyApplied) {
      state.flags["event-applied-14"] = true;
      pushLog("刺头把半块红薯塞进你怀里。");
    }
    if (state.day === 24 && !alreadyApplied) {
      state.flags["event-applied-24"] = true;
      adjustBond("huiming", 2);
      state.flags.dreamPending = true;
      pushLog("慧明师父把念珠放进你手心。");
    }

    saveGame();
    openDayEvent(event);
  }

  function openDayEvent(event) {
    state.flags["event-seen-" + state.day] = true;
    saveGame();
    if (event.final) {
      openModal({
        eyebrow: "第 25 天 · 黄昏",
        title: event.title,
        body: event.text,
        actions: [{
          label: "走进风雪",
          primary: true,
          onClick: () => {
            closeModal();
            showFinalScene();
          }
        }]
      });
      return;
    }

    if (event.choices) {
      const actions = event.choices.map((choice) => ({
        label: choice.label,
        inline: true,
        onClick: () => resolveMoralChoice(event, choice)
      }));
      openModal({
        eyebrow: "第 " + state.day + " 天 · " + event.weather,
        title: event.title,
        body: event.text + "\n\n" + event.note,
        actions
      });
      return;
    }

    let eventBody = event.text + "\n\n" + event.note;
    if (state.day === 18 && state.bonds.shitou >= 5) {
      eventBody += "\n\n他留给你的手札还压在枕下。最后一页写着：替我看看火车。回来讲给我听。";
    }
    if (state.day === 24 && state.bonds.huiming >= 5) {
      eventBody += "\n\n他把念珠塞进你手里：“替师父……去北边看看。”";
    }
    openModal({
      eyebrow: "第 " + state.day + " 天 · " + event.weather,
      title: event.title,
      body: eventBody,
      actions: [{
        label: "开始行动",
        primary: true,
        onClick: () => {
          closeModal();
          showActionPhase();
        }
      }]
    });
  }

  function resolveMoralChoice(event, choice) {
    if (!state) return;
    const flagKey = "moral-" + state.day;
    if (state.flags[flagKey]) return;
    state.flags[flagKey] = choice.id;

    let consequence = "";
    if (state.day === 5) {
      if (choice.id === "accept") {
        addFood("greens", 1);
        state.kindness -= 1;
        adjustBond("shitou", 1);
        consequence = "你把荠菜放进嘴里，嚼得很慢。石头转过去，肩膀轻轻动了一下。";
      } else if (choice.id === "refuse") {
        state.kindness += 2;
        state.bond += 1;
        adjustBond("shitou", 2);
        adjustCommunity({ popularity: 2 });
        consequence = "石头愣了一下，随即把荠菜重新塞回你手里，说：“那就一人一半。”";
        addFood("greens", 1);
      } else {
        state.kindness += 1;
        state.bond += 1;
        adjustBond("shitou", 2);
        consequence = "你们蹲在墙根，一人一半。谁也没说谢谢。";
        addFood("greens", 1);
      }
    } else if (state.day === 9) {
      if (choice.id === "share") {
        consumeFood("porridge", 1);
        state.kindness += 1;
        state.bond += 2;
        adjustBond("xiaonan", 2);
        adjustCommunity({ popularity: 3 });
        applyStats({ spirit: 5 });
        consequence = "你把碗递到小囡嘴边。她喝得很急，最后却把碗沿轻轻推回给你。";
      } else if (choice.id === "fight") {
        applyStats({ health: -8 });
        state.kindness += 1;
        state.bond += 1;
        adjustBond("xiaonan", 1);
        consequence = "你扑上去抢碗，被推倒在泥里。粥没抢回来，小囡却拉住了你的衣角。";
      } else if (choice.id === "lie") {
        state.kindness += 2;
        state.bond += 2;
        adjustBond("xiaonan", 2);
        adjustCommunity({ popularity: 2 });
        applyStats({ spirit: 6 });
        consequence = "你蹲下来，看着她的眼睛说：“嗯，买糖去了，买大包的。”她第一次正眼看你，眼泪还挂着。";
      } else {
        state.kindness -= 1;
        state.bond -= 1;
        adjustBond("xiaonan", -1);
        applyStats({ spirit: -6 });
        consequence = "你低下头，从旁边走过去。第二天，小囡没有看你。";
      }
    } else if (state.day === 11) {
      if (choice.id === "favor") {
        adjustBond("chen", -1);
        adjustCommunity({ popularity: -3, smoke: 1 });
        consequence = "你给栓子多添了一勺。排队的孩子们都看见了，没有人说话。陈婶醒来后知道了，只把勺子接过去，没有看你。";
      } else if (choice.id === "equal") {
        adjustBond("chen", 2);
        adjustCommunity({ popularity: 4, smoke: 2 });
        consequence = "你一勺一勺分完，每个孩子都一样多。栓子低下头，陈婶在灶台边轻轻说了一句：“手没抖。”";
      } else {
        adjustBond("huiming", 1);
        adjustCommunity({ popularity: 1 });
        consequence = "慧明师父接过勺子。她分得很慢，最后把自己的那一口也倒进了锅里。";
      }
    } else if (state.day === 14) {
      if (choice.id === "eat") {
        state.kindness -= 1;
        adjustBond("citou", -1);
        applyStats({ satiety: 38, warmth: 6, spirit: 4 });
        consequence = "红薯很甜。你吃完才想起，刺头一直看着你。";
      } else if (choice.id === "report") {
        state.kindness -= 1;
        adjustBond("citou", -2);
        adjustCommunity({ popularity: -2 });
        applyStats({ spirit: -5 });
        consequence = "陈婶没有骂人，只把刺头叫走。那一晚，他回来得很晚。";
      } else if (choice.id === "return") {
        state.kindness += 2;
        adjustBond("citou", 1);
        consequence = "刺头盯着你看了很久，最后把红薯掰成两半，塞回你手里一半。";
        addFood("sweetPotato", 1);
      } else if (choice.id === "cover") {
        state.kindness += 1;
        state.bond += 2;
        adjustBond("citou", 2);
        adjustCommunity({ popularity: 2 });
        applyStats({ satiety: 24, warmth: 4, spirit: 4 });
        consequence = "巡逻的脚步越来越近，你蹲在草垛后替他望风。刺头掰红薯时忽然说：“我弟……也爱吃甜的。”然后闭了嘴。";
      } else {
        state.kindness += 2;
        state.bond += 1;
        adjustBond("citou", 2);
        applyStats({ spirit: 5 });
        consequence = "你把红薯放到发烧孩子的枕边。刺头看见了，什么也没说。";
      }
    } else if (state.day === 17) {
      const total = inventoryCount();
      if (state.bonds.chen >= 5) {
        adjustBond("chen", 1);
        adjustCommunity({ popularity: 3 });
        state.kindness += 1;
        consequence = "陈婶看了你一眼，忽然把话头岔开：“这屋我查过了，没有。”她走得很快，没有回头。";
      } else if (choice.id === "all") {
        Object.keys(state.inventory).forEach((type) => { state.inventory[type] = 0; });
        state.kindness += 3;
        adjustCommunity({ smoke: 6, popularity: 7 });
        adjustBond("chen", 1);
        applyStats({ spirit: 3 });
        consequence = total > 0
          ? "你把铺下所有能吃的东西都交了出去。陈婶接过去时，手一直在抖。"
          : "你掀开铺盖，里面什么也没有。陈婶点点头，去了下一间屋。";
      } else if (choice.id === "half") {
        let remaining = Math.ceil(total / 2);
        Object.keys(state.inventory).forEach((type) => {
          const take = Math.min(state.inventory[type], remaining);
          state.inventory[type] -= take;
          remaining -= take;
        });
        state.kindness += 1;
        adjustCommunity({ smoke: 2, popularity: 2 });
        consequence = total > 0
          ? "你交出一半，留下另一半。没有人知道。"
          : "你什么也交不出来，只能把半块榆皮粉饼掰成两半。";
      } else {
        state.kindness -= 1;
        adjustCommunity({ popularity: -3 });
        applyStats({ spirit: -5 });
        consequence = "你没有开门。脚步声从门前经过，又慢慢远去。";
      }
    }

    pushLog(consequence);
    renderChapterUI();
    openModal({
      eyebrow: "第 " + state.day + " 天",
      title: "你的选择",
      body: consequence,
      actions: [{
        label: "开始行动",
        primary: true,
        onClick: () => {
          closeModal();
          showActionPhase();
        }
      }]
    });
  }

  function showActionPhase() {
    if (!state) return;
    state.phase = "action";
    renderChapterUI();
  }

  function renderChapterUI() {
    if (!state) return;
    dom.dayLabel.textContent = "第 " + state.day + " 天";
    const labels = {
      story: "清晨",
      action: "白天 · 行动 " + state.actionsToday + "/" + ACTIONS_PER_DAY,
      dusk: "黄昏 · 分食",
      final: "黄昏 · 风雪"
    };
    dom.phaseLabel.textContent = labels[state.phase] || "清晨";

    const event = DATA.DAILY_EVENTS[state.day];
    const nextEvent = DATA.DAILY_EVENTS[Math.min(25, state.day + 1)];
    dom.weatherChip.textContent = event ? event.weather : "阴";
    dom.dayWeather.textContent = event ? event.weather : "阴";
    if (dom.weatherForecast) {
      dom.weatherForecast.textContent = "明日预兆 · " + (nextEvent ? nextEvent.weather : "风雪未定");
    }
    if (dom.rumorText) dom.rumorText.textContent = getDailyRumor();
    dom.chapterCaption.textContent = getChapterCaption(event);
    dom.journalText.textContent = event ? event.note : "";
    if (state.phase === "action" && !state.flags["whisper-day-" + state.day]) {
      state.flags["whisper-day-" + state.day] = true;
      setTimeout(() => {
        if (state && state.phase === "action") showSceneWhisper(getDailyRumor());
      }, 650);
    } else if (state.phase !== "action" && dom.sceneWhisper) {
      dom.sceneWhisper.classList.remove("is-visible");
    }
    renderStats();
    renderStatusStrip();
    renderCommunity();
    renderBonds();
    renderJournal();
    renderActions();
  }

  function getChapterCaption(event) {
    if (!event) return "";
    if (state.phase === "story") return "";
    if (state.phase === "action") {
      const remaining = Math.max(0, ACTIONS_PER_DAY - state.actionsToday);
      return "在天黑前，再去 " + remaining + " 个地方。\n带回一点能撑过今晚的东西。";
    }
    if (state.phase === "dusk") return "黄昏。\n把今天手里有的东西，亲手分出去。";
    if (state.phase === "final") return "雪落在草垛上。\n她连伸手的力气都没有了。";
    return "";
  }

  function renderStats() {
    const stats = [
      ["satiety", "饱食"],
      ["warmth", "体温"],
      ["health", "健康"],
      ["spirit", "心力"]
    ];
    dom.statsBar.innerHTML = "";
    stats.forEach(([key, label]) => {
      const value = Math.round(state.stats[key]);
      const item = document.createElement("div");
      item.className = "stat" + (value <= 24 ? " is-low" : "");
      const head = document.createElement("div");
      head.className = "stat-head";
      const name = document.createElement("span");
      name.textContent = label;
      const number = document.createElement("strong");
      number.textContent = String(value);
      head.appendChild(name);
      head.appendChild(number);
      const track = document.createElement("div");
      track.className = "stat-track";
      const fill = document.createElement("span");
      fill.className = "stat-fill";
      fill.style.width = value + "%";
      track.appendChild(fill);
      item.appendChild(head);
      item.appendChild(track);
      dom.statsBar.appendChild(item);
    });
  }

  function renderStatusStrip() {
    if (!dom.statusStrip) return;
    dom.statusStrip.innerHTML = "";
    getStatuses().forEach((status) => {
      const chip = document.createElement("span");
      chip.className = "status-chip is-" + status.tone;
      chip.textContent = status.label;
      dom.statusStrip.appendChild(chip);
    });
  }

  function renderMeterDots(element, value) {
    if (!element) return;
    element.innerHTML = "";
    const filled = Math.max(1, Math.ceil(value / 20));
    for (let index = 0; index < 5; index += 1) {
      const dot = document.createElement("span");
      dot.className = index < filled ? "is-filled" : "";
      element.appendChild(dot);
    }
  }

  function renderCommunity() {
    if (!state) return;
    if (dom.smokeLabel) dom.smokeLabel.textContent = getCommunityWord(state.community.smoke, "smoke");
    if (dom.popularityLabel) dom.popularityLabel.textContent = getCommunityWord(state.community.popularity, "people");
    renderMeterDots(dom.smokeDots, state.community.smoke);
    renderMeterDots(dom.popularityDots, state.community.popularity);
  }

  function renderBonds() {
    if (!dom.bondList || !state) return;
    dom.bondList.innerHTML = "";
    DATA.NPC_PROFILES.forEach((profile) => {
      const level = getBondLevel(state.bonds[profile.id]);
      const row = document.createElement("div");
      row.className = "bond-row";
      const mark = document.createElement("span");
      mark.className = "bond-mark";
      mark.textContent = profile.mark;
      const copy = document.createElement("span");
      copy.className = "bond-copy";
      const name = document.createElement("strong");
      name.textContent = profile.name;
      const levelText = document.createElement("small");
      levelText.textContent = level.name;
      copy.appendChild(name);
      copy.appendChild(levelText);
      row.appendChild(mark);
      row.appendChild(copy);
      dom.bondList.appendChild(row);
    });
  }

  function renderJournal() {
    dom.inventoryList.innerHTML = "";
    const entries = Object.keys(DATA.FOODS)
      .map((type) => ({ type, food: DATA.FOODS[type], count: state.inventory[type] || 0 }))
      .filter((entry) => entry.count > 0);

    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "inventory-row";
      empty.innerHTML = "<span>手里</span><strong>空着</strong>";
      dom.inventoryList.appendChild(empty);
    } else {
      entries.forEach((entry) => {
        const row = document.createElement("div");
        row.className = "inventory-row";
        const label = document.createElement("span");
        label.textContent = entry.food.icon + " " + entry.food.label;
        const count = document.createElement("strong");
        count.textContent = "× " + entry.count;
        row.appendChild(label);
        row.appendChild(count);
        dom.inventoryList.appendChild(row);
      });
    }

    dom.journalEvents.innerHTML = "";
    state.log.slice(-5).reverse().forEach((entry) => {
      const item = document.createElement("p");
      item.className = "journal-event";
      item.textContent = "D" + entry.day + " · " + entry.text;
      dom.journalEvents.appendChild(item);
    });
  }

  function stopExplore() {
    explore.active = false;
    explore.targetX = null;
    explore.pendingActionId = null;
    explore.keys.left = false;
    explore.keys.right = false;
    if (explore.raf) cancelAnimationFrame(explore.raf);
    explore.raf = null;
    if (dom.exploreLayer) dom.exploreLayer.classList.add("is-hidden");
    if (dom.exploreControls) dom.exploreControls.classList.add("is-hidden");
        if (dom.exploreClock) dom.exploreClock.classList.add("is-hidden");
    if (dom.exploreMinimap) dom.exploreMinimap.classList.add("is-hidden");
if (dom.chapterActions) dom.chapterActions.style.display = "none";
  }

  function createExplorePickups(day) {
    const shift = (day * 7) % 13;
    const collected = Array.isArray(state.flags.collectedPickups) ? state.flags.collectedPickups : [];
    return [
      { id: "pickup-" + day + "-warmth", kind: "warmth", icon: "柴", label: "一截干柴", x: 420 + shift * 12, bottom: 24 },
      { id: "pickup-" + day + "-spirit", kind: "spirit", icon: "炭", label: "半截炭笔", x: 1280 + shift * 5, bottom: 54 },
      { id: "pickup-" + day + "-greens", kind: "greens", icon: "叶", label: "一把野菜", x: 2180 - shift * 9, bottom: 26 }
    ].filter((pickup) => !collected.includes(pickup.id));
  }

  function collectPickup(pickup) {
    if (!pickup || !state) return;
    const collected = Array.isArray(state.flags.collectedPickups) ? state.flags.collectedPickups : [];
    if (collected.includes(pickup.id)) return;
    collected.push(pickup.id);
    state.flags.collectedPickups = collected;
    if (pickup.kind === "warmth") {
      applyStats({ warmth: 6 });
      adjustCommunity({ smoke: 1 });
      pushLog("你在墙角拾到一截干柴，灶膛能多烧一会儿。");
    } else if (pickup.kind === "spirit") {
      applyStats({ spirit: 5 });
      pushLog("你捡到半截炭笔，在掌心画了一只歪歪扭扭的小鸟。");
    } else {
      addFood("greens", 1);
      pushLog("你在路边拾到一把野菜。");
    }
    playFeedback("pickup");
    if (pickup.element && pickup.element.parentNode) pickup.element.parentNode.removeChild(pickup.element);
    explore.pickups = explore.pickups.filter((item) => item.id !== pickup.id);
    showToast("拾到：" + pickup.label);
    renderStats();
    renderJournal();
    renderCommunity();
    saveGame();
  }

  function collectNearbyPickups() {
    explore.pickups.slice().forEach((pickup) => {
      if (Math.abs(explore.x - pickup.x) <= 58) collectPickup(pickup);
    });
  }

  function renderExplorePickups() {
    if (!dom.explorePickups) return;
    dom.explorePickups.innerHTML = "";
    explore.pickups.forEach((pickup) => {
      const token = document.createElement("span");
      token.className = "explore-pickup";
      token.style.bottom = pickup.bottom + "%";
      token.innerHTML = "<strong>" + pickup.icon + "</strong><small>" + pickup.label + "</small>";
      pickup.element = token;
      dom.explorePickups.appendChild(token);
    });
  }

  function getExploreLayout(locationId) {
    return EXPLORE_LOCATION_LAYOUT[locationId] || { x: EXPLORE_WORLD_WIDTH / 2, bottom: 25 };
  }

  function getExploreCameraTarget() {
    const viewWidth = dom.exploreLayer ? dom.exploreLayer.clientWidth : window.innerWidth;
    const maxCamera = Math.max(0, EXPLORE_WORLD_WIDTH - viewWidth);
    return clamp(explore.x - viewWidth / 2, 0, maxCamera);
  }

  function updateExploreCamera(dt, snap) {
    const viewWidth = Math.max(1, dom.exploreLayer ? dom.exploreLayer.clientWidth : window.innerWidth);
    explore.viewWidth = viewWidth;
    const target = getExploreCameraTarget();
    const amount = snap ? 1 : 1 - Math.pow(0.0025, Math.max(0.001, dt || 0.016));
    explore.cameraX = lerp(explore.cameraX, target, amount);
    updateExploreWorldPositions();
  }

  function updateExploreWorldPositions() {
    const viewWidth = explore.viewWidth || (dom.exploreLayer ? dom.exploreLayer.clientWidth : window.innerWidth);
    if (dom.explorePlayer) dom.explorePlayer.style.left = (explore.x - explore.cameraX) + "px";
    explore.hotspots.forEach((hotspot) => {
      const screenX = hotspot.worldX - explore.cameraX;
      hotspot.element.style.left = screenX + "px";
      const visible = screenX > -90 && screenX < viewWidth + 90;
      hotspot.element.classList.toggle("is-offscreen", !visible);
    });
    explore.pickups.forEach((pickup) => {
      if (!pickup.element) return;
      const screenX = pickup.x - explore.cameraX;
      pickup.element.style.left = screenX + "px";
      pickup.element.classList.toggle("is-offscreen", screenX < -70 || screenX > viewWidth + 70);
    });
    updateExploreMinimapPlayer();
  }

  function updateExploreMinimapPlayer() {
    if (!explore.minimapPlayerElement) return;
    explore.minimapPlayerElement.style.left = clamp((explore.x / EXPLORE_WORLD_WIDTH) * 100, 0, 100) + "%";
  }

  function renderExploreMinimap() {
    if (!dom.exploreMinimapTrack) return;
    dom.exploreMinimapTrack.innerHTML = "";
    const seen = new Set();
    explore.hotspots.forEach((hotspot) => {
      const locationId = hotspot.action.locationId || "unknown";
      if (seen.has(locationId)) return;
      seen.add(locationId);
      const location = getLocation(locationId);
      const marker = document.createElement("span");
      marker.className = "minimap-location is-current-action";
      marker.style.left = clamp((hotspot.worldX / EXPLORE_WORLD_WIDTH) * 100, 0, 100) + "%";
      marker.title = location ? location.name : hotspot.action.label;
      dom.exploreMinimapTrack.appendChild(marker);
    });
    const player = document.createElement("span");
    player.className = "minimap-player";
    dom.exploreMinimapTrack.appendChild(player);
    explore.minimapPlayerElement = player;
    if (dom.exploreMinimapText) dom.exploreMinimapText.textContent = "慈云庵";
    updateExploreMinimapPlayer();
  }

  function updateExplorePrompt() {
    if (!explore.active || !dom.explorePrompt) return;
    let nearest = null;
    let nearestDistance = Infinity;
    explore.hotspots.forEach((hotspot) => {
      const distance = Math.abs(explore.x - hotspot.worldX);
      hotspot.element.classList.toggle("is-near", distance <= 115);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = hotspot;
      }
    });

    if (explore.targetX !== null && explore.pendingActionId) {
      const target = explore.hotspots.find((hotspot) => hotspot.action.id === explore.pendingActionId);
      const distance = target ? Math.max(0, Math.round(Math.abs(target.worldX - explore.x))) : 0;
      dom.explorePrompt.textContent = target
        ? "正在跑向 " + target.action.label + " · 还有 " + distance + " 步"
        : "正在跑过去……";
    } else if (nearest && nearestDistance <= 115) {
      const location = getLocation(nearest.action.locationId);
      dom.explorePrompt.textContent = "到了 " + (location ? location.name : nearest.action.label) + "。按 E 或点地点互动。";
      if (dom.exploreMinimapText && location) dom.exploreMinimapText.textContent = location.name;
    } else if (nearest) {
      const location = getLocation(nearest.action.locationId);
      const direction = nearest.worldX >= explore.x ? "→" : "←";
      dom.explorePrompt.textContent = (location ? location.name : nearest.action.label) + " " + direction + " " + Math.round(nearestDistance) + " 步 · A / D 跑动 · Shift 加速";
      if (dom.exploreMinimapText && location) dom.exploreMinimapText.textContent = location.name + " " + direction;
    } else {
      dom.explorePrompt.textContent = "A / D 跑动 · Shift 加速 · E 互动";
    }
  }

  function updateExplorePlayer() {
    updateExploreWorldPositions();
    updateExplorePrompt();
  }

  function formatCountdown(seconds) {
    const safe = Math.max(0, Math.ceil(seconds));
    return String(Math.floor(safe / 60)).padStart(2, "0") + ":" + String(safe % 60).padStart(2, "0");
  }

  function updateExploreClock() {
    if (!dom.exploreClock) return;
    const seconds = Math.max(0, Math.ceil(explore.timeLeft));
    if (dom.exploreClockText) dom.exploreClockText.textContent = formatCountdown(seconds);
    if (dom.exploreClockBar) dom.exploreClockBar.style.width = clamp((explore.timeLeft / EXPLORE_DAY_SECONDS) * 100, 0, 100) + "%";
    dom.exploreClock.classList.toggle("is-danger", seconds <= 12);
  }

  function forceExploreDusk() {
    if (!state || state.phase !== "action" || explore.forcedDusk) return;
    explore.forcedDusk = true;
    state.phase = "dusk";
    stopExplore();
    applyStats({ warmth: -8, health: -3, spirit: -4 });
    pushLog("天突然黑下来，你摸黑回到庵里，手脚已经冻僵。");
    playFeedback("fail");
    renderChapterUI();
    saveGame();
    openModal({
      eyebrow: "天色已暗",
      title: "风从门缝里钻进来",
      body: "你在外面待得太久。回到慈云庵时，屋檐下已经看不见路。\n\n今天没有做的事，只能留给明天；但今晚的饥饿不会等。",
      actions: [{
        label: "回到庵里",
        primary: true,
        onClick: () => {
          closeModal();
          openDusk();
        }
      }]
    });
  }
  function triggerExploreAction(actionId) {
    const action = DATA.ACTION_LIBRARY[actionId];
    if (!action || !state || state.phase !== "action") return;
    stopExplore();
    explore.pendingActionId = null;
    explore.targetX = null;
    explore.keys.left = false;
    explore.keys.right = false;
    runAction(action);
  }

  function startExploreLoop() {
    if (explore.raf) cancelAnimationFrame(explore.raf);
    explore.lastTimestamp = performance.now();
    const step = (timestamp) => {
      if (!explore.active) {
        explore.raf = null;
        return;
      }
      const dt = Math.min(0.05, Math.max(0.01, (timestamp - explore.lastTimestamp) / 1000));
      explore.lastTimestamp = timestamp;
      const modalOpen = dom.modalLayer && !dom.modalLayer.classList.contains("is-hidden");
      const canMove = !paused && !modalOpen && state && state.phase === "action";

      if (canMove) {
        let direction = 0;
        if (explore.keys.left) direction -= 1;
        if (explore.keys.right) direction += 1;
        if (direction) {
          explore.targetX = null;
          explore.pendingActionId = null;
          const speed = explore.keys.sprint ? 420 : 220;
          explore.x = clamp(explore.x + direction * speed * dt, 60, EXPLORE_WORLD_WIDTH - 60);
        } else if (explore.targetX !== null) {
          const difference = explore.targetX - explore.x;
          if (Math.abs(difference) <= 5) {
            explore.x = explore.targetX;
            const pending = explore.pendingActionId;
            explore.targetX = null;
            explore.pendingActionId = null;
            if (pending) setTimeout(() => triggerExploreAction(pending), 120);
          } else {
            const speed = explore.keys.sprint ? 520 : 300;
            explore.x = clamp(explore.x + Math.sign(difference) * Math.min(Math.abs(difference), speed * dt), 60, EXPLORE_WORLD_WIDTH - 60);
          }
        }

        explore.timeLeft -= dt;
        updateExploreClock();
        if (explore.timeLeft <= 12 && !explore.warned) {
          explore.warned = true;
          playFeedback("warn");
          showToast("风起来了。天快黑了，回庵前再拿一样东西。");
        }
        if (explore.timeLeft <= 0) {
          forceExploreDusk();
          return;
        }
      }

      updateExploreCamera(dt, false);
      updateExplorePlayer();
      collectNearbyPickups();
      explore.raf = requestAnimationFrame(step);
    };
    explore.raf = requestAnimationFrame(step);
  }

  function moveExploreTo(hotspot) {
    if (!explore.active) return;
    if (!hotspot || !hotspot.action) return;
    if (Math.abs(explore.x - hotspot.worldX) <= 120) {
      triggerExploreAction(hotspot.action.id);
      return;
    }
    explore.targetX = hotspot.worldX;
    explore.pendingActionId = hotspot.action.id;
    updateExplorePrompt();
  }

  function interactExplore() {
    if (!explore.active || !state || state.phase !== "action") return;
    let nearest = null;
    let nearestDistance = Infinity;
    explore.hotspots.forEach((hotspot) => {
      const distance = Math.abs(explore.x - hotspot.worldX);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = hotspot;
      }
    });
    if (nearest && nearestDistance <= 120) {
      triggerExploreAction(nearest.action.id);
    } else {
      showToast("再跑近一点，才能看清那里有什么。");
    }
  }
  function renderExplore(actionIds) {
    if (!dom.exploreLayer || !dom.exploreHotspots) return;
    dom.chapterActions.innerHTML = "";
    dom.chapterActions.style.display = "none";
    dom.chapterHint.textContent = "";
    dom.exploreLayer.classList.remove("is-hidden");
    if (dom.exploreControls) dom.exploreControls.classList.remove("is-hidden");
    if (dom.exploreClock) dom.exploreClock.classList.remove("is-hidden");
    if (dom.exploreMinimap) dom.exploreMinimap.classList.remove("is-hidden");
    updateExploreClock();
    dom.exploreHotspots.innerHTML = "";
    explore.hotspots = [];

    const actions = actionIds.map((id) => DATA.ACTION_LIBRARY[id]).filter(Boolean);
    const counts = {};
    actions.forEach((action) => {
      const locationId = action.locationId || "hall";
      counts[locationId] = (counts[locationId] || 0) + 1;
    });
    const used = {};

    actions.forEach((action) => {
      const locationId = action.locationId || "hall";
      const layout = getExploreLayout(locationId);
      const indexAtLocation = used[locationId] || 0;
      used[locationId] = indexAtLocation + 1;
      const offset = (indexAtLocation - ((counts[locationId] || 1) - 1) / 2) * 118;
      const worldX = clamp(layout.x + offset, 70, EXPLORE_WORLD_WIDTH - 70);
      const location = getLocation(locationId);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "explore-hotspot";
      button.dataset.actionId = action.id;
      button.dataset.locationId = locationId;
      button.style.bottom = layout.bottom + "%";
      button.setAttribute("aria-label", action.label + "：" + action.description);

      const icon = document.createElement("span");
      icon.className = "hotspot-icon";
      icon.textContent = action.icon;
      const label = document.createElement("strong");
      label.textContent = location ? location.name : action.label;
      const description = document.createElement("small");
      description.textContent = action.short;
      button.appendChild(icon);
      button.appendChild(label);
      button.appendChild(description);

      const hotspot = { action, worldX, locationId, element: button };
      explore.hotspots.push(hotspot);
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        playFeedback("click");
        moveExploreTo(hotspot);
      });
      dom.exploreHotspots.appendChild(button);
    });

    explore.active = true;
    explore.viewWidth = dom.exploreLayer.clientWidth || window.innerWidth;
    explore.cameraX = getExploreCameraTarget();
    renderExplorePickups();
    renderExploreMinimap();
    updateExplorePlayer();
    collectNearbyPickups();
    startExploreLoop();
  }
  function renderActions() {
    dom.chapterActions.innerHTML = "";
    dom.btnPause.style.visibility = state.phase === "final" ? "hidden" : "visible";
    if (state.phase === "story" || state.phase === "dusk") {
      stopExplore();
      return;
    }

    if (state.phase === "final") {
      stopExplore();
      dom.chapterActions.style.display = "grid";
      dom.chapterActions.style.gridTemplateColumns = "minmax(0, 1fr)";
      dom.chapterHint.textContent = "移动键失效";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "action-card";
      button.style.textAlign = "center";
      button.innerHTML = "<span class=\"action-icon\">碗</span><span class=\"action-label\">把碗给她</span><span class=\"action-description\">这是唯一可以推进的交互</span>";
      button.addEventListener("click", giveFinalBowl);
      dom.chapterActions.appendChild(button);
      return;
    }

    const actionIds = (DATA.DAILY_ACTIONS[state.day] || []).filter((id) => DATA.ACTION_LIBRARY[id] && !state.usedActionsToday.includes(id));
    if (!actionIds.length) {
      stopExplore();
      return;
    }
    renderExplore(actionIds);
  }

  function runAction(action) {
    if (!state || state.phase !== "action") return;
    if (state.actionsToday >= ACTIONS_PER_DAY) return;
    if (state.usedActionsToday.includes(action.id)) return;
    if (action.locationId && !state.locationsSeen.includes(action.locationId)) {
      state.locationsSeen.push(action.locationId);
    }
    state.flags.currentLocation = action.locationId || "";
    if (action.kind === "timing") {
      openTimingAction(action);
      return;
    }
    if (action.kind === "plant") {
      openPlantAction(action);
      return;
    }
    if (action.kind === "scrub") {
      openScrubAction(action);
      return;
    }
    if (action.kind === "hold") {
      openHoldAction(action);
      return;
    }
    completeAction(action, true);
  }

  function openTimingAction(action) {
    const isQueue = action.id === "queue";
    const safeLeft = 34 + Math.random() * 22;
    const safeWidth = isQueue ? 17 : 13;
    const body = document.createElement("div");
    body.className = "timing-game";
    body.innerHTML =
      "<div class=\"timing-track\">" +
        "<span class=\"timing-safe\" style=\"left:" + safeLeft + "%;width:" + safeWidth + "%\"></span>" +
        "<span class=\"timing-marker\"></span>" +
      "</div>" +
      "<p class=\"timing-hint\">" + (isQueue ? "在人堆挤过来之前，护住碗。" : "看准鱼影经过亮处的一瞬。") + "</p>";

    let position = 0;
    let direction = 1;
    let interval = null;
    let resolved = false;
    const marker = body.querySelector(".timing-marker");

    openModal({
      eyebrow: "即时交互",
      title: isQueue ? "护住你的碗" : "快下手",
      body,
      cleanup: () => {
        if (interval) clearInterval(interval);
        interval = null;
      },
      actions: [{
        label: isQueue ? "伸手护碗" : "下手捞",
        primary: true,
        onClick: () => {
          if (resolved) return;
          resolved = true;
          if (interval) clearInterval(interval);
          const success = position >= safeLeft && position <= safeLeft + safeWidth;
          if (isQueue) {
            if (success) {
              showToast("碗护住了。陈婶往碗里添了一勺稀粥。");
            } else {
              applyStats({ health: -3, spirit: -2 });
              showToast("人潮把你挤歪了，碗里的粥洒掉大半。");
            }
          } else if (success) {
            showToast("你摸到一条小鱼，凉的，还在甩尾。");
          } else {
            applyStats({ warmth: -28, health: -3 });
            showToast("你一脚踩进冷水里，鱼从指缝间滑走了。");
          }
          completeAction(action, success);
        }
      }]
    });

    interval = setInterval(() => {
      position += direction * 1.25;
      if (position >= 100) {
        position = 100;
        direction = -1;
      } else if (position <= 0) {
        position = 0;
        direction = 1;
      }
      marker.style.left = position + "%";
    }, 16);
  }

  function openScrubAction(action) {
    const body = document.createElement("div");
    body.className = "scrub-game";
    body.innerHTML =
      "<div class=\"scrub-pot\" role=\"application\" aria-label=\"按住并左右擦洗锅底\">" +
        "<span class=\"scrub-bubble bubble-a\"></span>" +
        "<span class=\"scrub-bubble bubble-b\"></span>" +
        "<span class=\"scrub-bubble bubble-c\"></span>" +
        "<strong>擦</strong>" +
      "</div>" +
      "<div class=\"scrub-progress\"><span></span></div>" +
      "<p class=\"scrub-instruction\">按住锅底，左右来回擦洗。把手上的力气用完，就能换到锅底的米渣。</p>";

    let dragging = false;
    let lastX = 0;
    let progress = 0;
    let resolved = false;
    const pot = body.querySelector(".scrub-pot");
    const fill = body.querySelector(".scrub-progress span");
    const instruction = body.querySelector(".scrub-instruction");

    const finish = () => {
      if (resolved) return;
      resolved = true;
      showToast("锅底被擦亮了。陈婶刮给你一小碗米渣。");
      completeAction(action, true);
    };

    const update = () => {
      fill.style.width = clamp(progress, 0, 100) + "%";
      pot.classList.toggle("is-working", dragging);
      if (progress >= 100) finish();
    };

    pot.addEventListener("pointerdown", (event) => {
      if (resolved) return;
      event.preventDefault();
      dragging = true;
      lastX = event.clientX;
      try { if (pot.setPointerCapture) pot.setPointerCapture(event.pointerId); } catch (error) { /* Synthetic events may not own the pointer. */ }
      instruction.textContent = "别停，锅底还有一层焦痕。";
      update();
    });
    pot.addEventListener("pointermove", (event) => {
      if (!dragging || resolved) return;
      const distance = Math.abs(event.clientX - lastX);
      lastX = event.clientX;
      progress += distance * 0.42;
      if (distance > 2) instruction.textContent = "对，就这样擦。";
      update();
    });
    const stopDragging = () => {
      dragging = false;
      update();
    };
    pot.addEventListener("pointerup", stopDragging);
    pot.addEventListener("pointercancel", stopDragging);
    pot.addEventListener("pointerleave", stopDragging);

    openModal({
      eyebrow: "帮工 · 擦锅",
      title: "把锅底擦出来",
      body,
      dismissible: false,
      cleanup: () => {
        dragging = false;
      },
      actions: [{ label: "让陈婶自己来", onClick: () => completeAction(action, false) }]
    });
  }

  function openHoldAction(action) {
    const body = document.createElement("div");
    body.className = "hold-game";
    body.innerHTML =
      "<button class=\"hold-pad\" type=\"button\">" +
        "<span class=\"hold-ring\"></span>" +
        "<strong>按住</strong>" +
        "<small>听一会儿呼吸</small>" +
      "</button>" +
      "<div class=\"hold-progress\"><span></span></div>" +
      "<p class=\"hold-instruction\">按住不要松手。大殿里很冷，但你可以在这里坐一会儿。</p>";

    const pad = body.querySelector(".hold-pad");
    const fill = body.querySelector(".hold-progress span");
    const instruction = body.querySelector(".hold-instruction");
    let progress = 0;
    let holding = false;
    let timer = null;
    let resolved = false;

    const update = () => {
      fill.style.width = progress + "%";
      pad.style.setProperty("--hold-progress", progress + "%");
      if (progress >= 100 && !resolved) {
        resolved = true;
        holding = false;
        clearInterval(timer);
        timer = null;
        instruction.textContent = "佛像没有说话。你的呼吸终于慢了下来。";
        showToast("你在佛前坐了一会儿。");
        setTimeout(() => completeAction(action, true), 420);
      }
    };

    const start = (event) => {
      if (resolved || holding) return;
      event.preventDefault();
      holding = true;
      instruction.textContent = "继续按住，不要急着松手。";
      clearInterval(timer);
      timer = setInterval(() => {
        if (!holding) return;
        progress = Math.min(100, progress + 2.2);
        update();
      }, 40);
    };
    const stop = () => {
      if (!holding || resolved) return;
      holding = false;
      clearInterval(timer);
      timer = null;
      if (progress < 100) {
        progress = Math.max(0, progress - 22);
        instruction.textContent = "手松开了。再按住一会儿。";
        update();
      }
    };
    pad.addEventListener("pointerdown", start);
    pad.addEventListener("pointerup", stop);
    pad.addEventListener("pointercancel", stop);
    pad.addEventListener("pointerleave", stop);
    window.addEventListener("pointerup", stop);

    openModal({
      eyebrow: "大殿 · 凝神",
      title: "听一会儿呼吸",
      body,
      dismissible: false,
      cleanup: () => {
        holding = false;
        clearInterval(timer);
        window.removeEventListener("pointerup", stop);
      },
      actions: [{ label: "今天先到这里", onClick: () => completeAction(action, false) }]
    });
  }

  function openPlantAction(action) {
    const quiz = DATA.PLANT_QUIZ[Math.floor(Math.random() * DATA.PLANT_QUIZ.length)];
    const body = document.createElement("div");
    const prompt = document.createElement("p");
    prompt.style.margin = "0";
    prompt.textContent = quiz.prompt;
    body.appendChild(prompt);

    const grid = document.createElement("div");
    grid.className = "plant-grid";
    quiz.options.forEach((option) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "plant-card";
      const shape = document.createElement("span");
      shape.className = "plant-shape";
      shape.textContent = "叶";
      const name = document.createElement("span");
      name.className = "plant-name";
      name.textContent = option.name;
      const hint = document.createElement("span");
      hint.className = "plant-hint";
      hint.textContent = option.hint;
      card.appendChild(shape);
      card.appendChild(name);
      card.appendChild(hint);
      card.addEventListener("click", () => {
        if (option.safe) {
          showToast("你认对了：" + option.name + "。");
          completeAction(action, true);
        } else {
          applyStats({ health: -15, spirit: -3 });
          pushLog("你误食了" + option.name + "，肚子绞痛。");
          openModal({
            eyebrow: "辨认失败",
            title: "这不是能吃的野菜",
            body: option.name + "有毒。\n" + option.hint + "\n\n你把嘴里的东西吐了出来，胃里仍然一阵阵绞痛。",
            actions: [{
              label: "回到庵里",
              primary: true,
              onClick: () => completeAction(action, false)
            }]
          });
        }
      });
      grid.appendChild(card);
    });
    body.appendChild(grid);

    openModal({
      eyebrow: "辨认野菜",
      title: "石头的生存笔记",
      body,
      actions: [{ label: "今天先不挖了", onClick: () => completeAction(action, false) }]
    });
  }

  function grantActionRewards(action, success) {
    if (!state || !success) return;
    const skillLevel = action.skill ? getSkillLevel(state.skills[action.skill]) : 1;
    const multiplier = 1 + (skillLevel - 1) * 0.25;
    Object.keys(action.gain || {}).forEach((type) => {
      let amount = action.gain[type] * multiplier;
      if (action.id === "fish" && (state.day === 11 || (DATA.DAILY_EVENTS[state.day] || {}).weather === "阵雨后转晴")) amount *= 2;
      if (action.id === "bark" && state.day >= 16) amount += 1;
      addFood(type, Math.max(1, Math.round(amount)));
    });
    Object.keys(action.xp || {}).forEach((skill) => addSkillXp(skill, action.xp[skill]));
    Object.keys(action.bond || {}).forEach((id) => adjustBond(id, action.bond[id]));
    adjustCommunity(action.community || {});
  }

  function completeAction(action, success) {
    if (!state) return;
    if (state.actionsToday >= ACTIONS_PER_DAY) return;
    if (state.usedActionsToday.includes(action.id)) return;
    state.actionsToday += 1;
    state.usedActionsToday.push(action.id);

    grantActionRewards(action, success);
    playFeedback(success ? "success" : "fail");

    if (action.id === "help") {
      applyStats({ warmth: 5 });
      pushLog("你帮陈婶刷了锅，换回一碗锅底米渣。");
    } else if (action.id === "care") {
      applyStats({ spirit: 18, satiety: -2 });
      state.bond += 1;
      pushLog("你陪小囡玩了很久。她的手指终于暖了一点。");
    } else if (action.id === "pray") {
      applyStats({ spirit: 15 });
      pushLog("你在大殿坐了一会儿。佛像没有说话。");
      saveGame();
    } else if (action.id === "rest") {
      applyStats({ warmth: 15, health: 4, spirit: 3 });
      pushLog("你靠着灶膛睡了一会儿，手脚慢慢有了知觉。");
    } else if (action.id === "bark") {
      applyStats({ warmth: -4 });
      pushLog("你剥下两块榆树皮，掌心被磨破了。");
    } else if (action.id === "queue") {
      pushLog(success ? "你护住了碗，领到一碗稀粥。" : "你的粥洒了。");
    } else if (action.id === "greens") {
      pushLog(success ? "你挖到两把能吃的野菜。" : "你没有挖到能吃的野菜。");
    } else if (action.id === "fish") {
      pushLog(success ? "你摸到一条小鱼。" : "你空着手从河边回来。");
    }

    if (action.outside && action.id !== "bark") {
      applyStats({ warmth: -3 });
    }
    const weather = (DATA.DAILY_EVENTS[state.day] || {}).weather || "";
    if (action.outside && /雨|雪|湿/.test(weather)) state.flags.wet = true;
    if (action.id === "pray") state.flags.dreamPending = true;

    closeModal();
    if (state.actionsToday < ACTIONS_PER_DAY) {
      state.phase = "action";
      explore.targetX = null;
      explore.pendingActionId = null;
      renderChapterUI();
      showToast("还有一点时间。再去一个地方。");
      saveGame();
      return;
    }

    state.phase = "dusk";
    renderChapterUI();
    setTimeout(openDusk, 280);
  }

  function endExploreEarly() {
    if (!state || state.phase !== "action") return;
    explore.keys.left = false;
    explore.keys.right = false;
    state.phase = "dusk";
    renderChapterUI();
    saveGame();
    openDusk();
  }

  function openDusk() {
    if (!state) return;
    const body = document.createElement("div");
    const intro = document.createElement("p");
    intro.style.margin = "0";
    intro.textContent = "黄昏。把今天手里的东西分出去。\n拖拽，或先点食物再点接收的人。";
    body.appendChild(intro);

    const layout = document.createElement("div");
    layout.className = "dusk-layout";
    const rack = document.createElement("div");
    rack.className = "food-rack";
    const recipients = document.createElement("div");
    recipients.className = "recipient-list";
    layout.appendChild(rack);
    layout.appendChild(recipients);
    body.appendChild(layout);

    const tip = document.createElement("p");
    tip.className = "dusk-tip";
    tip.textContent = "没有分出去的东西会自动藏进铺下。它们不会消失，也不会替你挨饿。";
    body.appendChild(tip);

    let selectedFood = null;

    function renderRack() {
      rack.innerHTML = "";
      const entries = Object.keys(DATA.FOODS)
        .map((type) => ({ type, food: DATA.FOODS[type], count: state.inventory[type] || 0 }))
        .filter((entry) => entry.count > 0);
      if (!entries.length) {
        const empty = document.createElement("div");
        empty.className = "food-empty";
        empty.textContent = "手里什么也没有。";
        rack.appendChild(empty);
        return;
      }
      entries.forEach((entry) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "food-chip" + (selectedFood === entry.type ? " is-selected" : "");
        chip.draggable = true;
        chip.innerHTML = "<strong>" + entry.food.icon + " " + entry.food.label + "</strong><span>× " + entry.count + " · 拖拽或点选</span>";
        chip.addEventListener("click", () => {
          selectedFood = selectedFood === entry.type ? null : entry.type;
          renderRack();
        });
        chip.addEventListener("dragstart", (event) => {
          selectedFood = entry.type;
          if (event.dataTransfer) event.dataTransfer.setData("text/plain", entry.type);
          renderRack();
        });
        rack.appendChild(chip);
      });
    }

    function renderRecipients() {
      recipients.innerHTML = "";
      const targets = [
        { id: "self", title: "自己", hint: "吃掉这一份" },
        { id: "xiaonan", title: "小囡", hint: "给她一口" },
        { id: "stone", title: "石头", hint: state.stoneDead ? "空铺位" : "给他一口", disabled: state.stoneDead }
      ];
      targets.forEach((target) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "recipient";
        button.disabled = Boolean(target.disabled);
        button.innerHTML = "<strong>" + target.title + "</strong><small>" + target.hint + "</small>";
        button.addEventListener("dragover", (event) => {
          event.preventDefault();
          button.classList.add("is-drop-target");
        });
        button.addEventListener("dragleave", () => button.classList.remove("is-drop-target"));
        button.addEventListener("drop", (event) => {
          event.preventDefault();
          button.classList.remove("is-drop-target");
          const dragged = event.dataTransfer ? event.dataTransfer.getData("text/plain") : selectedFood;
          if (dragged) selectedFood = dragged;
          allocateTo(target.id);
        });
        button.addEventListener("click", () => allocateTo(target.id));
        recipients.appendChild(button);
      });
    }

    function allocateTo(targetId) {
      if (!selectedFood) {
        showToast("先选一份食物。");
        return;
      }
      const type = selectedFood;
      if ((state.inventory[type] || 0) <= 0) {
        selectedFood = null;
        renderRack();
        return;
      }

      if (targetId === "self") {
        eatFood(type);
        if (type === "bark" || type === "barkPaste") state.flags.bloated = true;
      } else if (targetId === "xiaonan") {
        consumeFood(type, 1);
        state.bond += 1;
        state.kindness += 1;
        adjustBond("xiaonan", 1);
        adjustCommunity({ popularity: 3, smoke: 1 });
        applyStats({ spirit: 2 });
        pushLog("你把一份" + DATA.FOODS[type].label + "给了小囡。");
        showToast("小囡把碗捧得很紧。");
      } else if (targetId === "stone" && !state.stoneDead) {
        consumeFood(type, 1);
        state.bond += 1;
        state.kindness += 1;
        adjustBond("shitou", 1);
        adjustCommunity({ popularity: 2 });
        pushLog("你把一份" + DATA.FOODS[type].label + "给了石头。");
        showToast("石头说：“你自己也吃。”");
      }

      if ((state.inventory[type] || 0) <= 0) selectedFood = null;
      renderRack();
      renderStats();
      renderJournal();
    }

    renderRack();
    renderRecipients();

    openModal({
      eyebrow: "黄昏 · 分食",
      title: "你手里的每一口，都是一次选择",
      body,
      dismissible: false,
      actions: [{
        label: "把剩下的藏进铺下，过夜",
        primary: true,
        onClick: finishDusk
      }]
    });
  }
  function finishDusk() {
    if (!state) return;
    closeModal();
    const finishedDay = state.day;
    const gentleMultiplier = settings.gentle ? 0.7 : 1;
    let satietyLoss = 15;
    let warmthLoss = 6;
    let spiritLoss = 2;

    if (state.day >= 16) warmthLoss += 5;
    if (state.day === 6) warmthLoss += 10;
    if (state.day === 11) spiritLoss += 2;

    applyStats({
      satiety: -satietyLoss * gentleMultiplier,
      warmth: -warmthLoss * gentleMultiplier,
      spirit: -spiritLoss
    });

    if (state.flags.wet) {
      applyStats({ warmth: -4, health: -3 });
      pushLog("湿衣服贴在身上，你半夜冻醒了一次。");
      state.flags.wet = false;
    }
    if (state.flags.bloated) {
      applyStats({ health: -3, spirit: -2 });
      pushLog("榆皮粉在胃里发胀，你蜷了很久才睡着。");
      state.flags.bloated = false;
    }

    if (state.stats.satiety <= 0) {
      applyStats({ health: -12 });
      pushLog("你饿得在半夜醒来，胃里一阵阵抽痛。");
    }
    if (state.stats.warmth <= 0) {
      applyStats({ health: -10 });
      pushLog("你冻得牙齿打颤，很久才睡着。");
    }
    if (state.stats.satiety > 62 && state.stats.warmth > 52) {
      applyStats({ health: 3 });
    }

    adjustCommunity({ smoke: -2, popularity: -1 });
    if (state.community.smoke >= 70) {
      addFood("porridge", 1);
      pushLog("灶膛的火还旺，陈婶多留了一勺粥。");
    } else if (state.community.smoke <= 30 && Math.random() < 0.35 && inventoryCount() > 0) {
      const stolen = Object.keys(state.inventory).find((type) => state.inventory[type] > 0);
      if (stolen) {
        state.inventory[stolen] -= 1;
        pushLog("半夜有人摸走了铺下的一份" + DATA.FOODS[stolen].label + "。");
      }
    }
    if (state.community.popularity <= 30) {
      applyStats({ spirit: -3 });
      pushLog("大通铺里没人说话，哭声从很远的地方传来。");
    }

    if (state.stats.health <= 0) {
      state.sickDays += 1;
      state.stats.health = 34;
      state.stats.spirit = Math.max(8, state.stats.spirit - 8);
      pushLog("你病倒了，被陈婶按在床上歇了一整天。");
      if (state.sickDays >= 3) {
        showBadEnding();
        return;
      }
    }

    const forceDream = { 13: 3, 18: 4, 24: 5 }[finishedDay] || 0;
    const nextDream = forceDream || (state.flags.dreamPending ? clamp(state.dreams + 1, 1, 5) : 0);
    state.flags.dreamPending = false;
    state.day += 1;
    state.phase = "story";
    state.checkpoint = "chapter";
    saveGame();

    if (nextDream) {
      fadeTo(() => showDream(nextDream, () => beginDay()), 380);
    } else {
      fadeTo(() => beginDay(), 380);
    }
  }

  function showBadEnding() {
    state.checkpoint = "ending";
    saveGame();
    openModal({
      eyebrow: "Bad Ending",
      title: "没能等到春天",
      body: "你几次病倒，身体已经撑不住了。\n\n慈云庵的雪还在下。有人把你抱到灶膛边，可你只觉得那团火越来越远。",
      dismissible: false,
      actions: [
        { label: "重新开始", primary: true, onClick: () => { closeModal(); startNewGame(); } },
        { label: "回到标题", onClick: () => { closeModal(); returnToTitle(); } }
      ]
    });
  }

  function showFinalScene() {
    if (!state) return;
    state.phase = "final";
    state.checkpoint = "chapter";
    saveGame();
    renderChapterUI();
  }

  function giveFinalBowl() {
    if (!state || state.flags.gaveFinalBowl) return;
    state.flags.gaveFinalBowl = true;
    consumeFood("porridge", 1);
    const familyBond = (state.bonds.xiaonan || 0) >= 5;
    state.bond += 4;
    state.kindness += 3;
    adjustBond("xiaonan", 1);
    applyStats({ spirit: 10 });
    pushLog(familyBond ? "小囡把木梳塞进你手里，又把碗推回来。你重新把碗放进她怀里。" : "你把最后一点粥和布老虎一起给了小囡。");
    dom.chapterActions.style.display = "none";
    dom.chapterHint.textContent = "";
    dom.chapterCaption.textContent = familyBond
      ? "小囡没有接碗。她把怀里的木梳塞进你手里，奶声奶气：“碗碗……给你。”\n你把碗重新放进她怀里，又把布老虎压在木梳旁边。\n\n然后转身走进风雪。"
      : "小囡捧住碗，手指慢慢收紧。\n你把布老虎塞进她怀里。\n\n然后转身走进风雪。";
    dom.chapterCaption.style.opacity = "1";
    saveGame();
    setTimeout(() => {
      fadeTo(startInterlude, 1100);
    }, 3000);
  }

  function startInterlude() {
    closeModal();
    showScreen("interlude-screen");
    state.checkpoint = "interlude";
    saveGame();
    clearInterludeTimers();
    if (dom.interludeLight) dom.interludeLight.classList.remove("is-on");
    if (dom.btnOpenEyes) dom.btnOpenEyes.classList.add("is-hidden");

    const script = [
      { at: 0, text: "心跳渐弱。" },
      { at: 2, text: "……冷……" },
      { at: 4.2, text: "咣当。咣当。" },
      { at: 6.2, text: "让一让，孩子先上。" },
      { at: 8.3, text: "风从很远的地方吹来。" },
      { at: 10.1, text: "远处有人在哼歌。" },
      { at: 11.7, text: "那声音越来越近，像在耳边。" },
      { at: 13.4, text: "醒了？这孩子，可算醒了。" }
    ];
    const speed = DEBUG_FAST ? 3 : 1;
    const start = performance.now();
    let lastTextIndex = -1;

    if (dom.interludeText) {
      dom.interludeText.textContent = script[0].text;
      dom.interludeText.style.opacity = "1";
    }
    if (dom.interludeTime) dom.interludeTime.textContent = "00:00";

    const interval = setInterval(() => {
      const elapsed = ((performance.now() - start) / 1000) * speed;
      const seconds = Math.floor(elapsed);
      if (dom.interludeTime) {
        dom.interludeTime.textContent = "00:" + String(Math.min(99, seconds)).padStart(2, "0");
      }

      let textIndex = 0;
      script.forEach((line, index) => {
        if (elapsed >= line.at) textIndex = index;
      });
      if (textIndex !== lastTextIndex) {
        lastTextIndex = textIndex;
        if (dom.interludeText) {
          dom.interludeText.style.opacity = "0";
          setTimeout(() => {
            if (currentScreen === "interlude-screen") {
              dom.interludeText.textContent = script[textIndex].text;
              dom.interludeText.style.opacity = "1";
            }
          }, 260);
        }
      }

      if (elapsed >= 10.7) {
        if (dom.interludeLight) dom.interludeLight.classList.add("is-on");
        if (dom.btnOpenEyes) dom.btnOpenEyes.classList.remove("is-hidden");
      }
    }, 120);
    interludeTimers.push(interval);

    if (DEBUG_FAST) {
      const fastTimer = setTimeout(() => {
        if (dom.interludeLight) dom.interludeLight.classList.add("is-on");
        if (dom.btnOpenEyes) dom.btnOpenEyes.classList.remove("is-hidden");
      }, 1800);
      interludeTimers.push(fastTimer);
    }
  }

  function clearInterludeTimers() {
    interludeTimers.forEach((timer) => {
      clearInterval(timer);
      clearTimeout(timer);
    });
    interludeTimers = [];
  }

  function openEyes() {
    clearInterludeTimers();
    showFinalDream(showEidji);
  }

  function showDream(index, callback) {
    if (!state) return;
    const dreamIndex = clamp(Number(index) || 1, 1, DATA.DREAM_SEQUENCES.length);
    const sequence = DATA.DREAM_SEQUENCES[dreamIndex - 1];
    state.dreams = Math.max(state.dreams || 0, dreamIndex);
    state.checkpoint = "dream";
    state.flags.dreamFinal = false;
    dreamReturnCallback = typeof callback === "function" ? callback : () => beginDay();
    dreamIsFinal = false;
    dreamTransitioning = false;
    saveGame();
    showScreen("dream-screen");
    if (dom.dreamCount) dom.dreamCount.textContent = "第 " + dreamIndex + " 次梦见白原";
    if (dom.dreamTitle) dom.dreamTitle.textContent = sequence.title;
    if (dom.dreamText) dom.dreamText.textContent = sequence.text;
    if (dom.dreamWhisper) dom.dreamWhisper.textContent = sequence.whisper;
    if (dom.btnDreamContinue) dom.btnDreamContinue.textContent = "醒来 · 第 " + state.day + " 天";
    dom.dreamScreen.classList.toggle("is-final", false);
  }

  function showFinalDream(callback) {
    if (!state) return;
    state.dreams = Math.max(state.dreams || 0, 5);
    state.checkpoint = "dream";
    state.flags.dreamFinal = true;
    dreamReturnCallback = typeof callback === "function" ? callback : showEidji;
    dreamIsFinal = true;
    dreamTransitioning = false;
    saveGame();
    showScreen("dream-screen");
    if (dom.dreamCount) dom.dreamCount.textContent = "白原尽头";
    if (dom.dreamTitle) dom.dreamTitle.textContent = DATA.FINAL_DREAM.title;
    if (dom.dreamText) dom.dreamText.textContent = DATA.FINAL_DREAM.text;
    if (dom.dreamWhisper) dom.dreamWhisper.textContent = DATA.FINAL_DREAM.whisper;
    if (dom.btnDreamContinue) dom.btnDreamContinue.textContent = "睁开眼睛";
    dom.dreamScreen.classList.toggle("is-final", true);
  }

  function continueDream() {
    if (!state || dreamTransitioning) return;
    dreamTransitioning = true;
    const wasFinal = Boolean(state.flags.dreamFinal) || dreamIsFinal;
    const callback = dreamReturnCallback || (wasFinal ? showEidji : beginDay);
    dreamReturnCallback = null;
    dreamIsFinal = false;
    state.flags.dreamFinal = false;
    state.checkpoint = wasFinal ? "eidji" : "chapter";
    state.phase = "story";
    saveGame();
    fadeTo(() => {
      dreamTransitioning = false;
      if (!wasFinal) showScreen("chapter-screen");
      callback();
    }, 450);
  }

  function ensureChapterLoop() {
    if (chapterRaf) cancelAnimationFrame(chapterRaf);
    chapterStartedAt = performance.now();
    const frame = (timestamp) => {
      if (currentScreen !== "chapter-screen") {
        chapterRaf = null;
        return;
      }
      drawChapterFrame(timestamp);
      chapterRaf = requestAnimationFrame(frame);
    };
    chapterRaf = requestAnimationFrame(frame);
  }

  function drawChapterFrame(timestamp) {
    const prepared = prepareCanvas(dom.chapterCanvas);
    if (!prepared || !state) return;
    const ctx = prepared.ctx;
    const width = prepared.width;
    const height = prepared.height;
    const event = DATA.DAILY_EVENTS[state.day] || {};
    const weather = event.weather || "";
    const t = (timestamp - chapterStartedAt) / 1000;

    ctx.clearRect(0, 0, width, height);

    const exploring = state.phase === "action" && explore.active;
    let artDrawn = false;
    if (exploring) {
      artDrawn = drawExploreWorldScene(ctx, width, height, weather, t);
    } else {
      const artKey = state.day >= 16 ? "chapter1Winter" : "chapter1Background";
      artDrawn = drawChapterPanorama(ctx, artImages[artKey], width, height, explore.cameraX || 0);
      if (!artDrawn) {
        drawChapterPlaceholder(ctx, width, height, weather, t);
        if (state.phase !== "story") drawChapterFigures(ctx, width, height, t);
      }
    }

    if (weather.includes("雪") || weather.includes("霜")) {
      drawSnow(ctx, width, height, t, weather.includes("大雪") ? 120 : 58);
    }
    if (weather.includes("雨")) {
      drawRain(ctx, width, height, t);
    }

    const dim = state.stats.spirit < 20 || state.stats.warmth < 25;
    ctx.save();
    ctx.fillStyle = dim ? "rgba(34, 42, 43, 0.27)" : "rgba(15, 17, 15, 0.06)";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    ctx.save();
    ctx.font = "11px 'Microsoft YaHei', sans-serif";
    ctx.fillStyle = "rgba(231,223,207,0.28)";
    if (!artDrawn) {
      ctx.fillText(exploring ? "横向地图 · 镜头跟随 · 美术素材待接入" : "灰盒场景 · 美术素材待接入", 18, height - 18);
    }
    ctx.restore();
  }

  function drawChapterPlaceholder(ctx, width, height, weather, t) {
    const cold = state.day >= 16 || weather.includes("雪");
    const horizon = height * 0.64;
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    if (cold) {
      sky.addColorStop(0, "#3b4241");
      sky.addColorStop(0.55, "#5c6260");
      sky.addColorStop(1, "#87847a");
    } else {
      sky.addColorStop(0, "#303632");
      sky.addColorStop(0.65, "#59605a");
      sky.addColorStop(1, "#807c6d");
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    const haze = ctx.createRadialGradient(width * 0.62, height * 0.28, 10, width * 0.62, height * 0.28, width * 0.55);
    haze.addColorStop(0, "rgba(221,214,197,0.18)");
    haze.addColorStop(1, "rgba(221,214,197,0)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, width, height);

    drawMountains(ctx, width, horizon, cold);

    ctx.fillStyle = cold ? "#ddd7c8" : "#4a493f";
    ctx.fillRect(0, horizon, width, height - horizon);
    ctx.fillStyle = cold ? "rgba(237,232,219,0.16)" : "rgba(201,190,166,0.08)";
    ctx.fillRect(0, horizon, width, 3);

    drawTemple(ctx, width, height, horizon, cold, t);

    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = "#d8d0be";
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i += 1) {
      const y = horizon + 20 + i * 24;
      ctx.beginPath();
      ctx.moveTo(width * 0.05, y);
      ctx.bezierCurveTo(width * 0.3, y - 10, width * 0.7, y + 11, width * 0.96, y - 3);
      ctx.stroke();
    }
    ctx.restore();
  }


  function drawExploreWorldScene(ctx, width, height, weather, t) {
    const cameraX = explore.cameraX || 0;
    const artKey = state.day >= 16 ? "chapter1Winter" : "chapter1Background";
    if (drawChapterPanorama(ctx, artImages[artKey], width, height, cameraX)) {
      return true;
    }
    const cold = state.day >= 16 || weather.includes("雪");
    const horizon = height * 0.63;
    const baseY = height * 0.80;

    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    if (cold) {
      sky.addColorStop(0, "#3c4443");
      sky.addColorStop(0.62, "#69706c");
      sky.addColorStop(1, "#a09a8b");
    } else {
      sky.addColorStop(0, "#2d3430");
      sky.addColorStop(0.58, "#59605a");
      sky.addColorStop(1, "#89806d");
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    const haze = ctx.createRadialGradient(width * 0.56, height * 0.24, 8, width * 0.56, height * 0.24, width * 0.65);
    haze.addColorStop(0, "rgba(224,216,199,0.2)");
    haze.addColorStop(1, "rgba(224,216,199,0)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, width, height);

    const parallax = cameraX * 0.18;
    ctx.save();
    ctx.fillStyle = cold ? "rgba(64,70,68,0.5)" : "rgba(53,61,55,0.44)";
    for (let i = -1; i < 7; i += 1) {
      const offset = (i * 430 - (parallax % 430));
      ctx.beginPath();
      ctx.moveTo(offset, horizon);
      ctx.lineTo(offset + 145, horizon - 78);
      ctx.lineTo(offset + 265, horizon - 28);
      ctx.lineTo(offset + 400, horizon - 92);
      ctx.lineTo(offset + 535, horizon);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    ctx.fillStyle = cold ? "#d9d3c5" : "#535248";
    ctx.fillRect(0, horizon, width, height - horizon);
    const pathGradient = ctx.createLinearGradient(0, horizon + 45, 0, height);
    pathGradient.addColorStop(0, cold ? "rgba(198,193,180,0.28)" : "rgba(164,151,123,0.18)");
    pathGradient.addColorStop(1, cold ? "rgba(128,125,116,0.34)" : "rgba(93,82,65,0.32)");
    ctx.fillStyle = pathGradient;
    ctx.beginPath();
    ctx.moveTo(0, horizon + 82);
    ctx.bezierCurveTo(width * 0.28, horizon + 55, width * 0.64, horizon + 108, width, horizon + 68);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    ctx.save();
    ctx.strokeStyle = cold ? "rgba(244,239,229,0.22)" : "rgba(231,223,207,0.12)";
    ctx.lineWidth = 1;
    for (let worldX = Math.floor(cameraX / 150) * 150 - 150; worldX < cameraX + width + 150; worldX += 150) {
      const screenX = worldX - cameraX;
      ctx.beginPath();
      ctx.moveTo(screenX, horizon + 95);
      ctx.lineTo(screenX + 4, height);
      ctx.stroke();
    }
    ctx.restore();

    DATA.MAP_LOCATIONS.forEach((location) => {
      const layout = getExploreLayout(location.id);
      const screenX = layout.x - cameraX;
      if (screenX < -260 || screenX > width + 260) return;
      drawExploreWorldLandmark(ctx, location, screenX, baseY, cold, t);
    });

    ctx.save();
    ctx.fillStyle = "rgba(20,22,19,0.2)";
    ctx.fillRect(0, baseY - 2, width, 4);
    ctx.restore();
    return false;
  }

  function drawExploreWorldLandmark(ctx, location, x, baseY, cold, t) {
    const scale = 1;
    ctx.save();
    ctx.translate(x, baseY);
    ctx.scale(scale, scale);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(231,223,207,0.16)";
    ctx.fillStyle = cold ? "#383c39" : "#373a34";

    if (location.id === "canteen") {
      ctx.fillRect(-72, -72, 144, 72);
      ctx.fillStyle = cold ? "#303431" : "#2e312d";
      ctx.beginPath();
      ctx.moveTo(-88, -72);
      ctx.lineTo(-52, -104);
      ctx.lineTo(52, -104);
      ctx.lineTo(88, -72);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(13,14,12,0.7)";
      ctx.fillRect(-16, -48, 32, 48);
      ctx.fillStyle = "rgba(205,166,109,0.22)";
      ctx.fillRect(28, -55, 18, 17);
      ctx.strokeStyle = "rgba(229,224,211,0.14)";
      ctx.beginPath();
      ctx.moveTo(48, -103);
      ctx.lineTo(48, -132);
      ctx.stroke();
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.arc(48 + Math.sin(t * 0.8 + i) * 5, -140 - i * 12, 7 + i * 2, Math.PI, Math.PI * 1.8);
        ctx.stroke();
      }
    } else if (location.id === "hall") {
      ctx.fillRect(-118, -84, 236, 84);
      ctx.fillStyle = cold ? "#2f3330" : "#30322e";
      ctx.beginPath();
      ctx.moveTo(-160, -84);
      ctx.lineTo(-92, -132);
      ctx.lineTo(92, -132);
      ctx.lineTo(160, -84);
      ctx.lineTo(128, -94);
      ctx.lineTo(-128, -94);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(12,13,11,0.74)";
      ctx.fillRect(-70, -88, 38, 88);
      ctx.fillRect(32, -88, 38, 88);
      ctx.fillStyle = "rgba(204,166,109,0.22)";
      ctx.fillRect(-10, -58, 20, 30);
    } else if (location.id === "dorm") {
      ctx.fillRect(-98, -58, 196, 58);
      ctx.beginPath();
      ctx.moveTo(-112, -58);
      ctx.lineTo(-74, -82);
      ctx.lineTo(74, -82);
      ctx.lineTo(112, -58);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(13,14,12,0.64)";
      ctx.fillRect(-78, -34, 27, 34);
      ctx.fillRect(28, -34, 27, 34);
    } else if (location.id === "field") {
      ctx.fillStyle = cold ? "rgba(207,204,191,0.28)" : "rgba(94,105,77,0.52)";
      for (let row = 0; row < 4; row += 1) {
        for (let col = 0; col < 8; col += 1) {
          const fx = -112 + col * 30 + (row % 2) * 8;
          const fy = -4 - row * 4;
          ctx.beginPath();
          ctx.moveTo(fx, fy);
          ctx.lineTo(fx - 6, fy - 16 - (col % 3) * 4);
          ctx.lineTo(fx + 1, fy - 10);
          ctx.lineTo(fx + 7, fy - 18);
          ctx.strokeStyle = cold ? "rgba(223,219,205,0.22)" : "rgba(148,161,119,0.42)";
          ctx.stroke();
        }
      }
    } else if (location.id === "river" || location.id === "iceRiver") {
      ctx.fillStyle = cold ? "rgba(173,200,204,0.13)" : "rgba(81,108,111,0.32)";
      ctx.beginPath();
      ctx.ellipse(0, -6, 146, 23, -0.04, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = cold ? "rgba(231,240,237,0.28)" : "rgba(177,202,200,0.22)";
      for (let i = 0; i < 5; i += 1) {
        ctx.beginPath();
        ctx.moveTo(-92 + i * 43, -8 + Math.sin(t + i) * 2);
        ctx.lineTo(-62 + i * 43, -12 + Math.cos(t + i) * 2);
        ctx.stroke();
      }
    } else if (location.id === "elm") {
      ctx.fillStyle = cold ? "#34362f" : "#3b382e";
      ctx.fillRect(-11, -132, 22, 132);
      ctx.strokeStyle = cold ? "#34362f" : "#3b382e";
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(0, -104);
      ctx.lineTo(-42, -145);
      ctx.moveTo(0, -116);
      ctx.lineTo(37, -154);
      ctx.moveTo(-30, -135);
      ctx.lineTo(-58, -161);
      ctx.moveTo(27, -143);
      ctx.lineTo(50, -174);
      ctx.stroke();
      ctx.strokeStyle = "rgba(231,223,207,0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, -158, 69, 0, Math.PI * 2);
      ctx.stroke();
    } else if (location.id === "grassStack") {
      ctx.fillStyle = cold ? "rgba(194,182,156,0.3)" : "rgba(148,126,83,0.55)";
      for (let i = 0; i < 3; i += 1) {
        const hx = -70 + i * 70;
        ctx.beginPath();
        ctx.moveTo(hx - 27, 0);
        ctx.lineTo(hx - 16, -58);
        ctx.lineTo(hx + 16, -58);
        ctx.lineTo(hx + 27, 0);
        ctx.closePath();
        ctx.fill();
      }
    } else if (location.id === "hill") {
      ctx.fillStyle = cold ? "rgba(98,104,101,0.45)" : "rgba(74,83,70,0.46)";
      ctx.beginPath();
      ctx.moveTo(-150, 0);
      ctx.lineTo(-62, -82);
      ctx.lineTo(2, -104);
      ctx.lineTo(70, -62);
      ctx.lineTo(150, 0);
      ctx.closePath();
      ctx.fill();
    } else {
      const buildings = location.id === "market" ? 4 : 2;
      for (let i = 0; i < buildings; i += 1) {
        const bx = -104 + i * 58;
        const bh = 42 + (i % 3) * 12;
        ctx.fillStyle = cold ? "#383c39" : "#373a34";
        ctx.fillRect(bx, -bh, 46, bh);
        ctx.fillStyle = cold ? "#2e3330" : "#2c302b";
        ctx.beginPath();
        ctx.moveTo(bx - 7, -bh);
        ctx.lineTo(bx + 10, -bh - 18);
        ctx.lineTo(bx + 53, -bh - 18);
        ctx.lineTo(bx + 53, -bh);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.fillStyle = "rgba(12,13,11,0.24)";
    ctx.beginPath();
    ctx.ellipse(0, 2, location.id === "river" || location.id === "iceRiver" ? 130 : 80, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.font = "10px 'Microsoft YaHei', sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(231,223,207,0.28)";
    ctx.fillText(location.name, x, baseY + 19);
    ctx.restore();
  }
  function drawMountains(ctx, width, horizon, cold) {
    ctx.save();
    ctx.fillStyle = cold ? "rgba(58,62,61,0.52)" : "rgba(55,61,54,0.42)";
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    ctx.lineTo(width * 0.12, horizon - 62);
    ctx.lineTo(width * 0.25, horizon - 20);
    ctx.lineTo(width * 0.39, horizon - 78);
    ctx.lineTo(width * 0.54, horizon - 28);
    ctx.lineTo(width * 0.7, horizon - 68);
    ctx.lineTo(width * 0.84, horizon - 30);
    ctx.lineTo(width, horizon - 54);
    ctx.lineTo(width, horizon);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawTemple(ctx, width, height, horizon, cold, t) {
    const baseX = width * 0.53;
    const baseY = horizon + 18;
    const scale = Math.min(width / 1000, height / 600);
    ctx.save();
    ctx.translate(baseX, baseY);
    ctx.scale(scale, scale);
    ctx.fillStyle = cold ? "#3b3d39" : "#393b35";
    ctx.fillRect(-150, -100, 300, 125);
    ctx.fillStyle = "rgba(13,14,12,0.72)";
    ctx.fillRect(-82, -105, 44, 130);
    ctx.fillRect(38, -105, 44, 130);
    ctx.fillStyle = cold ? "#2f312d" : "#30322d";
    ctx.beginPath();
    ctx.moveTo(-205, -100);
    ctx.lineTo(-125, -160);
    ctx.lineTo(125, -160);
    ctx.lineTo(205, -100);
    ctx.lineTo(162, -112);
    ctx.lineTo(-162, -112);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(210,199,177,0.13)";
    ctx.beginPath();
    ctx.moveTo(-125, -160);
    ctx.lineTo(0, -190);
    ctx.lineTo(125, -160);
    ctx.lineTo(96, -151);
    ctx.lineTo(0, -176);
    ctx.lineTo(-96, -151);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(210,173,113,0.18)";
    const glow = 0.65 + Math.sin(t * 1.3) * 0.12;
    ctx.globalAlpha = glow;
    ctx.fillRect(-13, -82, 26, 38);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(226,217,198,0.14)";
    ctx.strokeRect(-150, -100, 300, 125);
    ctx.restore();

    ctx.fillStyle = "rgba(15,16,14,0.22)";
    ctx.fillRect(0, horizon + 40, width, 5);
  }
  function drawChapterFigures(ctx, width, height, t) {
    const ground = height * 0.81;
    ctx.save();
    const figureX = width * 0.38;
    const bob = Math.sin(t * 1.2) * 1.2;
    ctx.fillStyle = "rgba(10,11,10,0.74)";
    ctx.beginPath();
    ctx.arc(figureX, ground - 54 + bob, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(figureX - 12, ground - 42 + bob);
    ctx.quadraticCurveTo(figureX, ground - 54 + bob, figureX + 12, ground - 42 + bob);
    ctx.lineTo(figureX + 15, ground - 4);
    ctx.lineTo(figureX - 16, ground - 4);
    ctx.closePath();
    ctx.fill();

    if (state.phase === "final") {
      const childX = width * 0.58;
      ctx.fillStyle = "rgba(10,11,10,0.78)";
      ctx.beginPath();
      ctx.ellipse(childX, ground - 27, 18, 30, 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(childX - 10, ground - 58, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(190,147,94,0.28)";
      ctx.beginPath();
      ctx.arc(childX + 18, ground - 18, 14, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const childX = width * 0.62;
      ctx.globalAlpha = state.stoneDead ? 0.3 : 0.52;
      ctx.fillStyle = "rgba(10,11,10,0.7)";
      ctx.beginPath();
      ctx.arc(childX, ground - 35, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(childX - 8, ground - 27);
      ctx.lineTo(childX + 8, ground - 27);
      ctx.lineTo(childX + 10, ground - 2);
      ctx.lineTo(childX - 10, ground - 2);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawSnow(ctx, width, height, t, count) {
    ctx.save();
    for (let i = 0; i < count; i += 1) {
      const seed = i * 12.9898;
      const normalized = ((Math.sin(seed) * 43758.5453) % 1 + 1) % 1;
      const speed = 18 + ((Math.sin(seed * 2.1) + 1) * 0.5) * 45;
      const y = ((((Math.sin(seed * 3.7) + 1) * 0.5) * height) + t * speed) % (height + 12);
      const size = i % 7 === 0 ? 2 : 1;
      ctx.fillStyle = "rgba(245,242,233," + (0.18 + (i % 5) * 0.05) + ")";
      ctx.fillRect(normalized * width, y - 6, size, size);
    }
    ctx.restore();
  }

  function drawRain(ctx, width, height, t) {
    ctx.save();
    ctx.strokeStyle = "rgba(210,220,218,0.16)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 45; i += 1) {
      const seed = i * 9.17;
      const normalized = ((Math.sin(seed) * 43758.5453) % 1 + 1) % 1;
      const x = normalized * width;
      const y = ((((Math.sin(seed * 2.3) + 1) * 0.5) * height) + t * 120) % height;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 5, y + 16);
      ctx.stroke();
    }
    ctx.restore();
  }
  function createEidjiRuntime() {
    return {
      active: false,
      startedAt: 0,
      lastTimestamp: 0,
      duration: 45000,
      raf: null,
      beds: [],
      player: { x: 0, y: 0, targetX: null, targetY: null },
      keys: Object.create(null),
      spawnAccumulator: 0,
      spawnInterval: 1.65,
      assistantTimer: 0,
      assistantRescues: 0,
      resolved: 0,
      cries: 0,
      layoutWidth: 0,
      layoutHeight: 0,
      keyDownHandler: null,
      keyUpHandler: null,
      clickHandler: null,
      needTypes: [
        { type: "milk", label: "奶", color: "#c6a06e" },
        { type: "diaper", label: "尿", color: "#8d9a87" },
        { type: "blanket", label: "被", color: "#9a8f7e" },
        { type: "soothe", label: "哄", color: "#b08b73" },
        { type: "burp", label: "嗝", color: "#8c8272" }
      ]
    };
  }

  function showEidji() {
    if (!state) return;
    state.checkpoint = "eidji";
    saveGame();
    showScreen("eidji-screen");
    if (dom.eidjiStart) dom.eidjiStart.classList.remove("is-hidden");
    if (dom.eidjiResult) dom.eidjiResult.classList.add("is-hidden");
    if (dom.nightProgressText) dom.nightProgressText.textContent = "00:00 / 00:" + (DEBUG_FAST ? "12" : "45");
    if (dom.nightProgressBar) dom.nightProgressBar.style.width = "0%";
    eidji = createEidjiRuntime();
    requestAnimationFrame(() => {
      if (eidji.active) return;
      const prepared = prepareCanvas(dom.eidjiCanvas);
      if (!prepared) return;
      layoutEidjiBeds(prepared.width, prepared.height, true);
      drawEidjiScene(performance.now(), true);
    });
  }

  function startNight() {
    if (!eidji || eidji.active) return;
    const prepared = prepareCanvas(dom.eidjiCanvas);
    if (!prepared) return;

    eidji.active = true;
    eidji.startedAt = performance.now();
    eidji.lastTimestamp = eidji.startedAt;
    eidji.duration = DEBUG_FAST ? 12000 : 45000;
    eidji.spawnAccumulator = 0;
    eidji.spawnInterval = 1.6;
    eidji.assistantTimer = 0;
    eidji.assistantRescues = 0;
    eidji.resolved = 0;
    eidji.cries = 0;
    eidji.keys = Object.create(null);

    layoutEidjiBeds(prepared.width, prepared.height, true);

    if (dom.eidjiStart) dom.eidjiStart.classList.add("is-hidden");
    if (dom.eidjiResult) dom.eidjiResult.classList.add("is-hidden");

    eidji.keyDownHandler = (event) => {
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
        event.preventDefault();
      }
      eidji.keys[key] = true;
      if (key === " " && eidji.player.targetX === null) {
        tryResolveNearestNeed();
      }
    };
    eidji.keyUpHandler = (event) => {
      eidji.keys[event.key.toLowerCase()] = false;
    };
    eidji.clickHandler = (event) => {
      const rect = dom.eidjiCanvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      let closest = null;
      let closestDistance = Infinity;
      eidji.beds.forEach((bed) => {
        const dx = x - bed.x;
        const dy = y - bed.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < closestDistance) {
          closestDistance = distance;
          closest = bed;
        }
      });
      if (closest && closestDistance <= closest.r * 2.8) {
        eidji.player.targetX = closest.x;
        eidji.player.targetY = closest.y;
      }
    };

    window.addEventListener("keydown", eidji.keyDownHandler);
    window.addEventListener("keyup", eidji.keyUpHandler);
    dom.eidjiCanvas.addEventListener("pointerdown", eidji.clickHandler);

    spawnNeedAt(randomFreeBed(), true);
    spawnNeedAt(randomFreeBed(), true);
    eidji.raf = requestAnimationFrame(eidjiLoop);
  }

  function layoutEidjiBeds(width, height, resetPlayer) {
    const centerX = width * 0.5;
    const centerY = height * 0.5 + Math.min(28, height * 0.04);
    const radius = Math.max(78, Math.min(width, height) * 0.34);
    const bedRadius = clamp(Math.min(width, height) * 0.025, 12, 23);
    const previous = eidji.beds.length;
    eidji.beds = [];

    for (let index = 0; index < 28; index += 1) {
      const angle = -Math.PI / 2 + (index / 28) * Math.PI * 2;
      eidji.beds.push({
        index,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        r: bedRadius,
        need: null,
        flash: 0,
        calm: 0
      });
    }

    if (resetPlayer || previous !== 28) {
      eidji.player.x = centerX;
      eidji.player.y = centerY;
      eidji.player.targetX = null;
      eidji.player.targetY = null;
    } else {
      eidji.player.x = clamp(eidji.player.x, 24, width - 24);
      eidji.player.y = clamp(eidji.player.y, 24, height - 24);
    }
    eidji.layoutWidth = width;
    eidji.layoutHeight = height;
  }

  function randomFreeBed() {
    const free = eidji.beds.filter((bed) => !bed.need);
    if (!free.length) {
      const nonCrying = eidji.beds.filter((bed) => bed.need && !bed.need.crying);
      return nonCrying.length ? nonCrying[Math.floor(Math.random() * nonCrying.length)] : eidji.beds[Math.floor(Math.random() * eidji.beds.length)];
    }
    return free[Math.floor(Math.random() * free.length)];
  }

  function spawnNeedAt(bed, urgent) {
    if (!bed) return;
    const template = eidji.needTypes[Math.floor(Math.random() * eidji.needTypes.length)];
    const life = urgent ? 7.5 : lerp(12, 8.5, clamp((performance.now() - eidji.startedAt) / eidji.duration, 0, 1));
    bed.need = {
      type: template.type,
      label: template.label,
      color: template.color,
      timer: life,
      max: life,
      crying: false
    };
    bed.flash = 1;
  }

  function tryResolveNearestNeed() {
    let nearest = null;
    let nearestDistance = Infinity;
    eidji.beds.forEach((bed) => {
      if (!bed.need) return;
      const dx = bed.x - eidji.player.x;
      const dy = bed.y - eidji.player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = bed;
      }
    });
    if (nearest && nearestDistance <= nearest.r + 34) {
      resolveBedNeed(nearest);
    }
  }

  function resolveBedNeed(bed) {
    if (!bed || !bed.need) return;
    bed.need = null;
    bed.calm = 1.2;
    eidji.resolved += 1;
  }
  function eidjiLoop(timestamp) {
    if (!eidji.active) return;
    const prepared = prepareCanvas(dom.eidjiCanvas);
    if (!prepared) {
      eidji.raf = requestAnimationFrame(eidjiLoop);
      return;
    }

    if (Math.abs(prepared.width - eidji.layoutWidth) > 2 || Math.abs(prepared.height - eidji.layoutHeight) > 2) {
      layoutEidjiBeds(prepared.width, prepared.height, false);
    }

    const dt = clamp((timestamp - eidji.lastTimestamp) / 1000, 0, 0.06);
    eidji.lastTimestamp = timestamp;
    const elapsed = (timestamp - eidji.startedAt) / 1000;

    if (elapsed >= eidji.duration / 1000) {
      endNight();
      return;
    }

    updateEidjiPlayer(dt);
    updateEidjiBeds(dt, elapsed);
    updateNightProgress(elapsed);
    drawEidjiScene(timestamp, false);
    eidji.raf = requestAnimationFrame(eidjiLoop);
  }

  function updateEidjiPlayer(dt) {
    const keys = eidji.keys;
    let moveX = 0;
    let moveY = 0;
    if (keys.a || keys.arrowleft) moveX -= 1;
    if (keys.d || keys.arrowright) moveX += 1;
    if (keys.w || keys.arrowup) moveY -= 1;
    if (keys.s || keys.arrowdown) moveY += 1;

    if (moveX || moveY) {
      eidji.player.targetX = null;
      eidji.player.targetY = null;
      const length = Math.sqrt(moveX * moveX + moveY * moveY);
      moveX /= length;
      moveY /= length;
      const speed = 240;
      eidji.player.x += moveX * speed * dt;
      eidji.player.y += moveY * speed * dt;
    } else if (eidji.player.targetX !== null && eidji.player.targetY !== null) {
      const dx = eidji.player.targetX - eidji.player.x;
      const dy = eidji.player.targetY - eidji.player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < 4) {
        eidji.player.targetX = null;
        eidji.player.targetY = null;
      } else {
        const speed = 285;
        eidji.player.x += (dx / distance) * Math.min(distance, speed * dt);
        eidji.player.y += (dy / distance) * Math.min(distance, speed * dt);
      }
    }

    eidji.player.x = clamp(eidji.player.x, 24, eidji.layoutWidth - 24);
    eidji.player.y = clamp(eidji.player.y, 74, eidji.layoutHeight - 24);

    let nearest = null;
    let nearestDistance = Infinity;
    eidji.beds.forEach((bed) => {
      if (!bed.need) return;
      const dx = bed.x - eidji.player.x;
      const dy = bed.y - eidji.player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = bed;
      }
    });
    if (nearest && nearestDistance <= nearest.r + 14) {
      resolveBedNeed(nearest);
    }
  }

  function updateEidjiBeds(dt, elapsed) {
    eidji.beds.forEach((bed) => {
      bed.flash = Math.max(0, bed.flash - dt * 2.4);
      bed.calm = Math.max(0, bed.calm - dt);
      if (!bed.need || bed.need.crying) return;

      bed.need.timer -= dt;
      if (bed.need.timer <= 0) {
        bed.need.crying = true;
        bed.need.label = "哭";
        bed.need.timer = 5.5;
        bed.need.max = 5.5;
        eidji.cries += 1;
        wakeNeighborNeeds(bed.index);
      }
    });

    eidji.spawnAccumulator += dt;
    eidji.spawnInterval = lerp(1.6, 0.72, clamp(elapsed / (eidji.duration / 1000), 0, 1));
    if (eidji.spawnAccumulator >= eidji.spawnInterval) {
      eidji.spawnAccumulator = 0;
      const free = eidji.beds.filter((bed) => !bed.need);
      if (free.length > 3) {
        spawnNeedAt(free[Math.floor(Math.random() * free.length)], false);
      }
    }

    eidji.assistantTimer += dt;
    const rescueAt = DEBUG_FAST ? 4 : 15;
    if (eidji.assistantTimer >= rescueAt) {
      eidji.assistantTimer = 0;
      const crying = eidji.beds.find((bed) => bed.need && bed.need.crying);
      if (crying) {
        resolveBedNeed(crying);
        eidji.assistantRescues += 1;
        showToast("萨仁默默接过了最闹的那个孩子。");
      }
    }
  }

  function wakeNeighborNeeds(index) {
    const neighbors = [
      (index + 27) % 28,
      (index + 1) % 28
    ];
    neighbors.forEach((neighborIndex, offset) => {
      const neighbor = eidji.beds[neighborIndex];
      if (!neighbor || neighbor.need) return;
      setTimeout(() => {
        if (eidji.active && !neighbor.need) {
          spawnNeedAt(neighbor, offset === 0);
          neighbor.flash = 1.4;
        }
      }, 250 + offset * 180);
    });
  }

  function updateNightProgress(elapsedSeconds) {
    const total = eidji.duration / 1000;
    const value = clamp(elapsedSeconds / total, 0, 1);
    if (dom.nightProgressBar) dom.nightProgressBar.style.width = (value * 100) + "%";
    if (dom.nightProgressText) {
      dom.nightProgressText.textContent = formatClock(elapsedSeconds) + " / " + formatClock(total);
    }
  }

  function formatClock(seconds) {
    const safe = Math.max(0, Math.floor(seconds));
    return "00:" + String(safe).padStart(2, "0");
  }

  function drawEidjiScene(timestamp, idle) {
    const prepared = prepareCanvas(dom.eidjiCanvas);
    if (!prepared) return;
    const ctx = prepared.ctx;
    const width = prepared.width;
    const height = prepared.height;

    if (!eidji.beds.length || Math.abs(width - eidji.layoutWidth) > 2 || Math.abs(height - eidji.layoutHeight) > 2) {
      layoutEidjiBeds(width, height, true);
    }

    ctx.clearRect(0, 0, width, height);
    const background = ctx.createRadialGradient(width * 0.5, height * 0.48, 20, width * 0.5, height * 0.48, Math.max(width, height) * 0.72);
    background.addColorStop(0, "#3d3225");
    background.addColorStop(0.48, "#211b15");
    background.addColorStop(1, "#0e0c09");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    const centerX = width * 0.5;
    const centerY = height * 0.5 + Math.min(28, height * 0.04);
    const radius = Math.max(78, Math.min(width, height) * 0.34);

    ctx.save();
    ctx.strokeStyle = "rgba(210,184,139,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radius, radius, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radius * 0.72, radius * 0.72, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radius * 0.38, radius * 0.38, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    const pulse = 0.5 + Math.sin((timestamp || performance.now()) / 280) * 0.5;
    eidji.beds.forEach((bed) => {
      ctx.save();
      if (bed.need) {
        const crying = bed.need.crying;
        ctx.fillStyle = crying ? "rgba(156,74,61,0.32)" : "rgba(199,166,110,0.18)";
        ctx.beginPath();
        ctx.arc(bed.x, bed.y, bed.r + 7 + pulse * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = bed.need ? bed.need.color : "rgba(211,195,165,0.14)";
      ctx.beginPath();
      ctx.arc(bed.x, bed.y, bed.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = bed.need && bed.need.crying ? "rgba(230,153,131,0.9)" : "rgba(235,222,196,0.22)";
      ctx.lineWidth = bed.need && bed.need.crying ? 2 : 1;
      ctx.stroke();

      if (bed.need) {
        ctx.fillStyle = "#191713";
        ctx.font = "bold " + Math.max(10, bed.r * 0.8) + "px 'Microsoft YaHei', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(bed.need.label, bed.x, bed.y + 1);
      } else {
        ctx.fillStyle = "rgba(235,222,196,0.22)";
        ctx.beginPath();
        ctx.arc(bed.x, bed.y, Math.max(3, bed.r * 0.25), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    const px = eidji.player.x;
    const py = eidji.player.y;
    const playerGlow = ctx.createRadialGradient(px, py, 2, px, py, 48);
    playerGlow.addColorStop(0, "rgba(226,188,126,0.3)");
    playerGlow.addColorStop(1, "rgba(226,188,126,0)");
    ctx.fillStyle = playerGlow;
    ctx.beginPath();
    ctx.arc(px, py, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d7bd8e";
    ctx.beginPath();
    ctx.arc(px, py, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(34,27,19,0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + 18, py);
    ctx.stroke();

    if (eidji.player.targetX !== null) {
      ctx.strokeStyle = "rgba(215,189,142,0.3)";
      ctx.setLineDash([4, 7]);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(eidji.player.targetX, eidji.player.targetY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (!idle && eidji.active) {
      ctx.save();
      ctx.fillStyle = "rgba(10,9,7,0.45)";
      ctx.fillRect(width - 158, height - 54, 138, 34);
      ctx.fillStyle = "rgba(232,218,193,0.55)";
      ctx.font = "11px 'Microsoft YaHei', sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("需求 " + eidji.beds.filter((bed) => bed.need).length + " · 安静 " + eidji.resolved + " · 哭声 " + eidji.cries, width - 146, height - 32);
      ctx.restore();
    }

    ctx.fillStyle = "rgba(231,223,207,0.2)";
    ctx.font = "11px 'Microsoft YaHei', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("灰盒俯视场景 · 28 张小床", 18, height - 18);
  }

  function stopNightLoop(removeListeners) {
    if (eidji.raf) cancelAnimationFrame(eidji.raf);
    eidji.raf = null;
    eidji.active = false;
    if (removeListeners !== false) {
      if (eidji.keyDownHandler) window.removeEventListener("keydown", eidji.keyDownHandler);
      if (eidji.keyUpHandler) window.removeEventListener("keyup", eidji.keyUpHandler);
      if (eidji.clickHandler) dom.eidjiCanvas.removeEventListener("pointerdown", eidji.clickHandler);
      eidji.keyDownHandler = null;
      eidji.keyUpHandler = null;
      eidji.clickHandler = null;
    }
  }

  function endNight() {
    stopNightLoop(true);
    if (dom.nightProgressBar) dom.nightProgressBar.style.width = "100%";
    drawEidjiScene(performance.now(), true);
    state.checkpoint = "eidji";
    saveGame();
    if (dom.eidjiResult) dom.eidjiResult.classList.remove("is-hidden");
    setTimeout(() => {
      if (dom.btnEidjiContinue) dom.btnEidjiContinue.focus();
    }, 100);
  }
  function startEnding() {
    closeModal();
    clearInterludeTimers();
    unlockArchive("archive-3");
    state.checkpoint = "ending";
    saveGame();
    showScreen("ending-screen");
    endingIndex = 0;
    if (dom.lightEnding) dom.lightEnding.classList.add("is-hidden");
    if (dom.callbackCard) dom.callbackCard.classList.remove("is-hidden");
    renderEndingCard();
  }

  function getAnswerForQuestion(question, index) {
    return state.prologueAnswers[index] || {
      questionId: question.id,
      optionId: question.options[0].id,
      text: question.options[0].text,
      rational: question.options[0].rational
    };
  }

  function renderEndingFaces() {
    if (!state || !dom.endingFaces) return;
    dom.endingFaces.innerHTML = "";
    DATA.NPC_PROFILES
      .slice()
      .sort((a, b) => (state.bonds[b.id] || 0) - (state.bonds[a.id] || 0))
      .forEach((profile) => {
        const points = state.bonds[profile.id] || 0;
        const level = getBondLevel(points);
        const card = document.createElement("div");
        card.className = "ending-face";
        const mark = document.createElement("span");
        mark.textContent = profile.mark;
        const name = document.createElement("strong");
        name.textContent = profile.name;
        const note = document.createElement("small");
        note.textContent = level.name + " · " + profile.symbol;
        card.appendChild(mark);
        card.appendChild(name);
        card.appendChild(note);
        dom.endingFaces.appendChild(card);
      });
  }

  function renderEndingCard() {
    if (!state || !dom.callbackContent) return;
    const all = DATA.PROLOGUE_QUESTIONS;

    if (endingIndex < all.length) {
      const question = all[endingIndex];
      const answer = getAnswerForQuestion(question, endingIndex);
      dom.callbackEyebrow.textContent = "终章 · 选项回扣 " + (endingIndex + 1) + " / " + all.length;
      dom.endingHeading.textContent = "你觉得不可能有人选的那些答案";
      dom.callbackContent.innerHTML = "";

      const q = document.createElement("p");
      q.className = "callback-question";
      q.textContent = question.question;

      const compare = document.createElement("div");
      compare.className = "answer-compare";

      const yours = document.createElement("div");
      yours.className = "answer-box";
      yours.innerHTML = "<span class=\"answer-label\">你当初选择了</span>";
      const yourText = document.createElement("p");
      yourText.textContent = answer.text;
      yours.appendChild(yourText);

      const real = document.createElement("div");
      real.className = "answer-box answer-real";
      real.innerHTML = "<span class=\"answer-label\">草原人民用一生回答</span>";
      const realText = document.createElement("p");
      realText.textContent = question.realAnswer;
      real.appendChild(realText);

      compare.appendChild(yours);
      compare.appendChild(real);

      const fact = document.createElement("p");
      fact.className = "fact-line";
      fact.textContent = question.fact;

      dom.callbackContent.appendChild(q);
      dom.callbackContent.appendChild(compare);
      dom.callbackContent.appendChild(fact);

      dom.callbackActions.innerHTML = "";
      const next = document.createElement("button");
      next.type = "button";
      next.className = "menu-button menu-button-primary";
      next.textContent = endingIndex === all.length - 1 ? "看见全部回答" : "下一页";
      next.addEventListener("click", () => {
        endingIndex += 1;
        renderEndingCard();
      });
      dom.callbackActions.appendChild(next);
      return;
    }

    dom.callbackEyebrow.textContent = "终章 · 最后一问";
    dom.endingHeading.textContent = "有人用一生，把那些答案全都选了";
    dom.callbackContent.innerHTML = "";

    const summary = document.createElement("div");
    summary.className = "callback-summary";
    summary.textContent = "你觉得不可能有人选的那些答案，\n有人用一生，把它们全都选了。\n她叫都贵玛。那一年，她 19 岁。\n在她身后，还有三千个草原家庭。";
    dom.callbackContent.appendChild(summary);

    if (!state.flags.waitedAtFinal) {
      const finalQuestion = document.createElement("p");
      finalQuestion.className = "final-question";
      finalQuestion.textContent = "现在，轮到你了。\n你愿意接过这份传承，成为他们中的一员吗？";
      dom.callbackContent.appendChild(finalQuestion);
    } else {
      const wait = document.createElement("p");
      wait.className = "final-wait";
      wait.textContent = "他们会等你。";
      dom.callbackContent.appendChild(wait);
    }

    dom.callbackActions.innerHTML = "";
    if (state.flags.waitedAtFinal) {
      const again = document.createElement("button");
      again.type = "button";
      again.className = "menu-button";
      again.textContent = "回到最后一问";
      again.addEventListener("click", () => {
        state.flags.waitedAtFinal = false;
        renderEndingCard();
      });
      dom.callbackActions.appendChild(again);
    } else {
      const yes = document.createElement("button");
      yes.type = "button";
      yes.className = "menu-button menu-button-primary";
      yes.textContent = "我愿意";
      yes.addEventListener("click", chooseWilling);
      const later = document.createElement("button");
      later.type = "button";
      later.className = "menu-button";
      later.textContent = "我再想想";
      later.addEventListener("click", () => {
        state.flags.waitedAtFinal = true;
        saveGame();
        renderEndingCard();
      });
      dom.callbackActions.appendChild(yes);
      dom.callbackActions.appendChild(later);
    }
  }

  function chooseWilling() {
    if (!state) return;
    state.flags.acceptedLight = true;
    addAchievement("next-light");
    if (state.prologueAnswers.length === DATA.PROLOGUE_QUESTIONS.length && state.prologueAnswers.every((answer) => answer.rational)) {
      addAchievement("honest");
    }
    if (state.bond >= 8 || state.kindness >= 6) {
      addAchievement("half-bowl");
    }
    if (state.dreams >= 5) addAchievement("white-plain");
    if (Object.values(state.bonds).every((points) => points >= 3)) addAchievement("all-faces");
    if (Object.values(state.bonds).every((points) => points >= 5)) addAchievement("witness");
    if (state.community.smoke >= 70 && state.community.popularity >= 70) addAchievement("smoke-and-song");
    renderEndingFaces();
    unlockArchive("archive-3");
    saveGame();
    if (dom.callbackCard) dom.callbackCard.classList.add("is-hidden");
    if (dom.lightEnding) dom.lightEnding.classList.remove("is-hidden");
    setTimeout(() => showToast("已解锁隐藏成就：第 n 束光"), 500);
  }

  function showTitle() {
    closeModal();
    clearInterludeTimers();
    if (eidji.active) stopNightLoop(true);
    if (dom.pauseOverlay) dom.pauseOverlay.classList.add("is-hidden");
    paused = false;
    showScreen("title-screen");
    updateTitleMeta();
  }

  function returnToTitle() {
    closeModal();
    closePause();
    showTitle();
  }

  function openPause() {
    if (currentScreen !== "chapter-screen") return;
    paused = true;
    if (dom.pauseOverlay) dom.pauseOverlay.classList.remove("is-hidden");
  }

  function closePause() {
    paused = false;
    if (dom.pauseOverlay) dom.pauseOverlay.classList.add("is-hidden");
  }

  function togglePause() {
    if (paused) {
      closePause();
    } else {
      openPause();
    }
  }

  function cacheDom() {
    dom.titleScreen = $("#title-screen");
    dom.prologueScreen = $("#prologue-screen");
    dom.chapterScreen = $("#chapter-screen");
    dom.interludeScreen = $("#interlude-screen");
    dom.dreamScreen = $("#dream-screen");
    dom.dreamCount = $("#dream-count");
    dom.dreamTitle = $("#dream-title");
    dom.dreamText = $("#dream-text");
    dom.dreamWhisper = $("#dream-whisper");
    dom.btnDreamContinue = $("#btn-dream-continue");
    dom.eidjiScreen = $("#eidji-screen");
    dom.endingScreen = $("#ending-screen");
    dom.fadeOverlay = $("#fade-overlay");
    dom.btnQuickPlay = $("#btn-quick-play");
    dom.btnNewGame = $("#btn-new-game");
    dom.btnContinue = $("#btn-continue");
    dom.btnArchive = $("#btn-archive");
    dom.btnSettings = $("#btn-settings");
    dom.saveMeta = $("#save-meta");
    dom.prologueProgressText = $("#prologue-progress-text");
    dom.prologueProgressBar = $("#prologue-progress-bar");
    dom.prologueQuestion = $("#prologue-question");
    dom.prologueOptions = $("#prologue-options");
    dom.btnPause = $("#btn-pause");
    dom.btnMap = $("#btn-map");
    dom.btnJournal = $("#btn-journal");
    dom.btnHelp = $("#btn-help");
    dom.dayLabel = $("#day-label");
    dom.phaseLabel = $("#phase-label");
    dom.statsBar = $("#stats-bar");
    dom.weatherChip = $("#weather-chip");
    dom.exploreClock = $("#explore-clock");
    dom.exploreClockText = $("#explore-clock-text");
    dom.exploreClockBar = $("#explore-clock-bar");
    dom.exploreMinimap = $("#explore-minimap");
    dom.exploreMinimapText = $("#explore-minimap-text");
    dom.exploreMinimapTrack = $("#explore-minimap-track");
    dom.chapterCaption = $("#chapter-caption");
    dom.sceneWhisper = $("#scene-whisper");
    dom.chapterActions = $("#chapter-actions");
    dom.exploreLayer = $("#explore-layer");
    dom.exploreHotspots = $("#explore-hotspots");
    dom.explorePickups = $("#explore-pickups");
    dom.explorePlayer = $("#explore-player");
    dom.explorePrompt = $("#explore-prompt");
    dom.exploreControls = $("#explore-controls");
    dom.btnExploreLeft = $("#btn-explore-left");
    dom.btnExploreRight = $("#btn-explore-right");
    dom.btnExploreInteract = $("#btn-explore-interact");
    dom.btnExploreReturn = $("#btn-explore-return");
    dom.chapterHint = $("#chapter-hint");
    dom.chapterCanvas = $("#chapter-canvas");
    dom.dayWeather = $("#day-weather");
    dom.weatherForecast = $("#weather-forecast");
    dom.statusStrip = $("#status-strip");
    dom.smokeLabel = $("#smoke-label");
    dom.popularityLabel = $("#popularity-label");
    dom.smokeDots = $("#smoke-dots");
    dom.popularityDots = $("#popularity-dots");
    dom.rumorText = $("#rumor-text");
    dom.bondList = $("#bond-list");
    dom.inventoryList = $("#inventory-list");
    dom.journalText = $("#journal-text");
    dom.journalEvents = $("#journal-events");
    dom.modalLayer = $("#modal-layer");
    dom.modalEyebrow = $("#modal-eyebrow");
    dom.modalTitle = $("#modal-title");
    dom.modalBody = $("#modal-body");
    dom.modalActions = $("#modal-actions");
    dom.toast = $("#toast");
    dom.pauseOverlay = $("#pause-overlay");
    dom.btnResume = $("#btn-resume");
    dom.btnPauseSettings = $("#btn-pause-settings");
    dom.btnPauseTitle = $("#btn-pause-title");
    dom.interludeLight = $("#interlude-light");
    dom.interludeTime = $("#interlude-time");
    dom.interludeText = $("#interlude-text");
    dom.btnOpenEyes = $("#btn-open-eyes");
    dom.eidjiStart = $("#eidji-start");
    dom.eidjiResult = $("#eidji-result");
    dom.eidjiCanvas = $("#eidji-canvas");
    dom.btnStartNight = $("#btn-start-night");
    dom.btnEidjiContinue = $("#btn-eidji-continue");
    dom.nightProgressText = $("#night-progress-text");
    dom.nightProgressBar = $("#night-progress-bar");
    dom.callbackCard = $("#callback-card");
    dom.callbackEyebrow = $("#callback-eyebrow");
    dom.endingHeading = $("#ending-heading");
    dom.callbackContent = $("#callback-content");
    dom.callbackActions = $("#callback-actions");
    dom.lightEnding = $("#light-ending");
    dom.endingFaces = $("#ending-faces");
    dom.btnEndingArchive = $("#btn-ending-archive");
    dom.btnEndingTitle = $("#btn-ending-title");
  }

  function bindEvents() {
    dom.btnQuickPlay.addEventListener("click", startQuickPlay);
    dom.btnNewGame.addEventListener("click", startNewGame);
    dom.btnContinue.addEventListener("click", continueGame);
    dom.btnArchive.addEventListener("click", openArchive);
    dom.btnSettings.addEventListener("click", openSettings);
    dom.btnPause.addEventListener("click", togglePause);
    dom.btnExploreLeft.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      explore.keys.left = true;
    });
    dom.btnExploreRight.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      explore.keys.right = true;
    });
    const stopExplorePointer = () => {
      explore.keys.left = false;
      explore.keys.right = false;
    };
    dom.btnExploreLeft.addEventListener("pointerup", stopExplorePointer);
    dom.btnExploreRight.addEventListener("pointerup", stopExplorePointer);
    dom.btnExploreLeft.addEventListener("pointercancel", stopExplorePointer);
    dom.btnExploreRight.addEventListener("pointercancel", stopExplorePointer);
    dom.btnExploreLeft.addEventListener("pointerleave", stopExplorePointer);
    dom.btnExploreRight.addEventListener("pointerleave", stopExplorePointer);
    dom.btnExploreInteract.addEventListener("click", interactExplore);
    dom.btnExploreReturn.addEventListener("click", endExploreEarly);
    dom.btnMap.addEventListener("click", openMap);
    dom.btnJournal.addEventListener("click", openJournal);
    dom.btnHelp.addEventListener("click", openControlsHelp);
    dom.btnResume.addEventListener("click", closePause);
    dom.btnPauseSettings.addEventListener("click", openSettings);
    dom.btnPauseTitle.addEventListener("click", returnToTitle);
    dom.btnOpenEyes.addEventListener("click", openEyes);
    dom.btnDreamContinue.addEventListener("click", continueDream);
    dom.btnStartNight.addEventListener("click", startNight);
    dom.btnEidjiContinue.addEventListener("click", startEnding);
    dom.btnEndingArchive.addEventListener("click", openArchive);
    dom.btnEndingTitle.addEventListener("click", returnToTitle);

    dom.modalLayer.querySelector(".modal-backdrop").addEventListener("click", () => {
      if (modalDismissible) closeModal();
    });

    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      const modalOpen = !dom.modalLayer.classList.contains("is-hidden");
      if (event.key === "Escape") {
        if (modalOpen && modalDismissible) {
          closeModal();
          return;
        }
        if (!modalOpen && currentScreen === "chapter-screen") {
          togglePause();
        }
      }
      if (!modalOpen && currentScreen === "chapter-screen" && state) {
        if (state.phase === "action") {
          if (key === "a" || key === "arrowleft") {
            event.preventDefault();
            explore.keys.left = true;
            return;
          }
          if (key === "d" || key === "arrowright") {
            event.preventDefault();
            explore.keys.right = true;
            return;
          }
          if (key === "shift") {
            event.preventDefault();
            explore.keys.sprint = true;
            return;
          }          if (key === "e" || key === " " || key === "enter") {
            event.preventDefault();
            interactExplore();
            return;
          }
        }
        if (key === "m") {
          event.preventDefault();
          openMap();
          return;
        }
        if (key === "j") {
          event.preventDefault();
          openJournal();
          return;
        }
      }
      if (key === "e" && currentScreen === "chapter-screen" && state && state.phase === "final") {
        giveFinalBowl();
      }
      if ((key === "enter" || key === "e" || key === " ") && currentScreen === "dream-screen" && !modalOpen) {
        event.preventDefault();
        continueDream();
      }
    });

    window.addEventListener("keyup", (event) => {
      const key = event.key.toLowerCase();
      if (key === "a" || key === "arrowleft") explore.keys.left = false;
      if (key === "d" || key === "arrowright") explore.keys.right = false;
      if (key === "shift") explore.keys.sprint = false;
    });

    window.addEventListener("blur", () => {
      explore.keys.left = false;
      explore.keys.right = false;
      explore.keys.sprint = false;
    });

    window.addEventListener("resize", () => {
      if (currentScreen === "eidji-screen" && !eidji.active) {
        requestAnimationFrame(() => {
          const prepared = prepareCanvas(dom.eidjiCanvas);
          if (!prepared) return;
          layoutEidjiBeds(prepared.width, prepared.height, false);
          drawEidjiScene(performance.now(), true);
        });
      }
    });
  }

  function makeSamplePrologueAnswers() {
    return DATA.PROLOGUE_QUESTIONS.map((question) => {
      const option = question.options.find((item) => item.rational) || question.options[0];
      return {
        questionId: question.id,
        optionId: option.id,
        text: option.text,
        rational: Boolean(option.rational)
      };
    });
  }

  function debugRoute() {
    const params = new URLSearchParams(location.search);
    const demo = params.get("demo");
    if (!demo) {
      showTitle();
      return;
    }

    state = createState();
    state.prologueAnswers = makeSamplePrologueAnswers();
    state.prologueIndex = DATA.PROLOGUE_QUESTIONS.length;

    if (demo === "chapter" || demo === "final") {
      state.day = demo === "final" ? 25 : clamp(parseInt(params.get("day") || "1", 10), 1, 25);
      state.phase = "story";
      state.checkpoint = "chapter";
      state.archiveUnlocked = DATA.ARCHIVE_ENTRIES.filter((entry) => entry.unlockDay <= state.day).map((entry) => entry.id);
      showScreen("chapter-screen");
      beginDay();
      const phase = params.get("phase");
      if (phase) {
        setTimeout(() => {
          closeModal();
          if (phase === "action") {
            showActionPhase();
          } else if (phase === "dusk") {
            state.phase = "dusk";
            renderChapterUI();
            openDusk();
          } else if (phase === "final") {
            showFinalScene();
          }
        }, 220);
      }
    } else if (demo === "grassland") {
      state.checkpoint = "eidji";
      state.day = 26;
      showEidji();
      if (params.get("autostart") === "1") setTimeout(startNight, 260);
    } else if (demo === "dream") {
      state.day = clamp(parseInt(params.get("day") || "13", 10), 1, 25);
      state.dreams = clamp(parseInt(params.get("count") || "3", 10), 1, 5);
      showDream(state.dreams, () => {
        state.checkpoint = "chapter";
        showScreen("chapter-screen");
        beginDay();
      });
    } else if (demo === "ending") {
      state.checkpoint = "ending";
      startEnding();
    } else {
      showTitle();
    }
  }

  function init() {
    cacheDom();
    bindEvents();
    preloadArt();
    updateTitleMeta();
    debugRoute();
    window.__EIDJI_DEMO__ = {
      getState: () => state,
      getExplore: () => explore,
      startQuickPlay,
      startNewGame,
      startChapter: enterChapter,
      showEidji,
      startNight,
      showEnding: startEnding,
      showDream,
      showFinalDream,
      openMap,
      openJournal,
      showTitle,
      beginDay,
      getEidji: () => eidji,
      data: DATA
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();













































