(function () {
  "use strict";

  const CURRENT_DATA = window.EIDJI_DATA;
  if (!CURRENT_DATA) {
    document.body.innerHTML = "<main style='padding:2rem;font-family:sans-serif'>没有找到游戏数据。请通过本地服务器打开编辑器。</main>";
    return;
  }

  const DRAFT_KEY = "eidji_editor_draft_v1";
  const SECTIONS = [
    { key: "PROLOGUE_QUESTIONS", label: "序章问卷", caption: "5 道不可能选项", icon: "序", group: "主线剧情" },
    { key: "DAILY_EVENTS", label: "25 天剧情", caption: "每日事件、天气与选择", icon: "日", group: "主线剧情" },
    { key: "NPC_PROFILES", label: "江南人物", caption: "五名 NPC 的欲望、秘密与记忆", icon: "人", group: "人物与关系" },
    { key: "BOND_LEVELS", label: "牵绊等级", caption: "从生疏到家人的表现", icon: "绊", group: "人物与关系" },
    { key: "ACTION_LIBRARY", label: "行动与小游戏", caption: "领粥、挖菜、摸鱼、擦锅、凝神", icon: "动", group: "玩法与资源" },
    { key: "DAILY_ACTIONS", label: "每日行动列表", caption: "每天可选择的四个行动", icon: "列", group: "玩法与资源" },
    { key: "FOODS", label: "食物与数值", caption: "食物名称和四项属性效果", icon: "食", group: "玩法与资源" },
    { key: "RECIPES", label: "灶台配方", caption: "食材组合与成品", icon: "灶", group: "玩法与资源" },
    { key: "TOOL_RECIPES", label: "工具图纸", caption: "六种工具的说明文字", icon: "具", group: "玩法与资源" },
    { key: "SKILL_DEFINITIONS", label: "技能定义", caption: "采集、捕鱼、辨认、编织", icon: "技", group: "玩法与资源" },
    { key: "PLANT_QUIZ", label: "植物图鉴", caption: "可食与有毒植物辨认", icon: "叶", group: "玩法与资源" },
    { key: "MAP_LOCATIONS", label: "地图地点", caption: "12 个地点的文本与危险等级", icon: "图", group: "世界与档案" },
    { key: "DAILY_RUMORS", label: "每日风声", caption: "侧栏随机世界细节", icon: "风", group: "世界与档案" },
    { key: "ARCHIVE_ENTRIES", label: "历史档案", caption: "三条史料与公开出处", icon: "档", group: "世界与档案" },
    { key: "DREAM_SEQUENCES", label: "白原梦境", caption: "五次递进梦境", icon: "白", group: "梦境与终章" },
    { key: "FINAL_DREAM", label: "最终梦境", caption: "白原尽头与娜仁相遇", icon: "终", group: "梦境与终章" },
    { key: "ART_MANIFEST", label: "美术资源路径", caption: "背景、角色与信物图片路径", icon: "画", group: "梦境与终章" }
  ];

  const FIELD_LABELS = {
    id: "内部 ID", question: "题目", options: "选项", text: "正文", rational: "理性答案",
    realAnswer: "真实回答", fact: "史实提示", title: "标题", weather: "天气", note: "当日手记",
    choices: "选择", label: "显示名称", short: "短标签", icon: "图标字", description: "描述",
    kind: "交互类型", gain: "产出", outside: "户外行动", locationId: "地点 ID", skill: "对应技能",
    xp: "技能经验", community: "共同体影响", bond: "牵绊影响", name: "名称", mark: "人物标记",
    role: "身份", desire: "欲望", conflict: "矛盾", secret: "秘密", routine: "日常", symbol: "信物",
    truth: "人物真意", memories: "牵绊记忆", at: "解锁等级", min: "最低点数", materials: "材料",
    unlock: "解锁条件", effect: "效果", result: "成品 ID", unlockSkill: "解锁技能等级", prompt: "提示语",
    safe: "可食用", hint: "辨认提示", summary: "摘要", body: "正文", source: "来源", url: "链接",
    unlockDay: "解锁天数", danger: "危险等级", intel: "地点情报", actions: "可用行动",
    unlockBond: "牵绊解锁", level: "等级", whisper: "梦境旁白", satiety: "饱食", warmth: "体温",
    health: "健康", spirit: "心力"
  };

  const LONG_FIELDS = new Set(["question", "text", "note", "realAnswer", "fact", "desire", "conflict", "secret", "routine", "truth", "summary", "body", "source", "intel", "prompt", "hint", "description", "whisper"]);
  const OPEN_ARRAY_FIELDS = new Set(["options", "choices", "memories"]);

  let state = deepClone(CURRENT_DATA);
  let currentSection = "PROLOGUE_QUESTIONS";
  let dirty = false;
  let draftTimer = null;
  let toastTimer = null;
  let pendingDraft = null;
  let serverMode = false;

  const dom = {
    root: document.getElementById("editor-root"), nav: document.getElementById("section-nav"),
    searchInput: document.getElementById("search-input"), searchResults: document.getElementById("search-results"),
    breadcrumb: document.getElementById("breadcrumb"), sectionTitle: document.getElementById("section-title"),
    sectionCaption: document.getElementById("section-caption"), dirtyStatus: document.getElementById("dirty-status"),
    draftBanner: document.getElementById("draft-banner"), draftTime: document.getElementById("draft-time"),
    fileImport: document.getElementById("file-import"), replaceFind: document.getElementById("find-input"),
    replaceWith: document.getElementById("replace-input"), replaceStatus: document.getElementById("replace-status"),
    validationDialog: document.getElementById("validation-dialog"),
    validationContent: document.getElementById("validation-content"), toast: document.getElementById("editor-toast"),
    btnPublish: document.getElementById("btn-publish"), btnSaveData: document.getElementById("btn-save-data")
  };

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getAtPath(path) {
    return path.reduce((value, key) => (value == null ? undefined : value[key]), state);
  }

  function setAtPath(path, value) {
    if (!path.length) return;
    let target = state;
    for (let index = 0; index < path.length - 1; index += 1) target = target[path[index]];
    target[path[path.length - 1]] = value;
  }

  function labelFor(key) { return FIELD_LABELS[key] || key; }
  function sectionDefinition(key) { return SECTIONS.find((section) => section.key === key) || SECTIONS[0]; }
  function countValue(value) {
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === "object") return Object.keys(value).length;
    return 0;
  }

  function escapeHtml(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function showToast(message) {
    dom.toast.textContent = message;
    dom.toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => dom.toast.classList.remove("is-visible"), 2600);
  }

  function markDirty() {
    dirty = true;
    dom.dirtyStatus.textContent = "有未保存修改";
    dom.dirtyStatus.classList.add("is-dirty");
    scheduleDraft();
  }

  function markClean() {
    dirty = false;
    dom.dirtyStatus.textContent = "已同步";
    dom.dirtyStatus.classList.remove("is-dirty");
  }

  function scheduleDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: Date.now(), data: state })); } catch (error) { /* ignore */ }
    }, 450);
  }

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (error) { /* ignore */ }
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft || !draft.data || !draft.data.PROLOGUE_QUESTIONS) return;
      pendingDraft = draft;
      dom.draftBanner.classList.remove("is-hidden");
      dom.draftTime.textContent = "保存于 " + new Date(draft.savedAt || Date.now()).toLocaleString("zh-CN", { hour12: false });
    } catch (error) { pendingDraft = null; }
  }

  function renderNav() {
    dom.nav.innerHTML = "";
    const groups = new Map();
    SECTIONS.forEach((section) => {
      if (!groups.has(section.group)) groups.set(section.group, []);
      groups.get(section.group).push(section);
    });
    groups.forEach((sections, groupName) => {
      const title = document.createElement("p");
      title.className = "nav-group-title";
      title.textContent = groupName;
      dom.nav.appendChild(title);
      sections.forEach((section) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "section-button" + (section.key === currentSection ? " is-active" : "");
        button.dataset.section = section.key;
        button.innerHTML = "<span class=\"section-icon\">" + escapeHtml(section.icon) + "</span>" +
          "<span class=\"section-copy\"><strong>" + escapeHtml(section.label) + "</strong><small>" + escapeHtml(section.caption) + "</small></span>" +
          "<span class=\"section-count\">" + countValue(state[section.key]) + "</span>";
        button.addEventListener("click", () => renderSection(section.key));
        dom.nav.appendChild(button);
      });
    });
  }

  function setActiveSection(key) {
    Array.from(dom.nav.querySelectorAll(".section-button")).forEach((button) => button.classList.toggle("is-active", button.dataset.section === key));
  }

  function renderSection(key) {
    currentSection = key;
    const section = sectionDefinition(key);
    setActiveSection(key);
    dom.breadcrumb.textContent = "当前游戏数据 / " + section.group;
    dom.sectionTitle.textContent = section.label;
    dom.sectionCaption.textContent = section.caption;
    dom.root.innerHTML = "";
    const intro = document.createElement("div");
    intro.className = "section-intro";
    intro.innerHTML = "<p>直接修改下方字段。文本中的换行会保留到游戏里。</p><strong>" + escapeHtml(section.caption) + "</strong>";
    dom.root.appendChild(intro);
    const value = state[key];
    if (key === "DAILY_EVENTS") renderDailyEvents(value);
    else if (key === "DAILY_ACTIONS") renderDailyActions(value);
    else if (Array.isArray(value)) renderArray(dom.root, value, [key], { root: true, open: key === "PROLOGUE_QUESTIONS" || key === "NPC_PROFILES" });
    else if (value && typeof value === "object") renderKeyedObject(dom.root, value, [key], { root: true });
    else renderPrimitiveField(dom.root, key, value, [key], { wide: true });
  }

  function summarizeItem(item, index) {
    if (!item || typeof item !== "object") return String(item || "第 " + (index + 1) + " 项");
    return item.title || item.name || item.question || item.label || item.text || item.prompt || item.id || "第 " + (index + 1) + " 项";
  }

  function renderEntityCard(container, item, path, index, options) {
    const card = document.createElement("details");
    card.className = "entity-card";
    if (options.open) card.open = true;
    const summary = document.createElement("summary");
    summary.className = "entity-summary";
    const indexNode = document.createElement("span");
    indexNode.className = "entity-index";
    indexNode.textContent = options.indexLabel ? options.indexLabel(item, index) : String(index + 1).padStart(2, "0");
    const copy = document.createElement("span");
    copy.className = "entity-summary-copy";
    const title = document.createElement("strong");
    title.textContent = summarizeItem(item, index);
    const sub = document.createElement("small");
    sub.textContent = options.summaryText ? options.summaryText(item) : (item && item.id ? item.id : "编辑内容");
    copy.appendChild(title);
    copy.appendChild(sub);
    const actions = document.createElement("span");
    actions.className = "entity-actions";
    if (options.allowDuplicate) {
      const duplicate = document.createElement("button");
      duplicate.type = "button";
      duplicate.className = "entity-action";
      duplicate.textContent = "复制";
      duplicate.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const list = getAtPath(path.slice(0, -1));
        list.splice(index + 1, 0, deepClone(item));
        markDirty();
        renderSection(currentSection);
      });
      actions.appendChild(duplicate);
    }
    if (options.allowDelete) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "entity-action is-danger";
      remove.textContent = "删除";
      remove.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!window.confirm("确认删除这一项？")) return;
        const list = getAtPath(path.slice(0, -1));
        list.splice(index, 1);
        markDirty();
        renderSection(currentSection);
      });
      actions.appendChild(remove);
    }
    summary.appendChild(indexNode);
    summary.appendChild(copy);
    summary.appendChild(actions);
    card.appendChild(summary);
    const body = document.createElement("div");
    body.className = "entity-body";
    if (item && item.id) {
      const id = document.createElement("span");
      id.className = "id-chip";
      id.textContent = "ID · " + item.id;
      body.appendChild(id);
    }
    if (item && typeof item === "object" && !Array.isArray(item)) renderObjectFields(body, item, path);
    else renderPrimitiveField(body, String(index), item, path, { wide: true });
    card.appendChild(body);
    container.appendChild(card);
  }

  function renderArray(container, array, path, options) {
    if (!Array.isArray(array)) return;
    const list = document.createElement("div");
    list.className = options.root ? "entity-list" : "array-block";
    const arrayLabel = path[path.length - 1];
    if (!options.root) {
      const label = document.createElement("div");
      label.className = "array-label";
      label.innerHTML = "<span>" + escapeHtml(labelFor(arrayLabel)) + "</span><small>" + array.length + " 项</small>";
      list.appendChild(label);
    }
    if (array.length === 0) {
      const empty = document.createElement("p");
      empty.className = "section-caption";
      empty.textContent = "这一项还没有内容。";
      list.appendChild(empty);
    }
    const primitive = array.every((item) => item == null || typeof item !== "object");
    if (primitive) {
      const rows = document.createElement("div");
      rows.className = "array-items";
      array.forEach((item, index) => {
        const row = document.createElement("div");
        row.className = "array-row";
        const editor = document.createElement("textarea");
        editor.value = item == null ? "" : String(item);
        editor.dataset.path = JSON.stringify(path.concat(index));
        editor.dataset.valueType = typeof item === "number" ? "number" : "string";
        editor.rows = 2;
        editor.addEventListener("input", () => {
          setAtPath(path.concat(index), editor.dataset.valueType === "number" ? Number(editor.value) : editor.value);
          markDirty();
        });
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "array-remove";
        remove.textContent = "×";
        remove.title = "删除";
        remove.addEventListener("click", () => {
          array.splice(index, 1);
          markDirty();
          renderSection(currentSection);
        });
        row.appendChild(editor);
        row.appendChild(remove);
        rows.appendChild(row);
      });
      list.appendChild(rows);
    } else {
      const items = document.createElement("div");
      items.className = "entity-list";
      array.forEach((item, index) => {
        renderEntityCard(items, item, path.concat(index), index, {
          open: Boolean(options.open && index === 0),
          allowDuplicate: true,
          allowDelete: true,
          summaryText: (entry) => entry && entry.id ? entry.id : "编辑内容"
        });
      });
      list.appendChild(items);
    }
    const add = document.createElement("button");
    add.type = "button";
    add.className = "array-add";
    add.textContent = primitive ? "＋ 添加一项" : "＋ 添加一条";
    add.addEventListener("click", () => {
      array.push(primitive ? "" : createBlankLike(array[array.length - 1] || {}));
      markDirty();
      renderSection(currentSection);
    });
    list.appendChild(add);
    container.appendChild(list);
  }

  function renderObjectFields(container, object, path) {
    const grid = document.createElement("div");
    grid.className = "field-grid";
    Object.keys(object).forEach((key) => {
      const value = object[key];
      if (key === "id") return;
      if (Array.isArray(value) || (value && typeof value === "object")) {
        const details = document.createElement("details");
        details.className = "nested-group";
        details.open = OPEN_ARRAY_FIELDS.has(key);
        const summary = document.createElement("summary");
        summary.textContent = labelFor(key) + " · " + countValue(value) + " 项";
        const content = document.createElement("div");
        content.className = "nested-content";
        if (Array.isArray(value)) renderArray(content, value, path.concat(key), { root: false });
        else renderObjectFields(content, value, path.concat(key));
        details.appendChild(summary);
        details.appendChild(content);
        grid.appendChild(details);
      } else {
        renderPrimitiveField(grid, key, value, path.concat(key), { wide: LONG_FIELDS.has(key) });
      }
    });
    container.appendChild(grid);
  }

  function renderPrimitiveField(container, key, value, path, options) {
    const field = document.createElement("div");
    const isLong = typeof value === "string" && (LONG_FIELDS.has(key) || value.includes("\n") || value.length > 70);
    field.className = "field" + (options.wide || isLong ? " is-wide" : "") + (isLong ? "" : " is-short");
    field.dataset.fieldPath = JSON.stringify(path);
    const head = document.createElement("div");
    head.className = "field-head";
    const label = document.createElement("label");
    label.textContent = labelFor(key);
    const counter = document.createElement("small");
    if (typeof value === "string") counter.textContent = value.length + " 字";
    head.appendChild(label);
    head.appendChild(counter);
    field.appendChild(head);
    if (typeof value === "boolean") {
      field.className = "bool-field";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = value;
      const checkLabel = document.createElement("label");
      checkLabel.textContent = value ? "开启" : "关闭";
      checkbox.addEventListener("change", () => {
        setAtPath(path, checkbox.checked);
        checkLabel.textContent = checkbox.checked ? "开启" : "关闭";
        markDirty();
      });
      field.appendChild(checkbox);
      field.appendChild(checkLabel);
    } else if (typeof value === "number") {
      const input = document.createElement("input");
      input.type = "number";
      input.value = value;
      input.addEventListener("input", () => { setAtPath(path, Number(input.value)); markDirty(); });
      field.appendChild(input);
    } else {
      const input = document.createElement(isLong ? "textarea" : "input");
      if (isLong) input.rows = Math.max(3, Math.min(10, value.split("\n").length + 2));
      else input.type = "text";
      input.value = value == null ? "" : String(value);
      input.addEventListener("input", () => {
        setAtPath(path, input.value);
        counter.textContent = input.value.length + " 字";
        field.classList.add("is-changed");
        markDirty();
      });
      field.appendChild(input);
    }
    container.appendChild(field);
  }

  function renderKeyedObject(container, object, path, options) {
    if (!object || typeof object !== "object" || Array.isArray(object)) return;
    const entries = Object.entries(object);
    const allObjects = entries.every(([, value]) => value && typeof value === "object" && !Array.isArray(value));
    if (!allObjects) { renderObjectFields(container, object, path); return; }
    const list = document.createElement("div");
    list.className = "keyed-list";
    entries.forEach(([key, item], index) => {
      const card = document.createElement("details");
      card.className = "entity-card";
      if (options.open || index === 0) card.open = true;
      const summary = document.createElement("summary");
      summary.className = "entity-summary";
      const indexNode = document.createElement("span");
      indexNode.className = "entity-index";
      indexNode.textContent = key;
      const copy = document.createElement("span");
      copy.className = "entity-summary-copy";
      const title = document.createElement("strong");
      title.textContent = summarizeItem(item, index);
      const small = document.createElement("small");
      small.textContent = item.id || key;
      copy.appendChild(title);
      copy.appendChild(small);
      summary.appendChild(indexNode);
      summary.appendChild(copy);
      const actions = document.createElement("span");
      actions.className = "entity-actions";
      summary.appendChild(actions);
      card.appendChild(summary);
      const body = document.createElement("div");
      body.className = "entity-body";
      if (item.id) {
        const id = document.createElement("span");
        id.className = "id-chip";
        id.textContent = "ID · " + item.id;
        body.appendChild(id);
      }
      renderObjectFields(body, item, path.concat(key));
      card.appendChild(body);
      list.appendChild(card);
    });
    container.appendChild(list);
  }

  function renderDailyEvents(events) {
    const list = document.createElement("div");
    list.className = "keyed-list";
    const days = Object.keys(events).sort((a, b) => Number(a) - Number(b));
    days.forEach((day, index) => {
      const event = events[day];
      const card = document.createElement("details");
      card.className = "entity-card day-card";
      if (index === 0) card.open = true;
      const summary = document.createElement("summary");
      summary.className = "entity-summary";
      const indexNode = document.createElement("span");
      indexNode.className = "entity-index";
      indexNode.textContent = "D" + day;
      const copy = document.createElement("span");
      copy.className = "entity-summary-copy";
      const title = document.createElement("strong");
      title.textContent = event.title || "未命名事件";
      const small = document.createElement("small");
      small.textContent = event.weather || "未设置天气";
      copy.appendChild(title);
      copy.appendChild(small);
      summary.appendChild(indexNode);
      summary.appendChild(copy);
      const actions = document.createElement("span");
      actions.className = "entity-actions";
      summary.appendChild(actions);
      card.appendChild(summary);
      const body = document.createElement("div");
      body.className = "entity-body";
      const meta = document.createElement("div");
      meta.className = "day-meta";
      meta.innerHTML = "<span>" + escapeHtml(event.weather || "天气未填") + "</span>" +
        "<span>" + (event.choices ? (event.choices.length + " 个选择") : "固定事件") + "</span>" +
        (event.final ? "<span class=\"has-choice\">终局事件</span>" : "");
      body.appendChild(meta);
      renderObjectFields(body, event, ["DAILY_EVENTS", day]);
      card.appendChild(body);
      list.appendChild(card);
    });
    dom.root.appendChild(list);
  }

  function renderDailyActions(dailyActions) {
    const wrapper = document.createElement("div");
    wrapper.className = "daily-actions-grid";
    const actionIds = Object.keys(state.ACTION_LIBRARY || {});
    Object.keys(dailyActions).sort((a, b) => Number(a) - Number(b)).forEach((day) => {
      const row = document.createElement("div");
      row.className = "daily-action-row";
      const label = document.createElement("strong");
      label.textContent = "D" + day;
      const input = document.createElement("input");
      input.type = "text";
      input.value = (dailyActions[day] || []).join(", ");
      input.placeholder = "例如：queue, help, care, pray";
      const count = document.createElement("small");
      const updateCount = () => {
        const ids = parseActionList(input.value);
        count.textContent = ids.length + " 项";
        count.title = ids.filter((id) => !actionIds.includes(id)).join(", ");
        if (ids.some((id) => !actionIds.includes(id))) {
          count.textContent += " · 有未知行动";
          count.style.color = "var(--danger)";
        } else count.style.color = "";
      };
      updateCount();
      input.addEventListener("input", () => {
        dailyActions[day] = parseActionList(input.value);
        updateCount();
        markDirty();
      });
      row.appendChild(label);
      row.appendChild(input);
      row.appendChild(count);
      wrapper.appendChild(row);
    });
    dom.root.appendChild(wrapper);
  }

  function parseActionList(value) {
    return String(value || "").split(/[,，\s]+/).map((item) => item.trim()).filter(Boolean);
  }

  function createBlankLike(template) {
    if (Array.isArray(template)) return [];
    if (template && typeof template === "object") {
      const object = {};
      Object.keys(template).forEach((key) => { object[key] = createBlankLike(template[key]); });
      return object;
    }
    if (typeof template === "number") return 0;
    if (typeof template === "boolean") return false;
    return "";
  }

  function walkStrings(value, path, output) {
    if (typeof value === "string") { output.push({ path, value }); return; }
    if (Array.isArray(value)) { value.forEach((item, index) => walkStrings(item, path.concat(index), output)); return; }
    if (value && typeof value === "object") Object.keys(value).forEach((key) => walkStrings(value[key], path.concat(key), output));
  }

  function searchData(query) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    const strings = [];
    walkStrings(state, [], strings);
    return strings.filter((item) => item.value.toLowerCase().includes(normalized))
      .map((item) => ({ ...item, section: item.path[0] })).slice(0, 80);
  }

  function renderSearchResults(query) {
    const results = searchData(query);
    if (!query.trim()) {
      dom.searchResults.classList.add("is-hidden");
      dom.searchResults.innerHTML = "";
      return;
    }
    dom.searchResults.innerHTML = "";
    if (!results.length) {
      const empty = document.createElement("div");
      empty.className = "search-result";
      empty.textContent = "没有找到匹配文字。";
      dom.searchResults.appendChild(empty);
    } else {
      results.forEach((result) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "search-result";
        const section = sectionDefinition(result.section);
        const pathText = result.path.map((part) => labelFor(String(part))).join(" / ");
        const snippet = result.value.replace(/\s+/g, " ").slice(0, 72);
        button.innerHTML = "<strong>" + escapeHtml(section.label) + " · " + escapeHtml(pathText) + "</strong><small>" + escapeHtml(snippet) + "</small>";
        button.addEventListener("click", () => {
          dom.searchResults.classList.add("is-hidden");
          renderSection(result.section);
          setTimeout(() => revealField(result.path), 50);
        });
        dom.searchResults.appendChild(button);
      });
    }
    dom.searchResults.classList.remove("is-hidden");
  }

  function revealField(path) {
    const target = dom.root.querySelector("[data-field-path=\"" + CSS.escape(JSON.stringify(path)) + "\"]");
    if (!target) return;
    let parent = target.parentElement;
    while (parent) { if (parent.tagName === "DETAILS") parent.open = true; parent = parent.parentElement; }
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    const input = target.querySelector("input, textarea");
    if (input) setTimeout(() => input.focus(), 250);
  }

  function countReplace(query) {
    if (!query) return 0;
    const strings = [];
    walkStrings(state, [], strings);
    return strings.reduce((total, item) => total + item.value.split(query).length - 1, 0);
  }

  function replaceAll(query, replacement) {
    if (!query) return 0;
    let count = 0;
    const replaceInValue = (value) => {
      if (typeof value === "string") {
        count += value.split(query).length - 1;
        return value.split(query).join(replacement);
      }
      if (Array.isArray(value)) return value.map(replaceInValue);
      if (value && typeof value === "object") {
        const next = {};
        Object.keys(value).forEach((key) => { next[key] = replaceInValue(value[key]); });
        return next;
      }
      return value;
    };
    state = replaceInValue(state);
    if (count) { markDirty(); renderSection(currentSection); }
    return count;
  }

  function validateData() {
    const issues = [];
    if (!Array.isArray(state.PROLOGUE_QUESTIONS) || state.PROLOGUE_QUESTIONS.length === 0) {
      issues.push("序章问卷没有任何题目。");
    } else {
      state.PROLOGUE_QUESTIONS.forEach((question, index) => {
        if (!question.question || !question.question.trim()) issues.push("序章第 " + (index + 1) + " 题缺少题目文字。");
        if (!Array.isArray(question.options) || question.options.length < 2) issues.push("序章第 " + (index + 1) + " 题至少需要两个选项。");
        (question.options || []).forEach((option, optionIndex) => {
          if (!option.text || !option.text.trim()) issues.push("序章第 " + (index + 1) + " 题第 " + (optionIndex + 1) + " 个选项为空。");
        });
      });
    }
    for (let day = 1; day <= 25; day += 1) {
      const event = state.DAILY_EVENTS && state.DAILY_EVENTS[day];
      if (!event) { issues.push("缺少第 " + day + " 天事件。"); continue; }
      if (!event.title || !event.title.trim()) issues.push("第 " + day + " 天缺少标题。");
      if (!event.text || !event.text.trim()) issues.push("第 " + day + " 天缺少事件正文。");
      (event.choices || []).forEach((choice, index) => {
        if (!choice.label || !choice.label.trim()) issues.push("第 " + day + " 天第 " + (index + 1) + " 个选择缺少显示文字。");
      });
    }
    (state.NPC_PROFILES || []).forEach((profile, index) => {
      if (!profile.name) issues.push("第 " + (index + 1) + " 名人物缺少姓名。");
      if (!profile.secret) issues.push((profile.name || "第 " + (index + 1) + " 名人物") + "缺少秘密文本。");
    });
    const knownActions = new Set(Object.keys(state.ACTION_LIBRARY || {}));
    Object.entries(state.DAILY_ACTIONS || {}).forEach(([day, ids]) => {
      (ids || []).forEach((id) => { if (!knownActions.has(id)) issues.push("D" + day + " 引用了不存在的行动：" + id); });
    });
    return issues;
  }

  function showValidation() {
    const issues = validateData();
    dom.validationContent.innerHTML = "";
    if (!issues.length) {
      const ok = document.createElement("div");
      ok.className = "validation-ok";
      ok.textContent = "没有发现明显的缺失或结构问题。";
      dom.validationContent.appendChild(ok);
    } else {
      issues.forEach((issue) => {
        const item = document.createElement("div");
        item.className = "validation-item";
        item.textContent = issue;
        dom.validationContent.appendChild(item);
      });
    }
    dom.validationDialog.showModal();
  }

  function buildDataJs() {
    const ordered = SECTIONS.map((section) => section.key);
    const allKeys = Array.from(new Set(ordered.concat(Object.keys(state))));
    const lines = ["(function () {", "  \"use strict\";", ""];
    allKeys.forEach((key) => {
      lines.push("  const " + key + " = " + JSON.stringify(state[key], null, 2) + ";");
      lines.push("");
    });
    lines.push("  window.EIDJI_DATA = {");
    allKeys.forEach((key) => lines.push("    " + key + ","));
    lines.push("  };", "})();", "");
    return lines.join("\n");
  }

  function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function detectLocalServer() {
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      const result = await response.json();
      serverMode = Boolean(response.ok && result.ok && result.local);
    } catch (error) {
      serverMode = false;
    }
    if (serverMode) {
      if (dom.btnPublish) dom.btnPublish.classList.remove("is-hidden");
      if (dom.btnSaveData) dom.btnSaveData.textContent = "保存到游戏";
      showToast("已连接本地编辑器服务：可保存文件并发布线上。");
    }
  }

  async function saveDataFile() {
    const content = buildDataJs();
    if (serverMode) {
      try {
        const response = await fetch("/api/save-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content })
        });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || "本地保存失败");
        markClean();
        clearDraft();
        showToast(result.backup ? ("已保存到游戏，并备份为 " + result.backup) : "已保存到游戏。刷新游戏页面即可。");
        return;
      } catch (error) {
        showToast("本地保存失败，改用下载：" + error.message);
      }
    }
    if ("showSaveFilePicker" in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: "data.js",
          types: [{ description: "JavaScript data file", accept: { "text/javascript": [".js"] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        markClean();
        clearDraft();
        showToast("已保存 data.js。刷新游戏页面即可看到新文字。");
        return;
      } catch (error) { if (error && error.name === "AbortError") return; }
    }
    downloadBlob(content, "data.js", "text/javascript;charset=utf-8");
    markClean();
    clearDraft();
    showToast("已下载 data.js，请替换游戏目录中的 js/data.js。");
  }

  async function publishData() {
    if (!serverMode) {
      showToast("发布功能需要通过“启动编辑器.bat”打开本地编辑器。");
      return;
    }
    if (!window.confirm("保存当前剧情并发布到 GitHub Pages？线上游戏约 1 分钟后更新。")) return;
    const content = buildDataJs();
    try {
      const response = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "发布失败");
      markClean();
      clearDraft();
      showToast("已发布到线上，提交：" + String(result.commit).slice(0, 8) + "。约 1 分钟后刷新游戏。");
    } catch (error) {
      showToast("发布失败：" + error.message);
    }
  }

  function exportJson() {
    downloadBlob(JSON.stringify(state, null, 2), "eidji-story-backup.json", "application/json;charset=utf-8");
    showToast("已导出 JSON 备份。");
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || !parsed.PROLOGUE_QUESTIONS || !parsed.DAILY_EVENTS) throw new Error("文件缺少 PROLOGUE_QUESTIONS 或 DAILY_EVENTS。");
        state = Object.assign(deepClone(CURRENT_DATA), parsed);
        currentSection = "PROLOGUE_QUESTIONS";
        markDirty();
        renderNav();
        renderSection(currentSection);
        showToast("JSON 已导入，可继续编辑或保存为 data.js。");
      } catch (error) { showToast("导入失败：" + error.message); }
    };
    reader.readAsText(file, "utf-8");
  }

  function restoreDraft() {
    if (!pendingDraft || !pendingDraft.data) return;
    state = deepClone(pendingDraft.data);
    pendingDraft = null;
    dom.draftBanner.classList.add("is-hidden");
    markDirty();
    renderNav();
    renderSection(currentSection);
    showToast("已恢复浏览器草稿。");
  }

  function discardDraft() {
    pendingDraft = null;
    dom.draftBanner.classList.add("is-hidden");
    clearDraft();
    showToast("草稿已丢弃。");
  }

  function resetToCurrent() {
    if (!window.confirm("恢复为当前 js/data.js 中的数据？未保存的改动会丢失。")) return;
    state = deepClone(CURRENT_DATA);
    pendingDraft = null;
    dom.draftBanner.classList.add("is-hidden");
    clearDraft();
    markClean();
    renderNav();
    renderSection(currentSection);
    showToast("已恢复当前游戏数据。");
  }

  function bindEvents() {
    document.getElementById("btn-open-game").addEventListener("click", () => window.open("index.html", "_blank", "noopener"));
    document.getElementById("btn-reset-data").addEventListener("click", resetToCurrent);
    document.getElementById("btn-validate").addEventListener("click", showValidation);
    document.getElementById("btn-export-json").addEventListener("click", exportJson);
    document.getElementById("btn-save-data").addEventListener("click", saveDataFile);
    dom.btnPublish.addEventListener("click", publishData);
    document.getElementById("btn-import").addEventListener("click", () => dom.fileImport.click());
    dom.fileImport.addEventListener("change", () => {
      const file = dom.fileImport.files && dom.fileImport.files[0];
      if (file) importJson(file);
      dom.fileImport.value = "";
    });
    document.getElementById("btn-count-replace").addEventListener("click", () => {
      const query = dom.replaceFind.value;
      dom.replaceStatus.textContent = query ? ("找到 " + countReplace(query) + " 处匹配。") : "请先输入要查找的文字。";
    });
    document.getElementById("btn-replace-all").addEventListener("click", () => {
      const query = dom.replaceFind.value;
      if (!query) { dom.replaceStatus.textContent = "请先输入要查找的文字。"; return; }
      const count = replaceAll(query, dom.replaceWith.value);
      dom.replaceStatus.textContent = "已替换 " + count + " 处。";
      if (count) showToast("批量替换完成：" + count + " 处。");
    });
    document.getElementById("btn-restore-draft").addEventListener("click", restoreDraft);
    document.getElementById("btn-discard-draft").addEventListener("click", discardDraft);
    document.getElementById("btn-close-dialog").addEventListener("click", () => dom.validationDialog.close());
    document.getElementById("btn-dialog-ok").addEventListener("click", () => dom.validationDialog.close());
    dom.searchInput.addEventListener("input", () => renderSearchResults(dom.searchInput.value));
    dom.searchInput.addEventListener("focus", () => { if (dom.searchInput.value) renderSearchResults(dom.searchInput.value); });
    document.addEventListener("click", (event) => { if (!event.target.closest(".sidebar-search")) dom.searchResults.classList.add("is-hidden"); });
    window.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); saveDataFile(); }
    });
    window.addEventListener("beforeunload", (event) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    });
  }

  function init() {
    renderNav();
    bindEvents();
    loadDraft();
    detectLocalServer();
    const hashSection = location.hash.replace("#", "");
    const firstSection = SECTIONS.some((section) => section.key === hashSection) ? hashSection : "PROLOGUE_QUESTIONS";
    renderSection(firstSection);
    if (pendingDraft) markClean();
    window.__EIDJI_EDITOR__ = {
      getState: () => deepClone(state),
      setState: (next) => { state = deepClone(next); renderNav(); renderSection(currentSection); markDirty(); },
      buildDataJs,
      validateData,
      publishData,
      isServerMode: () => serverMode,
      section: renderSection
    };
  }

  init();
})();

