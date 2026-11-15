'use strict';
// BellaSpeller, version 1. Everything is stored on this device only.

const KEY = 'star-speller-1';
const DEBUG = true; // true: settings button on every screen and no PIN. Set false for release.
function soundOn() { return S.sound === undefined ? !DEBUG : S.sound === true; } // off by default while debugging
const APP_VER = '2.19'; // bump with every release
const APP_VERSION = 'version ' + APP_VER + ', 15 November 2026' + (DEBUG ? ' (debug mode: no PIN)' : '');
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function fresh() {
  return {
    pin: null, name: '', girls: ['Imogen', 'Persephone', 'Florence', 'Tabitha'], meIn: false,
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
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.weeks && s.weeks.length) { if (s.girls && s.girls.join() === 'Priya,Maya,Jess,Tilly') s.girls = ['Imogen', 'Persephone', 'Florence', 'Tabitha']; return s; } } catch (e) { } return fresh(); }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }
let S = load();
const curWeek = () => S.weeks.find(w => w.id === S.cur) || S.weeks[S.weeks.length - 1];
const epOf = wk => (S.eps && S.eps[wk.ep]) || window.EPISODES[wk.ep];

// ---------- stories written by AI (grown-ups page only) ----------
const DEFAULT_MODEL = 'z-ai/glm-5.3';
const MODEL_SUGGESTIONS = ['z-ai/glm-5.3', 'z-ai/glm-5.3-flashx', 'openai/gpt-6.1-terra', 'openai/gpt-6.1-sol', 'anthropic/claude-sonnet-5.5'];
const STORY_RULES = `You write a short three-part story for a spelling app used at home by a nine-year-old girl in England. She is the author: she chooses what happens, and she writes the week's spelling words herself, inside things the characters write (a note, an invitation, a diary line, a sign, a list).

The story idea in the request comes from the nine-year-old author, so follow it, keep it suitable for her age, and be kind about it.

Style: real children with ordinary problems (friendship, school, family, sleepovers), warm and funny, in British English. Short, plain sentences that sound good read aloud. No fantasy, no romance, nothing frightening or unkind. Nobody is ever teased about reading, spelling or being clever.

Setting and values: the story is set in a modern, sensible English family world, with kind, responsible parents and carers. Use British daily life and British English: school uniform, PE kit, break time, assembly, tea, squash, toast, fruit, sandwiches, soup, pasta, jacket potatoes, flapjacks, wellies, rain, the park, the corner shop. Never include fast food or junk food (no pizza, burgers, fries, soda, candy, takeaways) and no American words or customs (no mom, cookies, sidewalk, vacation, recess). Sleepovers are realistic: parents are at home, bedtimes are respected, and nobody is left unsupervised or put in danger. Fantasy is welcome when the idea asks for it (witches, dragons, other worlds), but everyday life stays British and sensible.

If the idea is a mystery or investigation, play fair: plant real clues early, give two or three suspects each with a reason and an alibi, let the friends make a wrong guess, and solve it kindly by reasoning from the clues. Case notes, evidence labels and suspect lists are good things for the characters to write. If the idea is science or building, keep it real and safe: kitchen and garden experiments with an adult nearby, nothing dangerous. Show the steps of a good investigation (a question, a guess, a test, a measurement, a result, trying again), and let a failed test teach something. Lab notebook entries, labels and results tables are good things for the characters to write.

Characters: exactly four friends, written only as {g1}, {g2}, {g3} and {g4}. The request says whether each is a girl or a boy and gives any trait: use the right pronouns (she and her, he and him) and keep each trait consistent. Never invent names for them. Other people have no names (her dad, the new teacher, a little brother).

Reply with one JSON object: {"title": string, "parts": [part1, part2, part3]}. Each part is a list of beats. A beat is one of:
{"n": "narration, at most two sentences"}
{"c": {"q": "a question about what happens next", "o": [{"l": "short option", "n": "what happens, at most two sentences"}, {"l": "short option", "n": "what happens, at most two sentences"}]}}
{"w": {"word": "the spelling word", "lead": "one short sentence saying who is writing what", "before": "text before the word", "after": "text after the word"}}
In a w beat, before + word + after must read as one natural sentence that the character writes. The word is in lower case exactly as given, and is never the first word of the sentence.

Rules:
1. Parts 1 and 2 together use every spelling word exactly once, split about evenly. Each of these parts has two or three narration beats and exactly one choice, and ends with a narration beat that is a cliffhanger. Both options of a choice must lead sensibly into the rest of the part.
2. Part 3 opens with one or two narration beats that resolve the cliffhanger. Then it uses every spelling word once more, each in its own w beat, as one shared piece of writing (club rules, a letter, a poster). Then one closing narration beat. Part 3 has no choice.
3. A spelling word may also appear naturally elsewhere in the story, in the narration and choices. Write natural prose, and never avoid an ordinary word just because it is one of this week's spelling words.
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
  });
  if (texts.some(t => /\{(?!g[1-4]\})/.test(t))) bad.push('It uses a name placeholder the app does not know.');
  const US = /\b(pizzas?|burgers?|hamburgers?|hot ?dogs?|fries|soda|candy|cookies?|mom|mommy|sidewalk|vacation|recess|takeaways?|fast food|junk food|mcdonald'?s|kfc)\b/i;
  const usHit = texts.map(t => String(t).match(US)).find(Boolean);
  if (usHit) bad.push('It uses American or fast-food wording ("' + usHit[0] + '"). Use British English and wholesome food, as the instructions say.');
  return bad;
}
const castDesc = () => [0, 1, 2, 3].map(i => { const m = (S.cast || [])[i] || {}; return '{g' + (i + 1) + '} is a ' + (m.boy ? 'boy' : 'girl') + (m.trait ? ', ' + m.trait : ''); }).join('; ');
const storyBrief = extra => '\nCharacters: ' + castDesc() + '.' + (extra && extra.idea ? '\nStory idea from the author: ' + extra.idea : '');
const aiBase = () => (S.aiBase || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
const aiKey = () => S.aiKey || S.orKey;
async function askAI(wk, problems, model, extra) {
  const words = wk.words.map(x => x.w);
  let ask = 'This week\'s spelling words: ' + words.join(', ') + '.';
  ask += storyBrief(extra);
  if (problems && problems.length) ask += '\n\nYour last draft had these problems. Write a new story that avoids them:\n- ' + problems.join('\n- ');
  const headers = { 'Authorization': 'Bearer ' + aiKey(), 'Content-Type': 'application/json' };
  if (/openrouter\.ai/.test(aiBase())) headers['X-Title'] = 'BellaSpeller';
  const t0 = Date.now();
  const r = await fetch(aiBase() + '/chat/completions', {
    method: 'POST', headers,
    body: JSON.stringify({ model: model || S.orModel || DEFAULT_MODEL, max_tokens: 8000, messages: [{ role: 'system', content: STORY_RULES }, { role: 'user', content: ask }] })
  });
  if (!r.ok) throw new Error('The AI service answered ' + r.status + '. ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  const c = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
  const t = typeof c === 'string' ? c : Array.isArray(c) ? c.map(x => x.text || '').join('') : '';
  const i0 = t.indexOf('{'), i1 = t.lastIndexOf('}');
  if (i0 < 0 || i1 <= i0) throw new Error('The reply was not a story.');
  return { ep: JSON.parse(t.slice(i0, i1 + 1)), usage: j.usage || null, ms: Date.now() - t0 };
}
async function draftStory(wk, extra) {
  const words = wk.words.map(x => x.w);
  let problems = [];
  for (let i = 0; i < 2; i++) {
    const ep = (await askAI(wk, problems, undefined, extra)).ep;
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
const POOL = ['Persephone', 'Imogen', 'Octavia', 'Clementine', 'Florence', 'Matilda', 'Beatrice', 'Arabella', 'Henrietta', 'Evie', 'Tabitha', 'Seraphina', 'Philippa', 'Cecily', 'Ottilie', 'Rosalind', 'Amelia', 'Poppy', 'Isla', 'Ivy', 'Willow', 'Edith', 'Harriet', 'Lottie', 'Elsie', 'Maisie', 'Winnie', 'Georgia', 'Felicity', 'Verity'];
const BOYS = ['Percy', 'Barnaby', 'Hugo', 'Rupert', 'Monty', 'Alfie', 'Archie', 'Wilfred', 'Ludo', 'Fergus', 'Oscar', 'Freddie', 'Arthur', 'Theo', 'Rufus', 'Jasper', 'Hector', 'Barney', 'Kit', 'Rory', 'Toby', 'Max', 'Ned', 'Felix', 'Louis', 'Jack', 'Edmund', 'Ralph', 'Humphrey', 'Orlando'];
const TRAITS = ['', 'funny', 'shy', 'bossy', 'kind', 'sensible', 'cheeky', 'curious', 'creative', 'brave', 'clumsy', 'forgetful', 'always late', 'worries a lot', 'notices everything', 'loves gadgets', 'asks lots of questions', 'loves experiments', 'loves animals', 'loves football', 'good at maths', 'good at drawing'];
const STORY_TYPES = [
  { title: 'The detective agency', blurb: 'Clues, suspects and a case to solve', icon: 'search', idea: 'The friends set up their own detective agency and take on their first case: clues, a notebook, a few suspects with reasons, and a fair puzzle that a careful reader could solve. In the spirit of a children\'s detective TV series: a small team where each member is good at something different, a case file, and a clever reveal at the end.' },
  { title: 'Science investigators', blurb: 'Test an idea and find out why', icon: 'flask', idea: 'The friends investigate a science question with safe experiments at home, with an adult nearby: they make a guess, test it, measure what happens, and work out why, including when it goes wrong. In the spirit of a popular science-and-engineering video channel: an ambitious idea, funny failures, a big payoff, and a clear explanation of why it worked.' },
  { title: 'Build it and test it', blurb: 'An engineering challenge', icon: 'tool', idea: 'The friends take on an engineering challenge, such as building something clever, testing it, watching it fail in a funny way, and improving it until it works. In the spirit of a popular engineering video channel: a clever build, funny failures, a big payoff, and a clear explanation of why it worked.' },
  { title: 'Sleepover surprise', blurb: 'Something happens after lights out', icon: 'moon', idea: 'A sleepover where something unexpected and funny happens after lights out.' },
  { title: 'Friends fall out', blurb: 'An argument that must be fixed', icon: 'heart', idea: 'Two close friends fall out over a misunderstanding and have to work out how to make up.' },
  { title: 'The new one', blurb: 'Someone new joins the group', icon: 'users', idea: 'Someone new joins the group, and the others have to decide how to welcome them. It does not go smoothly at first.' },
  { title: 'Lost and found', blurb: 'Something has gone missing', icon: 'search', idea: 'Something important goes missing and the friends investigate, with funny wrong guesses.' },
  { title: 'Trip chaos', blurb: 'A school trip goes wrong', icon: 'flag', idea: 'A school trip goes hilariously wrong because of a mix-up.' },
  { title: 'Pet trouble', blurb: 'A pet causes chaos', icon: 'paw', idea: 'A pet causes chaos at the worst possible moment.' },
  { title: 'Birthday problem', blurb: 'The party plans go wrong', icon: 'gift', idea: 'Planning a birthday party goes wrong in several funny ways.' },
  { title: 'The secret club', blurb: 'Rules, secrets and a problem', icon: 'star', idea: 'The friends start a secret club with its own rules, and then a problem tests it.' }
];
const WHERE = ['A sleepover', 'At school', 'On holiday', 'At a party', 'In the park', 'At home'];
const WRONG = ['A secret gets out', 'Something goes missing', 'Two friends argue', 'Someone gets left out', 'A big mistake', 'A silly misunderstanding'];
const ENDS = ['Friends again', 'A funny disaster', 'A big surprise', 'Everyone learns something'];
const SCREEN_PROMPTS = ['Choose a story, or write your own.', 'Who is in your story?', 'Tell me your story idea.', 'Writing your story.'];
const PRAISE = ['Brilliant!', 'Well done!', 'Spot on!', 'You got it!', 'Fantastic!', 'Super spelling!'];
const FIX_TAIL = ' Have a good look. Then try once more.';
const FIX_A = 'So close. The yellow letters were hiding.', FIX_B = 'So close. Here is how it looks.';
const RED_WHY = 'This is a tricky word. It has no rule. You just have to remember it.';
const cardSpeech = (word, sentence) => (sentence ? sentence + ' ... ' + word + '. Say it out loud.' : word + '. Say it out loud.');
const CLUB_MSG = 'These are the four girls in your story. Tap a name to change it.';
const COMMON = [...PRAISE, ...SCREEN_PROMPTS, 'Well done. You got there!', FIX_A + FIX_TAIL, FIX_B + FIX_TAIL, CLUB_MSG];
const effVp = () => (S.vp === undefined ? 'ms-emily' : S.vp); // Emily unless a grown-up chose otherwise
const preset = () => PRESETS.find(p => p.id === effVp());
const ttsOn = () => !!(S.orKey && preset());
const idb = new Promise(res => {
  try { const r = indexedDB.open('bellaspeller-voice', 1); r.onupgradeneeded = () => r.result.createObjectStore('clips'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch (e) { res(null); }
});
async function idbGet(k) { const db = await idb; if (!db) return null; return new Promise(res => { try { const q = db.transaction('clips').objectStore('clips').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); } catch (e) { res(null); } }); }
async function idbPut(k, v) { const db = await idb; if (!db) return; return new Promise(res => { try { const tx = db.transaction('clips', 'readwrite'); tx.objectStore('clips').put(v, k); tx.oncomplete = () => res(); tx.onerror = () => res(); } catch (e) { res(); } }); }
const urlCache = new Map();
const clipKey = t => effVp() + '|' + t;
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
  if (!ttsOn() || !soundOn()) return null;
  const need = [];
  for (const t of new Set(texts)) { if (t && sendable(t) && !(await getClipUrl(t))) need.push(t); }
  if (!need.length) return null;
  let n = 0, skip = false, err = null;
  await new Promise(res => {
    h(`<div class="screen"><div class="spin"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS.star}</svg></div><h1>${esc(msg)}</h1><div class="bar"><i id="pbar"></i></div><p class="subtle" id="pc">0 of ${need.length}</p><button id="go" class="btn small">Start now</button></div>`);
    on('#go', () => { skip = true; res(); });
    let i = 0;
    const worker = async () => {
      while (i < need.length && !skip && !err) {
        try { await fetchClip(need[i++]); } catch (e) { err = e; }
        n++; const pc = $('#pc'); if (pc) pc.textContent = n + ' of ' + need.length;
        const pb = $('#pbar'); if (pb) pb.style.width = Math.round(100 * n / need.length) + '%';
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
function partTexts(beats, last, wk) {
  const o = [];
  if (wk && !last) { if (wk.rule) o.push(wk.rule); o.push(RED_WHY); }
  beats.forEach(b => {
    if (b.n) o.push(fill(b.n));
    else if (b.c) { o.push(fill(b.c.q) + ' ' + b.c.o.map(x => fill(x.l)).join('. Or. ')); b.c.o.forEach(x => o.push(fill(x.n))); }
    else if (b.w) {
      const s = fill(b.w.before) + b.w.word + fill(b.w.after);
      if (!last) o.push(cardSpeech(b.w.word, s));
      o.push(fill(b.w.lead || '') + ' ' + s + ' ... ' + b.w.word);
    }
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
  if (!soundOn()) return;
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
const ICONS = {
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  speaker: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19.5 5.5a9 9 0 0 1 0 13"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
  book: '<path d="M12 6C10 4.5 7 4 4 4v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2z"/><path d="M12 6v14"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  lock: '<path d="M6 11h12v10H6z"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  check: '<path d="M5 12.5l5 5 9-10"/>',
  del: '<path d="M21 5H9l-6 7 6 7h12z"/><path d="M13 9.5l4 5M17 9.5l-4 5"/>',
  swap: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  paw: '<circle cx="7" cy="10" r="2"/><circle cx="12" cy="7" r="2"/><circle cx="17" cy="10" r="2"/><path d="M7 17c0-3 3-5 5-5s5 2 5 5-3 3-5 3-5 0-5-3z"/>',
  gift: '<rect x="4" y="10" width="16" height="10"/><path d="M12 10v10M3 7h18v3H3zM12 7c-2-3-5-3-5-1s3 1 5 1zM12 7c2-3 5-3 5-1s-3 1-5 1z"/>',
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
  pencil: '<path d="M4 20l1-4L16 5l3 3L8 19z"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 15c3 0 5 1.5 5 4"/>',
  muted: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/>',
  flask: '<path d="M9 3h6M10 3v6L5 19a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-10V3"/>',
  tool: '<path d="M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-2.4 2.4-2.6-.6-.6-2.6z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  star: '<path fill="currentColor" stroke="none" d="M12 2.2l2.95 6.1 6.7.95-4.85 4.7 1.15 6.65L12 17.4l-5.95 3.2 1.15-6.65L2.35 9.25l6.7-.95z"/>'
};
const ico = n => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;
function h(html, opts) {
  keyHandler = null;
  const top = opts && opts.noTop ? '' : `<div class="top"><div class="lhs"><button id="goHome" class="iconbtn" aria-label="Home">${ico('home')}<span>Home</span></button></div><span class="prog">${esc(prog)}</span></div>`;
  $('#app').innerHTML = top + html;
  const g = $('#goHome'); if (g) g.onclick = () => { hush(); home(); };
  window.scrollTo(0, 0);
}
const on = (sel, fn) => { const e = $(sel); if (e) e.onclick = fn; };
const BACK = Symbol('back');
function backBtn(res) {
  const t = $('.top .lhs'); if (!t) return;
  const b = document.createElement('button');
  b.className = 'iconbtn backbtn'; b.setAttribute('aria-label', 'Back'); b.innerHTML = ico('back') + '<span>Back</span>';
  b.onclick = () => { hush(); res(BACK); };
  t.appendChild(b);
}
function fill(t) {
  const g = S.girls.slice();
  if (S.meIn && S.name) g[0] = S.name;
  return String(t).replace(/\{g([1-4])\}/g, (m, n) => g[n - 1]);
}

// ---------- small screens ----------
function narrate(text, label) {
  return new Promise(res => {
    h(`<div class="screen"><div class="page"><p class="story">${esc(text)}</p></div>
      <div class="row"><button id="hear" class="iconbtn big" aria-label="Hear it again">${ico('speaker')}</button><button id="next" class="btn big">${esc(label || 'Next')} ${ico('next')}</button></div></div>`);
    on('#hear', () => say(text));
    on('#next', () => { hush(); res(); });
    keyHandler = e => { if (e.key === 'Enter') { hush(); res(); } };
    backBtn(res);
    say(text);
  });
}
function choose(q, opts) {
  return new Promise(res => {
    h(`<div class="screen"><div class="page"><p class="story">${esc(q)}</p></div><div class="msg">Tap what happens next</div>
      <div class="choices">${opts.map((o, i) => `<button class="choice" id="o${i}">${esc(o)}</button>`).join('')}</div>
      <button id="hear" class="iconbtn big" aria-label="Hear it again">${ico('speaker')}</button></div>`);
    on('#hear', () => say(q + ' ' + opts.join('. Or. ')));
    opts.forEach((o, i) => on('#o' + i, () => { hush(); res(i); }));
    backBtn(res);
    say(q + ' ' + opts.join('. Or. '));
  });
}
function learnCard(week, wobj, ctx) {
  return new Promise(res => {
    const sentence = ctx ? fill(ctx.before) + wobj.w + fill(ctx.after) : '';
    const why = wobj.red ? RED_WHY : (week.rule || '');
    const word = `<span class="grow" id="gw">${esc(wobj.w)}</span>`;
    const body = ctx ? `<p class="story">${esc(fill(ctx.before))}${word}${esc(fill(ctx.after))}</p>` : `<p class="story solo">${word}</p>`;
    const tags = (wobj.red ? `<span class="tag red">Tricky word</span>` : '') + (wobj.say ? `<span class="tag">Say it the spelling way: ${esc(wobj.say)}</span>` : '');
    h(`<div class="screen cardscreen"><div class="page">${body}</div>${tags ? `<div class="row">${tags}</div>` : ''}
      <div class="row"><button id="hear" class="iconbtn big" aria-label="Hear it">${ico('speaker')}</button>${why ? `<button id="why" class="btn small">${ico('bulb')}<span>Why?</span></button>` : ''}<button id="next" class="btn big">I've said it ${ico('check')}</button></div>
      <div id="whybox" style="width:100%"></div></div>`);
    // The word starts small, in line with the sentence, then grows and changes colour as it is spoken.
    let tm = null;
    const grow = () => {
      clearTimeout(tm);
      const g = $('#gw'); if (g) g.classList.remove('big');
      tm = setTimeout(() => { const g2 = $('#gw'); if (g2) g2.classList.add('big'); }, 1900);
    };
    const spoken = cardSpeech(wobj.w, sentence);
    on('#hear', () => { grow(); say(spoken); });
    on('#why', () => { $('#whybox').innerHTML = `<div class="page small"><p class="story">${esc(why)}</p></div>`; say(why); });
    on('#next', () => { clearTimeout(tm); hush(); res(); });
    backBtn(res);
    grow(); say(spoken);
  });
}

// ---------- keyboard and writing ----------
const KB = ['qwertyuiop', 'asdfghjkl', "zxcvbnm'-"];
const kbHtml = () => `<div class="kb">${KB.map((r, i) => `<div>${[...r].map(c => `<button class="key" data-k="${esc(c)}">${esc(c)}</button>`).join('')}${i === 2 ? `<button class="key wide" data-k="del" aria-label="Delete">${ico('del')}</button>` : ''}</div>`).join('')}</div>`;

function writeWord(word, ctx, noBack) {
  return new Promise(res => {
    let typed = '', hints = 0, done = false;
    const sentence = ctx ? fill(ctx.before) + word + fill(ctx.after) : '';
    const sayIt = () => say(ctx ? fill(ctx.lead || '') + ' ' + sentence + ' ... ' + word : word);
    h(`<div class="screen">
      ${ctx ? `<div class="page"><p class="lead-in">${esc(fill(ctx.lead || ''))}</p><p class="story">“${esc(fill(ctx.before))}<span class="blank"></span>${esc(fill(ctx.after))}”</p></div>` : `<div class="cue">${ico('speaker')}<span>Listen, then write the word</span></div>`}
      <div id="slots" class="slots"></div>
      <div class="row"><button id="hear" class="iconbtn big" aria-label="Hear it">${ico('speaker')}</button><button id="hint" class="btn small">${ico('bulb')}<span>Next letter</span></button></div>
      ${kbHtml()}
      <button id="done" class="btn big">Done ${ico('check')}</button></div>`);
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
    h(`<div class="screen"><p class="msg">${msg}</p>
      <div class="wordtile">${[...word].map((c, i) => mask[i] ? esc(c) : `<span class="hid">${esc(c)}</span>`).join('')}</div>
      <p class="subtle">Have a good look. Then try once more.</p>
      <button id="next" class="btn big">Try once more ${ico('next')}</button></div>`);
    on('#next', () => { hush(); res(); });
    backBtn(res);
    say(msg + FIX_TAIL);
  });
}
function praise(word, clean) {
  return new Promise(res => {
    const p = clean ? PRAISE[Math.floor(Math.random() * PRAISE.length)] : 'Well done. You got there!';
    h(`<div class="screen"><div class="bigstar"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS.star}</svg></div><h1>${esc(p)}</h1><div class="wordtile small">${esc(word)}</div>
      <button id="next" class="btn big">Next ${ico('next')}</button></div>`);
    on('#next', () => { hush(); res(); });
    keyHandler = e => { if (e.key === 'Enter') { hush(); res(); } };
    backBtn(res);
    say(p);
  });
}

// One word, start to finish. Returns true if right first time with no hints.
async function doWord(week, wobj, mode, ctx, withCard, starred) {
  const word = wobj.w;
  let attempts = 0;
  for (;;) { // Back from the correction or praise screens restarts the word
    let a;
    for (;;) {
      if (withCard && (await learnCard(week, wobj, ctx)) === BACK) return BACK;
      a = await writeWord(word, ctx);
      if (a === BACK) { if (withCard) continue; return BACK; }
      break;
    }
    const ok = a.typed === word;
    // A repeat go after pressing Back is recorded as a redo, and kept out of her results.
    S.log.push({ t: Date.now(), d: today(), wk: week.id, w: word, mode, typed: a.typed, hints: a.hints, ok, redo: attempts++ > 0 || undefined });
    save();
    if (!ok) {
      if ((await showFix(word, a.typed)) === BACK) continue;
      const b = await writeWord(word, ctx, false);
      if (b === BACK) continue;
      if (b.typed !== word && (await showFix(word, b.typed)) === BACK) continue;
    }
    const sk = mode + ':' + word;
    if (!starred || !starred.has(sk)) { S.stars++; if (starred) starred.add(sk); }
    save();
    if ((await praise(word, ok && a.hints === 0)) === BACK) continue;
    return ok && a.hints === 0 && attempts === 1;
  }
}

// ---------- starting a story: shelf, cast, Bella's own idea ----------
function waiting(msg) {
  h(`<div class="screen"><div class="spin"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS.star}</svg></div><h1>${esc(msg)}</h1><p class="subtle">This can take up to a minute.</p></div>`);
}
async function transcribe(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  const fmt = /mp4|m4a|aac/.test(blob.type) ? 'mp4' : 'webm';
  const r = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
    method: 'POST', headers: { 'Authorization': 'Bearer ' + S.orKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'elevenlabs/scribe-v2', input_audio: { data: btoa(bin), format: fmt } })
  });
  if (!r.ok) throw new Error('I could not hear that (' + r.status + '). Please type your idea.');
  return ((await r.json()).text || '').trim();
}
async function tidyIdea(idea) {
  if (!aiKey()) return null;
  try {
    const headers = { 'Authorization': 'Bearer ' + aiKey(), 'Content-Type': 'application/json' };
    if (/openrouter\.ai/.test(aiBase())) headers['X-Title'] = 'BellaSpeller';
    const r = await fetch(aiBase() + '/chat/completions', {
      method: 'POST', headers,
      body: JSON.stringify({ model: S.orModel || DEFAULT_MODEL, max_tokens: 1500, messages: [
        { role: 'system', content: 'You help a nine-year-old author in England. Rewrite her story idea as two or three short, clear sentences in friendly British English. Keep all her ideas. Keep it kind and suitable for her age, in a sensible modern English family world: no fast food, junk food or American words. Reply with only the sentences.' },
        { role: 'user', content: idea }] })
    });
    if (!r.ok) return null;
    const j = await r.json(); const c = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    return (typeof c === 'string' ? c : '').trim() || null;
  } catch (e) { return null; }
}
function shelf(ep, st, sample) {
  return new Promise(res => {
    const hasStory = ep && st, done = hasStory && st.part >= ep.parts.length;
    const card = (id, icon, title, blurb, cls) => `<button class="shelfcard ${cls || ''}" id="${id}"><span class="ticon">${ico(icon)}</span><div><b>${esc(title)}</b><small>${esc(blurb)}</small></div></button>`;
    h(`<div class="screen"><h1>Choose your story</h1>
      <button id="caststrip" class="caststrip"><span>In your story: <b>${esc(S.girls.slice(0, 4).join(', '))}</b></span><span class="chg">${ico('swap')} Change</span></button>
      ${aiKey() ? '' : '<p class="subtle">Stories are written by AI. Add the AI key with the settings gear to use these.</p>'}
      ${hasStory ? card('again', 'book', (done ? 'Play again: ' : 'Carry on: ') + ep.title, done ? 'Tell this story again' : 'Part ' + (st.part + 1) + ' of ' + ep.parts.length, 'wide') : ''}
      ${card('own', 'pencil', 'Write my own story', 'Tell me your idea', 'wide own')}
      <div class="shelf">${STORY_TYPES.map((t, i) => card('t' + i, t.icon, t.title, t.blurb)).join('')}${sample ? card('sample', 'book', 'Sample story', 'The Silver Shoes Sleepover') : ''}</div>
      </div>`);
    on('#own', () => { hush(); res({ kind: 'own' }); });
    on('#caststrip', () => { hush(); res({ kind: 'cast' }); });
    STORY_TYPES.forEach((t, i) => on('#t' + i, () => { hush(); res({ kind: 'type', type: t }); }));
    on('#sample', () => { hush(); res({ kind: 'sample' }); });
    on('#again', () => { hush(); res({ kind: 'again' }); });
    backBtn(res);
    say(SCREEN_PROMPTS[0]);
  });
}
function typeText({ title, initial = '', max = 400, names = false }) {
  return new Promise(res => {
    let txt = initial;
    const ov = document.createElement('div'); ov.className = 'overlay'; ov.id = 'typeOverlay';
    const show = () => (names ? txt.replace(/(^|[ '-])([a-z])/g, (m, a, b) => a + b.toUpperCase()) : txt);
    const rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
    ov.innerHTML = `<div class="pickcard"><div class="dbghead"><b>${esc(title)}</b><button class="btn small" id="tt-x">Cancel</button></div>
      <div class="typed${names ? ' name' : ''}" id="tt-view"></div>
      <div class="kb">${rows.map((r, i) => `<div>${[...r].map(c => `<button class="key" data-k="${c}">${c}</button>`).join('')}${i === 2 ? `<button class="key wide" data-k="del" aria-label="Delete">${ico('del')}</button>` : ''}</div>`).join('')}
        <div><button class="key" data-k="'">'</button><button class="key space" data-k=" ">space</button>${names ? '' : '<button class="key" data-k=".">.</button><button class="key" data-k=",">,</button>'}</div></div>
      <button class="btn big" id="tt-ok" style="margin-top:12px">Done ${ico('check')}</button></div>`;
    document.body.appendChild(ov);
    const paint = () => { $('#tt-view').textContent = show() || ' '; };
    const onKey = e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      e.stopPropagation();
      if (e.key === 'Backspace') { del(); e.preventDefault(); }
      else if (e.key === 'Enter') { finish(show().trim()); e.preventDefault(); }
      else if (e.key.length === 1 && /[A-Za-z' .,-]/.test(e.key)) { add(names ? e.key.toLowerCase() : e.key); e.preventDefault(); }
    };
    const finish = v => { document.removeEventListener('keydown', onKey, true); ov.remove(); res(v); };
    const add = c => { if (txt.length < max) { txt += c; paint(); } };
    const del = () => { txt = txt.slice(0, -1); paint(); };
    ov.querySelectorAll('.key').forEach(k => { k.onclick = () => { const c = k.dataset.k; c === 'del' ? del() : add(c); }; });
    document.addEventListener('keydown', onKey, true);
    $('#tt-x').onclick = () => finish(null);
    $('#tt-ok').onclick = () => finish(show().trim());
    paint();
  });
}
function pickName(boy, current, used) {
  return new Promise(res => {
    const pool = boy ? BOYS : POOL;
    const ov = document.createElement('div'); ov.className = 'overlay'; ov.id = 'namePicker';
    document.body.appendChild(ov);
    let rec = null;
    const close = v => { if (rec && rec.state === 'recording') { try { rec.stop(); } catch (e) { } } ov.remove(); res(v); };
    const take = v => { const n = String(v || '').replace(/[^A-Za-z' -]/g, '').trim().slice(0, 14); if (n) close(n.charAt(0).toUpperCase() + n.slice(1)); };
    ov.innerHTML = `<div class="pickcard"><div class="dbghead"><b>${boy ? "Pick a boy's name" : "Pick a girl's name"}</b><button class="btn small" id="pk-x">Close</button></div>
      <div class="namegrid">${pool.filter(n => n === current || !used.includes(n)).map(n => `<button class="chip small${n === current ? ' on' : ''}" data-n="${esc(n)}">${esc(n)}</button>`).join('')}</div>
      <div class="row"><button class="btn small" id="pk-type">${ico('pencil')}<span>Type a name</span></button><button class="btn small" id="pk-say">${ico('mic')}<span>Say a name</span></button></div><p class="note" id="pk-msg"></p></div>`;
    ov.querySelectorAll('[data-n]').forEach(b => { b.onclick = () => { say(b.dataset.n); close(b.dataset.n); }; });
    $('#pk-x').onclick = () => close(null);
    $('#pk-type').onclick = async () => { const t = await typeText({ title: 'Type a name', initial: '', max: 14, names: true }); if (t) take(t); };
    $('#pk-say').onclick = async () => {
      const msg = $('#pk-msg'), lab = $('#pk-say span');
      if (rec && rec.state === 'recording') { rec.stop(); return; }
      if (!S.orKey) { msg.textContent = 'To use your voice, add the OpenRouter key with the settings gear. You can type instead.'; return; }
      if (!navigator.mediaDevices || !window.MediaRecorder) { msg.textContent = 'This device cannot record. Please type the name.'; return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const chunks = []; rec = new MediaRecorder(stream);
        rec.ondataavailable = e => chunks.push(e.data);
        rec.onstop = async () => {
          stream.getTracks().forEach(t => t.stop());
          const blob = new Blob(chunks, { type: (rec && rec.mimeType) || 'audio/webm' });
          if (lab.isConnected) lab.textContent = 'Say a name';
          if (msg.isConnected) msg.textContent = 'Listening to what you said...';
          try { const text = (await transcribe(blob)).split(/\s+/)[0]; if (ov.isConnected) take(text); } catch (e) { if (msg.isConnected) msg.textContent = e.message; }
        };
        rec.start(); lab.textContent = 'Tap when done'; msg.textContent = 'Listening... say the name.';
        setTimeout(() => { if (rec && rec.state === 'recording') rec.stop(); }, 15000);
      } catch (e) { msg.textContent = 'I could not use the microphone. Please type the name.'; }
    };
  });
}
function pickTrait(current) {
  return new Promise(res => {
    const ov = document.createElement('div'); ov.className = 'overlay'; ov.id = 'traitPicker';
    document.body.appendChild(ov);
    const close = v => { ov.remove(); res(v); };
    const list = ['None'].concat(TRAITS.filter(Boolean));
    if (current && !TRAITS.includes(current)) list.splice(1, 0, current);
    ov.innerHTML = `<div class="pickcard"><div class="dbghead"><b>Pick a trait</b><button class="btn small" id="tr-x">Close</button></div>
      <div class="namegrid">${list.map(t => `<button class="chip small${(t === 'None' ? !current : t === current) ? ' on' : ''}" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div>
      <div class="row"><button class="btn small" id="tr-type">${ico('pencil')}<span>Type a trait</span></button></div></div>`;
    ov.querySelectorAll('[data-v]').forEach(b => { b.onclick = () => close(b.dataset.v === 'None' ? '' : b.dataset.v); });
    $('#tr-x').onclick = () => close(null);
    $('#tr-type').onclick = async () => { const t = await typeText({ title: 'Type a trait', initial: '', max: 30 }); if (t && t.trim()) close(t.trim().toLowerCase()); };
  });
}
function castScreen() {
  return new Promise(res => {
    const cast = [0, 1, 2, 3].map(i => { const m = (S.cast || [])[i] || {}; return { name: S.girls[i] || POOL[i], boy: !!m.boy, trait: m.trait || '' }; });
    h(`<div class="screen"><h1>Who is in your story?</h1><p class="subtle">Tap Girl or Boy to choose a name. Then pick a trait if you like.</p>
      <div class="cast" id="castlist"></div>
      ${S.name ? `<label class="toggle"><input type="checkbox" id="meIn" ${S.meIn ? 'checked' : ''}> Put me in the story as the first one</label>` : ''}
      <button id="next" class="btn big">Use these ${ico('check')}</button></div>`);
    const others = i => cast.filter((_, j) => j !== i).map(c => c.name);
    const choose_ = async i => { const c = cast[i]; const n = await pickName(c.boy, c.name, others(i)); if (n) c.name = n; draw(); };
    const draw = () => {
      $('#castlist').innerHTML = cast.map((c, i) => `<div class="castrow2"><div class="seg"><button class="segbtn${c.boy ? '' : ' on'}" data-g="${i}" data-v="0">Girl</button><button class="segbtn${c.boy ? ' on' : ''}" data-g="${i}" data-v="1">Boy</button></div><button class="namebtn" data-n="${i}">${esc(c.name)}</button><button class="chip small" data-t="${i}">${esc(c.trait || '+ trait')}</button></div>`).join('');
      document.querySelectorAll('#castlist [data-g]').forEach(b => { b.onclick = () => { const i = +b.dataset.g, boy = b.dataset.v === '1', c = cast[i]; if (boy !== c.boy) { c.boy = boy; if (!(boy ? BOYS : POOL).includes(c.name)) c.name = (boy ? BOYS : POOL).find(n => !others(i).includes(n)); } draw(); choose_(i); }; });
      document.querySelectorAll('#castlist [data-n]').forEach(b => { b.onclick = () => choose_(+b.dataset.n); });
      document.querySelectorAll('#castlist [data-t]').forEach(b => { b.onclick = async () => { const c = cast[+b.dataset.t]; const t = await pickTrait(c.trait); if (t !== null) { c.trait = t; draw(); } }; });
    };
    draw();
    on('#next', () => {
      hush();
      S.girls = cast.map((c, i) => c.name.trim() || POOL[i]);
      S.cast = cast.map(c => ({ boy: c.boy, trait: c.trait }));
      if ($('#meIn')) S.meIn = $('#meIn').checked;
      save(); res(true);
    });
    backBtn(res);
    say(SCREEN_PROMPTS[1]);
  });
}
function outlineScreen() {
  return new Promise(res => {
    const pick = { where: '', wrong: '', end: '' };
    const chips = (key, arr) => `<div class="chiprow" data-k="${key}">${arr.map(t => `<button class="chip small" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div>`;
    h(`<div class="screen"><h1>Your story idea</h1><p class="subtle">Tap ideas, say your idea, or type it. Any mix is fine.</p>
      <div class="page small"><p class="lead-in">Where is it?</p>${chips('where', WHERE)}<p class="lead-in">What goes wrong?</p>${chips('wrong', WRONG)}<p class="lead-in">How does it end?</p>${chips('end', ENDS)}</div>
      <textarea id="idea" class="ideabox" rows="3" placeholder="Say it or type it here"></textarea>
      <div class="row"><button id="mic" class="btn small">${ico('mic')}<span>Tell me</span></button><button id="typeit" class="btn small">${ico('pencil')}<span>Type it</span></button><button id="next" class="btn big">Done ${ico('check')}</button></div><p id="micmsg" class="subtle"></p></div>`);
    document.querySelectorAll('.chiprow').forEach(row => row.querySelectorAll('.chip').forEach(c => {
      c.onclick = () => { const k = row.dataset.k, on_ = c.classList.contains('on'); row.querySelectorAll('.chip').forEach(x => x.classList.remove('on')); if (!on_) { c.classList.add('on'); pick[k] = c.dataset.v; } else pick[k] = ''; };
    }));
    let rec = null;
    on('#mic', async () => {
      const msg = $('#micmsg');
      if (rec) { rec.stop(); return; }
      if (!S.orKey) { msg.textContent = 'To use your voice, add the OpenRouter key with the settings gear. You can type instead.'; return; }
      if (!navigator.mediaDevices || !window.MediaRecorder) { msg.textContent = 'This device cannot record. Please type your idea.'; return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const chunks = []; rec = new MediaRecorder(stream);
        rec.ondataavailable = e => chunks.push(e.data);
        rec.onstop = async () => {
          stream.getTracks().forEach(t => t.stop());
          const blob = new Blob(chunks, { type: (rec && rec.mimeType) || 'audio/webm' }); rec = null;
          const span = $('#mic span'); if (span) span.textContent = 'Tell me';
          if (msg.isConnected) msg.textContent = 'Listening to what you said...';
          try { const text = await transcribe(blob); const box = $('#idea'); if (box) { box.value = (box.value ? box.value + ' ' : '') + text; msg.textContent = 'Got it. You can change the words if you like.'; } }
          catch (e) { if (msg.isConnected) msg.textContent = e.message; }
        };
        rec.start(); $('#mic span').textContent = 'Tap to stop'; msg.textContent = 'Listening... tell me your story idea.';
        setTimeout(() => { if (rec && rec.state === 'recording') rec.stop(); }, 60000);
      } catch (e) { msg.textContent = 'I could not use the microphone. Please type your idea.'; }
    });
    on('#typeit', async () => { const t = await typeText({ title: 'Type your story idea', initial: $('#idea').value, max: 400 }); if (t !== null) $('#idea').value = t; });
    on('#next', () => {
      const bits = [];
      if (pick.where) bits.push('Where: ' + pick.where + '.');
      if (pick.wrong) bits.push('What goes wrong: ' + pick.wrong + '.');
      if (pick.end) bits.push('How it ends: ' + pick.end + '.');
      const own = $('#idea').value.trim(); if (own) bits.push('In her own words: ' + own);
      if (!bits.length) { $('#micmsg').textContent = 'Tap an idea, say it, or type it first.'; return; }
      if (rec && rec.state === 'recording') rec.stop();
      hush(); res(bits.join(' '));
    });
    backBtn(res);
    say(SCREEN_PROMPTS[2]);
  });
}
function confirmIdea(text) {
  return new Promise(res => {
    h(`<div class="screen"><h1>Is this your story?</h1><div class="page"><p class="story">${esc(text)}</p></div>
      <div class="row"><button id="hear" class="iconbtn big" aria-label="Hear it">${ico('speaker')}</button><button id="yes" class="btn big">Yes, write it ${ico('check')}</button></div>
      <button id="change" class="btn small">Change it</button></div>`);
    on('#hear', () => say(text)); on('#yes', () => { hush(); res(true); }); on('#change', () => { hush(); res(BACK); });
    backBtn(res);
    say('Is this your story? ' + text);
  });
}
function readyScreen(title) {
  return new Promise(res => {
    const names = S.girls.slice(0, 4);
    const list = names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
    h(`<div class="screen"><h1>Ready?</h1><p class="subtle">${esc(title)}</p>
      <div class="page small"><p class="lead-in">In your story</p><p class="story">${esc(list)}</p></div>
      <button id="go" class="btn big">Start the story ${ico('next')}</button>
      <button id="chg" class="btn small">${ico('swap')}<span>Change characters</span></button></div>`);
    on('#go', () => { hush(); res('start'); });
    on('#chg', () => { hush(); res('cast'); });
    keyHandler = e => { if (e.key === 'Enter') { hush(); res('start'); } };
    backBtn(res);
  });
}
function failScreen(msg) {
  return new Promise(res => {
    h(`<div class="screen"><h1>That did not work</h1><div class="page small"><p class="story">${esc(msg)}</p></div><button id="retry" class="btn big">Try again</button></div>`);
    on('#retry', () => res(true)); backBtn(res);
  });
}
async function writeNewStory(wk, idea) {
  for (;;) {
    waiting(SCREEN_PROMPTS[3]); say(SCREEN_PROMPTS[3]);
    try { const ep = await draftStory(wk, { idea }); ep.idea = idea; return ep; }
    catch (e) { hush(); if ((await failScreen(e.message || 'Something went wrong.')) === BACK) return BACK; }
  }
}
async function storyStart(wk) {
  // Quick route: pick a story and it starts. Characters are optional (the Change strip on the shelf).
  // Steps: shelf, outline (own story only), confirm, ready (start or change characters), write. Back goes one step back.
  let step = 'shelf', pick = null, idea = null, final = null;
  for (;;) {
    if (step === 'shelf') {
      pick = await shelf(epOf(wk), S.story[wk.id], !!findEpisode(wk.words));
      if (pick === BACK) return false;
      if (pick.kind === 'cast') { await castScreen(); continue; }
      if (pick.kind === 'again') { const e0 = epOf(wk), s0 = S.story[wk.id]; if (e0 && s0 && s0.part >= e0.parts.length) { S.story[wk.id] = { part: 0 }; save(); } return true; }
      if (pick.kind === 'sample') { wk.ep = findEpisode(wk.words); S.story[wk.id] = { part: 0 }; save(); return true; }
      if (pick.kind === 'type') { final = pick.type.idea; step = 'ready'; } else step = 'outline';
    } else if (step === 'outline') {
      idea = await outlineScreen();
      if (idea === BACK) { step = 'shelf'; continue; }
      step = 'confirm';
    } else if (step === 'confirm') {
      waiting('Tidying your idea'); say('One moment.');
      const tidy = await tidyIdea(idea);
      if (!tidy) { final = idea; step = 'ready'; continue; }
      if ((await confirmIdea(tidy)) === BACK) { step = 'outline'; continue; }
      final = 'Tidied version: ' + tidy + ' Original: ' + idea; step = 'ready';
    } else if (step === 'ready') {
      const r = await readyScreen(pick.kind === 'type' ? pick.type.title : 'Your own story');
      if (r === BACK) { step = pick.kind === 'own' ? 'outline' : 'shelf'; continue; }
      if (r === 'cast') { await castScreen(); continue; }
      step = 'write';
    } else {
      const made = await writeNewStory(wk, final);
      if (made === BACK) { step = pick.kind === 'own' ? 'outline' : 'shelf'; continue; }
      const id = 'ai' + Date.now(); S.eps = S.eps || {}; S.eps[id] = made; wk.ep = id; S.story[wk.id] = { part: 0 }; save();
      return true;
    }
  }
}

// ---------- the two kinds of day ----------
function clubSetup() {
  return new Promise(res => {
    const names = S.girls.slice();
    const msg = CLUB_MSG;
    h(`<div class="screen"><h1>Who is in your story?</h1><p class="subtle">${msg}</p>
      <div class="chips">${names.map((g, i) => `<button class="chip" id="g${i}"><span>${esc(g)}</span>${ico('swap')}</button>`).join('')}</div>
      ${S.name ? `<label class="toggle"><input type="checkbox" id="meIn" ${S.meIn ? 'checked' : ''}> Put me in the story</label>` : ''}
      <button id="next" class="btn big">Start the story ${ico('next')}</button></div>`);
    names.forEach((g, i) => on('#g' + i, () => {
      let k = POOL.indexOf(names[i]);
      do { k = (k + 1) % POOL.length; } while (names.includes(POOL[k]));
      names[i] = POOL[k]; $('#g' + i + ' span').textContent = names[i]; say(names[i]);
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
  const wk = curWeek();
  let ep = epOf(wk), st = S.story[wk.id];
  if (!(await storyStart(wk))) return home();
  ep = epOf(wk); st = S.story[wk.id];
  const last = ep.parts.length > 1 && st.part === ep.parts.length - 1;
  prog = `${ep.title} · part ${st.part + 1} of ${ep.parts.length}`;
  const beats = ep.parts[st.part], starred = new Set();
  await prep(partTexts(beats, last, wk).concat(COMMON), 'Getting the story ready');
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
      <button id="next" class="btn big">Done ${ico('check')}</button></div>`);
    on('#next', res);
  });
}

// ---------- home ----------
function home() {
  if (pendingReload) { pendingReload = false; location.reload(); return; }
  prog = '';
  const wk = curWeek(), ep = epOf(wk);
  const stNow = S.story[wk.id];
  const sub = !ep || !stNow ? 'Choose a story' : stNow.part >= ep.parts.length ? 'Choose or play again' : `Part ${stNow.part + 1} of ${ep.parts.length}`;
  const storyBtn = `<button id="story" class="tile t-story"><span class="ticon">${ico('book')}</span><div class="tt"><b>Story day</b><small>${esc(sub)}</small></div></button>`;
  h(`<div class="top"><span class="wordmark">${ico('star')}<span>BellaSpeller</span></span><button id="lock" class="iconbtn" aria-label="Grown-ups">${ico('lock')}</button></div>
    <div class="screen"><div class="hello"><h1>Hello${S.name ? ' ' + esc(S.name) : ''}!</h1><p>What shall we do today?</p></div>
    <div class="tiles">${storyBtn}
    <button id="quick" class="tile t-quick"><span class="ticon">${ico('bolt')}</span><div class="tt"><b>Quick day</b><small>Just the ${wk.words.length} words</small></div></button>
    <button id="sky" class="tile t-sky"><span class="ticon">${ico('star')}</span><div class="tt"><b>My stars</b><small>${S.stars} ${S.stars === 1 ? 'star' : 'stars'}</small></div></button></div></div>`, { noTop: true });
  on('#story', storyDay); on('#quick', quickDay); on('#sky', () => ceiling().then(home)); on('#lock', adultGate);
}

// ---------- grown-ups ----------
function adultGate() {
  if (DEBUG) return adult(); // no PIN while debugging
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
  S.log.forEach(l => { if (l.ok && !l.hints && !l.redo) (days[l.w] = days[l.w] || new Set()).add(l.d); });
  return Object.keys(days).filter(w => days[w].size >= 2);
}
function adult() {
  const wk = curWeek(), own = owned();
  const rows = S.weeks.map(w => {
    const logs = S.log.filter(l => l.wk === w.id && !l.redo), days = new Set(logs.map(l => l.d)).size;
    const clean = logs.filter(l => l.ok && !l.hints).length;
    return `<tr><td>${esc(w.label)}${w.id === wk.id ? ' (current)' : ''}</td><td>${w.score == null ? 'not entered' : w.score + ' / ' + w.words.length}</td><td>${days}</td><td>${logs.length ? clean + ' of ' + logs.length : 'none'}</td><td>${w.ep ? 'yes' : 'no'}</td></tr>`;
  }).join('');
  const wordRows = wk.words.map(x => {
    const logs = S.log.filter(l => l.wk === wk.id && l.w === x.w && !l.redo);
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
    ${aiKey() ? `<button id="draft" class="btn">${epOf(wk) ? 'Write a different story' : 'Write the story'}</button>` : '<p class="note">To have stories written by AI, add an OpenRouter key under Settings, at the bottom of this page.</p>'}
    <div id="draftOut"></div>

    ${aiKey() ? `<h2>Compare models</h2><p class="note">Writes this week's story with each model so you can choose on evidence. One attempt each, so the results show how often each gets it right first time.</p>
    <input id="cm1" type="text" value="z-ai/glm-5.3"><input id="cm2" type="text" value="z-ai/glm-5.3-flashx" style="margin-top:8px"><input id="cm3" type="text" value="openai/gpt-6.1-terra" style="margin-top:8px">
    <button id="compare" class="btn">Write with all three</button><div id="cmpOut"></div>` : ''}

    <h2>Add a new week</h2>
    <label>Day of the spelling test</label><input id="nl" type="date" value="${new Date(Date.now() + 4 * 864e5).toISOString().slice(0, 10)}" style="max-width:220px">
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
    <p class="note">This is the device's own free voice. It is used when no recorded voice is chosen, while a recorded phrase is not ready yet, and for any line that contains her name.</p>
    <label>Recorded voice (uses the OpenRouter key below; saved on this device after first use)</label><select id="psel"><option value="">None: use this device's voice</option>${PRESETS.map(p => `<option value="${p.id}" ${effVp() === p.id ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}</select>
    <div><button id="psample" class="btn small">Hear a sample</button> <button id="pready" class="btn small">Get this week's words ready</button></div>
    <p id="pstat" class="note">${esc(lastTtsErr)}</p>
    <label>OpenRouter key, for writing stories (stays on this device, and is left out of backups)</label><input id="orKey" type="password" autocomplete="off" value="${esc(S.orKey || '')}">
    <label>AI model for writing stories</label><input id="orModel" type="text" list="modelList" autocomplete="off" value="${esc(S.orModel || DEFAULT_MODEL)}"><datalist id="modelList">${MODEL_SUGGESTIONS.map(m => `<option value="${m}">`).join('')}</datalist>
    <label>Story AI address (leave blank for OpenRouter; any OpenAI-style service works, for example Z.ai)</label><input id="aiBase" type="text" autocomplete="off" placeholder="https://openrouter.ai/api/v1" value="${esc(S.aiBase || '')}">
    <label>Story AI key (leave blank to use the OpenRouter key)</label><input id="aiKey" type="password" autocomplete="off" value="${esc(S.aiKey || '')}">
    <div><button id="saveName" class="btn">Save settings</button> <button id="backup" class="btn small">Save a backup file</button></div>
    <p class="note">BellaSpeller ${APP_VERSION}. Everything is stored on this device only.</p></div>`);
  on('#saveName', () => { S.name = $('#name').value.trim(); S.orKey = $('#orKey').value.trim(); S.orModel = $('#orModel').value.trim() || DEFAULT_MODEL; S.aiBase = $('#aiBase').value.trim(); S.aiKey = $('#aiKey').value.trim(); save(); adult(); });
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
  on('#compare', async () => {
    const out = $('#cmpOut'), btn = $('#compare');
    const models = ['cm1', 'cm2', 'cm3'].map(i => $('#' + i).value.trim()).filter(Boolean);
    const words = wk.words.map(x => x.w);
    btn.disabled = true; out.innerHTML = '<p class="note">Writing with ' + models.length + ' models. This can take up to a minute.</p>';
    const res = await Promise.all(models.map(async m => {
      try { const r = await askAI(wk, null, m); r.problems = checkEpisode(r.ep, words); r.model = m; return r; }
      catch (e) { return { model: m, error: e.message }; }
    }));
    out.innerHTML = res.map((r, i) => `<div class="cmp"><b>${esc(r.model)}</b>${r.ms ? ' · ' + Math.round(r.ms / 1000) + ' seconds' : ''}${r.usage ? ' · ' + (r.usage.prompt_tokens || '?') + ' in, ' + (r.usage.completion_tokens || '?') + ' out' : ''}<br>${r.error ? esc(r.error) : (r.problems.length ? 'Does not pass: ' + esc(r.problems.slice(0, 3).join(' ')) : 'Passes the checks')}${r.ep ? `<div><button class="btn small" data-v="${i}">Read it</button>${r.problems.length ? '' : ` <button class="btn small" data-u="${i}">Use this story</button>`}</div><div id="cv${i}"></div>` : ''}</div>`).join('');
    res.forEach((r, i) => {
      const v = out.querySelector(`[data-v="${i}"]`); if (v) v.onclick = () => { $('#cv' + i).innerHTML = storyPreview(r.ep); };
      const u = out.querySelector(`[data-u="${i}"]`);
      if (u) u.onclick = () => { const ep = r.ep; ep.title = String(ep.title || "This week's story"); ep.words = words; const id = 'ai' + Date.now(); S.eps = S.eps || {}; S.eps[id] = ep; wk.ep = id; delete S.story[wk.id]; save(); adult(); };
    });
    btn.disabled = false;
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
    a.href = URL.createObjectURL(new Blob([JSON.stringify(Object.assign({}, S, { orKey: undefined, aiKey: undefined }), null, 1)], { type: 'application/json' }));
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
      S.weeks.push({ id, label: $('#nl').value ? 'Test on ' + new Date($('#nl').value + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Week added ' + today(), rule: $('#nr').value.trim(), words: ws, score: null, ep: findEpisode(ws) });
      S.cur = id; save(); adult();
    });
  });
}

// ---------- debug settings: a button on every screen, no PIN. Set DEBUG to false for release. ----------
async function freshReload() {
  try { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); for (const k of await caches.keys()) await caches.delete(k); } catch (e) { }
  location.reload();
}
const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0; } return false; };
function debugUI() {
  if (!DEBUG) return;
  const b = document.createElement('button');
  b.id = 'dbg'; b.className = 'dbgbtn'; b.setAttribute('aria-label', 'Settings (debug)'); b.innerHTML = ico('gear');
  b.onclick = toggleDebug;
  document.body.appendChild(b);
  const sb = document.createElement('button');
  sb.id = 'snd'; sb.className = 'dbgbtn snd';
  const paint = () => { sb.innerHTML = ico(soundOn() ? 'speaker' : 'muted'); sb.setAttribute('aria-label', soundOn() ? 'Sound on' : 'Sound off'); sb.title = soundOn() ? 'Sound on' : 'Sound off'; sb.classList.toggle('off', !soundOn()); };
  sb.onclick = () => { S.sound = !soundOn(); save(); if (!soundOn()) hush(); paint(); };
  paint();
  document.body.appendChild(sb);
  const v = document.createElement('div');
  v.id = 'vtag'; v.textContent = 'BellaSpeller v' + APP_VER;
  document.body.appendChild(v);
  const check = async () => {
    try {
      const t = await (await fetch('app.js?chk=' + Date.now(), { cache: 'no-store' })).text();
      const m = t.match(/const APP_VER = '([^']+)'/); if (!m) return;
      const latest = m[1];
      if (latest === APP_VER) { v.className = 'ok'; v.textContent = 'BellaSpeller v' + APP_VER + ' ✓ latest'; v.onclick = null; }
      else if (newer(latest, APP_VER)) { v.className = 'new'; v.textContent = 'v' + APP_VER + ' · v' + latest + ' available: tap to update'; v.onclick = freshReload; }
      else { v.className = 'ok'; v.textContent = 'BellaSpeller v' + APP_VER + ' (ahead of the live site)'; v.onclick = null; }
    } catch (e) { v.className = ''; v.textContent = 'BellaSpeller v' + APP_VER + ' (offline: cannot check)'; }
  };
  check();
  setInterval(check, 120000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
}
function toggleDebug() {
  const old = $('#dbgPanel'); if (old) { old.remove(); return; }
  const wk = curWeek();
  const dev = ('speechSynthesis' in window ? speechSynthesis.getVoices() : []).filter(x => /^en/i.test(x.lang));
  const p = document.createElement('div');
  p.id = 'dbgPanel';
  p.innerHTML = `<div class="dbgcard adult">
    <div class="dbghead"><b>Debug settings</b><button id="dbgx" class="btn small" aria-label="Close">Close</button></div>
    <p class="note">${esc(APP_VERSION)}<br>Week: ${esc(wk.label)} · stars ${S.stars} · answers logged ${S.log.length}</p>
    <label>Recorded voice</label><select id="dvp"><option value="">None: use this device's voice</option>${PRESETS.map(x => `<option value="${x.id}" ${effVp() === x.id ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select>
    <label>Device voice</label><select id="dvs"><option value="">Automatic</option>${dev.map(x => `<option value="${esc(x.name)}" ${S.voiceName === x.name ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
    <label>Story model</label><input id="dmodel" type="text" list="dmodels" autocomplete="off" value="${esc(S.orModel || DEFAULT_MODEL)}"><datalist id="dmodels">${MODEL_SUGGESTIONS.map(m => `<option value="${m}">`).join('')}</datalist>
    <div class="dbgrow"><button id="dsample" class="btn small">Hear a sample</button><button id="dhome" class="btn small">Go home</button><button id="dstory" class="btn small">Restart this week's story</button><button id="dclear" class="btn small">Clear stars and answers</button><button id="dreload" class="btn small">Reload fresh copy</button><button id="dfull" class="btn small">Full grown-ups page</button></div>
    <p id="dmsg" class="note"></p></div>`;
  document.body.appendChild(p);
  const msg = t => { $('#dmsg').textContent = t; };
  const close = () => { const e = $('#dbgPanel'); if (e) e.remove(); };
  $('#dbgx').onclick = close;
  p.onclick = e => { if (e.target === p) close(); };
  $('#dvp').onchange = e => { S.vp = e.target.value; save(); msg('Recorded voice saved.'); };
  $('#dvs').onchange = e => { S.voiceName = e.target.value; save(); pickVoice(); msg('Device voice saved.'); };
  $('#dmodel').onchange = e => { S.orModel = e.target.value.trim() || DEFAULT_MODEL; save(); msg('Story model saved.'); };
  $('#dsample').onclick = () => say(SAMPLE);
  $('#dhome').onclick = () => { close(); hush(); home(); };
  $('#dstory').onclick = () => { delete S.story[wk.id]; save(); msg('This week\'s story will start again from part 1.'); };
  let sure = false;
  $('#dclear').onclick = () => {
    if (!sure) { sure = true; $('#dclear').textContent = 'Tap again to confirm'; return; }
    S.stars = 0; S.log = []; S.story = {}; save(); sure = false; $('#dclear').textContent = 'Clear stars and answers'; msg('Cleared.');
  };
  $('#dreload').onclick = () => { msg('Clearing saved copies...'); freshReload(); };
  $('#dfull').onclick = () => { close(); hush(); adult(); };
}

// ---------- the sleepover scene behind everything ----------
function buildScene() {
  const el = document.createElement('div');
  el.id = 'scene'; el.setAttribute('aria-hidden', 'true');
  const cols = ['#ffc83d', '#ff7a90', '#62d6aa', '#9d8cff'];
  let lights = '<g fill="none" stroke="rgba(255,255,255,.28)" stroke-width="2.5">';
  let bulbs = '';
  for (let i = 0; i < 6; i++) {
    const x0 = i * 200;
    lights += `<path d="M${x0} 8 Q${x0 + 100} 60 ${x0 + 200} 8"/>`;
    [[50, 24], [100, 31], [150, 24]].forEach(([dx, y], k) => {
      const c = cols[(i * 3 + k) % 4];
      bulbs += `<circle cx="${x0 + dx}" cy="${y + 6}" r="13" fill="${c}" opacity=".22"/><circle cx="${x0 + dx}" cy="${y + 6}" r="5.5" fill="${c}"/>`;
    });
  }
  lights += '</g>';
  const star = (x, y, s, d) => `<g class="tw" style="animation-delay:${d}s" opacity=".7" transform="translate(${x} ${y}) scale(${s})"><path fill="#fff1a8" d="M0 -12l3.5 7.4 8.1 1.1-5.9 5.7 1.4 8L0 5.2l-7.1 4 1.4-8-5.9-5.7 8.1-1.1z"/></g>`;
  const stars = star(290, 190, 1.1, 0) + star(380, 300, .8, .8) + star(500, 150, .9, 1.6) + star(640, 250, 1.2, .4) + star(760, 160, .8, 2.2) + star(920, 330, 1, 1.2) + star(260, 380, .7, 2.8) + star(700, 340, .8, .6) + star(60, 220, .9, 1.4) + star(1140, 200, .9, .2);
  el.innerHTML = `<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="moonglow"><stop offset="0" stop-color="#fff3b8" stop-opacity=".55"/><stop offset="1" stop-color="#fff3b8" stop-opacity="0"/></radialGradient>
      <radialGradient id="lantern"><stop offset="0" stop-color="#ffd27a" stop-opacity=".75"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>
    </defs>
    <circle cx="880" cy="170" r="120" fill="url(#moonglow)"/>
    <mask id="moonmask"><rect x="800" y="90" width="160" height="160" fill="#fff"/><circle cx="900" cy="158" r="38" fill="#000"/></mask>
    <circle cx="880" cy="170" r="46" fill="#fff3b8" mask="url(#moonmask)"/>
    ${lights}${bulbs}${stars}
    <path d="M0 800V700Q200 650 420 705T860 695T1200 670V800z" fill="#1b1650" opacity=".7"/>
    <circle cx="350" cy="745" r="150" fill="url(#lantern)"/>
    <path d="M250 800L350 590L450 800z" fill="#3b2c82"/>
    <path d="M350 590L250 800h44L350 660z" fill="#4a389a" opacity=".7"/>
    <path d="M322 800L350 690L378 800z" fill="#ffcf6b"/>
    <rect x="480" y="738" width="250" height="90" rx="45" fill="#34277a"/>
    <rect x="496" y="750" width="72" height="62" rx="28" fill="#5a47b0"/>
    <rect x="750" y="752" width="230" height="86" rx="43" fill="#43338f"/>
    <rect x="770" y="764" width="70" height="60" rx="28" fill="#6a56c4"/>
  </svg>`;
  document.body.insertBefore(el, document.body.firstChild);
}
buildScene();
debugUI();

// ---------- start ----------
// When a new version takes over, reload onto it, but only from the home screen so nobody loses their place.
let pendingReload = false;
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    if ($('#story, #quick')) location.reload(); else pendingReload = true;
  });
  navigator.serviceWorker.register('sw.js').catch(() => { });
}
home();
