/* ============================================================
   game.js — เอนจินหลัก (เปิดอิสระ 100% + Dynamic Synergy Bonus)
   ============================================================ */
(function () {
  const D = GAME_DATA;
  const ui = document.getElementById("ui");
  const hud = document.getElementById("hud");
  const modal = document.getElementById("modal");
  const pauseEl = document.getElementById("pause");
  const fader = document.getElementById("fader");

  const YEAR_MIN = 2411, YEAR_MAX = 2500;
  const REIGN_END = 2500;
  const TOTAL_POPULATION = 7000000;

  let G = null;
  let records = loadRecords();
  let screen = "title";
  let paused = false;
  let modalOpen = false;

  function freshState() {
    return {
      name: "", gender: "m", origin: null, dream: null,
      stats: { hp: 50, wis: 30, gold: 30, honor: 30, joy: 50 },
      flags: [], usedEvents: [], log: [], stageIdx: 0, dead: false, deathCause: null, year: D.birthYear || 2421,
    };
  }

  function loadRecords() {
    try {
      const r = JSON.parse(localStorage.getItem("r5_records") || "null");
      if (r && Array.isArray(r.endings)) return r;
    } catch (e) {}
    return { endings: [], lives: 0, best: 0 };
  }
  function saveRecords() {
    try { localStorage.setItem("r5_records", JSON.stringify(records)); } catch (e) {}
  }

  const TH_D = "๐๑๒๓๔๕๖๗๘๙";
  const th = (n) => String(n).replace(/\d/g, (d) => TH_D[+d]);
  const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function esc(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

  function fade(cb) {
    fader.classList.add("on");
    setTimeout(() => { cb(); fader.classList.remove("on"); }, 580);
  }

  let bgFlip = false;
  function setBG(key, fxMode) {
    const a = document.getElementById("bg-a"), b = document.getElementById("bg-b");
    if (!a || !b) return;
    const showEl = bgFlip ? a : b, hideEl = bgFlip ? b : a;
    showEl.style.backgroundImage = `url("assets/${key}.jpg")`;
    showEl.classList.add("show"); hideEl.classList.remove("show");
    bgFlip = !bgFlip;
    if (window.FX) FX.setMode(fxMode || (key === "night" ? "firefly" : key === "village" || key === "forest" ? "petal" : "dust"));
  }

  function renderStats() {
    const box = document.getElementById("stats");
    if (!box) return;
    box.innerHTML = "";
    for (const k of ["hp", "wis", "gold", "honor", "joy"]) {
      const m = D.statMeta[k];
      const val = (G && G.stats && typeof G.stats[k] === "number") ? G.stats[k] : 50;
      const el = document.createElement("div");
      el.className = "stat"; el.dataset.k = k;
      el.innerHTML = `<span class="s-ico">${m.ico}</span>
        <span class="s-name">${m.name}</span>
        <span class="s-bar"><span class="s-fill" style="display:block;height:100%;border-radius:inherit;width:${val}%;background:${m.color}"></span></span>
        <span class="s-val" style="font-size:0.85em;margin-left:4px;font-weight:600;min-width:24px;text-align:right;">${val}</span>`;
      box.appendChild(el);
    }
  }

  function checkSuddenDeath(age) {
    const SUDDEN_DEATH_CHANCE = 0.04;
    if (Math.random() < SUDDEN_DEATH_CHANCE) {
      G.dead = true;
      G.stats.hp = 0;
      G.deathCause = getRandomDeathCause(age);
      G.log.push({ year: G.year, text: `⚡ ชะตาพลิกผันกะทันหัน: ${G.deathCause}` });
      return true;
    }
    return false;
  }

  function animateStatDeltas(deltas) {
    for (const k of Object.keys(deltas)) {
      const el = document.querySelector(`.stat[data-k="${k}"]`);
      if (!el) continue;
      const d = deltas[k];
      const fill = el.querySelector(".s-fill");
      const valEl = el.querySelector(".s-val");
      if (fill && G && G.stats) fill.style.width = G.stats[k] + "%";
      if (valEl && G && G.stats) valEl.textContent = G.stats[k];
      el.classList.remove("pulse"); void el.offsetWidth; el.classList.add("pulse");
      const tag = document.createElement("span");
      tag.className = "delta " + (d >= 0 ? "up" : "down");
      tag.textContent = (d >= 0 ? "+" : "") + d;
      el.appendChild(tag);
      setTimeout(() => tag.remove(), 1700);
    }
  }

  function setTimeline(year, ageLabel) {
    const cursor = document.getElementById("timeline-cursor");
    const reign = document.getElementById("timeline-reign");
    if (!cursor || !reign) return;
    const pct = (y) => ((y - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100;
    cursor.style.left = pct(Math.min(year, YEAR_MAX)) + "%";
    reign.style.left = "0%";
    reign.style.width = pct(REIGN_END) + "%";
    document.getElementById("hud-year").textContent = "พ.ศ. " + th(year);
    document.getElementById("hud-age").textContent = ageLabel;
  }

  function showModal(card, cb) {
    modalOpen = true;
    document.getElementById("modal-ribbon").textContent = card.ribbon || "📰 ข่าวในแผ่นดิน";
    document.getElementById("modal-title").textContent = card.title;
    document.getElementById("modal-year").textContent = card.year || "";
    document.getElementById("modal-text").textContent = card.text;
    const effBox = document.getElementById("modal-effect");
    if (card.effect) {
      const deltas = applyEffects(card.effect, false);
      effBox.innerHTML = deltas.map(([k, v]) =>
        `<span style="color:${v >= 0 ? "#2e7d4f" : "#b34747"}">${D.statMeta[k].ico} ${v >= 0 ? "+" : ""}${v}</span>`
      ).join(" ");
      animateStatDeltas(Object.fromEntries(deltas));
      if (window.AudioSys) AudioSys.sfx(card.effect.joy < 0 || card.effect.hp < 0 ? "gong" : "bell");
    } else {
      effBox.innerHTML = "";
      if (window.AudioSys) AudioSys.sfx("bell");
    }
    modal.classList.remove("hidden");
    document.getElementById("modal-ok").onclick = () => {
      modal.classList.add("hidden");
      modalOpen = false;
      if (window.AudioSys) AudioSys.sfx("page");
      cb && cb();
    };
  }

  function applyEffects(eff, luck = true) {
    const deltas = [];
    const luckRoll = luck ? Math.round(rnd(-2, 3)) : 0;
    for (const k of Object.keys(eff)) {
      let d = eff[k];
      if (luck && d !== 0) d += d > 0 ? Math.max(0, luckRoll) : Math.min(0, luckRoll);
      const before = G.stats[k];
      G.stats[k] = clamp(before + d);
      const real = G.stats[k] - before;
      if (real !== 0) deltas.push([k, real]);
    }
    return deltas;
  }

  function getRandomDeathCause(age) {
    const dc = D.deathCauses;
    if (!dc) return "โรคร้ายและร่างกายทรุดโทรม";
    if (typeof dc === "object" && !Array.isArray(dc)) {
      if (age <= 1 && dc.infant) return pick(dc.infant);
      if (age <= 18 && dc.youth) return pick(dc.youth);
      if (age <= 59 && dc.adult) return pick(dc.adult);
      if (dc.senior) return pick(dc.senior);
    }
    if (Array.isArray(dc)) return pick(dc);
    return "โรคร้ายและร่างกายทรุดโทรม";
  }

  function checkDeath(defaultCause) {
    const currentStage = D.stages && D.stages[G.stageIdx];
    const currentAge = currentStage ? currentStage.age : (G.year - (G.birthYear || 2421));

    if (G.stats.hp <= 0) {
      G.dead = true;
      if (!G.deathCause) G.deathCause = defaultCause || getRandomDeathCause(currentAge);
      return true;
    }
    if (G.stats.hp < 25 && Math.random() < 0.60) {
      G.stats.hp = 0;
      G.dead = true;
      G.deathCause = defaultCause || getRandomDeathCause(currentAge);
      return true;
    }
    return false;
  }

  function getDemographicRank() {
    let score = G.stats.hp + G.stats.wis + G.stats.gold + G.stats.honor + G.stats.joy;
    let percentile = Math.min(99.9, Math.max(1.0, (score / 400) * 100)).toFixed(1);
    let approxPeople = Math.round((TOTAL_POPULATION * percentile) / 100);
    return { percentile, approxPeople };
  }

  /* ---------------- ระบบตรวจเช็กความเชื่อมโยงกับวัยเด็ก (Dynamic Synergy) ---------------- */
  function checkChildhoodSynergy(c) {
    if (!G || !G.flags) return false;
    const childInterest = G.flags.find(f => f.startsWith("interest_"));
    if (!childInterest) return false;
    const domainKey = childInterest.replace("interest_", "");
    
    // ตรวจสอบ Tag ของตัวเลือกหรือ Flag ปัจจุบันว่าตรงกับสายความสนใจในวัยเด็กหรือไม่
    if (c.tags && c.tags.includes(domainKey)) return true;
    if (c.flag && c.flag.includes(domainKey)) return true;
    
    // การจับคู่เปรียบเทียบคำพ้อง
    if (domainKey === "freeman" && c.tags && c.tags.includes("joy")) return true;
    return false;
  }

  function eligibleChoices(st) {
    // ปลดล็อกตัวเลือกให้สุ่มหรือเลือกเล่นได้อิสระ 100% โดยกรองเฉพาะเพศ
    const ok = st.choices.filter(c => {
      if (c.gender && c.gender !== G.gender) return false;
      return true;
    });

    const shuffled = (a) => [...a].sort(() => Math.random() - 0.5);
    const matches = shuffled(ok.filter(c => checkChildhoodSynergy(c)));
    const general = shuffled(ok.filter(c => !checkChildhoodSynergy(c)));

    const chosen = [...matches, ...general].slice(0, 3);
    return chosen.length >= 3 ? chosen : shuffled(ok).slice(0, 3);
  }

  /* ---------------- หน้าจอต่าง ๆ ---------------- */
  function screenTitle() {
    screen = "title";
    hud.classList.add("hidden");
    setBG("title", "dust");
    ui.innerHTML = `
      <section id="screen-title" class="screen">
        <div class="title-frame">
          <div class="title-ornament">❦ ❦ ❦</div>
          <h1 class="game-title">หนึ่งในเจ็ดล้าน</h1>
          <div class="game-subtitle">ชีวิตในแผ่นดินรัชกาลที่ ๕</div>
          <p class="title-tagline">จำลองชีวิตหนึ่งชีวิตท่ามกลางสยามยุคปฏิรูป พ.ศ. ๒๔๒๑–๒๔๙๖<br>เลือกได้อย่างอิสระทุกช่วงวัย — ทักษะในวัยเด็กจะส่งผลต่อยอดสู่อนาคต</p>
          <div class="title-buttons">
            <button id="btn-start" class="btn btn-primary">🌅 เริ่มชะตาชีวิต</button>
            <button id="btn-gallery" class="btn">📖 คลังตอนจบ</button>
          </div>
          <div id="title-records"></div>
          <div class="kbd-hint">เล่นง่าย ๆ ด้วยเมาส์/นิ้วสัมผัส • กด 1–3 เลือกทาง • M ปิดเสียง</div>
        </div>
      </section>`;
    const rec = document.getElementById("title-records");
    if (records.lives > 0 && rec) {
      rec.textContent = `เคยใช้ชีวิตแล้ว ${th(records.lives)} ชีวิต • บารมีสูงสุด ${th(records.best)} • ปลดล็อกตอนจบ ${th(records.endings.length)}/${th(D.endings.length)}`;
    }
    document.getElementById("btn-start").onclick = () => { if (window.AudioSys) { AudioSys.unlock(); AudioSys.sfx("birth"); } setupSel.origin = null; setupSel.dream = null; setupSel.name = ""; screenSetup(0); };
    document.getElementById("btn-gallery").onclick = () => { if (window.AudioSys) { AudioSys.unlock(); AudioSys.sfx("page"); } screenGallery(); };
    if (window.AudioSys) AudioSys.unlock();
  }

  const setupSel = { origin: null, dream: null, gender: "m", name: "", birthYear: 2421 };

  function rollPersona() {
    setupSel.gender = pick(["m", "f"]);
    const originObj = pick(D.origins);
    setupSel.origin = originObj ? originObj.id : D.origins[0].id;
    setupSel.name = pick(D.names[setupSel.gender]);
    setupSel.birthYear = D.birthYear || 2421;
  }

  function screenSetup(step) {
    screen = "setup";
    if (window.AudioSys) AudioSys.sfx("page");
    const dots = `<div class="setup-steps">${[0, 1].map(i => `<div class="step-dot ${i <= step ? "on" : ""}"></div>`).join("")}</div>`;

    if (step === 0) {
      ui.innerHTML = `
        <section class="screen"><div class="setup-wrap">
          <h2 class="setup-title">ความฝันและปณิธานชีวิต</h2>
          <p class="setup-sub">เลือกเส้นทางที่เธอปรารถนา — ทางเลือกในชีวิตจะส่งเสริมตามปณิธานนี้</p>
          ${dots}
          <div class="cards-grid">
            ${D.dreams.map(dr => `
              <div class="pick-card" data-id="${dr.id}">
                <span class="pc-ico">${dr.ico}</span>
                <h3>${dr.name}</h3>
                <p>${dr.desc}</p>
              </div>`).join("")}
          </div>
        </div></section>`;
      ui.querySelectorAll(".pick-card").forEach(c => {
        c.onclick = () => {
          setupSel.dream = c.dataset.id;
          if (window.AudioSys) AudioSys.sfx("chime");
          c.classList.add("selected");
          rollPersona();
          setTimeout(() => screenSetup(1), 380);
        };
      });
    } else {
      if (!setupSel.origin) rollPersona();
      const originObj = D.origins.find(o => o.id === setupSel.origin) || D.origins[0];
      const genderLabel = setupSel.gender === "m" ? "ชาย" : "หญิง";

      ui.innerHTML = `
        <section class="screen"><div class="setup-wrap" style="max-width:640px">
          <h2 class="setup-title">ชะตาชีวิตแรกเกิด</h2>
          <p class="setup-sub">โชคชะตาได้กำหนดชื่อ เพศ ปีเกิด และชาติตระกูลให้คุณเรียบร้อยแล้ว</p>
          ${dots}
          <div class="paper-panel" style="margin-top:4px">
            <div style="background:rgba(0,0,0,0.04); border:1px dashed #a38252; padding:20px; border-radius:8px; text-align:center; margin-bottom:16px;">
              <div style="font-size:0.9em; color:#666; margin-bottom:8px;">🎲 ชะตาชีวิตแรกเกิด:</div>
              <div style="font-size:1.2em; font-weight:bold; color:#2c1d11; margin-bottom:8px;">
                ชื่อ: <span style="color:#4a2c11;">${setupSel.name}</span> &nbsp;|&nbsp; 
                เพศ: <span style="color:#8b0000;">${genderLabel}</span> &nbsp;|&nbsp; 
                ปีเกิด: <span style="color:#2e7d4f;">พ.ศ. ${th(setupSel.birthYear)}</span>
              </div>
              <h3 style="margin:8px 0 4px 0; color:#4a2c11;">${originObj.ico} ${originObj.name} (${originObj.place})</h3>
              <p style="font-size:0.9em; margin:6px 0 0 0; color:#333;">${originObj.desc}</p>
            </div>

            <div class="center-row" style="margin-top:18px">
              <button id="btn-born" class="btn btn-primary">👶 เกิดแล้ว!</button>
            </div>
          </div>
        </div></section>`;

      ui.querySelector("#btn-born").onclick = () => {
        startLife(setupSel.name, setupSel.gender, setupSel.birthYear);
      };
    }
  }

  function startLife(name, gender, birthYear) {
    G = freshState();
    G.name = name;
    G.gender = gender;
    G.year = birthYear || D.birthYear || 2421;
    G.origin = setupSel.origin;
    G.dream = setupSel.dream;
    const o = D.origins.find(x => x.id === G.origin) || D.origins[0];
    if (o && o.base) G.stats = { ...o.base };
    if (window.AudioSys) AudioSys.sfx("birth");

    const INFANT_MORTALITY_RATE = 0.35;
    if (Math.random() < INFANT_MORTALITY_RATE) {
      G.dead = true;
      G.stats.hp = 0;
      G.deathCause = getRandomDeathCause(0);
      G.log.push({ year: G.year, text: `💀 ดับสูญแรกเกิด: ${G.deathCause}` });

      fade(() => {
        hud.classList.add("hidden");
        if (window.AudioSys) AudioSys.sfx("gong");
        showModal({
          ribbon: "🕯️ โชคชะตาแสนสั้น (อัตราการตายทารกยุคโบราณ)",
          year: "พ.ศ. " + th(G.year),
          title: "ทารกไม่รอดชีวิต...",
          text: `น่าเสียดายยิ่งนัก! ทารกน้อย ${G.name} ${G.deathCause} ในยุคที่หมอตำแยและยาโบราณยังเป็นที่พึ่งหลัก ทำได้เพียงทำพิธีอุทิศส่วนกุศลส่งวิญญาณสู่ภพภูมิที่ดี`
        }, () => {
          screenEnding();
        });
      });
      return;
    }

    fade(() => {
      hud.classList.remove("hidden");
      renderStats();
      setTimeline(G.year, "แรกเกิด");
      playStage(0);
    });
  }

  function playStage(idx) {
    screen = "play";
    G.stageIdx = idx;
    const st = D.stages[idx];
    G.year = st.year;
    renderStats();
    setTimeline(st.year, `อายุ ${th(st.age)} ปี`);
    setBG(st.bg);
    
    const cards = [...st.history];
    const next = () => {
      if (cards.length) { showModal(cards.shift(), next); return; }
      if (checkDeath()) { screenEnding(); return; }
      renderScene(st);
    };
    next();
  }

  function renderScene(st) {
    const o = D.origins.find(x => x.id === G.origin) || D.origins[0];
    const choices = eligibleChoices(st);
    G._currentChoices = choices;
    const intro = idx0Intro(st, o);
    
    ui.innerHTML = `
      <section id="screen-play" class="screen">
        <div class="scene-panel">
          <div class="scene-head">
            <span class="scene-stage">${st.stage} • พ.ศ. ${th(st.year)} • อายุ ${th(st.age)} ปี</span>
            <h2 class="scene-title">${st.title}</h2>
          </div>
          <div class="scene-text">${intro}</div>
          <div class="choice-list">
            ${choices.map((c, i) => {
              const isSynergy = checkChildhoodSynergy(c);
              const synergyBadge = isSynergy ? `<span style="font-size:0.75em; color:#d97706; font-weight:bold; margin-left:6px;">[🌟 ต่อยอดปณิธานวัยเด็ก]</span>` : "";
              return `
              <button class="choice-btn" data-i="${i}">
                <span class="c-num">${i + 1}</span>
                <span class="c-ico">${c.ico}</span>
                <span class="c-txt">${c.text}${synergyBadge}</span>
                <span class="c-hint">${c.hint}</span>
              </button>`;
            }).join("")}
          </div>
        </div>
      </section>`;
    ui.querySelectorAll(".choice-btn").forEach(b => {
      b.onclick = () => chooseChoice(st, +b.dataset.i, b);
    });
  }

  function idx0Intro(st, o) {
    if (st.id === "child") return esc(o.intro) + "<br><br>" + esc(st.intro({ name: `<b>${G.name}</b>` })).replace(/&lt;b&gt;|&lt;\/b&gt;/g, (m) => m.includes("/") ? "</b>" : "<b>");
    return esc(st.intro({ name: G.name }));
  }

  function chooseChoice(st, i, btn) {
    if (modalOpen) return;
    const c = G._currentChoices[i];
    if (window.AudioSys) AudioSys.sfx("chime");
    ui.querySelectorAll(".choice-btn").forEach(b => b.disabled = true);
    btn.classList.add("picked");
    setTimeout(() => resolveChoice(st, c), 420);
  }

  function resolveChoice(st, c) {
    if (c.flag && !G.flags.includes(c.flag)) G.flags.push(c.flag);

    if (c.deathRisk && Math.random() < c.deathRisk) {
      G.stats.hp = 0;
      G.dead = true;
      G.deathCause = c.deathMsg || getRandomDeathCause(st.age);
      G.log.push({ year: st.year, text: `💀 ชะตาขาด: ${c.text}` });
      if (window.AudioSys) AudioSys.sfx("gong");

      showModal({
        ribbon: "💀 วาระสุดท้ายของชีวิต",
        year: "พ.ศ. " + th(st.year),
        title: "ชะตาขาด!",
        text: `${G.name} ${G.deathCause}`
      }, () => {
        screenEnding();
      });
      return;
    }

    // คำนวณ Synergy Bonus (+3) ย้อนหลังหากตรงกับวัยเด็ก
    let effMod = { ...c.eff };
    const isSynergy = checkChildhoodSynergy(c);
    if (isSynergy) {
      const dreamObj = D.dreams.find(d => d.id === G.dream);
      const targetStat = dreamObj ? dreamObj.stat : "wis";
      if (typeof effMod[targetStat] === "number") {
        effMod[targetStat] += 3;
      } else {
        effMod["wis"] = (effMod["wis"] || 0) + 3;
      }
    }

    const deltas = applyEffects(effMod, true);
    animateStatDeltas(Object.fromEntries(deltas));
    const good = deltas.reduce((s, [, v]) => s + v, 0) >= 0;
    setTimeout(() => { if (window.AudioSys) AudioSys.sfx(good ? "good" : "bad"); }, 250);
    G.log.push({ year: st.year, text: c.text });

    const chips = deltas.map(([k, v]) =>
      `<span class="fx-chip ${v >= 0 ? "up" : "down"}">${D.statMeta[k].ico} ${D.statMeta[k].name} ${v >= 0 ? "+" : ""}${v}</span>`).join("");

    let customNote = "";
    if (isSynergy) {
      customNote = ' <br><b style="color:#d97706;">✨ (ความรู้และปณิธานที่สั่งสมตั้งแต่ ๘ ขวบ ส่งผลให้เติบโตในเส้นทางนี้ได้อย่างรวดเร็ว +๓)</b>';
    } else if (st.id === "teen") {
      customNote = ' <br><b style="color:#2e7d4f;">💡 (แม้จะก้าวสู่เส้นทางใหม่ แต่ประสบการณ์ในวัยเด็กก็นำมาประยุกต์ใช้ได้อย่างน่าทึ่ง)</b>';
    }

    const panel = document.querySelector(".scene-panel");
    panel.innerHTML = `
      <div class="scene-head"><span class="scene-stage">${st.stage} • ผลลัพธ์</span></div>
      <div class="result-panel">
        <p class="result-text">${esc(c.result({ name: G.name }))}${customNote}</p>
        <div class="result-effects">${chips}</div>
      </div>
      <div class="center-row"><button id="btn-next" class="btn btn-primary">ดำเนินชีวิตต่อ →</button></div>`;
    document.getElementById("btn-next").onclick = () => afterStage(st);
  }

  function afterStage(st) {
    if (window.AudioSys) AudioSys.sfx("page");
    if (checkDeath()) { screenEnding(); return; }

    if (checkSuddenDeath(st.age)) {
      if (window.AudioSys) AudioSys.sfx("gong");
      showModal({
        ribbon: "⚡ อนิจจังของชีวิต (ความเสี่ยงสุ่มกะทันหัน)",
        year: "พ.ศ. " + th(st.year),
        title: "ชะตาขาดกะทันหัน!",
        text: `อนิจจา! ${G.name} ${G.deathCause} เหตุการณ์เกิดขึ้นอย่างไม่คาดฝัน ทิ้งไว้เพียงความทรงจำให้คนรุ่นหลัง`
      }, () => {
        screenEnding();
      });
      return;
    }

    if (Math.random() < 0.45) {
      if (!G.usedEvents) G.usedEvents = [];
      const pool = D.miniEvents.filter(e => {
        if (st.year < e.years[0] || st.year > e.years[1]) return false;
        if (G.usedEvents.includes(e.title)) return false;
        if (e.tags) {
          const o = D.origins.find(x => x.id === G.origin) || D.origins[0];
          const hasMatchingTag = e.tags.some(t => o.tags.includes(t) || G.flags.includes("career_" + t) || G.flags.includes("interest_" + t));
          if (!hasMatchingTag) return false;
        }
        return true;
      });

      if (pool.length) {
        const e = pick(pool);
        G.usedEvents.push(e.title);
        let eff = { ...e.eff };
        if (e.luckBased && Math.random() < 0.3) eff = { gold: 25, joy: 8 };

        const causeMsg = e.deathMsg || getRandomDeathCause(st.age);

        showModal({ ribbon: "🎋 เรื่องราวระหว่างทาง", year: "พ.ศ. " + th(st.year + Math.floor(rnd(0, 3))), title: e.title, text: e.text, effect: eff }, () => {
          if (checkDeath(causeMsg)) { screenEnding(); return; }
          advance(st);
        });
        return;
      }
    }
    advance(st);
  }

  function advance(st) {
    if (G.stageIdx + 1 < D.stages.length) {
      fade(() => playStage(G.stageIdx + 1));
    } else {
      screenEnding();
    }
  }

  function screenEnding() {
    screen = "ending";
    if (window.AudioSys) AudioSys.sfx(G.dead ? "sigh" : "unlock");
    const ending = D.endings.find(e => e.cond(G)) || D.endings[D.endings.length - 1];
    const isNew = !records.endings.includes(ending.id);
    if (isNew) records.endings.push(ending.id);
    records.lives++;

    const dream = D.dreams.find(d => d.id === G.dream);
    let dreamScore = 0;
    if (dream) {
      dreamScore = dream.id === "joy" ? Math.round((G.stats.joy + G.stats.hp) / 2) : G.stats[dream.stat];
    }
    const dreamOK = dreamScore >= 70, dreamMid = dreamScore >= 50;
    const bonus = dreamOK ? 40 : dreamMid ? 15 : 0;
    const score = G.dead
      ? Math.round((G.stats.hp + G.stats.wis + G.stats.gold + G.stats.honor + G.stats.joy) / 2)
      : G.stats.hp + G.stats.wis + G.stats.gold + G.stats.honor + G.stats.joy + bonus;
    const isBest = score > records.best;
    if (isBest) records.best = score;
    saveRecords();

    const rankInfo = getDemographicRank();
    const ageAtEnd = G.year - (G.birthYear || 2421);
    const lifespan = G.dead 
      ? `ดับสูญในปี พ.ศ. ${th(G.year)}` 
      : `ใช้ชีวิตยืนยาวจนถึงปี พ.ศ. ${th(G.year)}`;
    const story = ending.story({ name: G.name });

    const causeText = G.dead 
      ? (G.deathCause || getRandomDeathCause(ageAtEnd))
      : "สิ้นอายุขัยตามธรรมชาติด้วยโรคชรายามชราภาพ";

    // สรุปประวัติปณิธานในวัยเด็ก
    const childFlag = G.flags.find(f => f.startsWith("interest_"));
    const childText = childFlag 
      ? childFlag.replace("interest_scholar", "เรียนหนังสือ/วิชาการ")
                 .replace("interest_merchant", "การค้าขาย/คิดเงิน")
                 .replace("interest_artisan", "งานช่างฝีมือ")
                 .replace("interest_soldier", "ฝึกฝนทักษะการต่อสู้")
                 .replace("interest_doctor", "ศึกษายาสมุนไพร")
                 .replace("interest_freeman", "วิ่งเล่นสั่งสมประสบการณ์ชีวิต")
      : "การเรียนรู้ในวัยเยาว์";

    const deathCardHtml = `
      <div style="background:${G.dead ? 'rgba(179, 71, 71, 0.12)' : 'rgba(46, 125, 79, 0.12)'}; border:1px solid ${G.dead ? '#b34747' : '#2e7d4f'}; padding:12px; border-radius:8px; margin:12px 0; text-align:center;">
        <div style="font-size:0.85em; color:${G.dead ? '#8b0000' : '#1e5233'}; font-weight:bold; margin-bottom:4px;">
          ${G.dead ? '💀 สาเหตุการเสียชีวิต / วาระสุดท้าย' : '🕊️ การสิ้นสุดชะตาชีวิต'}
        </div>
        <div style="font-size:1.1em; font-weight:bold; color:#2c1d11;">
          "${esc(causeText)}"
        </div>
        <div style="font-size:0.85em; color:#666; margin-top:4px;">(ณ พ.ศ. ${th(G.year)} • อายุประมาณ ${th(ageAtEnd)} ปี)</div>
      </div>
    `;

    setBG("night", "firefly");
    const s = G.stats;
    const originObj = D.origins.find(o => o.id === G.origin) || D.origins[0];
    ui.innerHTML = `
      <section id="screen-ending" class="screen">
        <div class="paper-panel ending-panel">
          <div class="ending-kicker">${isNew ? "✨ ปลดล็อกตอนจบใหม่! ✨" : "ตอนจบที่เคยพบแล้ว"}</div>
          <h2 class="ending-title">${ending.ico} ${ending.title}</h2>
          <div class="ending-life">${esc(G.name)} • ${originObj.name} • ${lifespan}</div>

          ${deathCardHtml}

          <div style="background:rgba(46,125,79,0.08); border:1px dashed #2e7d4f; padding:10px; border-radius:8px; margin:8px 0; text-align:center; font-size:0.9em; color:#1e5233;">
            🌱 <b>เส้นทางชีวิตจากวัยเด็ก:</b> จากการสั่งสมความสนใจในเรื่อง <b>"${childText}"</b> ตอนอายุ ๘ ขวบ ได้กลายเป็นรากฐานสำคัญที่ส่งผลต่อชีวิตตลอดทั้ง ๔ รัชกาล
          </div>

          <div style="background:rgba(185,138,58,0.12); border:1px dashed #b98a3a; padding:12px; border-radius:8px; margin:12px 0; text-align:center;">
            <div style="font-size:0.9em; color:#555;">📊 สถิติชะตาชีวิตในแผ่นดิน:</div>
            <div style="font-size:1.1em; font-weight:bold; color:#2c1d11;">
              คุณคือกลุ่มประชากร <span style="color:#b34747; font-size:1.2em;">Top ${rankInfo.percentile}%</span> ของประชากรสยาม ๗ ล้านคน
            </div>
            <div style="font-size:0.85em; color:#666; margin-top:2px;">(ประมาณอันดับที่ ${th(rankInfo.approxPeople)} จาก ๗,๐๐๐,๐๐๐ ชีวิต)</div>
          </div>

          <div class="ending-dream ${dreamOK ? "ok" : dreamMid ? "mid" : "no"}">
            ${dream ? `${dream.ico} ความฝัน “${dream.name}” — ${dreamOK ? "บรรลุเป้าหมายสูงสุด!" : dreamMid ? "ประสบความสำเร็จตามสมควร" : "ฝันไม่สำเร็จ แต่ชีวิตยังมีค่า"}` : ""}
          </div>
          <div class="ending-story">${esc(story)}</div>
          <div class="ending-stats">
            ${["hp", "wis", "gold", "honor", "joy"].map(k => `
              <div class="ending-stat"><b>${th(s[k])}</b>${D.statMeta[k].ico} ${D.statMeta[k].name}</div>`).join("")}
          </div>
          <div class="ending-score">🏅 คะแนนบารมี: ${th(score)} ${isBest ? '<span class="ending-new">สถิติใหม่!</span>' : ""}</div>
          <ul class="life-log">${G.log.map(l => `<li><b>พ.ศ. ${th(l.year)}</b> — ${esc(l.text)}</li>`).join("")}</ul>
          <div class="center-row" style="gap:12px;flex-wrap:wrap">
            <button id="btn-again" class="btn btn-primary">🌱 เกิดใหม่อีกชีวิต</button>
            <button id="btn-gal2" class="btn">📖 คลังตอนจบ (${th(records.endings.length)}/${th(D.endings.length)})</button>
            <button id="btn-home" class="btn">🏠 หน้าปก</button>
          </div>
        </div>
      </section>`;
    if (isNew && !G.dead && window.FX) {
      const rect = ui.querySelector(".ending-panel").getBoundingClientRect();
      FX.burst(rect.left + rect.width / 2, rect.top + 60);
    }
    document.getElementById("btn-again").onclick = () => { if (window.AudioSys) AudioSys.sfx("page"); setupSel.origin = null; setupSel.dream = null; setupSel.name = ""; screenSetup(0); };
    document.getElementById("btn-gal2").onclick = () => { if (window.AudioSys) AudioSys.sfx("page"); screenGallery(); };
    document.getElementById("btn-home").onclick = () => { if (window.AudioSys) AudioSys.sfx("page"); screenTitle(); };
  }

  function screenGallery() {
    screen = "gallery";
    setBG("forest", "petal");
    ui.innerHTML = `
      <section id="screen-gallery" class="screen">
        <div class="paper-panel gallery-panel">
          <div class="gallery-head">
            <h2>📖 คลังตอนจบ</h2>
            <span class="gallery-count">ปลดล็อก ${th(records.endings.length)} / ${th(D.endings.length)}</span>
          </div>
          <div class="gallery-grid">
            ${D.endings.map(e => {
              const got = records.endings.includes(e.id);
              return `<div class="g-card ${got ? "" : "locked"}">
                <div class="g-ico">${got ? e.ico : "❔"}</div>
                <h4>${got ? e.title : "ยังไม่เคยพบ"}</h4>
                <p>${got ? "เคยใช้ชีวิตถึงตอนจบนี้แล้ว" : "ใช้ชีวิตให้ถึงเส้นทางนี้เพื่อปลดล็อก"}</p>
              </div>`;
            }).join("")}
          </div>
          <div class="center-row" style="margin-top:16px">
            <button id="btn-back" class="btn btn-primary">← กลับ</button>
          </div>
        </div>
      </section>`;
    document.getElementById("btn-back").onclick = () => { if (window.AudioSys) AudioSys.sfx("page"); screenTitle(); };
  }

  const btnMute = document.getElementById("btn-mute");
  function syncMute() { 
    if (btnMute && window.AudioSys) btnMute.textContent = AudioSys.muted ? "🔕" : "🔔"; 
  }
  if (btnMute) {
    btnMute.onclick = () => { 
      if (window.AudioSys) {
        AudioSys.unlock(); 
        AudioSys.setMuted(!AudioSys.muted); 
        syncMute(); 
        if (!AudioSys.muted) AudioSys.sfx("click");
      }
    };
  }
  syncMute();

  const btnPause = document.getElementById("btn-pause");
  if (btnPause) btnPause.onclick = togglePause;

  function togglePause() {
    if (screen !== "play") return;
    paused = !paused;
    if (pauseEl) pauseEl.classList.toggle("hidden", !paused);
    if (window.AudioSys) AudioSys.sfx("click");
  }

  const pauseResume = document.getElementById("pause-resume");
  const pauseRestart = document.getElementById("pause-restart");
  const pauseTitle = document.getElementById("pause-title");

  if (pauseResume) pauseResume.onclick = togglePause;
  if (pauseRestart) pauseRestart.onclick = () => { paused = false; if (pauseEl) pauseEl.classList.add("hidden"); setupSel.origin = null; setupSel.dream = null; setupSel.name = ""; screenSetup(0); };
  if (pauseTitle) pauseTitle.onclick = () => { paused = false; if (pauseEl) pauseEl.classList.add("hidden"); screenTitle(); };

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "m" || ev.key === "M") { if (btnMute) btnMute.click(); return; }
    if (ev.key === "Escape") { togglePause(); return; }
    if (paused) return;
    if (modalOpen && (ev.key === "Enter" || ev.key === " ")) {
      ev.preventDefault();
      document.getElementById("modal-ok").click(); return;
    }
    if (screen === "title" && (ev.key === "Enter" || ev.key === " ")) {
      ev.preventDefault(); document.getElementById("btn-start").click(); return;
    }
    if (screen === "play") {
      const next = document.getElementById("btn-next");
      if (next && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); next.click(); return; }
      const idx = ["1", "2", "3"].indexOf(ev.key);
      if (idx >= 0) {
        const btns = ui.querySelectorAll(".choice-btn");
        if (btns[idx]) btns[idx].click();
      }
    }
  });

  document.addEventListener("pointerdown", () => { if (window.AudioSys) AudioSys.unlock(); }, { once: true });

  screenTitle();
})();