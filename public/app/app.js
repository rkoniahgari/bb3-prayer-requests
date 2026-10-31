function startApp(DATA) {
  var LOGO = "/app/logo.webp";
  var app = document.getElementById("app");
  document.documentElement.lang = "en";
  var ui = { lastSlug: null, deck: 0, todayAsList: false };

  function h(tag, props) {
    var el = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k === "html") el.innerHTML = v;
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); return; }
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  function fmt(iso, long) {
    var p = iso.split("-").map(Number), d = new Date(p[0], p[1] - 1, p[2]);
    return d.toLocaleDateString("en-US", long ? { weekday: "long", month: "long", day: "numeric" } : { weekday: "short", month: "short", day: "numeric" });
  }
  function fmtShortDate(iso) { var p = iso.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }
  function slug(s) { return "p-" + s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function initials(s) {
    var w = s.replace(/[^A-Za-z\s]/g, " ").trim().split(/\s+/);
    return ((w[0] || "")[0] + (w.length > 1 ? w[w.length - 1][0] : "")).toUpperCase();
  }

  // ---------- shape the data ----------
  // Requests added on this site (source "web") never move the study date; they count as new
  // until the next study's requests arrive.
  var latest, people, everyone, bySlug, praiseItems, today, isToday;
  function prepare() {
    DATA.sample = false;
    DATA.updated = DATA.updated || todayISO();
    DATA.items.forEach(function (it) { it.originalNote = it.note; });
  }
  prepare();
  function shape() {
    latest = DATA.items.filter(function (it) { return !it.removed && it.kind === "request" && !it.answered && it.source !== "web"; })
      .reduce(function (m, it) { return it.added > m ? it.added : m; }, "");
    people = {}; var order = [];
    DATA.items.forEach(function (it) {
      if (it.removed) return;
      if (!people[it.name]) { people[it.name] = { name: it.name, slug: slug(it.name), open: [], answered: [], praise: [] }; order.push(it.name); }
      var p = people[it.name];
      if (it.kind === "praise") p.praise.push(it); else if (it.answered) p.answered.push(it); else p.open.push(it);
    });
    bySlug = {};
    (DATA.members || []).forEach(function (n) { if (!people[n]) { people[n] = { name: n, slug: slug(n), open: [], answered: [], praise: [] }; order.push(n); } });
    everyone = order.map(function (n) { return people[n]; })
      .sort(function (a, b) { return a.name.localeCompare(b.name); });
    everyone.forEach(function (p) {
      p.open.sort(function (a, b) { return b.added.localeCompare(a.added); });
      p.answered.sort(function (a, b) { return b.answered.localeCompare(a.answered); });
      p.isNew = p.open.some(isNewItem);
      bySlug[p.slug] = p;
    });
    praiseItems = DATA.items.filter(function (it) { return !it.removed && (it.kind === "praise" || it.answered); })
      .sort(function (a, b) { return (b.answered || b.added).localeCompare(a.answered || a.added); });
    today = everyone.filter(function (p) { return p.isNew; });
    isToday = latest === todayISO();
  }
  function isNewItem(it) { return it.kind === "request" && !it.answered && it.added >= latest; }
  function todayISO() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function firstName(name) { return name.split(" ")[0]; }
  shape();
  function visible() { return everyone; }

  // ---------- pieces ----------
  // Text size: three named buttons at the bottom of each page, so the way back is always visible.
  var SIZES = [["1", "Normal"], ["2", "Larger"], ["3", "Largest"]];
  // Text size lives in one place ("Aa" at the top of the main pages, or the sidebar on computers)
  // and applies to every page.
  function setSize(v) {
    document.documentElement.dataset.size = v;
    try { localStorage.setItem("g3-size", v); } catch (e) {}
    document.querySelectorAll(".side-size .size-opt").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.v === v)); });
    route(true);
  }
  function sizeOptions() {
    var cur = document.documentElement.dataset.size || "1";
    return h("div", { class: "size-opts" }, SIZES.map(function (o) {
      return h("button", { type: "button", class: "size-opt s" + o[0], "data-v": o[0], "aria-pressed": String(cur === o[0]),
        title: "Show the words in " + o[1].toLowerCase() + " size", onclick: function () { setSize(o[0]); } }, o[1]);
    }));
  }
  function aaButton() {
    return h("button", { type: "button", class: "aa-btn", id: "aa-btn", "aria-expanded": String(!!ui.sizeOpen), "aria-controls": "size-panel",
        title: "Make the words bigger or smaller",
        onclick: function () { ui.sizeOpen = !ui.sizeOpen; route(true); var b = document.getElementById(ui.sizeOpen ? "size-panel" : "aa-btn"); if (b) b.focus(); } },
      h("span", { class: "aa", "aria-hidden": "true", text: "Aa" }), h("span", { text: "Text size" }));
  }
  function sizePanel() {
    return h("div", { class: "size-panel", id: "size-panel", hidden: !ui.sizeOpen, role: "group", "aria-labelledby": "size-panel-title", tabindex: "-1" },
      h("p", { class: "size-panel-title", id: "size-panel-title", text: "Text size" }),
      h("p", { class: "help", text: "Pick the size that is easiest to read. It applies to every page." }),
      sizeOptions(),
      h("button", { type: "button", class: "btn wide-btn", title: "Close the text size choices",
        onclick: function () { ui.sizeOpen = false; route(true); var b = document.getElementById("aa-btn"); if (b) b.focus(); } }, "Done"));
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && ui.sizeOpen) { ui.sizeOpen = false; route(true); var b = document.getElementById("aa-btn"); if (b) b.focus(); }
  });
  function addButton(forName) {
    return h("a", { class: "add-btn", href: "#add", onclick: function () { ui.addFor = forName || null; ui.added = null; } },
      h("span", { class: "add-icon", "aria-hidden": "true", text: "+" }), h("span", { text: forName ? "Add a prayer for " + firstName(forName) : "Add a prayer" }));
  }
  var PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
  var STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/></svg>';
  var ICON_TODAY = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><path d="M8.5 14.5l2.3 2.3 4.7-4.6"/></svg>';
  var ICON_PEOPLE = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17" cy="9" r="2.8"/><path d="M16.5 14.2c2.9.2 5 2.3 5 5.3"/></svg>';

  var TABS = [
    { key: "today", label: "New", icon: ICON_TODAY, count: today.length, countLabel: " new" },
    { key: "everyone", label: "Members", icon: ICON_PEOPLE, count: 0 },
    { key: "praise", label: "Praise Reports", icon: STAR, count: 0 },
  ];
  var ICON_GEAR = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
  if (DATA.role === "manager") TABS.push({ key: "manage", label: "Manage", icon: ICON_GEAR, count: 0 });
  var LIST_NAMES = { today: "New prayer requests", everyone: "Members", praise: "Praise reports", add: "Add a prayer request", update: "Update a prayer request", "praise-add": "Share a praise report", manage: "Manage", "manage-members": "Manage members", "manage-chat": "Add from chat" };

  // Always-visible navigation: a bar along the bottom on phones, a sidebar on big screens.
  var tabbar = h("nav", { class: "tabbar", "aria-label": "Main" },
    h("div", { class: "side-brand" },
      h("img", { src: LOGO, width: "720", height: "405", alt: "" }),
      h("div", null, h("strong", { text: "Prayer Requests" }), h("span", { text: "Bible & Breakfast" }), h("span", { text: "Group 3" }))),
    h("p", { class: "side-label", text: "Pages" }),
    h("ul", { style: "--tabs:" + TABS.length }, TABS.map(function (t) {
    return h("li", null, h("a", { class: "tabbar-link", href: "#" + t.key, id: "nav-" + t.key },
      h("span", { class: "tab-icon", html: t.icon }),
      h("span", { class: "tab-label", text: t.label }),
      t.count ? h("span", { class: "tab-badge" }, String(t.count), h("span", { class: "sr", text: t.countLabel })) : null));
  })),
    h("div", { class: "side-foot" },
      h("p", null, "Updated", h("br"), h("strong", { text: fmt(DATA.updated, true) })),
      h("p", { text: "New requests are added after each Mon, Wed and Fri study." })));
  var skip = h("a", { class: "skip", href: "#app", onclick: function (e) { e.preventDefault(); var t = document.getElementById("page-title"); if (t) t.focus(); } }, "Skip to main content");
  document.body.insertBefore(tabbar, app);
  document.body.insertBefore(skip, tabbar);
  function updateBadge() {
    var el = document.querySelector("#nav-today .tab-badge");
    if (!el && today.length) { el = h("span", { class: "tab-badge" }); document.getElementById("nav-today").append(el); }
    if (el) { el.hidden = !today.length; el.replaceChildren(String(today.length), h("span", { class: "sr", text: " new" })); }
  }
  function setNav(active) {
    TABS.forEach(function (t) {
      var el = document.getElementById("nav-" + t.key);
      if (t.key === active) el.setAttribute("aria-current", "page"); else el.removeAttribute("aria-current");
    });
  }

  function header(title, sub, action) {
    return h("header", { class: "app-head2" },
      h("div", { class: "brand-row" },
        h("img", { class: "logo", src: LOGO, width: "720", height: "405", alt: "" }),
        h("p", { class: "brand-name" }, h("span", { text: "Bible & Breakfast" }), h("span", { text: "Group 3" }))),
      h("div", { class: "title-row2" },
        h("div", { class: "title-block" },
          h("h1", { id: "page-title", tabindex: "-1", text: title }),
          sub ? h("p", { text: sub }) : null),
        action === "praise" ? praiseButton() : action === "none" ? null : addButton()));
  }
  function sampleNote() { return null; }
  function footer() { return null; }

  function todayPage() {
    return [
      sampleNote(),
      header("New Prayer Requests", latest ? "From the study on " + fmt(latest, true) : "Shared at our Bible studies"),
      today.length ? h("section", { class: "top", "aria-label": "New prayer requests, " + plural(today.length, "person", "people") },
        h("p", { class: "hint lead", text: "Tap a name to read their prayer request." }),
        todayRows()) :
        h("div", { class: "empty" }, h("strong", { text: "No new prayer requests yet." }),
          h("p", { text: "New requests appear here after each Bible study." }),
          h("a", { class: "btn primary", href: "#everyone" }, "See all members")),
      today.length ? h("a", { class: "btn wide-btn", href: "#everyone" }, "See all members ›") : null,
      h("p", { class: "list-note", text: "This list is updated after each Monday, Wednesday and Friday study." }),
      footer()];
  }
  function todayRows() {
    return h("ul", { class: "rows" }, today.map(function (p) {
      var fresh = freshFor(p), more = fresh.length - 1;
      return h("li", null, h("a", { class: "row-link", href: "#" + p.slug, id: "row-" + p.slug,
          "aria-label": p.name + ". New: " + fresh.map(function (it) { return it.text; }).join(". ") },
        h("span", { class: "avatar", "aria-hidden": "true", text: initials(p.name) }),
        h("span", { class: "row-main", "aria-hidden": "true" },
          h("span", { class: "row-name", text: p.name }),
          h("span", { class: "row-preview", text: fresh[0].text }),
          more > 0 ? h("span", { class: "row-more", text: "+ " + more + " more" }) : null),
        h("span", { class: "row-go", "aria-hidden": "true" }, "Read", h("span", { class: "chev", text: "›" }))));
    }));
  }
  function freshFor(p) { return p.open.filter(isNewItem); }

  function everyonePage() {
    return [
      sampleNote(),
      header("Members", plural(everyone.length, "member", "members") + " \u00B7 A to Z"),
      h("p", { class: "members-hint" },
        h("span", { class: "lead-text", text: "Tap a name to see their prayer requests." }),
        latest && today.length ? [" ", h("span", { class: "badge", text: "New" }), " marks a new request."] : null),
      h("ul", { class: "grid" }, everyone.map(function (p) {
        return h("li", null, h("a", { class: "tile" + (p.isNew ? " is-new" : ""), href: "#" + p.slug, id: "tile-" + p.slug,
            "aria-label": p.name + ", " + plural(p.open.length, "prayer request", "prayer requests") + (p.isNew ? ", new" : "") },
          p.isNew ? h("span", { class: "badge", "aria-hidden": "true", text: "New" }) : null,
          h("span", { class: "avatar", "aria-hidden": "true", text: initials(p.name) }),
          h("span", { class: "tile-name", "aria-hidden": "true", text: p.name }),
          h("span", { class: "tile-count", "aria-hidden": "true", text: p.open.length ? "See " + plural(p.open.length, "request", "requests") + " \u203A" : "No requests yet \u203A" })));
      })),
      footer()];
  }

  function reqCard(it, showName, canUpdate) {
    var answered = !!it.answered || it.kind === "praise";
    var isNew = !answered && isNewItem(it);
    var meta = [];
    if (isNew) meta.push(h("span", { class: "badge", text: "New" }));
    if (it.answered) meta.push(h("span", { text: "Asked " + fmt(it.added) + " · Answered " + fmt(it.answered) }));
    else meta.push(h("span", { text: (it.kind === "praise" ? "Shared " : "Asked ") + fmt(it.added) }));
    if (canUpdate) {
      return h("li", { class: "req req-tap" + (isNew ? " is-new" : "") },
        h("a", { class: "req-link", href: "#update", onclick: function () { ui.updating = it; ui.updated = null; },
            "aria-label": it.text + ". Asked " + fmt(it.added) + (isNew ? ", new" : "") + ". Tap if this prayer has been answered." },
          h("span", { class: "req-body", "aria-hidden": "true" },
            h("span", { class: "req-text", text: it.text }),
            h("span", { class: "meta" }, meta)),
          h("span", { class: "chev", "aria-hidden": "true", text: "\u203A" })));
    }
    return h("li", { class: "req" + (answered ? " answered" : "") + (isNew ? " is-new" : "") },
      showName ? h("p", { class: "req-name", text: it.name }) : null,
      h("p", { class: "req-text", text: it.text }),
      it.note ? h("p", { class: "req-note", text: it.note }) : null,
      h("div", { class: "meta" }, meta));
  }

  function personPage(p) {
    var from = ui.lastList || "everyone";
    var list = from === "today" && p.isNew ? today : everyone;
    var first = firstName(p.name);
    return [
      h("div", { class: "topbar" },
        h("a", { class: "btn", href: "#" + (list === today ? "today" : "everyone") }, "‹ Back to " + (list === today ? "New Requests" : "Members"))),
      h("div", { class: "who" + (p.isNew ? " is-new" : "") },
        h("span", { class: "avatar", "aria-hidden": "true", text: initials(p.name) }),
        h("div", null, h("h1", { id: "page-title", tabindex: "-1", text: p.name }),
          h("p", { text: p.open.length ? plural(p.open.length, "prayer request", "prayer requests") : "No prayer requests yet" }))),
      h("section", { class: "top", "aria-labelledby": "pray-title" },
        h("h2", { class: "section-title", id: "pray-title", text: "Please pray for" }),
        p.open.length ? h("ul", { class: "cards" }, p.open.map(function (it) { return reqCard(it); }))
          : h("p", { class: "empty-note", text: "No prayer requests right now." })),
      // One quiet card with both things a person can do here.
      h("nav", { class: "actions-card", "aria-labelledby": "act-title" },
        h("p", { class: "actions-title", id: "act-title", text: "Update " + first + "’s prayer list" }),
        p.open.length ? h("a", { class: "action-row", href: "#update", title: "Choose a prayer that was answered or is no longer needed",
            onclick: function () { ui.updatingPerson = p; ui.updatingSet = null; ui.updated = null; ui.updateChoice = null; } },
          h("span", { class: "action-icon star", html: STAR }),
          h("span", { class: "action-label", text: "Mark a prayer as answered" }),
          h("span", { class: "chev", "aria-hidden": "true", text: "›" })) : null,
        h("a", { class: "action-row", href: "#add", title: "Add a new prayer request for " + p.name,
            onclick: function () { ui.addFor = p.name; ui.added = null; } },
          h("span", { class: "action-icon plus", html: PLUS }),
          h("span", { class: "action-label", text: "Add a new prayer for " + first }),
          h("span", { class: "chev", "aria-hidden": "true", text: "›" }))),
      p.answered.length || p.praise.length ? h("section", { class: "top", "aria-labelledby": "ans-title" },
        h("h2", { class: "section-title", id: "ans-title", text: "Answered prayers and praise" }),
        h("ul", { class: "cards" }, p.answered.concat(p.praise).map(function (it) { return reqCard(it); }))) : null,
      simpleFooter()];
  }
  function simpleFooter() { return null; }

  // ---------- adding a request ----------
  var CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var HEART = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-4.4-9.2-9A5.2 5.2 0 0 1 12 6.6 5.2 5.2 0 0 1 21.2 12C19 16.6 12 21 12 21z"/></svg>';
  function composer() {
    return h("a", { class: "composer", href: "#add", onclick: function () { ui.addFor = null; ui.added = null; } },
      h("span", { class: "plus", html: PLUS }),
      h("span", { class: "composer-text" }, h("span", { text: "Forgot to share at the study?" }), h("strong", { text: "Add a prayer request" })),
      h("span", { class: "chev", "aria-hidden": "true", text: "›" }));
  }
  function remembered() { try { return localStorage.getItem("g3-me") || ""; } catch (e) { return ""; } }

  // Saves a new request or praise report to the group's list.
  function saveRequest(item) {
    return api("add", { name: item.name, text: item.text, kind: item.kind }).then(function (saved) {
      item.id = saved.id; item.added = saved.added; item.source = "web";
      return item;
    }, saveFailed);
  }

  // ---------- form helpers: every field says what it is, and mistakes are easy to recover from ----------
  function need(required) { return h("span", { class: "need" + (required ? "" : " opt"), text: required ? "(required)" : "(optional)" }); }
  function fieldLabel(forId, text, required) { return h("label", { for: forId }, text, " ", need(required)); }
  function fieldLegend(text, required) { return h("legend", null, text, " ", need(required)); }
  function helpText(id, text) { return h("p", { class: "help", id: id, text: text }); }
  function draft(key, val) {
    try {
      if (val === undefined) return localStorage.getItem("g3-draft-" + key) || "";
      if (val) localStorage.setItem("g3-draft-" + key, val); else localStorage.removeItem("g3-draft-" + key);
    } catch (e) { return ""; }
  }
  // A text box that saves as you type and shows how much room is left.
  function textBox(id, key, placeholder, helpId) {
    var MAX = 300;
    var ta = h("textarea", { id: id, class: "input", rows: "4", maxlength: String(MAX), placeholder: placeholder,
      "aria-describedby": helpId + " " + id + "-count " + id + "-err" });
    if (key !== "update") ta.setAttribute("aria-required", "true");
    var saved = draft(key);
    ta.value = saved;
    var count = h("p", { class: "count", id: id + "-count" });
    function update() { var left = MAX - ta.value.length; count.textContent = left <= 60 ? left + " letters left." : "You can write up to " + MAX + " letters."; }
    ta.addEventListener("input", function () { draft(key, ta.value); update(); });
    update();
    return {
      el: ta, count: count,
      restored: saved ? h("p", { class: "restored", text: "We kept what you were writing last time." }) : null,
      clear: function () { draft(key, ""); },
    };
  }
  // The name list, with a way out for anyone who is not on it.
  function nameField(id, preset) {
    var names = (DATA.members || []).slice().sort(function (a, b) { return a.localeCompare(b); });
    var sel = h("select", { id: id, class: "input", "aria-required": "true", "aria-describedby": id + "-help " + id + "-err" },
      h("option", { value: "", text: "Choose your name" }),
      names.map(function (n) { return h("option", { value: n, text: n }); }),
      h("option", { value: "__other", text: "My name is not on this list" }));
    var other = h("input", { id: id + "-other", class: "input", type: "text", autocomplete: "name", maxlength: "60", "aria-required": "true", "aria-describedby": id + "-other-err" });
    var otherErr = h("p", { class: "error", id: id + "-other-err", hidden: true, text: "Please type your name." });
    var otherWrap = h("div", { class: "field sub-field", hidden: true }, fieldLabel(id + "-other", "Please type your name", true), other, otherErr);
    var err = h("p", { class: "error", id: id + "-err", hidden: true, text: "Please choose your name from the list." });
    var start = preset || remembered();
    if (start && names.indexOf(start) < 0) { sel.value = "__other"; other.value = start; otherWrap.hidden = false; }
    else sel.value = start || "";
    sel.addEventListener("change", function () {
      otherWrap.hidden = sel.value !== "__other";
      err.hidden = true; sel.removeAttribute("aria-invalid");
      if (!otherWrap.hidden) other.focus();
    });
    return {
      el: [sel, err, otherWrap],
      value: function () { return sel.value === "__other" ? other.value.trim().replace(/\s+/g, " ") : sel.value; },
      onChange: function (fn) { sel.addEventListener("change", fn); other.addEventListener("change", fn); },
      check: function () {
        err.hidden = true; otherErr.hidden = true; sel.removeAttribute("aria-invalid"); other.removeAttribute("aria-invalid");
        if (!sel.value) { err.hidden = false; sel.setAttribute("aria-invalid", "true"); return { id: id, msg: "Choose your name" }; }
        if (sel.value === "__other" && !other.value.trim()) { otherErr.hidden = false; other.setAttribute("aria-invalid", "true"); return { id: id + "-other", msg: "Type your name" }; }
        return null;
      },
    };
  }
  // A box at the top of the form that lists what still needs fixing, each linked to its field.
  function errorSummary(form, errors) {
    var old = form.querySelector(".error-summary");
    if (old) old.remove();
    if (!errors.length) return;
    var box = h("div", { class: "error-summary", role: "alert", tabindex: "-1" },
      h("p", { class: "error-title", text: errors.length === 1 ? "Please fix one thing before sharing:" : "Please fix " + errors.length + " things before sharing:" }),
      h("ul", null, errors.map(function (er) {
        return h("li", null, h("a", { href: "#" + er.id, title: "Go to this question",
          onclick: function (e) { e.preventDefault(); var f = document.getElementById(er.id); if (f) { f.focus(); f.scrollIntoView({ block: "center" }); } } }, er.msg));
      })));
    form.prepend(box);
    box.focus();
    box.scrollIntoView({ block: "start" });
  }
  function rememberName(name) { try { localStorage.setItem("g3-me", name); } catch (e) {} }
  function removeAdded(item) {
    DATA.items = DATA.items.filter(function (x) { return x !== item; });
    api("update", { id: item.id, change: { removed: true } }).catch(saveFailed);
    shape(); updateBadge();
  }

  var INFO = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M12 11v6"/><path d="M12 7.5h.01"/></svg>';
  var LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  // A calm reminder to keep personal details out of what is shared with the group.
  function privacyNote() {
    return h("aside", { class: "privacy-note", role: "note", "aria-labelledby": "privacy-title" },
      h("p", { class: "privacy-title", id: "privacy-title" }, h("span", { class: "privacy-icon", html: INFO }), "Important note"),
      h("p", { text: "First names only. Leave out medical details, addresses and phone numbers." }),
      h("p", { text: "For anything personal, just write \u201CUnspoken request.\u201D" }));
  }
  function addPage() {
    if (ui.added) return thanksView(ui.added);
    var who = nameField("f-name", ui.addFor);
    var kind = "request";
    function labelFor(k) { return k === "praise" ? "What would you like to thank God for?" : "What would you like us to pray for?"; }
    function exampleFor(k) { return k === "praise" ? "For example: My test results came back clear." : "For example: Healing for my knee after surgery on Tuesday."; }
    var tb = textBox("f-text", "add", exampleFor(kind), "f-text-help");
    var labelWords = h("span", { text: labelFor(kind) });
    var textErr = h("p", { class: "error", id: "f-text-err", hidden: true, text: "Please write a few words about your request." });
    function choice(value, title, sub, icon) {
      var input = h("input", { type: "radio", name: "kind", value: value, id: "k-" + value });
      input.checked = kind === value;
      input.addEventListener("change", function () { ui.addKind = value; labelWords.textContent = labelFor(value); tb.el.placeholder = exampleFor(value); });
      return h("label", { class: "choice", for: "k-" + value, title: title }, input,
        h("span", { class: "choice-icon", html: icon }),
        h("span", { class: "choice-text" }, h("strong", { text: title }), h("span", { text: sub })));
    }
    var submit = h("button", { type: "submit", class: "btn primary wide-btn raised", title: "Share this with everyone in Group 3" }, "Share with the group");
    var form = h("form", { class: "form", novalidate: true },
      h("div", { class: "field" }, fieldLabel("f-name", "Whose prayer request is this?", true),
        helpText("f-name-help", "Choose the name it should appear under."), who.el),
      h("div", { class: "field" }, h("label", { for: "f-text" }, labelWords, " ", need(true)),
        helpText("f-text-help", "Keep it short."),
        tb.restored, tb.el, tb.count, textErr),
      submit,
      h("a", { class: "btn wide-btn", href: "#" + (ui.lastList || "today"), title: "Leave without sharing. What you wrote is kept for next time." }, "Cancel"));
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var errors = [], e1 = who.check(), words = tb.el.value.trim();
      if (e1) errors.push(e1);
      textErr.hidden = !!words; tb.el.setAttribute("aria-invalid", String(!words));
      if (!words) errors.push({ id: "f-text", msg: "Write a few words about your request" });
      if (errors.length) { errorSummary(form, errors); return; }
      submit.disabled = true; submit.textContent = "Sharing…";
      var name = who.value();
      var item = { id: "w" + Date.now(), name: name, kind: "request", text: words.charAt(0).toUpperCase() + words.slice(1),
        added: todayISO(), answered: null, note: "", source: "web" };
      rememberName(name);
      saveRequest(item).then(function () {
        DATA.items.push(item); shape(); updateBadge(); tb.clear();
        ui.added = item; ui.addKind = null; ui.addFor = null;
        route("focus");
      }, function () {
        submit.disabled = false; submit.textContent = "Share with the group";
        errorSummary(form, [{ id: "f-text", msg: "We could not send it just now. Your words are saved. Please try again in a minute." }]);
      });
    });
    return [
      h("div", { class: "topbar" }, h("a", { class: "btn", href: "#" + (ui.lastList || "today") }, "\u2039 Back to " + ({ today: "New Requests", everyone: "Members", praise: "Praise Reports" }[ui.lastList] || "New Requests"))),
      h("div", null,
        h("h1", { class: "page-h1", id: "page-title", tabindex: "-1", text: "Add a Prayer Request" }),
        h("p", { class: "hint", text: "Share something you\u2019d like the group to pray about." })),
      privacyNote(),
      form];
  }
  function thanksView(item) {
    var p = people[item.name];
    var isPraise = item.kind === "praise";
    return [
      h("div", { class: "thanks", role: "status" },
        h("span", { class: "thanks-icon", html: CHECK }),
        h("h1", { id: "page-title", tabindex: "-1", text: "Thank you, " + firstName(item.name) }),
        h("p", { text: isPraise ? "Your praise report was shared with the group." : "Your prayer request was added under your name. The group will see it on the list." }),
        h("a", { class: "btn primary wide-btn", href: isPraise ? "#praise" : "#" + p.slug, onclick: function () { ui.added = null; } },
          isPraise ? "See it on the Praise page" : "See it under your name"),
        h("a", { class: "btn wide-btn", href: "#today", onclick: function () { ui.added = null; } }, "Back to New Requests"),
        h("button", { type: "button", class: "linklike", title: "Take it back and return to the form with your words", onclick: function () {
          removeAdded(item);
          draft(isPraise && item.source === "web" && ui.lastList === "praise" ? "praise" : "add", item.text);
          ui.added = null; ui.addFor = item.name; ui.addKind = item.kind;
          var target = isPraise && ui.lastList === "praise" ? "praise-add" : "add";
          navigate(target);
        } }, "Undo, I want to change it"))];
  }

  // ---------- marking a prayer answered, or taking it off the list ----------
  // Marks a prayer answered (with an optional note), takes it off the list, or undoes either.
  function saveUpdate(item, change) {
    return api("update", { id: item.id, change: change }).catch(saveFailed);
  }
  function saveFailed(err) {
    notify("We could not save that just now. Please check your internet connection and try again.");
    route(true);
    throw err;
  }
  function reload() {
    return api("data").then(function (d) {
      writeCache(d);
      DATA = d; prepare(); shape(); updateBadge();
      if (!/^(add|update|praise-add|paste)$/.test(currentKey())) route(true);
    });
  }
  var loadedAt = Date.now();
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && Date.now() - loadedAt > 60000) { loadedAt = Date.now(); reload().catch(function () {}); }
  });
  function applyChange(item, change) {
    item.answered = change && change.answered || null;
    item.note = change && change.note || item.originalNote || "";
    item.removed = !!(change && change.removed);
  }

  function updatePage() {
    if (ui.updated) return updatedView(ui.updated);
    var p = ui.updatingPerson && people[ui.updatingPerson.name];
    if (!p || !p.open.length) return todayPage();
    // Several prayers can be marked at once.
    var chosen = (ui.updatingSet || []).filter(function (it) { return p.open.indexOf(it) >= 0; });
    if (!chosen.length && p.open.length === 1) chosen = [p.open[0]];
    ui.updatingSet = chosen;
    var choice = ui.updateChoice || "answered";
    var who = nameField("u-who", remembered() || p.name);
    var tb = textBox("u-note", "update", "For example: The surgery went well and she is home.", "u-note-help");
    var noteField = h("div", { class: "field", hidden: choice !== "answered" },
      fieldLabel("u-note", "Would you like to share what happened?", false),
      helpText("u-note-help", "This will be shown with the prayer on the Praise page."), tb.restored, tb.el, tb.count,
      h("p", { class: "error", id: "u-note-err", hidden: true }));
    var submit = h("button", { type: "submit", class: "btn primary wide-btn raised" });
    function submitText() {
      var n = ui.updatingSet.length;
      if (ui.updateChoice === "removed") {
        submit.textContent = n > 1 ? "Take " + n + " off the list" : "Take off the list";
        submit.title = "Take the chosen prayer requests off the prayer list";
      } else {
        submit.textContent = n > 1 ? "Move " + n + " prayers to Praise" : "Move to Praise";
        submit.title = "Move the chosen prayers to Praise Reports";
      }
    }
    var pickErr = h("p", { class: "error", id: "u-pick-err", hidden: true, text: "Please choose at least one prayer request." });
    var pickList = h("div", { class: "choices" }, p.open.map(function (it, i) {
      var input = h("input", { type: "checkbox", name: "which", id: "w-" + i, "aria-describedby": "u-pick-help u-pick-err" });
      input.checked = chosen.indexOf(it) >= 0;
      input.addEventListener("change", function () {
        var at = ui.updatingSet.indexOf(it);
        if (input.checked && at < 0) ui.updatingSet.push(it);
        if (!input.checked && at >= 0) ui.updatingSet.splice(at, 1);
        pickErr.hidden = true; submitText();
        if (ui.updatingSet.length) { var box = document.querySelector(".error-summary"); if (box) box.remove(); }
      });
      return h("label", { class: "choice check", for: "w-" + i, title: "Choose this prayer request" }, input,
        h("span", { class: "choice-text" }, h("strong", { text: it.text }), h("span", { text: "Asked " + fmt(it.added) })));
    }));
    function option(value, title, sub) {
      var input = h("input", { type: "radio", name: "what", value: value, id: "u-" + value });
      input.checked = choice === value;
      input.addEventListener("change", function () { ui.updateChoice = value; noteField.hidden = value !== "answered"; submitText(); });
      return h("label", { class: "choice", for: "u-" + value, title: title }, input,
        h("span", { class: "choice-text" }, h("strong", { text: title }), h("span", { text: sub })));
    }
    var many = p.open.length > 1;
    var form = h("form", { class: "form", novalidate: true },
      h("fieldset", { class: "field", id: "u-pick" },
        fieldLegend(many ? "1. Which prayer requests?" : "This prayer request", true),
        many ? helpText("u-pick-help", "Choose all that apply. You can tick more than one.") : null,
        pickList, pickErr),
      h("fieldset", { class: "field" }, fieldLegend((many ? "2. " : "") + "What happened?", true),
        h("div", { class: "choices", role: "radiogroup", "aria-required": "true", "aria-label": "What happened?" },
          option("answered", "God answered " + (many ? "these prayers" : "this prayer"), "They move to Praise Reports so everyone can celebrate."),
          option("removed", "No longer needed", "They are quietly taken off the prayer list."))),
      noteField,
      h("div", { class: "field" }, fieldLabel("u-who", "Who is updating this?", true),
        helpText("u-who-help", "So the group knows who shared the news."), who.el),
      submit,
      h("a", { class: "btn wide-btn", href: "#" + p.slug, title: "Leave without changing anything" }, "Cancel, keep praying"));
    submitText();
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var errors = [];
      pickErr.hidden = ui.updatingSet.length > 0;
      if (!ui.updatingSet.length) errors.push({ id: "w-0", msg: "Choose at least one prayer request" });
      var e2 = who.check(); if (e2) errors.push(e2);
      if (errors.length) { errorSummary(form, errors); return; }
      var items = ui.updatingSet.slice(), name = who.value();
      submit.disabled = true; submit.textContent = "Saving…";
      rememberName(name);
      var befores = items.map(function (it) { return { answered: it.answered, note: it.note, removed: !!it.removed }; });
      var change = ui.updateChoice === "removed" ? { removed: true, by: name } : { answered: todayISO(), note: tb.el.value.trim(), by: name };
      Promise.all(items.map(function (it) { return saveUpdate(it, change); })).then(function () {
        items.forEach(function (it) { applyChange(it, change); });
        shape(); updateBadge(); tb.clear();
        ui.updated = { items: items, befores: befores, kind: change.removed ? "removed" : "answered" };
        ui.updateChoice = null; ui.updatingSet = null;
        route("focus");
      });
    });
    return [
      h("div", { class: "topbar" }, h("a", { class: "btn", href: "#" + p.slug }, "‹ Back to " + firstName(p.name))),
      h("div", null,
        h("h1", { class: "page-h1", id: "page-title", tabindex: "-1", text: "A prayer was answered" }),
        h("p", { class: "hint", text: "Update " + firstName(p.name) + "’s prayer list. You can undo this afterwards." })),
      form];
  }
  function updatedView(u) {
    var items = u.items || [u.item], befores = u.befores || [u.before];
    var p = people[items[0].name], n = items.length;
    var answered = u.kind === "answered";
    return [
      h("div", { class: "thanks", role: "status" },
        h("span", { class: "thanks-icon", html: answered ? STAR : CHECK }),
        h("h1", { id: "page-title", tabindex: "-1", text: answered ? "Praise God!" : "Taken off the list" }),
        h("p", { text: answered
          ? (n === 1 ? "This prayer is now in Praise Reports for everyone to see:" : n + " prayers are now in Praise Reports for everyone to see:")
          : (n === 1 ? "This request is no longer on the prayer list:" : n + " requests are no longer on the prayer list:") }),
        h("ul", { class: "moved-list" }, items.map(function (it) { return h("li", { text: it.text }); })),
        answered ? h("a", { class: "btn primary wide-btn", href: "#praise", onclick: function () { ui.updated = null; } }, "See Praise Reports") : null,
        h("a", { class: "btn wide-btn" + (answered ? "" : " primary"), href: p ? "#" + p.slug : "#everyone", onclick: function () { ui.updated = null; } },
          p ? "Back to " + firstName(items[0].name) + "’s page" : "Back to Members"),
        h("button", { type: "button", class: "linklike", title: n === 1 ? "Put it back the way it was" : "Put all of them back the way they were", onclick: function () {
          var back = items[0];
          Promise.all(items.map(function (it, i) {
            var b = befores[i].answered || befores[i].removed ? befores[i] : null;
            applyChange(it, b);
            return saveUpdate(it, b);
          })).then(function () {
            shape(); updateBadge(); ui.updated = null;
            navigate(people[back.name] ? people[back.name].slug : "everyone");
          });
        } }, "Undo, I tapped this by mistake"))];
  }

  // ---------- praise page and "share a praise report" ----------
  function praiseRow(it) {
    var answered = !!it.answered, main = answered && it.note ? it.note : it.text;
    return h("li", { class: "praise-row" },
      h("span", { class: "avatar praise-av", "aria-hidden": "true", text: initials(it.name) }),
      h("div", { class: "praise-body" },
        h("p", { class: "praise-head" }, h("strong", { text: it.name }), h("span", { class: "praise-date", text: fmt(it.answered || it.added) })),
        h("p", { class: "praise-kind" }, h("span", { class: "praise-icon", html: STAR }), answered ? "Prayer answered" : "Praise report"),
        h("p", { class: "praise-text", text: main }),
        answered && it.note ? h("p", { class: "praise-was" }, h("span", { text: "Prayer request: " }), it.text) : null));
  }
  // Praise stays short: recent good news first, everything older filed by month (like Photos or an order history).
  function praiseDate(it) { return it.answered || it.added; }
  function monthKey(iso) { return iso.slice(0, 7); }
  function monthLabel(ym) { var p = ym.split("-").map(Number); return new Date(p[0], p[1] - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }); }
  function praiseMonths() {
    var map = {}, order = [];
    praiseItems.forEach(function (it) { var k = monthKey(praiseDate(it)); if (!map[k]) { map[k] = []; order.push(k); } map[k].push(it); });
    return order.sort().reverse().map(function (k) { return { key: k, items: map[k] }; });
  }
  function praisePage() {
    var RECENT_MAX = 10;
    var newest = praiseItems.length ? praiseDate(praiseItems[0]) : "";
    var p0 = newest.split("-").map(Number);
    var cutoff = newest ? new Date(Date.UTC(p0[0], p0[1] - 1, p0[2] - 14)).toISOString().slice(0, 10) : "";
    var recentAll = praiseItems.filter(function (it) { return praiseDate(it) > cutoff; });
    var recent = recentAll.slice(0, RECENT_MAX);
    var months = praiseMonths();
    return [
      header("Praise Reports", plural(praiseItems.length, "answer", "answers") + " to prayer", "praise"),
      praiseItems.length ? [
        h("section", { class: "top", "aria-labelledby": "pr-recent" },
          h("div", null,
            h("h2", { class: "section-title", id: "pr-recent", text: "Recent" }),
            h("p", { class: "hint", text: "Good news from the last two weeks, newest first." })),
          h("ul", { class: "praise-list" }, recent.map(praiseRow)),
          recentAll.length > RECENT_MAX ? h("a", { class: "btn wide-btn", href: "#praise-" + monthKey(newest) }, "See all from " + monthLabel(monthKey(newest)) + " ›") : null),
        h("section", { class: "top", "aria-labelledby": "pr-months" },
          h("div", null,
            h("h2", { class: "section-title", id: "pr-months", text: "By month" }),
            h("p", { class: "hint lead", text: "Tap a month to see all of its praise reports." })),
          h("ul", { class: "rows months" }, months.map(function (m) {
            return h("li", null, h("a", { class: "row-link", href: "#praise-" + m.key, id: "row-praise-" + m.key,
                "aria-label": monthLabel(m.key) + ", " + plural(m.items.length, "praise report", "praise reports") },
              h("span", { class: "avatar month-av", "aria-hidden": "true", html: STAR }),
              h("span", { class: "row-main", "aria-hidden": "true" },
                h("span", { class: "row-name", text: monthLabel(m.key) }),
                h("span", { class: "row-preview", text: plural(m.items.length, "praise report", "praise reports") })),
              h("span", { class: "row-go", "aria-hidden": "true" }, "See", h("span", { class: "chev", text: "›" }))));
          })))]
        : h("div", { class: "empty" }, h("strong", { text: "No praise reports yet." }), h("p", { text: "Answered prayers will appear here." })),
      footer()];
  }
  function praiseMonthPage(ym) {
    var items = praiseItems.filter(function (it) { return monthKey(praiseDate(it)) === ym; });
    return [
      h("div", { class: "topbar" }, h("a", { class: "btn", href: "#praise" }, "‹ Back to Praise Reports")),
      h("div", null,
        h("h1", { class: "page-h1", id: "page-title", tabindex: "-1", text: monthLabel(ym) }),
        h("p", { class: "hint", text: plural(items.length, "praise report", "praise reports") + ", newest first" })),
      items.length ? h("ul", { class: "praise-list" }, items.map(praiseRow))
        : h("div", { class: "empty" }, h("strong", { text: "No praise reports this month." }))];
  }
  function praiseButton() {
    return h("a", { class: "add-btn", href: "#praise-add", onclick: function () { ui.added = null; ui.updated = null; ui.praiseFor = null; ui.praiseText = ""; } },
      h("span", { class: "add-icon", "aria-hidden": "true", text: "+" }), h("span", { text: "Share praise" }));
  }

  function praiseAddPage() {
    if (ui.added) return thanksView(ui.added);
    if (ui.updated) return updatedView(ui.updated);
    var who = nameField("pr-who", ui.praiseWho);
    var pickErr = h("p", { class: "error", id: "pr-pick-err", hidden: true, text: "Please choose one of the options." });
    var textErr = h("p", { class: "error", id: "pr-text-err", hidden: true, text: "Please write a few words about what happened." });
    var tb = textBox("pr-text", "praise", "For example: My test results came back clear!", "pr-text-help");
    var reqWrap = h("div");
    var firstPick = null;
    function openFor() { var p = people[who.value()]; return p ? p.open : []; }
    function drawReqs() {
      reqWrap.replaceChildren(); firstPick = null; pickErr.hidden = true;
      var open = openFor();
      if (!who.value() || !open.length) return;
      function radio(id, value, title, sub) {
        var input = h("input", { type: "radio", name: "about", id: id, "aria-describedby": "pr-pick-err" });
        input.checked = ui.praiseFor === value;
        input.addEventListener("change", function () { ui.praiseFor = value; pickErr.hidden = true; });
        if (!firstPick) firstPick = input;
        return h("label", { class: "choice", for: id, title: title }, input, h("span", { class: "choice-text" }, h("strong", { text: title }), h("span", { text: sub })));
      }
      reqWrap.append(h("fieldset", { class: "field" },
        fieldLegend("Is this about one of " + firstName(who.value()) + "’s prayer requests?", true),
        helpText("pr-pick-help", "If it is, that request moves from the prayer list to Praise."),
        h("div", { class: "choices" },
          open.map(function (it, i) { return radio("pf-" + i, it, it.text, "Asked " + fmt(it.added)); }),
          radio("pf-new", "new", "Something else", "Good news that is not on the prayer list")),
        pickErr));
    }
    who.onChange(function () { ui.praiseWho = who.value(); ui.praiseFor = null; drawReqs(); });
    drawReqs();
    var submit = h("button", { type: "submit", class: "btn primary wide-btn raised", title: "Share this good news with everyone in Group 3" }, "Share praise report");
    var form = h("form", { class: "form", novalidate: true },
      h("div", { class: "field" }, fieldLabel("pr-who", "Who is this from?", true),
        helpText("pr-who-help", "Choose the name it should appear under."), who.el),
      reqWrap,
      h("div", { class: "field" }, fieldLabel("pr-text", "Share your praise report", true),
        helpText("pr-text-help", "Tell the group what God has done."),
        tb.restored, tb.el, tb.count, textErr),
      submit,
      h("a", { class: "btn wide-btn", href: "#praise", title: "Leave without sharing. What you wrote is kept for next time." }, "Cancel"));
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var errors = [], e1 = who.check(), words = tb.el.value.trim(), open = openFor();
      if (e1) errors.push(e1);
      var needPick = !e1 && open.length > 0 && !ui.praiseFor;
      pickErr.hidden = !needPick;
      if (needPick) errors.push({ id: "pf-0", msg: "Choose which prayer this is about, or “Something else”" });
      textErr.hidden = !!words; tb.el.setAttribute("aria-invalid", String(!words));
      if (!words) errors.push({ id: "pr-text", msg: "Write a few words about what happened" });
      if (errors.length) { errorSummary(form, errors); return; }
      var name = who.value();
      submit.disabled = true; submit.textContent = "Sharing…";
      rememberName(name);
      var words2 = words.charAt(0).toUpperCase() + words.slice(1);
      var done = function () { tb.clear(); ui.praiseFor = null; route("focus"); };
      if (ui.praiseFor && ui.praiseFor !== "new") {
        var item = ui.praiseFor, before = { answered: item.answered, note: item.note, removed: !!item.removed };
        var change = { answered: todayISO(), note: words2, by: name };
        saveUpdate(item, change).then(function () { applyChange(item, change); shape(); updateBadge(); ui.updated = { item: item, before: before, kind: "answered" }; done(); });
      } else {
        var praise = { id: "w" + Date.now(), name: name, kind: "praise", text: words2, added: todayISO(), answered: null, note: "", source: "web" };
        saveRequest(praise).then(function () { DATA.items.push(praise); shape(); ui.added = praise; done(); });
      }
    });
    return [
      h("div", { class: "topbar" }, h("a", { class: "btn", href: "#praise" }, "\u2039 Back to Praise")),
      h("div", null,
        h("h1", { class: "page-h1", id: "page-title", tabindex: "-1", text: "Share a Praise Report" }),
        h("p", { class: "hint", text: "Has God answered a prayer? Let the group celebrate with you." })),
      privacyNote(),
      form];
  }

  // ---------- tooltips: every button and link says what it does ----------
  function tip(el, text) { if (el && !el.getAttribute("title")) el.setAttribute("title", text); }
  function addTips() {
    tip(document.getElementById("nav-today"), "See the newest prayer requests");
    tip(document.getElementById("nav-everyone"), "See all members, A to Z");
    tip(document.getElementById("nav-praise"), "See answered prayers and praise reports");
    document.querySelectorAll(".row-link, .tile").forEach(function (a) {
      var n = a.querySelector(".row-name, .tile-name"); if (n) tip(a, "Open " + n.textContent + "’s prayer requests");
    });
    document.querySelectorAll(".add-btn").forEach(function (a) {
      var t = a.textContent;
      tip(a, a.getAttribute("href") === "#praise-add" ? "Share good news or an answered prayer with the group"
        : t.indexOf(" for ") > 0 ? "Add a new prayer request for " + t.split(" for ")[1] : "Add a new prayer request");
    });
    document.querySelectorAll(".topbar > .btn:first-child").forEach(function (a) { tip(a, "Go back to " + a.textContent.replace("‹", "").trim()); });
    document.querySelectorAll(".size-opt").forEach(function (b) { tip(b, "Show the words in " + b.textContent.toLowerCase() + " size"); });
    document.querySelectorAll(".pager .next").forEach(function (a) { var s = a.querySelector("small"); tip(a, "Go to the next person" + (s ? ": " + s.textContent : "")); });
    document.querySelectorAll(".pager a[aria-label]").forEach(function (a) { tip(a, "Go to the " + a.getAttribute("aria-label").toLowerCase()); });
    document.querySelectorAll(".answer-box a").forEach(function (a) { tip(a, "Choose a prayer that was answered or is no longer needed"); });
    document.querySelectorAll('.btn[href="#everyone"]').forEach(function (a) { tip(a, "See all members, A to Z"); });
    document.querySelectorAll(".skip").forEach(function (a) { tip(a, "Jump past the menu to the page itself"); });
    document.querySelectorAll("a, button, select, input, textarea").forEach(function (el) {
      if (el.getAttribute("title")) return;
      var label = el.id && document.querySelector('label[for="' + el.id + '"]');
      tip(el, (label ? label.textContent.replace(/\s*\((required|optional)\)\s*$/i, "") : (el.getAttribute("aria-label") || el.textContent)).trim().replace(/\s+/g, " "));
    });
  }

  // ---------- manager area: only with the manager link ----------
  var ICON_EDIT = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>';
  var ICON_EYE = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var ICON_EYE_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.6 5.1A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6A17.4 17.4 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M3 3l18 18"/></svg>';
  var ICON_TRASH = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/></svg>';
  var ICON_RESTORE = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>';
  function iconBtn(icon, label, onclick, extra) {
    return h("button", { type: "button", class: "icon-btn" + (extra ? " " + extra : ""), "aria-label": label, title: label, onclick: onclick, html: icon });
  }
  function shortText(t) { return t.length > 40 ? t.slice(0, 38) + "…" : t; }
  var DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  // The routine runs at 12:23 pm Eastern on Mondays, Wednesdays and Fridays.
  function nextSortTime(iso) {
    var parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "numeric", hour12: false })
      .formatToParts(iso ? new Date(iso) : new Date());
    var get = function (t) { return parts.filter(function (p) { return p.type === t; })[0].value; };
    var day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
    var mins = (Number(get("hour")) % 24) * 60 + Number(get("minute"));
    for (var k = 0; k < 8; k++) {
      var d = (day + k) % 7;
      if ((d === 1 || d === 3 || d === 5) && (k > 0 || mins < 12 * 60 + 23)) return "around 12:30 pm Eastern on " + DAY_NAMES[d];
    }
    return "after the next study";
  }
  function managePage(page) {
    if (DATA.role !== "manager") return todayPage();
    var section = page === "manage-members" ? "members" : page === "manage-chat" ? "chat" : "requests";
    var all = DATA.all || [];
    var waiting = (DATA.inbox || []).filter(function (c) { return c.status === "Waiting"; }).length;
    var sections = [
      ["requests", "#manage", "Requests", all.filter(function (it) { return !it.archived; }).length],
      ["members", "#manage-members", "Members", (DATA.memberRows || []).length],
      ["chat", "#manage-chat", "From chat", waiting]];
    var seg = h("nav", { class: "seg", "aria-label": "Manage sections" }, sections.map(function (x) {
      return h("a", { class: "seg-btn", href: x[1], "aria-current": section === x[0] ? "page" : null },
        h("span", { text: x[2] }), x[3] ? h("span", { class: "seg-count", text: String(x[3]) }) : null);
    }));
    return [
      header("Manage", "", "none"),
      seg,
      section === "members" ? manageMembers() : section === "chat" ? manageChat() : manageRequests()];
  }

  function manageRequests() {
    var all = (DATA.all || []).slice().sort(function (a, b) { return (b.answered || b.added).localeCompare(a.answered || a.added); });
    var groups = {
      list: all.filter(function (it) { return !it.archived && !it.hidden; }),
      hidden: all.filter(function (it) { return !it.archived && it.hidden; }),
      removed: all.filter(function (it) { return it.archived; }),
    };
    var f = ui.mFilter || "list";
    var chips = [["list", "On the list"], ["hidden", "Hidden"], ["removed", "Removed"]];
    var rows = groups[f];
    return h("section", { class: "top", "aria-label": "Prayer requests" },
      h("div", { class: "chips", role: "group", "aria-label": "Show" }, chips.map(function (c) {
        return h("button", { type: "button", class: "chip", "aria-pressed": String(f === c[0]),
          onclick: function () { ui.mFilter = c[0]; ui.mEdit = null; ui.mConfirm = null; route(true); } },
          h("span", { text: c[1] }), h("span", { class: "chip-count", text: String(groups[c[0]].length) }));
      })),
      rows.length ? h("ul", { class: "manage-list" }, rows.map(manageRow))
        : h("p", { class: "empty-note", text: f === "list" ? "No prayer requests on the list." : f === "hidden" ? "Nothing is hidden." : "Nothing has been removed." }));
  }
  function manageRow(it) {
    if (ui.mEdit === it.id) {
      var names = (DATA.members || []).slice();
      if (names.indexOf(it.name) < 0) names.unshift(it.name);
      var sel = h("select", { id: "me-name", class: "input" }, names.map(function (n) { return h("option", { value: n, text: n }); }));
      sel.value = it.name;
      var ta = h("textarea", { id: "me-text", class: "input", rows: "3", maxlength: "300" });
      ta.value = it.text;
      return h("li", { class: "m-row editing" },
        h("div", { class: "field" }, fieldLabel("me-name", "Name", true), sel),
        h("div", { class: "field" }, fieldLabel("me-text", it.kind === "praise" ? "Praise report" : "Prayer request", true), ta),
        h("div", { class: "manage-actions" },
          h("button", { type: "button", class: "btn primary", onclick: function () {
            if (!ta.value.trim()) { ta.setAttribute("aria-invalid", "true"); ta.focus(); return; }
            manage({ action: "edit", id: it.id, name: sel.value, text: ta.value.trim() }, "Saved.");
          } }, "Save changes"),
          h("button", { type: "button", class: "btn", onclick: function () { ui.mEdit = null; route(true); } }, "Cancel")));
    }
    var who = it.name, what = "“" + shortText(it.text) + "”";
    var actions = it.archived
      ? [iconBtn(ICON_RESTORE, "Restore " + what + " from " + who, function () { manage({ action: "restore", id: it.id }, "Restored to the list."); })]
      : [iconBtn(ICON_EDIT, "Edit " + what + " from " + who, function () { ui.mEdit = it.id; ui.mConfirm = null; route(true); }),
         iconBtn(it.hidden ? ICON_EYE : ICON_EYE_OFF, (it.hidden ? "Show " : "Hide ") + what + " from " + who, function () {
           manage({ action: it.hidden ? "show" : "hide", id: it.id }, it.hidden ? "It shows on the list again." : "Hidden. Find it under Hidden.");
         }),
         iconBtn(ICON_TRASH, "Remove " + what + " from " + who, function () { ui.mConfirm = it.id; route(true); }, "danger")];
    return h("li", { class: "m-row" },
      h("div", { class: "m-line" },
        h("span", { class: "avatar m-av", "aria-hidden": "true", text: initials(it.name) }),
        h("div", { class: "m-main" },
          h("p", { class: "m-name" }, it.name, h("span", { class: "m-date", text: " · " + fmt(it.answered || it.added) })),
          h("p", { class: "m-text", text: it.text }),
          it.kind === "praise" || it.answered ? h("span", { class: "tag", text: it.kind === "praise" ? "Praise" : "Answered" }) : null),
        h("div", { class: "m-actions" }, actions)),
      ui.mConfirm === it.id ? h("div", { class: "m-confirm", role: "group", "aria-label": "Confirm removing" },
        h("span", { text: "Remove this request? You can restore it later." }),
        h("button", { type: "button", class: "btn primary", onclick: function () { ui.mConfirm = null; manage({ action: "archive", id: it.id }, "Removed. Find it under Removed."); } }, "Remove"),
        h("button", { type: "button", class: "btn", onclick: function () { ui.mConfirm = null; route(true); } }, "Cancel")) : null);
  }

  function manageMembers() {
    var link = location.origin + "/" + encodeURIComponent(DATA.memberPath || "");
    var input = h("input", { id: "m-new", class: "input", type: "text", maxlength: "60", autocomplete: "off", placeholder: "For example: Grace O.", "aria-describedby": "m-new-help m-new-err" });
    var err = h("p", { class: "error", id: "m-new-err", hidden: true, text: "Please type a name." });
    return h("section", { class: "top", "aria-label": "Members" },
      h("div", { class: "link-box" },
        h("div", { class: "link-main" }, h("p", { class: "link-label", text: "Group link" }), h("p", { class: "link-text", text: link })),
        copyButton(link)),
      h("form", { class: "member-add", novalidate: true, onsubmit: function (e) {
          e.preventDefault();
          var n = input.value.trim().replace(/\s+/g, " ");
          err.hidden = !!n;
          if (!n) { input.setAttribute("aria-invalid", "true"); input.focus(); return; }
          manage({ action: "member-add", name: n }, n + " was added.");
        } },
        fieldLabel("m-new", "Add a member", true),
        helpText("m-new-help", "First name and last initial."),
        h("div", { class: "inline-add" }, input, h("button", { type: "submit", class: "btn primary" }, "Add")),
        err),
      h("ul", { class: "manage-list" }, (DATA.memberRows || []).map(function (m) {
        return h("li", { class: "m-row" },
          h("div", { class: "m-line" },
            h("span", { class: "avatar m-av", "aria-hidden": "true", text: initials(m.name) }),
            h("p", { class: "m-name member", text: m.name }),
            h("div", { class: "m-actions" }, iconBtn(ICON_TRASH, "Remove " + m.name + " from the member list", function () { ui.mConfirm = m.id; route(true); }, "danger"))),
          ui.mConfirm === m.id ? h("div", { class: "m-confirm", role: "group", "aria-label": "Confirm removing" },
            h("span", { text: "Remove " + m.name + " from the member list?" }),
            h("button", { type: "button", class: "btn primary", onclick: function () { ui.mConfirm = null; manage({ action: "member-remove", id: m.id }, m.name + " was removed."); } }, "Remove"),
            h("button", { type: "button", class: "btn", onclick: function () { ui.mConfirm = null; route(true); } }, "Cancel")) : null);
      })));
  }

  function manageChat() {
    var box = h("textarea", { id: "mc-text", class: "input paste-box", rows: "10", "aria-required": "true", "aria-describedby": "mc-help mc-err",
      placeholder: "Paste the prayer requests from the Zoom chat here." });
    var saved = draft("mchat");
    box.value = saved;
    box.addEventListener("input", function () { draft("mchat", box.value); });
    var err = h("p", { class: "error", id: "mc-err", hidden: true, text: "Please paste the chat first." });
    var submit = h("button", { type: "submit", class: "btn primary wide-btn raised", title: "Send the chat to be sorted onto the list" }, "Send to be sorted");
    var form = h("form", { class: "form", novalidate: true },
      h("div", { class: "field" }, fieldLabel("mc-text", "Zoom chat", true),
        helpText("mc-help", "Paste it exactly as it is. Messy is fine. Each request is sorted under the right name and added to the list " + nextSortTime() + "."),
        saved ? h("p", { class: "restored", text: "We kept what you pasted last time." }) : null, box, err),
      submit);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var chat = box.value.trim();
      err.hidden = !!chat;
      if (!chat) { box.setAttribute("aria-invalid", "true"); box.focus(); return; }
      submit.disabled = true; submit.textContent = "Sending…";
      api("manage", { action: "paste", chat: chat }).then(function () {
        draft("mchat", "");
        return reload();
      }).then(function () { notify("Sent. It will be added to the list " + nextSortTime() + ".", "ok"); }, function () {
        submit.disabled = false; submit.textContent = "Send to be sorted";
        notify("We could not send it just now. Your paste is saved. Please try again in a minute.");
      });
    });
    var inbox = DATA.inbox;
    var STATUS = { "Waiting": "waiting", "Added": "added", "Needs a look": "needs" };
    return h("section", { class: "top", "aria-label": "Add from chat" }, form,
      h("h2", { class: "section-title", text: "Recent chats" }),
      inbox === null ? h("p", { class: "empty-note", text: "The Chat Inbox is not connected yet. In Notion, connect the “Group 3 Chat Inbox” list to the prayer app." })
        : !inbox || !inbox.length ? h("p", { class: "empty-note", text: "Chats you send will show here, with what happened to them." })
        : h("ul", { class: "manage-list" }, inbox.map(function (c) {
            return h("li", { class: "m-row chat-row" },
              h("p", { class: "m-name" }, h("span", { class: "status " + (STATUS[c.status] || "waiting"), text: c.status }),
                h("span", { class: "m-date", text: " Sent " + new Date(c.pastedAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) })),
              h("p", { class: "m-text quiet", text: c.preview + (c.preview.length >= 140 ? "…" : "") }),
              c.status === "Waiting" ? h("p", { class: "hint", text: "Will be added " + nextSortTime(c.pastedAt) + "." }) : null,
              c.note ? h("p", { class: "m-note", text: c.note }) : null);
          })));
  }

  function copyButton(textToCopy) {
    return h("button", { type: "button", class: "btn", title: "Copy the link to send it", onclick: function () {
      var done = function () { notify("Link copied. You can paste it into WhatsApp or an email.", "ok"); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(textToCopy).then(done, function () { selectLink(); });
      else selectLink();
    } }, "Copy link");
  }
  function selectLink() {
    var el = document.querySelector(".link-text");
    if (!el) return;
    var r = document.createRange(); r.selectNodeContents(el);
    var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    notify("The link is selected. Copy it from your phone's menu.", "ok");
  }
  function manage(body, doneMsg) {
    return api("manage", body).then(function () { ui.mEdit = null; return reload(); }).then(function () { notify(doneMsg, "ok"); }, function () {
      notify("That did not save. Please check your internet connection and try again.");
    });
  }

  // ---------- clean addresses: /praying-together/members instead of #everyone ----------
  // Screens keep their short internal names; these two functions translate to and from the address.
  var BASE = "/" + encodeURIComponent(GROUP_KEY);
  var KEY_TO_PATH = { today: "", everyone: "members", praise: "praise-reports", add: "add-prayer", update: "answered-prayer",
    "praise-add": "share-praise", manage: "manage/prayer-requests", "manage-members": "manage/members", "manage-chat": "manage/zoom-chat" };
  function pathFor(key) {
    var m;
    if (KEY_TO_PATH[key] !== undefined) return BASE + (KEY_TO_PATH[key] ? "/" + KEY_TO_PATH[key] : "");
    if ((m = /^p-(.+)$/.exec(key))) return BASE + "/members/" + m[1];
    if ((m = /^praise-(\d{4}-\d{2})$/.exec(key))) return BASE + "/praise-reports/" + m[1];
    return BASE;
  }
  function isRouteKey(key) { return KEY_TO_PATH[key] !== undefined || /^p-./.test(key) || /^praise-\d{4}-\d{2}$/.test(key); }
  function currentKey() {
    var rest = location.pathname.split("/").slice(2).filter(Boolean).map(decodeURIComponent);
    var a = rest[0] || "", b = rest[1] || "";
    if (!a || a === "new") return "today";
    if (a === "members") return b ? "p-" + b : "everyone";
    if (a === "praise-reports") return /^\d{4}-\d{2}$/.test(b) ? "praise-" + b : "praise";
    if (a === "manage") return b === "members" ? "manage-members" : b === "zoom-chat" ? "manage-chat" : "manage";
    for (var k in KEY_TO_PATH) if (KEY_TO_PATH[k] === a) return k;
    return "today";
  }
  function navigate(key, replace) {
    var url = pathFor(key);
    if (url !== location.pathname) history[replace ? "replaceState" : "pushState"]({}, "", url);
    route("focus");
  }
  // Links are written as "#key" in the code; give them real addresses so they look right and open correctly in a new tab.
  function linkify() {
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      var key = a.getAttribute("href").slice(1);
      if (key === "" ) key = "today";
      if (!isRouteKey(key)) return;
      a.setAttribute("data-key", key);
      a.setAttribute("href", pathFor(key));
    });
  }
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest("a[data-key]");
    if (!a) return;
    e.preventDefault();
    navigate(a.getAttribute("data-key"));
  });
  window.addEventListener("popstate", function () { route("focus"); });
  // Old links with a "#" still work: switch them to the clean address.
  if (location.hash.length > 1 && isRouteKey(location.hash.slice(1))) history.replaceState({}, "", pathFor(location.hash.slice(1)));

  // ---------- routing: #today, #everyone, #praise, or #p-name for one person ----------
  function route(keepScroll) {
    var key = currentKey(), y = window.scrollY, kids, page, nav;
    if (bySlug[key]) { kids = personPage(bySlug[key]); page = key; nav = ui.lastList || "everyone"; ui.lastSlug = key; }
    else {
      var month = /^praise-(\d{4}-\d{2})$/.exec(key);
      page = month ? key : LIST_NAMES[key] ? key : "today";
      kids = month ? praiseMonthPage(month[1]) : page === "everyone" ? everyonePage() : page === "praise" ? praisePage() : page === "add" ? addPage() : page === "update" ? updatePage() : page === "praise-add" ? praiseAddPage() : /^manage/.test(page) ? managePage(page) : todayPage();
      if (ui.lastList !== page && !keepScroll) ui.lastSlug = ui.lastList === undefined ? null : ui.lastSlug;
      nav = /^manage/.test(page) ? "manage" : page === "praise-add" || month ? "praise" : page === "add" || page === "update" ? (ui.lastList || "today") : page;
    }
    app.replaceChildren();
    add(app, kids);
    setNav(nav);
    addTips();
    linkify();
    document.title = (bySlug[page] ? bySlug[page].name : /^praise-\d{4}-\d{2}$/.test(page) ? monthLabel(page.slice(7)) + " praise" : LIST_NAMES[page]) + " \u00B7 Group 3 Prayer Requests";
    if (keepScroll === true) { window.scrollTo(0, y); return; }
    if (!bySlug[page] && ui.lastSlug && ui.lastList === page) {
      var spot = document.getElementById("row-" + ui.lastSlug) || document.getElementById("tile-" + ui.lastSlug);
      if (spot) { spot.scrollIntoView({ block: "center" }); spot.focus({ preventScroll: true }); return; }
    }
    if (!bySlug[page] && page !== "add" && page !== "update" && page !== "praise-add" && !/^praise-\d/.test(page)) ui.lastList = page;
    window.scrollTo(0, 0);
    if (keepScroll === "focus") { var t = document.getElementById("page-title"); if (t) t.focus({ preventScroll: true }); }
  }
  route();
  return {
    // A fresh copy arrived from Notion: redraw, unless someone is in the middle of typing.
    refresh: function (d) {
      DATA = d; prepare(); shape(); updateBadge();
      if (!/^(add|update|praise-add|paste|manage-chat)$/.test(currentKey()) && !ui.mEdit) route(true);
    },
  };
}
// ---------- start-up: the link itself is the key ----------
var GROUP_KEY = decodeURIComponent(location.pathname.split("/")[1] || "");
function readResponse(res) {
  if (res.status === 403) { location.replace("/private.html"); throw new Error("private"); }
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}
function api(path, body) {
  return fetch("/api/" + path, {
    method: body ? "POST" : "GET",
    headers: { "x-group-key": GROUP_KEY, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }).then(readResponse);
}
var noticeEl, noticeTimer;
function notify(message, kind) {
  if (!noticeEl) {
    noticeEl = document.createElement("div");
    noticeEl.className = "notice-bar";
    noticeEl.setAttribute("role", "status");
    noticeEl.setAttribute("aria-live", "polite");
    document.body.append(noticeEl);
  }
  noticeEl.className = "notice-bar" + (kind === "ok" ? " ok" : "");
  noticeEl.textContent = message;
  noticeEl.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(function () { noticeEl.hidden = true; }, 7000);
}
// The list is kept on this device so the page opens instantly next time;
// a fresh copy is fetched in the background and the page updates if anything changed.
var CACHE_KEY = "g3-list-" + GROUP_KEY;
function readCache() {
  try { var c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); return c && c.data && c.data.items ? c.data : null; } catch (e) { return null; }
}
function writeCache(d) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data: d })); } catch (e) {}
}
// First visit: a calm launch screen (logo, group name, a gliding line) instead of a blank page.
var LAUNCH = '<div class="launch" id="launch" aria-hidden="true">' +
  '<img src="/app/logo.webp" alt="" width="720" height="405">' +
  '<p class="launch-name">Bible &amp; Breakfast</p><p class="launch-sub">Group 3 \u00B7 Prayer Requests</p>' +
  '<span class="launch-line"><span></span></span></div><p class="sr">Opening the prayer list</p>';
(function boot() {
  var app = document.getElementById("app");
  var cached = readCache();
  // The list was already requested in the first moment the page opened (see the top of the page).
  var first = window.__g3First ? window.__g3First.then(readResponse) : api("data");
  window.__g3First = null;
  if (cached) {
    var live = startApp(cached);
    first.then(function (d) { writeCache(d); live.refresh(d); }, function () {});
    return;
  }
  app.setAttribute("aria-busy", "true");
  // Only show the launch screen if the list takes more than a moment, so it never just flashes.
  var showLaunch = setTimeout(function () { app.innerHTML = LAUNCH; }, 150);
  first.then(function (d) {
    clearTimeout(showLaunch);
    writeCache(d);
    var launch = document.getElementById("launch");
    var start = function () { app.removeAttribute("aria-busy"); app.classList.add("fade-in"); startApp(d); };
    if (!launch || matchMedia("(prefers-reduced-motion: reduce)").matches) { start(); return; }
    launch.classList.add("leaving");
    setTimeout(start, 220);
  }, function (err) {
    clearTimeout(showLaunch);
    if (String(err && err.message) === "private") return;
    app.removeAttribute("aria-busy");
    app.innerHTML = '<div class="empty"><strong>The prayer list could not load.</strong><p>Please check your internet connection.</p><button type="button" class="btn primary" id="retry">Try again</button></div>';
    document.getElementById("retry").onclick = function () { location.reload(); };
  });
})();
