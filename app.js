'use strict';
// BellaSpeller, version 1. Everything is stored on this device only.

const KEY = 'star-speller-1';
const APP_VERSION = 'version 1.7, 14 November 2026'; // change this with every release
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function fresh() {
  return {
    pin: null, name: '', girls: ['Priya', 'Maya', 'Jess', 'Tilly'], meIn: false,
    weeks: [{
      id: 'w1', label: 'Try-out week',
      rule: 'Adding -ing or -er to words ending in e with a consonant before it',
      words: [
        { w: 'nice' }, { w: 'nicer' }, { w: 'shiny' }, { w: 'shining' }, { w: 'being' },
        { w: 'every', red: true, say: 'ev-er-y' }, { w: 'everyone', red: true, say: 'ev-er-y-one' }, { w: 'other', red: true }
      ],
      score: null, ep: 'shiny-shoes'
    }],
    cur: 'w1', log: [], stars: 0, story: {}
  };
}
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.weeks && s.weeks.length) return s; } catch (e) { } return fresh(); }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }
let S = load();
const curWeek = () => S.weeks.find(w => w.id === S.cur) || S.weeks[S.weeks.length - 1];
const epOf = wk => (S.eps && S.eps[wk.ep]) || window.EPISODES[wk.ep];

// ---------- stories written by AI (grown-ups page only) ----------
const DEFAULT_MODEL = 'anthropic/claude-sonnet-5.5';
const STORY_RULES = `You write a short three-part story for a spelling app used at home by a nine-year-old girl in England. She is the author: she chooses what happens, and she writes the week's spelling words herself, inside things the characters write (a note, an invitation, a diary line, a sign, a list).

Style: real girls with ordinary problems (friendship, school, family, sleepovers), warm and funny, in British English. Short, plain sentences that sound good read aloud. No fantasy, no romance, nothing frightening or unkind. Nobody is ever teased about reading, spelling or being clever.

Characters: exactly four girls, written only as {g1}, {g2}, {g3} and {g4}. Never invent names for them. Other people have no names (her dad, the new teacher, a little brother).

Reply with one JSON object: {"title": string, "parts": [part1, part2, part3]}. Each part is a list of beats. A beat is one of:
{"n": "narration, at most two sentences"}
{"c": {"q": "a question about what happens next", "o": [{"l": "short option", "n": "what happens, at most two sentences"}, {"l": "short option", "n": "what happens, at most two sentences"}]}}
{"w": {"word": "the spelling word", "lead": "one short sentence saying who is writing what", "before": "text before the word", "after": "text after the word"}}
In a w beat, before + word + after must read as one natural sentence that the character writes. The word is in lower case exactly as given, and is never the first word of the sentence.

Rules:
1. Parts 1 and 2 together use every spelling word exactly once, split about evenly. Each of these parts has two or three narration beats and exactly one choice, and ends with a narration beat that is a cliffhanger. Both options of a choice must lead sensibly into the rest of the part.
2. Part 3 opens with one or two narration beats that resolve the cliffhanger. Then it uses every spelling word once more, each in its own w beat, as one shared piece of writing (club rules, a letter, a poster). Then one closing narration beat. Part 3 has no choice.
3. Most important: a spelling word must never appear anywhere except as the "word" of its own w beat. Not in the title, the narration, the choices, the leads, or the before and after text of any beat. Choose a different word.
4. Reply with the JSON object only.`;

function checkEpisode(ep, words) {
  const bad = [];
  if (!ep || !Array.isArray(ep.parts) || ep.parts.length !== 3) return ['It does not have three parts.'];
  const texts = [String(ep.title || '')];
  const used = [[], [], []];
  ep.parts.forEach((part, pi) => {
    if (!Array.isArray(part)) { bad.push('Part ' + (pi + 1) + ' is not a list.'); return; }
    let choices = 0;
    part.forEach(b => {
      if (b && typeof b.n === 'string') texts.push(b.n);
      else if (b && b.c && Array.isArray(b.c.o) && b.c.o.length >= 2) { choices++; texts.push(String(b.c.q)); b.c.o.forEach(o => texts.push(String(o.l), String(o.n))); }
      else if (b && b.w && typeof b.w.word === 'string') {
        b.w.word = b.w.word.toLowerCase(); b.w.lead = String(b.w.lead || ''); b.w.before = String(b.w.before || ''); b.w.after = String(b.w.after || '');
        used[pi].push(b.w.word); texts.push(b.w.lead, b.w.before, b.w.after);
        if (!words.includes(b.w.word)) bad.push('"' + b.w.word + '" is not one of the words.');
      } else bad.push('Part ' + (pi + 1) + ' has a beat the app cannot read.');
    });
    if (pi < 2 && choices !== 1) bad.push('Part ' + (pi + 1) + ' should have exactly one choice.');
  });
  const first = used[0].concat(used[1]);
  words.forEach(w => {
    if (first.filter(x => x === w).length !== 1) bad.push('"' + w + '" should be written exactly once in parts 1 and 2.');
    if (used[2].filter(x => x === w).length !== 1) bad.push('"' + w + '" should be written exactly once in part 3.');
    const re = new RegExp('(^|[^a-z])' + w.replace(/[^a-z]/g, '.') + '($|[^a-z])', 'i');
    if (texts.some(t => re.test(t))) bad.push('"' + w + '" is shown in the story text, which gives the spelling away.');
  });
  if (texts.some(t => /\{(?!g[1-4]\})/.test(t))) bad.push('It uses a name placeholder the app does not know.');
  return bad;
}
async function askAI(wk, problems) {
  const words = wk.words.map(x => x.w);
  let ask = 'This week\'s spelling words: ' + words.join(', ') + '.';
  if (problems && problems.length) ask += '\n\nYour last draft had these problems. Write a new story that avoids them:\n- ' + problems.join('\n- ');
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + S.orKey, 'Content-Type': 'application/json', 'X-Title': 'BellaSpeller' },
    body: JSON.stringify({ model: S.orModel || DEFAULT_MODEL, max_tokens: 4000, messages: [{ role: 'system', content: STORY_RULES }, { role: 'user', content: ask }] })
  });
  if (!r.ok) throw new Error('The AI service answered ' + r.status + '. ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  const c = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
  const t = typeof c === 'string' ? c : Array.isArray(c) ? c.map(x => x.text || '').join('') : '';
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('The reply was not a story.');
  return JSON.parse(t.slice(a, b + 1));
}
async function draftStory(wk) {
  const words = wk.words.map(x => x.w);
  let problems = [];
  for (let i = 0; i < 2; i++) {
    const ep = await askAI(wk, problems);
    problems = checkEpisode(ep, words);
    if (!problems.length) { ep.title = String(ep.title || 'This week\'s story'); ep.words = words; return ep; }
  }
  throw new Error('Two drafts had problems (' + problems[0] + ') Please try again.');
}
function storyPreview(ep) {
  return `<h3>${esc(ep.title)}</h3>` + ep.parts.map((part, i) => `<p><b>Part ${i + 1}</b></p>` + part.map(b =>
    b.n ? `<p>${esc(fill(b.n))}</p>`
      : b.c ? `<p><i>She chooses: ${esc(fill(b.c.q))}</i></p><ul>${b.c.o.map(o => `<li>${esc(fill(o.l))}: ${esc(fill(o.n))}</li>`).join('')}</ul>`
        : `<p>${esc(fill(b.w.lead))} “${esc(fill(b.w.before))}<b>[${esc(b.w.word)}]</b>${esc(fill(b.w.after))}”</p>`).join('')).join('');
}

// ---------- speech ----------
let voice = null;
function pickVoice() {
  const v = speechSynthesis.getVoices(), en = v.filter(x => /^en/i.test(x.lang));
  let c = S.voiceName && v.find(x => x.name === S.voiceName);
  if (!c && en.length) {
    const score = x => {
      let s = 0;
      if (/en[-_]GB/i.test(x.lang)) s += 10;
      if (/natural|online/i.test(x.name)) s += 20;
      if (/sonia|libby|maisie|hazel|susan|serena|female/i.test(x.name)) s += 8;
      if (/george|ryan|thomas|daniel|alfie|mark|david|\bmale\b/i.test(x.name) && !/female/i.test(x.name)) s -= 8;
      return s;
    };
    c = en.slice().sort((a, b) => score(b) - score(a))[0];
  }
  voice = c || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
// ----- recorded voices (OpenRouter text-to-speech), saved on this device -----
const PRESETS = [
  { id: 'ms-emily', label: 'Emily, British (Microsoft)', model: 'microsoft/mai-voice-2.1-flash', voice: 'en-GB-Emily:MAI-Voice-2.1-Flash' },
  { id: 'mistral-jane', label: 'Jane, British (Mistral)', model: 'mistralai/voxtral-mini-tts-3-0', voice: 'gb_jane_neutral' },
  { id: 'el-alice', label: 'Alice (ElevenLabs)', model: 'elevenlabs/eleven-flash-v2.5', voice: 'alice' },
  { id: 'el-lily', label: 'Lily (ElevenLabs)', model: 'elevenlabs/eleven-flash-v2.5', voice: 'lily' },
  { id: 'el-matilda', label: 'Matilda (ElevenLabs)', model: 'elevenlabs/eleven-flash-v2.5', voice: 'matilda' }
];
const POOL = ['Priya', 'Maya', 'Jess', 'Tilly', 'Zara', 'Ellie', 'Ruby', 'Amber', 'Daisy', 'Freya', 'Lola', 'Poppy', 'Isla', 'Hana', 'Skye', 'Rosie'];
const PRAISE = ['Brilliant!', 'Well done!', 'Spot on!', 'You got it!', 'Fantastic!', 'Super spelling!'];
const FIX_TAIL = ' Have a good look. Then try once more.';
const FIX_A = 'So close. The yellow letters were hiding.', FIX_B = 'So close. Here is how it looks.';
const CLUB_MSG = 'These are the four girls in your story. Tap a name to change it.';
const COMMON = [...POOL, ...PRAISE, 'Well done. You got there!', FIX_A + FIX_TAIL, FIX_B + FIX_TAIL, CLUB_MSG];
const preset = () => PRESETS.find(p => p.id === S.vp);
const ttsOn = () => !!(S.orKey && preset());
const idb = new Promise(res => {
  try { const r = indexedDB.open('bellaspeller-voice', 1); r.onupgradeneeded = () => r.result.createObjectStore('clips'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch (e) { res(null); }
});
async function idbGet(k) { const db = await idb; if (!db) return null; return new Promise(res => { try { const q = db.transaction('clips').objectStore('clips').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); } catch (e) { res(null); } }); }
async function idbPut(k, v) { const db = await idb; if (!db) return; return new Promise(res => { try { const tx = db.transaction('clips', 'readwrite'); tx.objectStore('clips').put(v, k); tx.oncomplete = () => res(); tx.onerror = () => res(); } catch (e) { res(); } }); }
const urlCache = new Map();
const clipKey = t => S.vp + '|' + t;
async function getClipUrl(t) {
  if (!ttsOn()) return null;
  const k = clipKey(t);
  if (urlCache.has(k)) return urlCache.get(k);
  const blob = await idbGet(k);
  if (!blob) return null;
  const u = URL.createObjectURL(blob); urlCache.set(k, u); return u;
}
async function fetchClip(t) {
  const p = preset();
  const r = await fetch('https://openrouter.ai/api/v1/audio/speech', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + S.orKey, 'Content-Type': 'application/json', 'X-Title': 'BellaSpeller' },
    body: JSON.stringify({ model: p.model, input: t, voice: p.voice, response_format: 'mp3' })
  });
  if (!r.ok) throw new Error('The voice service answered ' + r.status + '. ' + (await r.text()).slice(0, 200));
  const blob = await r.blob();
  if (/json|text/i.test(blob.type) || blob.size < 200) throw new Error('The voice service did not send audio. ' + (await blob.text()).slice(0, 200));
  await idbPut(clipKey(t), blob);
  const u = URL.createObjectURL(blob); urlCache.set(clipKey(t), u);
  return u;
}
// Makes sure the clips exist. Shows a short "getting ready" screen, which Bella can skip.
async function prep(texts, msg) {
  if (!ttsOn()) return null;
  const need = [];
  for (const t of new Set(texts)) { if (t && sendable(t) && !(await getClipUrl(t))) need.push(t); }
  if (!need.length) return null;
  let n = 0, skip = false, err = null;
  await new Promise(res => {
    h(`<div class="screen"><h1>${esc(msg)}</h1><p class="lead" id="pc">0 of ${need.length}</p><button id="go" class="btn">Start now</button></div>`);
    on('#go', () => { skip = true; res(); });
    let i = 0;
    const worker = async () => {
      while (i < need.length && !skip && !err) {
        try { await fetchClip(need[i++]); } catch (e) { err = e; }
        n++; const pc = $('#pc'); if (pc) pc.textContent = n + ' of ' + need.length;
      }
    };
    Promise.all([worker(), worker(), worker()]).then(() => res());
  });
  lastTtsErr = err ? err.message : '';
  return err;
}
let sayTimer = null, keepUtt = null, sayTok = 0, audioEl = null, ttsFails = 0, lastTtsErr = '';
const SAMPLE = 'Hello! Let us spell some words. Every one is a star.';
// Her own name is never sent to the voice service; those lines use the device voice.
const sendable = t => !(S.meIn && S.name && t.toLowerCase().includes(S.name.toLowerCase()));
function partTexts(beats, last) {
  const o = [];
  beats.forEach(b => {
    if (b.n) o.push(fill(b.n));
    else if (b.c) { o.push(fill(b.c.q) + ' ' + b.c.o.map(x => fill(x.l)).join('. Or. ')); b.c.o.forEach(x => o.push(fill(x.n))); }
    else if (b.w) { const s = fill(b.w.before) + b.w.word + fill(b.w.after); if (!last) o.push(s); o.push(s + ' ... ' + b.w.word); }
  });
  return o;
}
function stopAll() {
  clearTimeout(sayTimer);
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  if (audioEl) { audioEl.onended = audioEl.onerror = null; audioEl.pause(); audioEl = null; }
}
function say(t) {
  const tok = ++sayTok;
  stopAll();
  if (!ttsOn()) return builtinSay(t);
  getClipUrl(t).then(url => {
    if (tok !== sayTok) return;
    if (url) {
      audioEl = new Audio(url);
      audioEl.onerror = () => { if (tok === sayTok) builtinSay(t); };
      audioEl.play().catch(() => { if (tok === sayTok) builtinSay(t); });
    } else {
      builtinSay(t);
      if (ttsFails < 3 && sendable(t)) fetchClip(t).then(() => { ttsFails = 0; }, e => { ttsFails++; lastTtsErr = e.message; });
    }
  });
}
function builtinSay(t) {
  if (!('speechSynthesis' in window)) return;
  clearTimeout(sayTimer);
  speechSynthesis.cancel();
  // Chrome drops speech requested straight after a cancel, so wait a moment.
  sayTimer = setTimeout(() => {
    if (!voice) pickVoice();
    if (speechSynthesis.paused) speechSynthesis.resume();
    const u = new SpeechSynthesisUtterance(t);
    if (voice) u.voice = voice;
    u.lang = voice ? voice.lang : 'en-GB';
    u.rate = 0.9;
    keepUtt = u; // stops the browser discarding it before it has finished
    speechSynthesis.speak(u);
  }, 120);
}
const hush = () => { sayTok++; stopAll(); };

// ---------- rendering ----------
let keyHandler = null, prog = '';
document.addEventListener('keydown', e => { if (keyHandler) keyHandler(e); });
function h(html, opts) {
  keyHandler = null;
  const top = opts && opts.noTop ? '' : `<div class="top"><button id="goHome" aria-label="Home">🏠 Home</button><span>${esc(prog)}</span></div>`;
  $('#app').innerHTML = top + html;
  const g = $('#goHome'); if (g) g.onclick = () => { hush(); home(); };
  window.scrollTo(0, 0);
}
const on = (sel, fn) => { const e = $(sel); if (e) e.onclick = fn; };
const BACK = Symbol('back');
function backBtn(res) {
  const t = $('.top'); if (!t) return;
  const b = document.createElement('button');
  b.className = 'backbtn'; b.textContent = '← Back';
  b.onclick = () => { hush(); res(BACK); };
  t.insertBefore(b, t.children[1]);
}
function fill(t) {
  const g = S.girls.slice();
  if (S.meIn && S.name) g[0] = S.name;
  return String(t).replace(/\{g([1-4])\}/g, (m, n) => g[n - 1]);
}

// ---------- small screens ----------
function narrate(text, label) {
  return new Promise(res => {
    h(`<div class="screen"><p class="story">${esc(text)}</p>
      <div class="row"><button id="hear" class="btn small">🔊 Hear it again</button><button id="next" class="btn big">${esc(label || 'Next')}</button></div></div>`);
    on('#hear', () => say(text));
    on('#next', () => { hush(); res(); });
    keyHandler = e => { if (e.key === 'Enter') { hush(); res(); } };
    backBtn(res);
    say(text);
  });
}
function choose(q, opts) {
  return new Promise(res => {
    h(`<div class="screen"><p class="story">${esc(q)}</p>${opts.map((o, i) => `<button class="btn choice" id="o${i}">${esc(o)}</button>`).join('')}</div>`);
    opts.forEach((o, i) => on('#o' + i, () => { hush(); res(i); }));
    backBtn(res);
    say(q + ' ' + opts.join('. Or. '));
  });
}
function learnCard(week, wobj, ctx) {
  return new Promise(res => {
    const story = ctx ? `<p class="lead">${esc(fill(ctx.lead || ''))}</p><p class="sentence">${esc(fill(ctx.before))}<b>${esc(wobj.w)}</b>${esc(fill(ctx.after))}</p><p class="lead">This is the word to learn. Say it out loud.</p>` : `<p class="lead">Look at it. Say it out loud.</p>`;
    const tag = wobj.red ? `<span class="tag red">Red word. No rule. Just remember it.</span>` : (week.rule ? `<span class="tag">${esc(week.rule)}</span>` : '');
    const sv = wobj.say ? `<p class="lead">Say it the spelling way: <b>${esc(wobj.say)}</b></p>` : '';
    h(`<div class="screen">${story}<div class="word">${esc(wobj.w)}</div>${tag}${sv}
      <div class="row"><button id="hear" class="btn small">🔊 Hear it</button><button id="next" class="btn big">I've said it</button></div></div>`);
    const spoken = ctx ? fill(ctx.before) + wobj.w + fill(ctx.after) : wobj.w;
    on('#hear', () => say(spoken));
    on('#next', () => { hush(); res(); });
    backBtn(res);
    say(spoken);
  });
}

// ---------- keyboard and writing ----------
const KB = ['qwertyuiop', 'asdfghjkl', "zxcvbnm'-"];
const kbHtml = () => `<div class="kb">${KB.map((r, i) => `<div>${[...r].map(c => `<button class="key" data-k="${esc(c)}">${esc(c)}</button>`).join('')}${i === 2 ? '<button class="key wide" data-k="del">⌫</button>' : ''}</div>`).join('')}</div>`;

function writeWord(word, ctx, noBack) {
  return new Promise(res => {
    let typed = '', hints = 0, done = false;
    const sentence = ctx ? fill(ctx.before) + word + fill(ctx.after) : '';
    const sayIt = () => say(ctx ? sentence + ' ... ' + word : word);
    h(`<div class="screen">
      ${ctx ? `<p class="lead">${esc(fill(ctx.lead || ''))}</p><p class="sentence">${esc(fill(ctx.before))}<span class="blank">&nbsp;</span>${esc(fill(ctx.after))}</p>` : `<p class="lead">Listen. Then write the word.</p>`}
      <div id="slots" class="slots"></div>
      <div class="row"><button id="hear" class="btn small">🔊 Hear it</button><button id="hint" class="btn small">💡 Next letter</button></div>
      ${kbHtml()}
      <button id="done" class="btn big">Done</button></div>`);
    const draw = () => {
      $('#slots').innerHTML = typed ? [...typed].map(c => `<span class="slot">${esc(c)}</span>`).join('') : '<span class="slot empty">&nbsp;</span>';
      $('#done').disabled = !typed;
    };
    const add = c => { if (typed.length < 24) { typed += c; draw(); } };
    const del = () => { typed = typed.slice(0, -1); draw(); };
    const finish = () => { if (typed && !done) { done = true; hush(); res({ typed, hints }); } };
    const hint = () => {
      let i = 0;
      while (i < typed.length && i < word.length && typed[i] === word[i]) i++;
      if (i < word.length) { typed = word.slice(0, i + 1); hints++; draw(); }
    };
    document.querySelectorAll('.key').forEach(b => { b.onclick = () => { const k = b.dataset.k; k === 'del' ? del() : add(k); }; });
    keyHandler = e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Backspace') { del(); e.preventDefault(); }
      else if (e.key === 'Enter') { finish(); e.preventDefault(); }
      else if (/^[a-zA-Z'-]$/.test(e.key)) { add(e.key.toLowerCase()); e.preventDefault(); }
    };
    on('#hear', sayIt); on('#hint', hint); on('#done', finish);
    if (!noBack) backBtn(res);
    draw(); sayIt();
  });
}

// Which letters of the right spelling did she already have, in order?
function matchMask(t, typed) {
  const n = t.length, m = typed.length;
  const d = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    d[i][j] = t[i] === typed[j] ? d[i + 1][j + 1] + 1 : Math.max(d[i + 1][j], d[i][j + 1]);
  const mask = new Array(n).fill(false);
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (t[i] === typed[j]) { mask[i] = true; i++; j++; }
    else if (d[i + 1][j] >= d[i][j + 1]) i++; else j++;
  }
  return mask;
}
function showFix(word, typed) {
  return new Promise(res => {
    const mask = matchMask(word, typed);
    const hiding = mask.some(x => !x);
    const msg = hiding ? FIX_A : FIX_B;
    h(`<div class="screen"><p class="lead">${msg}</p>
      <div class="word">${[...word].map((c, i) => mask[i] ? esc(c) : `<span class="hid">${esc(c)}</span>`).join('')}</div>
      <p class="lead">Have a good look. Then try once more.</p>
      <button id="next" class="btn big">Try once more</button></div>`);
    on('#next', () => { hush(); res(); });
    say(msg + FIX_TAIL);
  });
}
function praise(word, clean) {
  return new Promise(res => {
    const p = clean ? PRAISE[Math.floor(Math.random() * PRAISE.length)] : 'Well done. You got there!';
    h(`<div class="screen"><div class="bigstar">★</div><h1>${esc(p)}</h1><div class="word">${esc(word)}</div>
      <button id="next" class="btn big">Next</button></div>`);
    on('#next', () => { hush(); res(); });
    keyHandler = e => { if (e.key === 'Enter') { hush(); res(); } };
    say(p);
  });
}

// One word, start to finish. Returns true if right first time with no hints.
async function doWord(week, wobj, mode, ctx, withCard, starred) {
  const word = wobj.w;
  let a;
  for (;;) {
    if (withCard && (await learnCard(week, wobj, ctx)) === BACK) return BACK;
    a = await writeWord(word, ctx);
    if (a === BACK) { if (withCard) continue; return BACK; }
    break;
  }
  const ok = a.typed === word;
  S.log.push({ t: Date.now(), d: today(), wk: week.id, w: word, mode, typed: a.typed, hints: a.hints, ok });
  save();
  let got = ok;
  if (!ok) {
    await showFix(word, a.typed);
    const b = await writeWord(word, ctx, true);
    got = b.typed === word;
    if (!got) await showFix(word, b.typed);
  }
  const sk = mode + ':' + word;
  if (!starred || !starred.has(sk)) { S.stars++; if (starred) starred.add(sk); }
  save();
  await praise(word, ok && a.hints === 0);
  return ok && a.hints === 0;
}

// ---------- the two kinds of day ----------
function clubSetup() {
  return new Promise(res => {
    const names = S.girls.slice();
    const msg = CLUB_MSG;
    h(`<div class="screen"><h1>Your story</h1><p class="lead">${msg}</p>
      <div class="club">${names.map((g, i) => `<button class="btn choice" id="g${i}">${esc(g)}</button>`).join('')}
      ${S.name ? `<label><input type="checkbox" id="meIn" ${S.meIn ? 'checked' : ''}> Put me in the story</label>` : ''}</div>
      <button id="next" class="btn big">Start the story</button></div>`);
    names.forEach((g, i) => on('#g' + i, () => {
      let k = POOL.indexOf(names[i]);
      do { k = (k + 1) % POOL.length; } while (names.includes(POOL[k]));
      names[i] = POOL[k]; $('#g' + i).textContent = names[i]; say(names[i]);
    }));
    on('#next', () => {
      hush(); S.girls = names;
      if ($('#meIn')) S.meIn = $('#meIn').checked;
      save(); res();
    });
    backBtn(res);
    say(msg);
  });
}
async function storyDay() {
  const wk = curWeek(), ep = epOf(wk);
  if (!ep) return home();
  let st = S.story[wk.id];
  if (!st || st.part >= ep.parts.length) { if ((await clubSetup()) === BACK) return home(); st = S.story[wk.id] = { part: 0 }; save(); }
  const last = ep.parts.length > 1 && st.part === ep.parts.length - 1;
  prog = `${ep.title} · part ${st.part + 1} of ${ep.parts.length}`;
  const beats = ep.parts[st.part], starred = new Set();
  await prep(partTexts(beats, last).concat(COMMON), 'Getting the story ready');
  prog = `${ep.title} · part ${st.part + 1} of ${ep.parts.length}`;
  let i = 0;
  while (i < beats.length) {
    const b = beats[i];
    let r;
    if (b.n) r = await narrate(fill(b.n));
    else if (b.c) {
      for (;;) {
        const k = await choose(fill(b.c.q), b.c.o.map(o => fill(o.l)));
        if (k === BACK) { r = BACK; break; }
        if ((await narrate(fill(b.c.o[k].n))) !== BACK) break;
      }
    } else if (b.w) { const wobj = wk.words.find(x => x.w === b.w.word) || { w: b.w.word }; r = await doWord(wk, wobj, 'story', b.w, !last, starred); }
    if (r === BACK) { if (i === 0) return home(); i--; } else i++;
  }
  st.part++; save();
  await ceiling();
  home();
}
async function quickDay() {
  const wk = curWeek(), ws = shuffle(wk.words.slice());
  const starred = new Set(), results = [];
  await prep(wk.words.map(x => x.w).concat(COMMON), 'Getting the words ready');
  let i = 0;
  while (i <= ws.length) {
    if (i < ws.length) {
      prog = `Word ${i + 1} of ${ws.length}`;
      const r = await doWord(wk, ws[i], 'quick', null, false, starred);
      if (r === BACK) { if (i === 0) return home(); i--; continue; }
      results[i] = r; i++;
    } else {
      prog = '';
      const right = results.filter(Boolean).length;
      const r = await narrate(`${right} out of ${ws.length} on the first try. ${right === ws.length ? 'Every single one!' : 'And a star for every word.'}`, 'See my stars');
      if (r === BACK) { i--; continue; }
      break;
    }
  }
  await ceiling();
  home();
}
function ceiling() {
  return new Promise(res => {
    const n = Math.min(S.stars, 500);
    let stars = '';
    for (let i = 0; i < n; i++) {
      const x = (i * 61.803) % 94 + 1, y = (i * 38.197 + (i * i * 7) % 13) % 86 + 2, s = 14 + (i * 37) % 22;
      stars += `<span style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;font-size:${s}px;animation-delay:${(i % 7) * .4}s">★</span>`;
    }
    prog = '';
    h(`<div class="screen"><div class="sky">${stars}</div><h1>${S.stars} ${S.stars === 1 ? 'star' : 'stars'}</h1>
      <button id="next" class="btn big">Done</button></div>`);
    on('#next', res);
  });
}

// ---------- home ----------
function home() {
  prog = '';
  const wk = curWeek(), ep = epOf(wk);
  let storyBtn = '';
  if (ep) {
    const st = S.story[wk.id];
    const sub = !st ? 'A new story' : st.part >= ep.parts.length ? 'Finished. Tell it again?' : `Part ${st.part + 1} of ${ep.parts.length}`;
    storyBtn = `<button id="story" class="btn homebtn">📖 Story day<small>${esc(sub)}</small></button>`;
  }
  h(`<div class="top"><span></span><button id="lock" aria-label="Grown-ups">🔒</button></div>
    <div class="screen"><h1>Hello${S.name ? ' ' + esc(S.name) : ''}!</h1><p class="lead">What shall we do today?</p>
    ${storyBtn}
    <button id="quick" class="btn homebtn quick">⚡ Quick day<small>Just the ${wk.words.length} words</small></button>
    <button id="sky" class="btn homebtn starsbtn">★ My stars<small>${S.stars}</small></button></div>`, { noTop: true });
  on('#story', storyDay); on('#quick', quickDay); on('#sky', () => ceiling().then(home)); on('#lock', adultGate);
}

// ---------- grown-ups ----------
function adultGate() {
  const setting = !S.pin;
  h(`<div class="screen adult"><h1>Grown-ups</h1>
    <p>${setting ? 'Choose a four-digit code. You will need it to open this page.' : 'Enter the four-digit code.'}</p>
    <input id="pin" type="password" inputmode="numeric" maxlength="4" autocomplete="off" style="max-width:160px;text-align:center;font-size:28px">
    <p id="err" class="note"></p><button id="ok" class="btn">${setting ? 'Set code' : 'Open'}</button></div>`);
  const go = () => {
    const v = $('#pin').value.trim();
    if (setting) { if (!/^\d{4}$/.test(v)) { $('#err').textContent = 'Please use four digits.'; return; } S.pin = v; save(); adult(); }
    else if (v === S.pin) adult(); else { $('#err').textContent = 'That is not the code.'; $('#pin').value = ''; }
  };
  on('#ok', go);
  $('#pin').onkeydown = e => { if (e.key === 'Enter') go(); };
  $('#pin').focus();
}
function parseWords(text) {
  const out = [];
  text.split(/[\n,;\t]+/).forEach(line => {
    const [raw, sayRaw] = line.split('|');
    const w = (raw || '').toLowerCase().replace(/^[\s\d.)\-•*]+/, '').replace(/[^a-z'\- ]/g, '').trim();
    if (!w) return;
    w.split(/\s+/).forEach(x => { if (x && !out.find(o => o.w === x)) out.push({ w: x, say: sayRaw && sayRaw.trim() ? sayRaw.trim() : undefined }); });
  });
  return out;
}
function findEpisode(words) {
  const key = words.map(x => x.w).sort().join(',');
  return Object.keys(window.EPISODES).find(id => window.EPISODES[id].words.slice().sort().join(',') === key) || null;
}
function owned() {
  const days = {};
  S.log.forEach(l => { if (l.ok && !l.hints) (days[l.w] = days[l.w] || new Set()).add(l.d); });
  return Object.keys(days).filter(w => days[w].size >= 2);
}
function adult() {
  const wk = curWeek(), own = owned();
  const rows = S.weeks.map(w => {
    const logs = S.log.filter(l => l.wk === w.id), days = new Set(logs.map(l => l.d)).size;
    const clean = logs.filter(l => l.ok && !l.hints).length;
    return `<tr><td>${esc(w.label)}${w.id === wk.id ? ' (current)' : ''}</td><td>${w.score == null ? 'not entered' : w.score + ' / ' + w.words.length}</td><td>${days}</td><td>${logs.length ? clean + ' of ' + logs.length : 'none'}</td><td>${w.ep ? 'yes' : 'no'}</td></tr>`;
  }).join('');
  const wordRows = wk.words.map(x => {
    const logs = S.log.filter(l => l.wk === wk.id && l.w === x.w);
    const wrong = logs.filter(l => !l.ok).map(l => esc(l.typed)).join(', ');
    return `<tr><td>${esc(x.w)}${x.red ? ' (red)' : ''}</td><td>${logs.length}</td><td>${logs.filter(l => l.ok && !l.hints).length}</td><td>${logs.reduce((a, l) => a + l.hints, 0)}</td><td>${wrong}</td><td>${own.includes(x.w) ? 'yes' : ''}</td></tr>`;
  }).join('');
  h(`<div class="adult"><h1>Grown-ups</h1>
    <h2>This week</h2>
    <label>Week in use</label><select id="cur">${S.weeks.map(w => `<option value="${w.id}" ${w.id === wk.id ? 'selected' : ''}>${esc(w.label)}</option>`).join('')}</select>
    <label>School test score for this week, out of ${wk.words.length}</label><input id="score" type="number" min="0" max="${wk.words.length}" value="${wk.score == null ? '' : wk.score}" style="max-width:120px">
    <div><button id="saveScore" class="btn">Save score</button> <button id="delWeek" class="btn small">Remove this week</button></div>

    <h2>Story for this week</h2>
    <p>${epOf(wk) ? 'A story is ready: "' + esc(epOf(wk).title) + '".' : 'No story yet. Quick day works without one.'}</p>
    ${S.orKey ? `<button id="draft" class="btn">${epOf(wk) ? 'Write a different story' : 'Write the story'}</button>` : '<p class="note">To have stories written by AI, add an OpenRouter key under Settings, at the bottom of this page.</p>'}
    <div id="draftOut"></div>

    <h2>Add a new week</h2>
    <label>Name of the week, for example "Test on 24 November"</label><input id="nl" type="text">
    <label>The spelling rule, as printed on the sheet (optional)</label><input id="nr" type="text">
    <label>Paste the words here, one per line or separated by commas</label><textarea id="nw" spellcheck="false"></textarea>
    <p class="note">To add a spelling voice for a tricky word, write it after a bar, like this: every | ev-er-y</p>
    <button id="read" class="btn">Read the words</button>
    <div id="preview"></div>

    <h2>Progress</h2>
    <p>Usual school score before the app: 5 or 6 out of 8. Words she owns (right first time, without a hint, on two different days): <b>${own.length}</b>.</p>
    <table><tr><th>Week</th><th>School score</th><th>Days used</th><th>Right first time, no hint</th><th>Story</th></tr>${rows}</table>
    <h2>This week, word by word</h2>
    <table><tr><th>Word</th><th>Tries</th><th>Right first time</th><th>Hints</th><th>What she typed when wrong</th><th>Owned</th></tr>${wordRows}</table>

    <h2>Settings</h2>
    <label>Her first name (stays on this device)</label><input id="name" type="text" value="${esc(S.name)}" maxlength="14">
    <label>Voice that reads aloud (try each one)</label><select id="vsel"><option value="">Automatic</option>${('speechSynthesis' in window ? speechSynthesis.getVoices() : []).filter(x => /^en/i.test(x.lang)).map(x => `<option value="${esc(x.name)}" ${S.voiceName === x.name ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
    <p class="note">Voices come from this device. If none sounds good, tell Claude and we can add recorded voices instead.</p>
    <label>Recorded voice (uses the OpenRouter key below; saved on this device after first use)</label><select id="psel"><option value="">None: use this device's voice</option>${PRESETS.map(p => `<option value="${p.id}" ${S.vp === p.id ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}</select>
    <div><button id="psample" class="btn small">Hear a sample</button> <button id="pready" class="btn small">Get this week's words ready</button></div>
    <p id="pstat" class="note">${esc(lastTtsErr)}</p>
    <label>OpenRouter key, for writing stories (stays on this device, and is left out of backups)</label><input id="orKey" type="password" autocomplete="off" value="${esc(S.orKey || '')}">
    <label>AI model</label><input id="orModel" type="text" autocomplete="off" value="${esc(S.orModel || DEFAULT_MODEL)}">
    <div><button id="saveName" class="btn">Save settings</button> <button id="backup" class="btn small">Save a backup file</button></div>
    <p class="note">BellaSpeller ${APP_VERSION}. Everything is stored on this device only.</p></div>`);
  on('#saveName', () => { S.name = $('#name').value.trim(); S.orKey = $('#orKey').value.trim(); S.orModel = $('#orModel').value.trim() || DEFAULT_MODEL; save(); adult(); });
  on('#draft', async () => {
    const out = $('#draftOut'), btn = $('#draft');
    btn.disabled = true; out.innerHTML = '<p class="note">Writing the story. This can take up to a minute.</p>';
    try {
      const ep = await draftStory(wk);
      out.innerHTML = `<p class="note">Please read it through before she sees it.</p>${storyPreview(ep)}<button id="useStory" class="btn">Use this story</button>`;
      on('#useStory', () => {
        const id = 'ai' + Date.now();
        S.eps = S.eps || {}; S.eps[id] = ep; wk.ep = id; delete S.story[wk.id]; save(); adult();
      });
    } catch (e) { out.innerHTML = `<p class="note">${esc(e.message || 'Something went wrong.')}</p>`; }
    btn.disabled = false; btn.textContent = 'Try another';
  });
  $('#psel').onchange = e => { S.vp = e.target.value; save(); };
  on('#psample', async () => {
    const st = $('#pstat');
    if (!S.orKey) { st.textContent = 'Add the OpenRouter key below and press Save settings first.'; return; }
    if (!preset()) { st.textContent = 'Choose a voice first.'; return; }
    st.textContent = 'Getting a sample...';
    try { await fetchClip(SAMPLE); st.textContent = 'Playing the sample.'; say(SAMPLE); } catch (e) { st.textContent = e.message; }
  });
  on('#pready', async () => {
    const st = $('#pstat');
    if (!ttsOn()) { st.textContent = 'Choose a voice and save the OpenRouter key first.'; return; }
    const need = [];
    for (const t of new Set(wk.words.map(x => x.w).concat(COMMON))) if (!(await getClipUrl(t))) need.push(t);
    if (!need.length) { st.textContent = 'Already ready.'; return; }
    let n = 0, err = null, i = 0;
    const w = async () => { while (i < need.length && !err) { try { await fetchClip(need[i++]); } catch (e) { err = e; } n++; st.textContent = n + ' of ' + need.length + ' ready'; } };
    await Promise.all([w(), w(), w()]);
    st.textContent = err ? err.message : 'Ready: ' + need.length + ' phrases saved on this device.';
  });
  $('#vsel').onchange = e => { S.voiceName = e.target.value; save(); pickVoice(); say('Hello! Let us spell some words. Every one is a star.'); };
  $('#cur').onchange = e => { S.cur = e.target.value; save(); adult(); };
  on('#saveScore', () => { const v = $('#score').value; wk.score = v === '' ? null : Math.max(0, Math.min(wk.words.length, parseInt(v, 10) || 0)); save(); adult(); });
  on('#delWeek', () => {
    if (S.weeks.length < 2) { alert('This is the only week. Add another one first.'); return; }
    if (!confirm('Remove "' + wk.label + '"? Her answers for it are kept in the backup data.')) return;
    S.weeks = S.weeks.filter(w => w.id !== wk.id); S.cur = S.weeks[S.weeks.length - 1].id; save(); adult();
  });
  on('#backup', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(Object.assign({}, S, { orKey: undefined }), null, 1)], { type: 'application/json' }));
    a.download = 'bellaspeller-backup-' + today() + '.json'; a.click();
  });
  on('#read', () => {
    const ws = parseWords($('#nw').value);
    if (!ws.length) { $('#preview').innerHTML = '<p class="note">No words found.</p>'; return; }
    const redFrom = ws.length >= 6 ? ws.length - 3 : ws.length;
    $('#preview').innerHTML = `<p>Check each word. Tick the red words, the ones with no rule.</p>` +
      ws.map((x, i) => `<div class="wl"><input type="checkbox" id="r${i}" ${i >= redFrom ? 'checked' : ''}><b>${esc(x.w)}</b>${x.say ? ' <span class="note">' + esc(x.say) + '</span>' : ''}</div>`).join('') +
      `<p class="note">${findEpisode(ws) ? 'A story is ready for these words.' : 'No story for these words yet. Quick day will work.'}</p><button id="saveWeek" class="btn">Save this week and use it</button>`;
    on('#saveWeek', () => {
      ws.forEach((x, i) => { x.red = $('#r' + i).checked || undefined; });
      const id = 'w' + Date.now();
      S.weeks.push({ id, label: $('#nl').value.trim() || 'Week added ' + today(), rule: $('#nr').value.trim(), words: ws, score: null, ep: findEpisode(ws) });
      S.cur = id; save(); adult();
    });
  });
}

// ---------- start ----------
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
home();
