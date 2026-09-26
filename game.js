(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const el = {
    view: $('view'), scene: $('scene'), monster: $('monster'), slash: $('slash'),
    danger: $('danger'), flash: $('flash'), sword: $('sword'), shield: $('shield'),
    level: $('level'), score: $('score'), best: $('best'), streak: $('streak'),
    heroHp: $('heroHp'), heroHpText: $('heroHpText'),
    shieldStatus: $('shieldStatus'),
    foeSprite: $('foeSprite'), foeHp: $('foeHp'), foeHpText: $('foeHpText'), foeName: $('foeName'),
    timerFill: $('timerFill'), question: $('question'), form: $('answerForm'),
    answer: $('answer'), numberPad: $('numberPad'), feedback: $('feedback'),
    backgroundMusic: $('backgroundMusic'), bossMusic: $('bossMusic'),
    volume: $('volume'),
    pauseBtn: $('pauseBtn'), homeBtn: $('homeBtn'), pauseOverlay: $('pauseOverlay'),
    resumeBtn: $('resumeBtn'), pauseHomeBtn: $('pauseHomeBtn'),
    startOverlay: $('startOverlay'), startBtn: $('startBtn'),
    overOverlay: $('overOverlay'), overTitle: $('overTitle'), overStats: $('overStats'), againBtn: $('againBtn'), overHomeBtn: $('overHomeBtn'),
  };
  const ctx = el.scene.getContext('2d');

  const FOES = [
    { name: 'Cave Bat', icon: '🦇' },
    { name: 'Dire Wolf', icon: '🐺' }, { name: 'Skeleton', icon: '💀' },
    { name: 'Wraith', icon: '👻' }, { name: 'Ogre', icon: '👹' },
    { name: 'Troll', icon: '🧌' }, { name: 'Stone Golem', icon: '🗿' },
    { name: 'Imp', icon: '😈' }, { name: 'Giant Spider', icon: '🕷️' },
  ];
  const BOSSES = [
    { name: 'Dragon', icon: '🐉' }, { name: 'Kraken', icon: '🦑' },
    { name: 'Hydra', icon: '🐍' }, { name: 'Demon Lord', icon: '👿' },
  ];
  const HERO_MAX_HP = 100;
  const BEST_KEY = 'runeMath.best';
  const VOLUME_KEY = 'runeMath.volume';
  const SPECIAL_ATTACK_TIME = 3;
  const SPECIAL_ATTACK_MULTIPLIER = 2;
  const SHIELD_STREAK = 3;

  let state = null;
  let best = loadBest();

  // camera / scene state
  let W = 0, H = 0;
  let offset = 0;          // how far down the corridor we've walked
  let speed = 0;           // current walking speed
  let walking = false;
  let approach = 0;        // 0 = monster far away, 1 = in your face
  let approachTarget = 0;
  let last = performance.now();

  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  function loadBest() {
    try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch (e) { return 0; }
  }
  function saveBest(v) {
    try { localStorage.setItem(BEST_KEY, String(v)); } catch (e) { /* storage unavailable */ }
  }
  function loadVolume() {
    try {
      const volume = Number(localStorage.getItem(VOLUME_KEY));
      return Number.isFinite(volume) && volume >= 0 && volume <= 1 ? volume : 0.5;
    } catch (e) { return 0.5; }
  }

  /* ------------------------------------------------------------------ */
  /*  Questions                                                          */
  /* ------------------------------------------------------------------ */
  function makeQuestion(op, level) {
    const big = 10 + level * 8;
    const factor = Math.min(12, 3 + level);
    let a, b, answer;
    switch (op) {
      case '+':
        a = rand(2, big); b = rand(2, big); answer = a + b; break;
      case '−':
        a = rand(5, big + 10); b = rand(1, a - 1); answer = a - b; break;
      case '×':
        a = rand(2, factor); b = rand(2, factor); answer = a * b; break;
      case '÷':
        b = rand(2, Math.min(12, 2 + level)); answer = rand(2, factor); a = b * answer; break;
      default:
        throw new Error('Unknown rune: ' + op);
    }
    return { text: `${a} ${op} ${b}`, answer };
  }

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */
  // Runs fn later, but only if the same game is still going.
  function later(fn, ms) {
    const s = state;
    const run = () => {
      if (state !== s || !s.running) return;
      if (s.paused) { setTimeout(run, 100); return; }
      fn();
    };
    setTimeout(run, ms);
  }

  function play(node, cls, ms = 450) {
    node.classList.remove(cls);
    void node.getBoundingClientRect();
    node.classList.add(cls);
    setTimeout(() => node.classList.remove(cls), ms);
  }

  function popup(text, kind, where) {
    const s = document.createElement('span');
    s.className = `popup ${kind} ${where}`;
    s.textContent = text;
    el.view.appendChild(s);
    setTimeout(() => s.remove(), 1000);
  }

  function say(text, kind) {
    el.feedback.textContent = text;
    el.feedback.dataset.kind = kind || '';
  }

  function walkFor(ms) {
    walking = true;
    setTimeout(() => { walking = false; }, ms);
  }

  function setBattleMusic(isBoss) {
    const active = isBoss ? el.bossMusic : el.backgroundMusic;
    const inactive = isBoss ? el.backgroundMusic : el.bossMusic;
    inactive.pause();
    inactive.currentTime = 0;
    if (!active.paused) return;
    active.play().catch(() => {});
  }

  function pauseBattleMusic(reset = false) {
    el.backgroundMusic.pause();
    el.bossMusic.pause();
    if (reset) {
      el.backgroundMusic.currentTime = 0;
      el.bossMusic.currentTime = 0;
    }
  }

  function setMusicVolume(value) {
    const volume = Math.min(1, Math.max(0, Number(value)));
    el.backgroundMusic.volume = volume;
    el.bossMusic.volume = volume;
    el.volume.value = String(volume);
    try { localStorage.setItem(VOLUME_KEY, String(volume)); } catch (e) { /* storage unavailable */ }
  }

  function render() {
    el.level.textContent = state.level;
    el.score.textContent = state.score;
    el.best.textContent = Math.max(best, state.score);
    el.streak.textContent = state.streak;
    el.heroHp.style.width = (state.hp / state.maxHp * 100) + '%';
    el.heroHpText.textContent = `${state.hp}/${state.maxHp}`;
    el.shieldStatus.hidden = !state.shieldReady;
    el.shield.classList.toggle('ready', state.shieldReady);
    el.foeHp.style.width = (state.monsterHp / state.monsterMax * 100) + '%';
    el.foeHpText.textContent = `${state.monsterHp}/${state.monsterMax}`;
  }

  /* ------------------------------------------------------------------ */
  /*  Monsters                                                           */
  /* ------------------------------------------------------------------ */
  function spawnMonster() {
    const level = state.level;
    const boss = level % 5 === 0;
    const m = boss
      ? BOSSES[(level / 5 - 1) % BOSSES.length]
      : FOES[(level - Math.floor(level / 5) - 1) % FOES.length];
    state.boss = boss;
    state.monsterMax = Math.round((70 + 25 * (level - 1)) * (boss ? 1.8 : 1));
    state.monsterHp = state.monsterMax;
    state.timeLimit = 6;
    el.foeName.textContent = boss ? `${m.name} (boss)` : m.name;
    el.foeSprite.textContent = m.icon;
    el.foeSprite.setAttribute('aria-label', m.name);
    el.foeSprite.classList.remove('fallen');
    setBattleMusic(boss);
    state.monster = m;
    approach = 0;
    approachTarget = 0;
  }

  function appear() {
    el.monster.classList.remove('away');
  }

  function nextQuestion() {
    const op = state.ops[rand(0, state.ops.length - 1)];
    state.q = makeQuestion(op, state.level);
    el.question.textContent = `${state.q.text} = ?`;
    el.answer.value = '';
    el.answer.focus();
    state.qStart = performance.now();
    state.locked = false;
  }

  function timeLeft(now = performance.now()) {
    return Math.max(0, state.timeLimit - (now - state.qStart) / 1000);
  }

  /* ------------------------------------------------------------------ */
  /*  Combat                                                             */
  /* ------------------------------------------------------------------ */
  function resolveHit(left, elapsed) {
    state.locked = true;
    const frac = left / state.timeLimit;
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    const shieldGained = !state.shieldReady && state.streak % SHIELD_STREAK === 0;
    if (shieldGained) state.shieldReady = true;
    const combo = 1 + Math.min(state.streak - 1, 10) * 0.05;
    const specialAttack = elapsed <= SPECIAL_ATTACK_TIME;
    const dmg = Math.round((10 + 50 * frac) * combo * (specialAttack ? SPECIAL_ATTACK_MULTIPLIER : 1));
    state.correct += 1;
    state.timeSum += elapsed;
    state.score += dmg;
    state.monsterHp = Math.max(0, state.monsterHp - dmg);

    const tag = specialAttack ? 'Rune Burst!' : frac > 0.8 ? 'Lightning strike!' : frac > 0.5 ? 'Swift strike!' : 'Strike!';
    say(`${tag} ${dmg} damage`, 'good');
    play(el.sword, 'swing', 500);
    play(el.slash, 'go', 400);
    if (specialAttack) {
      play(el.flash, 'burst', 650);
      popup('RUNE BURST!', 'special', 'foe');
    }
    if (shieldGained) popup('SHIELD READY!', 'shield', 'hero');
    later(() => play(el.foeSprite, 'hurt'), 200);
    popup(`-${dmg}`, 'good', 'foe');

    if (state.monsterHp === 0) {
      const bonus = 50 * state.level;
      state.slain += 1;
      state.score += bonus;
      state.hp = Math.min(state.maxHp, state.hp + 20);
      say(`${state.monster.name} defeated! +${bonus} bonus, +20 health`, 'good');
      later(() => el.foeSprite.classList.add('fallen'), 350);
      render();
      later(() => {
        el.monster.classList.add('away');
        el.question.textContent = 'Onward…';
        walkFor(1400);
      }, 1100);
      later(() => {
        state.level += 1;
        spawnMonster();
        render();
        appear();
        nextQuestion();
      }, 2500);
    } else {
      approach = Math.max(0, approach - 0.35); // knock the monster back
      approachTarget = 0;
      render();
      later(nextQuestion, 500);
    }
  }

  function resolveMiss(timedOut) {
    if (state.locked) return;
    state.locked = true;
    state.streak = 0;
    state.wrong += 1;
    const dmg = Math.round((12 + state.level * 2) * (state.boss ? 1.5 : 1));
    const shieldBlocked = state.shieldReady;
    if (shieldBlocked) state.shieldReady = false;
    else state.hp = Math.max(0, state.hp - dmg);

    say(shieldBlocked
      ? 'Shield shattered! Attack blocked.'
      : timedOut
        ? `Too slow! ${state.q.text} = ${state.q.answer}.`
        : `Not quite: ${state.q.text} = ${state.q.answer}.`, shieldBlocked ? 'good' : 'bad');
    approach = 1.25;
    approachTarget = 1.25;
    play(el.foeSprite, 'lunge');
    later(() => {
      play(el.shield, 'block');
      if (!shieldBlocked) {
        play(el.view, 'shake', 400);
        play(el.flash, 'go', 500);
      }
    }, 180);
    popup(shieldBlocked ? 'BLOCKED!' : `-${dmg}`, shieldBlocked ? 'shield' : 'bad', 'hero');
    render();

    if (state.hp === 0) {
      later(gameOver, 1200);
    } else {
      later(nextQuestion, 1500);
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    if (!state || !state.running || state.locked) return;
    const raw = el.answer.value.trim();
    if (!/^-?\d+$/.test(raw)) return;
    const elapsed = (performance.now() - state.qStart) / 1000;
    const left = Math.max(0, state.timeLimit - elapsed);
    if (Number(raw) === state.q.answer) resolveHit(left, elapsed);
    else resolveMiss(false);
  }

  function onNumberPadClick(e) {
    const button = e.target.closest('button');
    if (!button || !state || !state.running || state.locked) return;
    if (button.dataset.key) {
      el.answer.value += button.dataset.key;
    } else if (button.dataset.action === 'delete') {
      el.answer.value = el.answer.value.slice(0, -1);
    } else if (button.dataset.action === 'submit') {
      el.form.requestSubmit();
    }
  }

  function gameOver() {
    state.running = false;
    pauseBattleMusic(true);
    el.pauseBtn.hidden = true;
    const isBest = state.score > best;
    if (isBest) { best = state.score; saveBest(best); }
    const total = state.correct + state.wrong;
    const acc = total ? Math.round(state.correct / total * 100) + '%' : '-';
    const avg = state.correct ? (state.timeSum / state.correct).toFixed(1) + 's' : '-';
    el.overTitle.textContent = isBest ? 'New best score!' : 'You have fallen';
    el.overStats.innerHTML = [
      ['Level reached', state.level],
      ['Score', state.score],
      ['Best score', best],
      ['Monsters slain', state.slain],
      ['Longest streak', state.bestStreak],
      ['Accuracy', acc],
      ['Average answer time', avg],
    ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    el.overOverlay.hidden = false;
    el.againBtn.focus();
  }

  function pauseGame() {
    if (!state || !state.running || state.paused) return;
    state.paused = true;
    state.pausedAt = performance.now();
    pauseBattleMusic();
    el.pauseOverlay.hidden = false;
    el.resumeBtn.focus();
  }

  function resumeGame() {
    if (!state || !state.running || !state.paused) return;
    const pausedFor = performance.now() - state.pausedAt;
    state.qStart += pausedFor;
    state.paused = false;
    setBattleMusic(state.boss);
    el.pauseOverlay.hidden = true;
    el.answer.focus();
  }

  function goHome() {
    if (state) state.running = false;
    pauseBattleMusic();
    state = null;
    walking = false;
    speed = 0;
    approach = 0;
    approachTarget = 0;
    el.pauseOverlay.hidden = true;
    el.overOverlay.hidden = true;
    el.startOverlay.hidden = false;
    el.pauseBtn.hidden = true;
    el.homeBtn.hidden = true;
    el.monster.classList.add('away');
    el.question.textContent = 'Ready?';
    el.answer.value = '';
    say('', '');
    el.startBtn.focus();
  }

  function startGame() {
    const ops = [...document.querySelectorAll('.ops input:checked')].map((i) => i.value);
    if (!ops.length) return;
    state = {
      ops, level: 1, score: 0, hp: HERO_MAX_HP, maxHp: HERO_MAX_HP,
      streak: 0, bestStreak: 0, shieldReady: false, slain: 0, correct: 0, wrong: 0, timeSum: 0,
      monster: null, monsterHp: 0, monsterMax: 1, boss: false,
      timeLimit: 12, q: null, qStart: 0, locked: true, running: true,
      paused: false, pausedAt: 0,
    };
    el.startOverlay.hidden = true;
    el.overOverlay.hidden = true;
    el.pauseBtn.hidden = false;
    el.homeBtn.hidden = false;
    el.timerFill.style.transform = 'scaleX(1)';
    el.question.textContent = 'Onward…';
    say('Answer fast: quicker answers hit harder.', '');
    spawnMonster();
    el.monster.classList.add('away');
    render();
    walkFor(1300);
    later(() => { appear(); nextQuestion(); }, 1300);
  }

  /* ------------------------------------------------------------------ */
  /*  First-person corridor                                              */
  /* ------------------------------------------------------------------ */
  function resize() {
    const r = el.scene.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    W = r.width;
    H = r.height;
    el.scene.width = Math.round(W * dpr);
    el.scene.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawScene(t, bob) {
    if (!W || !H) return;
    const cx = W / 2;
    const cy = H * 0.46 + bob;
    const f = Math.min(H * 0.95, W * 0.8);
    const floorY = -1, ceilY = 1.15, zn = 0.35, zf = 14, S = 1.6;
    const P = (X, Y, z) => [cx + X * f / z, cy - Y * f / z];

    const quad = (pts, fill) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    };
    const line = (p, q, style, w) => {
      ctx.strokeStyle = style;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(q[0], q[1]);
      ctx.stroke();
    };

    ctx.fillStyle = '#120b14';
    ctx.fillRect(0, 0, W, H);

    // floor
    const fg = ctx.createLinearGradient(0, cy, 0, H);
    fg.addColorStop(0, '#281322'); fg.addColorStop(1, '#6d3c35');
    quad([P(-1, floorY, zn), P(1, floorY, zn), P(1, floorY, zf), P(-1, floorY, zf)], fg);
    // ceiling
    const cg = ctx.createLinearGradient(0, cy, 0, 0);
    cg.addColorStop(0, '#170c18'); cg.addColorStop(1, '#422032');
    quad([P(-1, ceilY, zn), P(1, ceilY, zn), P(1, ceilY, zf), P(-1, ceilY, zf)], cg);
    // walls
    const lg = ctx.createLinearGradient(0, 0, cx, 0);
    lg.addColorStop(0, '#7b3934'); lg.addColorStop(1, '#271321');
    quad([P(-1, ceilY, zn), P(-1, floorY, zn), P(-1, floorY, zf), P(-1, ceilY, zf)], lg);
    const rg = ctx.createLinearGradient(W, 0, cx, 0);
    rg.addColorStop(0, '#7b3934'); rg.addColorStop(1, '#271321');
    quad([P(1, ceilY, zn), P(1, floorY, zn), P(1, floorY, zf), P(1, ceilY, zf)], rg);
    // far wall
    quad([P(-1, ceilY, zf), P(1, ceilY, zf), P(1, floorY, zf), P(-1, floorY, zf)], '#160b13');

    // Staggered stone blocks catch the torchlight on both corridor walls.
    const drawBrickWall = (side) => {
      const rows = 6;
      const depth = 1.8;
      for (let row = 0; row < rows; row += 1) {
        const y0 = floorY + (ceilY - floorY) * row / rows;
        const y1 = floorY + (ceilY - floorY) * (row + 1) / rows;
        const shift = row % 2 ? depth / 2 : 0;
        for (let z0 = zn - shift; z0 < zf; z0 += depth) {
          const near = Math.max(zn, z0);
          const far = Math.min(zf, z0 + depth);
          if (near >= far) continue;
          quad([P(side, y0, near), P(side, y1, near), P(side, y1, far), P(side, y0, far)],
            row % 2 ? 'rgba(112,48,47,0.16)' : 'rgba(227,120,77,0.1)');
          line(P(side, y0, near), P(side, y1, near), 'rgba(30,12,19,0.72)', Math.max(1, 3 / near));
          line(P(side, y0, near), P(side, y0, far), 'rgba(245,151,92,0.2)', Math.max(1, 2 / near));
        }
      }
    };
    drawBrickWall(-1);
    drawBrickWall(1);

    [-0.5, 0, 0.5].forEach((X) => {
      line(P(X, floorY, zn), P(X, floorY, zf), 'rgba(241,157,92,0.2)', 1);
      line(P(X, ceilY, zn), P(X, ceilY, zf), 'rgba(112,47,53,0.2)', 1);
    });
    [[-1, floorY], [1, floorY], [-1, ceilY], [1, ceilY]].forEach(([X, Y]) => {
      line(P(X, Y, zn), P(X, Y, zf), 'rgba(237,133,81,0.4)', 2);
    });

    // A vaulted door gives the corridor the same destination as the home-screen dungeon.
    const doorWidth = f * 0.19;
    const doorHeight = f * 0.27;
    const doorBottom = cy + f * 0.12;
    const doorTop = doorBottom - doorHeight;
    ctx.beginPath();
    ctx.moveTo(cx - doorWidth / 2, doorBottom);
    ctx.lineTo(cx - doorWidth / 2, doorTop + doorWidth / 2);
    ctx.arc(cx, doorTop + doorWidth / 2, doorWidth / 2, Math.PI, 0);
    ctx.lineTo(cx + doorWidth / 2, doorBottom);
    ctx.closePath();
    ctx.fillStyle = '#110911';
    ctx.fill();
    ctx.strokeStyle = '#a54b3e';
    ctx.lineWidth = Math.max(2, f * 0.012);
    ctx.stroke();

    // stone slab lines that slide toward you as you walk
    const shift = offset % S;
    for (let k = 0; ; k++) {
      const z = zn + k * S - shift;
      if (z > zf) break;
      if (z < zn) continue;
      const a = Math.pow(Math.max(0, 1 - z / zf), 0.9);
      const lw = Math.min(6, Math.max(1, 3 / z));
      const col = `rgba(244,161,94,${a * 0.45})`;
      line(P(-1, floorY, z), P(1, floorY, z), col, lw);
      line(P(-1, ceilY, z), P(1, ceilY, z), col, lw);
      line(P(-1, ceilY, z), P(-1, floorY, z), col, lw);
      line(P(1, ceilY, z), P(1, floorY, z), col, lw);
    }

    // torches
    const T = S * 3;
    const tShift = offset % T;
    const tBase = Math.floor(offset / T);
    for (let k = 0; ; k++) {
      const z = zn + 0.8 + k * T - tShift;
      if (z > zf) break;
      if (z < zn + 0.3) continue;
      const idx = tBase + k;
      const side = idx % 2 === 0 ? -1 : 1;
      const [x, y] = P(side * 0.98, 0.55, z);
      const flick = 0.8 + 0.2 * Math.sin(t * 9 + idx * 2.1) + 0.1 * Math.sin(t * 23 + idx);
      const r = (0.9 * f) / z;
      const a = Math.pow(Math.max(0, 1 - z / zf), 0.7);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,190,90,${0.85 * a * flick})`);
      g.addColorStop(0.35, `rgba(240,150,60,${0.3 * a * flick})`);
      g.addColorStop(1, 'rgba(240,150,60,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, 2 * r, 2 * r);

      // Wall bracket, wooden handle, and flame make the light source tangible.
      const torch = Math.max(3, Math.min(34, f * 0.065 / z));
      const inward = -side;
      ctx.fillStyle = `rgba(39,20,22,${a})`;
      ctx.fillRect(x - torch * 0.32, y - torch * 0.14, torch * 0.64, torch * 0.3);
      ctx.strokeStyle = `rgba(25,13,16,${a})`;
      ctx.lineWidth = Math.max(1, torch * 0.16);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + inward * torch * 0.28, y + torch * 0.72);
      ctx.stroke();
      ctx.strokeStyle = `rgba(149,74,37,${a})`;
      ctx.lineWidth = Math.max(1, torch * 0.08);
      ctx.beginPath();
      ctx.moveTo(x + inward * torch * 0.03, y + torch * 0.08);
      ctx.lineTo(x + inward * torch * 0.27, y + torch * 0.68);
      ctx.stroke();

      ctx.fillStyle = `rgba(255,119,42,${a * flick})`;
      ctx.beginPath();
      ctx.moveTo(x, y - torch * 1.08 * flick);
      ctx.quadraticCurveTo(x + torch * 0.44, y - torch * 0.36, x, y + torch * 0.12);
      ctx.quadraticCurveTo(x - torch * 0.44, y - torch * 0.36, x, y - torch * 1.08 * flick);
      ctx.fill();
      ctx.fillStyle = `rgba(255,234,140,${a * flick})`;
      ctx.beginPath();
      ctx.moveTo(x, y - torch * 0.64 * flick);
      ctx.quadraticCurveTo(x + torch * 0.2, y - torch * 0.26, x, y - torch * 0.02);
      ctx.quadraticCurveTo(x - torch * 0.2, y - torch * 0.26, x, y - torch * 0.64 * flick);
      ctx.fill();
    }

    // fog at the far end of the corridor
    const fog = ctx.createRadialGradient(cx, cy, 0, cx, cy, f * 0.55);
    fog.addColorStop(0, 'rgba(7,8,26,0.95)');
    fog.addColorStop(1, 'rgba(7,8,26,0)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, W, H);
  }

  function updateMonster() {
    approach = Math.min(1.3, Math.max(0, approach));
    const s = (0.55 + 0.9 * approach) * (state?.boss ? 1.3 : 1);
    const feetY = H * 0.46 + H * (0.10 + 0.20 * approach);
    el.monster.style.bottom = (H - feetY) + 'px';
    el.monster.style.transform = `translateX(-50%) scale(${s})`;
    const live = state && state.running && !state.locked;
    el.danger.style.opacity = live ? Math.max(0, (approach - 0.6) / 0.4) * 0.7 : 0;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (state && state.running && !state.locked) {
      const left = timeLeft(now);
      const f = Math.min(1, left / state.timeLimit);
      el.timerFill.style.transform = `scaleX(${f})`;
      el.timerFill.dataset.urgency = f > 0.5 ? 'calm' : f > 0.25 ? 'warn' : 'danger';
      approachTarget = 1 - f;
      if (left <= 0) resolveMiss(true);
    }

    if (state && state.paused) {
      drawScene(now / 1000, Math.sin(offset * 4) * 6 * (speed / 3.2));
      updateMonster();
      return;
    }

    speed += ((walking ? 3.2 : 0) - speed) * Math.min(1, dt * 4);
    offset += speed * dt;
    approach += (approachTarget - approach) * Math.min(1, dt * 8);

    drawScene(now / 1000, Math.sin(offset * 4) * 6 * (speed / 3.2));
    updateMonster();
  }

  /* ------------------------------------------------------------------ */
  /*  Wiring                                                             */
  /* ------------------------------------------------------------------ */
  function updateStartButton() {
    el.startBtn.disabled = !document.querySelector('.ops input:checked');
  }

  el.form.addEventListener('submit', onSubmit);
  el.numberPad.addEventListener('click', onNumberPadClick);
  el.startBtn.addEventListener('click', startGame);
  el.pauseBtn.addEventListener('click', pauseGame);
  el.homeBtn.addEventListener('click', goHome);
  el.resumeBtn.addEventListener('click', resumeGame);
  el.pauseHomeBtn.addEventListener('click', goHome);
  el.overHomeBtn.addEventListener('click', goHome);
  el.againBtn.addEventListener('click', () => {
    el.overOverlay.hidden = true;
    el.startOverlay.hidden = false;
    el.startBtn.focus();
  });
  el.volume.addEventListener('input', (e) => setMusicVolume(e.target.value));
  document.querySelectorAll('.ops input').forEach((i) => i.addEventListener('change', updateStartButton));
  document.addEventListener('keydown', (e) => {
    if (state && state.running && /^\d$/.test(e.key) && document.activeElement !== el.answer) el.answer.focus();
  });
  window.addEventListener('resize', resize);

  el.best.textContent = best;
  el.pauseBtn.hidden = true;
  el.homeBtn.hidden = true;
  setMusicVolume(loadVolume());
  resize();
  el.startBtn.focus();
  requestAnimationFrame(frame);
})();
