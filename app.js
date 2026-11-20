'use strict';
// BellaSpeller, version 1. Everything is stored on this device only.

const KEY = 'star-speller-1';
const DEBUG = true; // true: settings button on every screen and no PIN. Set false for release.
const QUIET = location.search.indexOf('quiet') >= 0; // adding ?quiet=1 to the address silences everything (for testing)
function soundOn() { return QUIET ? false : S.sound === undefined ? true : S.sound === true; } // on by default
let testMode = false; // true while she is being tested: the spoken word is the test, so it is always on and there is no button to turn it off
const APP_VER = '3.123'; // bump with every release
const APP_VERSION = 'version ' + APP_VER + ', 15 November 2026' + (DEBUG ? ' (debug mode: no PIN)' : '');
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Her current set of ten words (from her own handwritten lists). A device that still has only the untouched first try-out week is moved to this set once.
const NEW_WORDS = ['many', 'enough', 'friend', 'because', 'answer', 'colour', 'great', 'decide', 'used', 'special'];
const OLD_TRYOUT = 'nice,nicer,shiny,shining,being,every,everyone,other';
function migrateWords(s) {
  if (s.wordsMigrated) return s;
  s.wordsMigrated = 1;
  const w = s.weeks[s.weeks.length - 1];
  if (s.weeks.length === 1 && w.id === 'w1' && w.words.map(x => x.w).join() === OLD_TRYOUT) {
    s.weeks.push({ id: 'w2', label: "Bella's words", rule: 'Tricky words that do not spell the way they sound', words: NEW_WORDS.map(x => ({ w: x })), score: null, ep: null });
    s.cur = 'w2';
  }
  return s;
}
// Mnemonics made before they had their own field were saved over the word's spelling trick. Move them across once.
function migrateMnem(s) {
  // A mnemonic is a sentence whose capitalised words start with the letters of the word, in order ("Big Elephants Can Always Understand Small Elephants" for because).
  const isMnemonic = (w, t) => t && /^[A-Z]/.test(t) && !/[:;]/.test(t) && t.split(/\s+/).filter(z => /^[A-Z]/.test(z)).map(z => z[0].toLowerCase()).join('') === w;
  (s.weeks || []).forEach(wk => (wk.words || []).forEach(x => {
    if (x.mnem && (isMnemonic(x.w, x.mnem) || (x.mnemWords && x.mnemBy === 'bella'))) { if (!x.mnemonic) x.mnemonic = x.mnem; delete x.mnem; delete x.mnemBy; }
  }));
  return s;
}
function fresh() {
  return {
    pin: null, name: '', girls: ['Imogen', 'Matilda', 'Florence', 'Tabitha'], meIn: false,
    weeks: [{
      id: 'w1', label: "Bella's words",
      rule: 'Tricky words that do not spell the way they sound',
      words: NEW_WORDS.map(w => ({ w })),
      score: null, ep: null
    }],
    cur: 'w1', log: [], stars: 0, story: {}
  };
}
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.weeks && s.weeks.length) { if (s.girls && s.girls.join() === 'Priya,Maya,Jess,Tilly') s.girls = ['Imogen', 'Matilda', 'Florence', 'Tabitha']; if (s.girls) s.girls = s.girls.map(g => g === 'Persephone' ? 'Matilda' : g); return migrateMnem(migrateWords(s)); } } catch (e) { } loadedFresh = true; return fresh(); }
let loadedFresh = false;
function save() {
  const j = JSON.stringify(S);
  try { localStorage.setItem(KEY, j); } catch (e) { saveWarn('Saving is not working in this browser. Please do not rely on what is on screen.'); }
  mirrorPut(j);
}
function saveWarn(msg) {
  if (document.getElementById('savewarn') || !document.body) return;
  const d = document.createElement('div'); d.id = 'savewarn'; d.textContent = msg;
  d.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;background:#b3261e;color:#fff;padding:12px 16px;border-radius:12px;font:600 16px sans-serif';
  document.body.appendChild(d);
}
// A second copy of everything, in a different store, so one browser clearing its storage cannot lose it all.
const looksFresh = st => !st || !st.weeks || (st.weeks.length === 1 && st.weeks[0].id === 'w1' && !(st.log || []).length && !Object.keys(st.eps || {}).length);
const mirrorDb = new Promise(res => { try { const r = indexedDB.open('bellaspeller-state', 1); r.onupgradeneeded = () => r.result.createObjectStore('state'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch (e) { res(null); } });
async function mirrorPut(j) {
  if (looksFresh(JSON.parse(j))) return; // never overwrite the safety copy with an empty start
  const db = await mirrorDb; if (!db) return;
  try { db.transaction('state', 'readwrite').objectStore('state').put(j, 'S'); } catch (e) { }
}
async function mirrorGet() {
  const db = await mirrorDb; if (!db) return null;
  return new Promise(res => { try { const q = db.transaction('state').objectStore('state').get('S'); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); } catch (e) { res(null); } });
}
let S = load();
const curWeek = () => S.weeks.find(w => w.id === S.cur) || S.weeks[S.weeks.length - 1];
const epOf = wk => (S.eps && S.eps[wk.ep]) || window.EPISODES[wk.ep];

// ---------- stories written by AI (grown-ups page only) ----------
const DEFAULT_MODEL = 'anthropic/claude-sonnet-5.5';
const modelSelect = id => { const cur = S.orModel || DEFAULT_MODEL, list = MODEL_SUGGESTIONS.includes(cur) ? MODEL_SUGGESTIONS : MODEL_SUGGESTIONS.concat([cur]); return `<select id="${id}">${list.map(m => `<option value="${esc(m)}" ${m === cur ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select>`; };
const MODEL_SUGGESTIONS = ['anthropic/claude-sonnet-5.5', 'openai/gpt-6.1-sol', 'google/gemini-4-hydrogen', 'mistralai/mistral-large-4-0', 'openai/gpt-6.1-terra'];
const STORY_RULES = `You write a short story for a spelling app used at home by a nine-year-old girl in England. She is the author: she chooses what happens. The story is told in parts, and each of the week's spelling words is met inside the story's own text, at the end of one paragraph, where the app will point it out to her.

The story idea in the request comes from the nine-year-old author, so follow it, keep it suitable for her age, and be kind about it.

Style: real children with ordinary problems (friendship, school, family, sleepovers), warm and funny, in British English. Short, plain sentences that sound good read aloud. No romance, nothing frightening or unkind. Nobody is ever teased about reading, spelling or being clever.

Setting and values: the story is set in a modern, sensible English family world, with kind, responsible parents and carers. Use British daily life and British English: school uniform, PE kit, break time, assembly, wellies, rain, the park, the corner shop, board games, torches, den-building, stargazing, reading under the covers. Never include fast food or junk food (no pizza, burgers, fries, soda, candy, takeaways) and no American words or customs (no mom, cookies, sidewalk, vacation, recess). Do not include food, eating or mealtimes in the story at all: no meals, snacks, treats, feasts or drinks, and no midnight feast. Sleepovers and adventures do not need food. If one of this week's spelling words is itself a food or eating word, use it in a natural non-food way if you can, otherwise as briefly as possible. Keep adults in the background. When a grown-up is needed, use a mum, a carer, a grandparent, an aunt, a teacher or a neighbour. Do not feature a dad or father, and never have one at home or helping with the story's events. Sleepovers are realistic: parents are at home, bedtimes are respected, and nobody is left unsupervised or put in danger. Fantasy is welcome when the idea asks for it (witches, dragons, other worlds), but everyday life stays British and sensible.

If the idea is a mystery or investigation, play fair: plant real clues early, give two or three suspects each with a reason and an alibi, let the friends make a wrong guess, and solve it kindly by reasoning from the clues. If the idea is science or building, keep it real and safe: garden and indoor experiments with an adult nearby, nothing dangerous. Show the steps of a good investigation (a question, a guess, a test, a measurement, a result, trying again), and let a failed test teach something.

Characters: {{CAST_RULE}}. The request says whether each is a girl or a boy and gives any trait: use the right pronouns (she and her, he and him) and keep each trait consistent. Never invent names for them. Other people have no names (her dad, the new teacher, a little brother).

How to work:
1. Plan first. Before writing, set out the plot in a few lines: the problem, what happens, how it ends. Put this in the "plan" field. The app ignores it; it is there so that you think the story through.
2. Write a story that makes sense on its own. Every paragraph follows from the one before. A reader who ignored the spelling words should find nothing odd.
3. Place each word where it belongs. For each spelling word, choose a paragraph where the word arises naturally from what is happening, and put it in that paragraph's LAST sentence. The last sentence must follow from the sentences before it.
4. Do not invent a reason for someone to write the word. No notes, signs, lists or diary lines unless the plot truly calls for one.
5. Do not bend the story to fit a word. If a word will not fit a paragraph, move it to a different paragraph.
6. Write in short, simple sentences, about 8 to 14 words each and never more than 22, that carry the reader along from one to the next. The story is shown as one run of sentences, not as paragraphs, so every sentence must follow from the one before it. Keep each paragraph short: two or three sentences, so the page is not crowded. Write exactly one paragraph for each spelling word, plus at most two short extra paragraphs (an opening and a closing). Spread the spelling words evenly, so that a word turns up in almost every paragraph and the words come one after another at a steady pace, while the story still hangs together. Keep the plan under 60 words.
7. Use each spelling word in an ordinary, natural way, in a complete sentence that a child would really say or read. Never use a word as a tag on the end of a sentence ("..., really.") or in a half-finished phrase ("she forgot when"), and never turn a sentence back to front to reach the word ("off she went" is fine, "off Ellie went" is not). If a word will not sit naturally in a paragraph, move it to another paragraph.
8. {{LENGTH_RULE}}
9. The story must be easy to follow for a nine-year-old who knows nothing about its topic. The first time anything unusual or technical appears (an object, a tool, a game, an experiment, a place), say in plain words what it is and why the characters are using it, before the story depends on it. Never mention an object as if the reader already knew it. For example, if paper clips will hold a bridge down or be used as weights, say so when the clips first appear. Say what each character wants early, and keep cause and effect clear: this happened, so that happened. Avoid jargon and lists of facts.

Reply with one JSON object: {"plan": string, "title": string, "parts": [part1, part2, ...]}. The request says how many parts and how many words go in each. Each part is a list of beats. A beat is one of:
{"n": "a narration paragraph with no spelling word to learn, one to three sentences"}
{"p": "a paragraph of two or three sentences whose LAST sentence contains the spelling word", "word": "the spelling word"}
{{CHOICE_FORMAT}}

Rules:
1. Every spelling word is the "word" of exactly one p beat in the whole story, and no other word is. The word is in lower case exactly as given, and appears exactly once, as a whole word, in the last sentence of that paragraph. Do not use a longer form in its place (for "nice" do not write "nicer" there).
{{CHOICE_RULE}}
3. Every part except the last ends with a cliffhanger. The last part resolves the story and ends warmly. Do not end by repeating the words.
4. A spelling word may also appear naturally elsewhere in the story, in narration, in other paragraphs and in choices. Write natural prose, and never avoid an ordinary word just because it is one of this week's spelling words.
5. Reply with the JSON object only.`;

const CHOICE_FORMAT = '{"c": {"q": "a question about what happens next", "o": [{"l": "short option", "n": "what happens, at most two sentences"}, {"l": "short option", "n": "what happens, at most two sentences"}]}}';
const nChoices = () => (S.choices === true ? 1 : Math.min(3, Math.max(0, parseInt(S.choices, 10) || 0)));
const CHOICE_RULE = n => '2. The whole story has exactly ' + n + (n === 1 ? ' choice' : ' choices') + ' in total (not one per part), spread out through the story. Put each choice after at least two paragraphs. Both options must lead sensibly into the rest of the story.';
const NO_CHOICE_RULE = '2. The story has no choices for the reader. Tell it straight through, and never use a c beat.';
// The story's length follows the number of spelling words: about this many words of story for each one.
const LENGTHS = { short: { label: 'Short', per: 18 }, standard: { label: 'Standard', per: 24 }, long: { label: 'Long', per: 36 } };
const curLen = () => { const L = LENGTHS[S.len] || LENGTHS.standard, n = Math.max(3, (curWeek().words || []).length), aim = L.per * n; return { label: L.label, aim, max: Math.round(aim * 1.2 + 30) }; };
const castN = () => Math.min(4, Math.max(2, parseInt(S.castN, 10) || 2));
const castRule = n => 'exactly ' + ['', '', 'two', 'three', 'four'][n] + ' friends, written only as ' + ['{g1}', '{g2}', '{g3}', '{g4}'].slice(0, n).join(', ').replace(/, ([^,]*)$/, ' and $1') + '. Do not add other named characters, and keep the cast small so the story stays short';
const storyRules = () => STORY_RULES.replace('{{CAST_RULE}}', castRule(castN())).replace('{{LENGTH_RULE}}', 'Keep the whole story under ' + curLen().max + ' words in all (aim for about ' + curLen().aim + '), so that reading it takes little time. Spend the words on a clear problem and a kind ending, not on extra scenes. Add up the words before you answer: a story over ' + curLen().max + ' words is rejected and has to be rewritten, which wastes time.').replace('{{CHOICE_FORMAT}}', nChoices() ? CHOICE_FORMAT : '').replace('{{CHOICE_RULE}}', nChoices() ? CHOICE_RULE(nChoices()) : NO_CHOICE_RULE);
function partPlan(n) { return [Math.max(1, n)]; } // one story, one part, every word in it
function lastSentence(t) {
  // A sentence ends at . ! or ? (and any closing quote) when the next word starts with a capital or an opening quote.
  // So "Is it really happy?" she whispered. stays one sentence.
  t = String(t).trim();
  let start = 0;
  for (const m of t.matchAll(/[.!?]+["”’')]*\s+(?=["“‘'A-Z])/g)) start = m.index + m[0].length;
  return t.slice(start).trim();
}
const wholeWord = (w, t) => (String(t).match(new RegExp('(^|[^A-Za-z\'’])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z]|[\'’][A-Za-z])', 'gi')) || []).length;
// Stores each word's story sentence (the last sentence of its paragraph) for Revise.
function addSentences(ep) {
  ep.sentences = {};
  ep.parts.forEach(part => part.forEach(b => { if (b.p && b.word) ep.sentences[b.word] = lastSentence(b.p); }));
}

const US = /\b(pizzas?|burgers?|hamburgers?|hot ?dogs?|fries|soda|candy|cookies?|mom|mommy|sidewalk|vacation|recess|takeaways?|fast food|junk food|mcdonald'?s|kfc|food|foods|eat|eats|eating|ate|eaten|meals?|mealtimes?|breakfast|lunch|lunchtime|dinner|supper|snacks?|feasts?|hungry|starving|drinks?|drinking|juice|squash|milk|tea|coffee|soup|eggs?|fish|chicken|vegetables?|salad|yoghurt|fruits?|apples?(?! trees?)|bananas?|bread|sandwiches|sandwich|pasta|rice|potato|potatoes|picnic|bake|baking|baked|cheese|toast|flapjacks?|biscuits?|cakes?|cupcakes?|crisps|sweets|chocolate|ice cream|marshmallows?|fizzy|white bread|midnight feast)\b/ig;
// Keeps only a few real emoji, and never food, drink or flags.
function cleanPic(t) {
  if (typeof t !== 'string') return undefined;
  const em = t.match(/\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}\uFE0F?)*/gu) || [];
  const food = ch => { const c = ch.codePointAt(0); return (c >= 0x1F32D && c <= 0x1F32F) || c === 0x1F33D || c === 0x1F336 || (c >= 0x1F345 && c <= 0x1F37F) || (c >= 0x1F950 && c <= 0x1F96F) || (c >= 0x1F9C0 && c <= 0x1F9CB) || c === 0x1F95B; };
  const ok = em.filter(e => !food(e)).slice(0, 5);
  return ok.length >= 2 ? ok.join('') : undefined;
}
function checkEpisode(ep, words) {
  const bad = [];
  const plan = partPlan(words.length);
  if (!ep || !Array.isArray(ep.parts) || ep.parts.length !== plan.length) return ['It should have ' + plan.length + ' part' + (plan.length === 1 ? '' : 's') + '.'];
  const texts = [String(ep.title || '')];
  const used = []; let totalChoices = 0;
  ep.parts.forEach((part, pi) => {
    if (!Array.isArray(part)) { bad.push('Part ' + (pi + 1) + ' is not a list.'); return; }
    let choices = 0, here = 0;
    part.forEach(b => {
      if (b && typeof b.n === 'string') texts.push(b.n);
      else if (b && b.c && Array.isArray(b.c.o) && b.c.o.length >= 2) { choices++; texts.push(String(b.c.q)); b.c.o.forEach(o => texts.push(String(o.l), String(o.n))); }
      else if (b && typeof b.p === 'string' && typeof b.word === 'string') {
        b.word = b.word.toLowerCase(); here++; used.push(b.word); texts.push(b.p); delete b.pic;
        if (typeof b.scene !== 'string' || b.scene.length > 280 || /\{(?!g[1-4]\})/.test(b.scene) || [...b.scene.matchAll(US)].length) delete b.scene; // a scene that does not pass is dropped and the paragraph is drawn instead
        if (!words.includes(b.word)) bad.push('"' + b.word + '" is not one of the words.');
        else if (new RegExp(',\\s*' + b.word + '[.!?]+["”’)]*$', 'i').test(lastSentence(b.p))) bad.push('The word "' + b.word + '" is only tacked on to the end of its sentence. Use it naturally inside a sentence.');
        else if (wholeWord(b.word, lastSentence(b.p)) !== 1) bad.push('The last sentence of the paragraph for "' + b.word + '" should contain "' + b.word + '" exactly once as a whole word.');
      } else bad.push('Part ' + (pi + 1) + ' has a beat the app cannot read.');
    });
    totalChoices += choices;
    if (Math.abs(here - plan[pi]) > 1) bad.push('Part ' + (pi + 1) + ' should have about ' + plan[pi] + ' word paragraphs, not ' + here + '.');
  });
  if (totalChoices !== nChoices()) bad.push('The story should have ' + (nChoices() ? 'exactly ' + nChoices() + (nChoices() === 1 ? ' choice' : ' choices') : 'no choices') + ' in all, not ' + totalChoices + '.');
  const longOnes = texts.slice(1).flatMap(t => splitSentences(t)).filter(t => t.split(/\s+/).length > 24).length;
  if (longOnes > 1) bad.push('Some sentences are too long (' + longOnes + ' are over 24 words). Write short, simple sentences.');
  const total = texts.slice(1).join(' ').split(/\s+/).filter(Boolean).length;
  if (total > curLen().max) bad.push('The story is ' + total + ' words, over the limit of ' + curLen().max + '. Shorten it.');
  words.forEach(w => { if (used.filter(x => x === w).length !== 1) bad.push('"' + w + '" should be the word of exactly one paragraph.'); });
  if (texts.some(t => /\{(?!g[1-4]\})/.test(t))) bad.push('It uses a name placeholder the app does not know.');
  if (texts.some(t => [...String(t).matchAll(/\{g([1-4])\}/g)].some(m => +m[1] > castN()))) bad.push('It uses more characters than the ' + castN() + ' in the cast.');
  const usHit = texts.map(t => [...String(t).matchAll(US)].map(m => m[0].toLowerCase()).filter(w => !words.includes(w))[0]).find(Boolean);
  if (usHit) bad.push('It mentions food or uses American wording (\"' + usHit + '\"). The family rules say no food in the stories and British English, as the instructions say.');
  return bad;
}
const DEFAULT_FAMILY_RULES = 'No food in the stories at all: no meals, snacks, treats, feasts or drinks. (Bella does not like cheese; no white bread, toast, flapjacks, biscuits, cakes or sweets; fruit only at the start of a meal. A list of foods that are fine will be added later.)';
const familyRules = () => (S.familyRules === undefined ? DEFAULT_FAMILY_RULES : S.familyRules).trim();
const castDesc = () => [0, 1, 2, 3].slice(0, castN()).map(i => { const m = (S.cast || [])[i] || {}; return '{g' + (i + 1) + '} is a ' + (m.boy ? 'boy' : 'girl') + (m.trait ? ', ' + m.trait : ''); }).join('; ');
const storyBrief = extra => '\nCharacters: ' + castDesc() + '.' + (extra && extra.idea ? '\nStory idea from the author: ' + extra.idea : '') + (familyRules() ? '\nFamily rules to follow: ' + familyRules() : '');
const aiBase = () => (S.aiBase || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
const aiKey = () => S.aiKey || S.orKey;
// The key is stored only in each device's own browser, so a new device has none until a grown-up adds it. These messages never include the key.
function aiNeedKey() { if (!aiKey()) throw new Error('This device does not have the AI key yet. A grown-up needs to add it: Grown-ups, then Settings, then paste the OpenRouter key and press Save settings.'); }
const aiFail = status => new Error(status === 401 || status === 403 ? 'The AI key on this device was refused. A grown-up should check it under Grown-ups, then Settings.' : 'The AI service answered ' + status + '. Please try again.');
async function askAI(wk, problems, model, extra) {
  const words = wk.words.map(x => x.w);
  let ask = 'This week\'s spelling words: ' + words.join(', ') + '.';
  const plan = partPlan(words.length);
  ask += '\nWrite ' + plan.length + ' part' + (plan.length === 1 ? '' : 's') + ', with ' + plan.join(', ') + ' word paragraph' + (plan.length === 1 && plan[0] === 1 ? '' : 's') + ' in each (' + words.length + ' words in all).';
  ask += storyBrief(extra);
  if (problems && problems.length) ask += '\n\nYour last draft had these problems. Write a new story that avoids them:\n- ' + problems.join('\n- ');
  aiNeedKey();
  const headers = { 'Authorization': 'Bearer ' + aiKey(), 'Content-Type': 'application/json' };
  if (/openrouter\.ai/.test(aiBase())) headers['X-Title'] = 'BellaSpeller';
  const t0 = Date.now();
  const r = await fetch(aiBase() + '/chat/completions', {
    method: 'POST', headers,
    body: JSON.stringify({ model: model || S.orModel || DEFAULT_MODEL, max_tokens: 8000, messages: [{ role: 'system', content: storyRules() }, { role: 'user', content: ask }] })
  });
  if (!r.ok) throw aiFail(r.status);
  const j = await r.json();
  const c = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
  const t = typeof c === 'string' ? c : Array.isArray(c) ? c.map(x => x.text || '').join('') : '';
  const i0 = t.indexOf('{'), i1 = t.lastIndexOf('}');
  if (i0 < 0 || i1 <= i0) throw new Error('The reply was not a story.');
  const raw = t.slice(i0, i1 + 1);
  try { return { ep: JSON.parse(raw), usage: j.usage || null, ms: Date.now() - t0 }; }
  catch (e) {
    const fr = j.choices[0].finish_reason || '?', out = j.usage && j.usage.completion_tokens;
    throw new Error('The reply was not valid story data (' + e.message + '). The model stopped because: ' + fr + (out ? ', after ' + out + ' tokens' : '') + '. The reply began: ' + t.slice(0, 160).replace(/\s+/g, ' ') + ' ... and ended: ' + t.slice(-120).replace(/\s+/g, ' '));
  }
}
async function draftStory(wk, extra) {
  const words = wk.words.map(x => x.w);
  // Two models write at the same time and the first draft that passes the checks is used. That is faster than waiting for one model and rewriting.
  const models = [...new Set([S.orModel || DEFAULT_MODEL, 'openai/gpt-6.1-terra'])];
  let problems = [];
  for (let round = 0; round < 2; round++) {
    const tries = models.map(async m => {
      const r = await askAI(wk, problems, m, extra), pr = checkEpisode(r.ep, words);
      if (pr.length) { const e = new Error(pr[0]); e.problems = pr; throw e; }
      return r.ep;
    });
    try {
      const ep = await Promise.any(tries);
      ep.title = String(ep.title || "This week's story"); ep.words = words; addSentences(ep); return ep;
    } catch (e) {
      const first = (e.errors || []).find(x => x && x.problems);
      if (first) problems = first.problems;
      else if (round === 1) throw new Error((e.errors && e.errors[0] && e.errors[0].message) || e.message || 'Could not write the story.');
    }
  }
  throw new Error('The drafts had problems (' + (problems[0] || 'they did not pass the checks') + '). Please try again.');
}
// Preview helper: shows the learning word in bold inside its paragraph's last sentence.
function markWord(text, word) {
  const ls = lastSentence(text), i = text.lastIndexOf(ls);
  const re = new RegExp('(^|[^A-Za-z\'’])(' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?![A-Za-z])', 'i');
  return esc(text.slice(0, i)) + esc(ls).replace(re, (m, a, w) => esc(a) + '<b>[' + w + ']</b>') + esc(text.slice(i + ls.length));
}
function storyPreview(ep) {
  return `<h3>${esc(ep.title)}</h3>` + ep.parts.map((part, i) => `<p class="parthead"><b>Part ${i + 1}</b></p>` + part.map(b =>
    b.n ? `<p>${esc(fill(b.n))}</p>`
      : b.c ? `<p><i>She chooses: ${esc(fill(b.c.q))}</i></p><ul>${b.c.o.map(o => `<li>${esc(fill(o.l))}: ${esc(fill(o.n))}</li>`).join('')}</ul>`
        : `<p>${markWord(fill(b.p || ''), b.word || '')}</p>`).join('')).join('');
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
const POOL = ['Imogen', 'Florence', 'Matilda', 'Beatrice', 'Evie', 'Tabitha', 'Amelia', 'Poppy', 'Isla', 'Ivy', 'Willow', 'Edith', 'Harriet', 'Lottie', 'Elsie', 'Maisie', 'Georgia', 'Grace', 'Ruby', 'Daisy', 'Alice', 'Hannah', 'Molly', 'Rose'];
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
// ---------- support tools (all switchable, all off by default) ----------
// Each word can carry: hard (the hard letters), parts (word parts, split with |), say (spelling voice), mnem (a memory trick).
const TOOLS = [
  { id: 'mnem', label: 'Memory trick', note: 'A short sentence or phrase that holds the spelling. Evidence for spelling is mixed; her own tricks are preferred.' },
  { id: 'hard', label: 'Underline the hard part', note: 'The tricky letters are underlined. No controlled study; she does this with her pen herself.' },
  { id: 'voice', label: 'Spelling voice', note: 'The word said the way it is spelled, such as w-hen. Some support: one controlled study, and her phonics scheme teaches it.' },
  { id: 'parts', label: 'Word parts', note: 'The word split into parts, such as side + ways. Word parts are among the better-supported teaching content.' },
  { id: 'family', label: 'Words like it', note: 'Words spelled with the same pattern, such as what, where, why for when. Made by the AI and checked by the app.' },
  { id: 'trace', label: 'Trace, copy, then write', note: 'Trace it, copy it, wait a moment, then write it from memory. Small case studies only.' },
  { id: 'letters', label: 'Say the letters while writing', note: 'She says each letter as she writes it. Evidence is mixed.' },
  { id: 'nextletter', label: 'Next letter', note: 'Gives her the next correct letter when she is stuck. It counts as help.' },
  { id: 'sure', label: 'Are you sure?', note: 'A gentle nudge, once per word, when a letter does not look right. It never says which letter. It counts as help.' },
  { id: 'choice', label: 'Pick the right spelling', note: 'She picks the right spelling from several, instead of writing it. This is recognition, not recall. Research found recall gives bigger memory benefits, so this is here to try, not because it is proven.' }
];
const toolOn = id => !!(S.tools && S.tools[id]);
// A tool is only offered for a word when it is switched on and the word has what the tool needs.
const toolHas = (id, x) => toolOn(id) && (id === 'mnem' ? !!x.mnem : id === 'hard' ? !!x.hard : id === 'voice' ? !!x.say : id === 'parts' ? !!x.parts && x.parts.includes('|') : true);
const toolsFor = x => TOOLS.filter(t => toolHas(t.id, x)).map(t => t.id);
const REVEALS = ['mnem', 'hard', 'parts', 'voice', 'sure', 'nextletter'];
const TOOL_SHORT = { family: 'Words like it', mnem: 'Memory trick', hard: 'Hard part', voice: 'Spelling voice', parts: 'Word parts', trace: 'Trace & copy', letters: 'Say the letters', sure: 'Are you sure?', choice: 'Pick the spelling', nextletter: 'Next letter' };
const SURE_MSG = 'Are you sure?';
function hardHtml(x) { const i = x.hard ? x.w.indexOf(x.hard) : -1; return i < 0 ? esc(x.w) : esc(x.w.slice(0, i)) + '<u>' + esc(x.hard) + '</u>' + esc(x.w.slice(i + x.hard.length)); }
// What the switched-on tools show for a word. stage 'look': the word is on screen. stage 'write': it is hidden, so anything shown is help.
function toolContent(x, stage) {
  const shown = []; let html = '';
  if (toolOn('hard') && x.hard) { shown.push('hard'); if (stage === 'write') html += `<div class="toolline"><b>The hard part:</b> <u>${esc(x.hard)}</u></div>`; }
  if (toolOn('parts') && x.parts && x.parts.includes('|')) { shown.push('parts'); html += `<div class="toolline"><b>Word parts:</b> ${x.parts.split('|').map(esc).join(' + ')}</div>`; }
  if (toolOn('voice') && x.say) { shown.push('voice'); html += `<div class="toolline"><b>Spelling voice:</b> ${esc(x.say)}</div>`; }
  if (toolOn('mnem')) { if (x.mnem) { shown.push('mnem'); html += `<div class="toolline"><b>Memory trick:</b> ${esc(x.mnem)}</div>`; } else html += `<div class="toolline"><button class="btn small" id="mymnem">Make my own memory trick</button></div>`; }
  if (toolOn('letters') && stage === 'write') { shown.push('letters'); html += '<div class="toolline">Say each letter out loud as you type it.</div>'; }
  return { html, shown };
}
// ---- help she asks for after a word did not go right: one at a time ----
const cueSpoken = (sentence, word) => sentence.trim().replace(/([^.!?])$/, '$1.') + ' The word I would like you to try to spell is ' + word + '. Again, the word is ' + word + '.';
const HELP_Q = 'That is not quite right. Would you like some help to spell this, or would you like to have another go?';
const HELP_MENU = 'Which help would you like?';
function helpsFor(x) { return ['family', 'hint', 'sure', 'choice']; } // the main helps, in this order; none shows the word
const HELP_LABEL = { family: 'A spelling tip', hint: 'A hint', sure: "I will tell you if a letter doesn't look right", voice: 'Spelling voice', hard: 'Hard part', parts: 'Word parts', choice: 'Multiple choice' };
// Empty boxes, one per letter, so she can see how long the word is and where the tricky bit is, without seeing any letters.
function boxesHtml(x, marks, groups) {
  const w = x.w, hi = x.hard ? w.indexOf(x.hard) : -1; let i = 0, out = '';
  const cells = (n, off) => { let h2 = ''; for (let k = 0; k < n; k++) { const at = off + k, m = marks && hi >= 0 && at >= hi && at < hi + x.hard.length; h2 += `<span class="bx${m ? ' hardbx' : ''}"></span>`; } return h2; };
  if (groups) { let off = 0; return groups.map(g => { const t = `<span class="bxg">${cells(g.length, off)}</span>`; off += g.length; return t; }).join('<span class="bxplus">+</span>'); }
  return `<span class="bxg">${cells(w.length, 0)}</span>`;
}
// Basic English spelling patterns, used to give the rule for a word. Checked in this order: the first that fits wins.
// [pattern, where it must be ('start', 'end', 'any'), example words]. No food words, no American spellings.
const PHONICS = [
  ['th', 'start', ['this', 'that', 'those', 'then', 'them']], ['sh', 'start', ['ship', 'shop', 'shell', 'shut']], ['ch', 'start', ['chat', 'chain', 'chop', 'chair']],
  ['wh', 'start', ['what', 'when', 'where', 'why', 'which']], ['kn', 'start', ['knee', 'knit', 'knock', 'know']], ['wr', 'start', ['write', 'wrong', 'wrap', 'wrist']], ['qu', 'start', ['queen', 'quick', 'quiet', 'quite']],
  ['ould', 'end', ['could', 'would', 'should']], ['ight', 'any', ['night', 'light', 'right', 'sight', 'might']], ['ough', 'any', ['though', 'through', 'thought', 'rough', 'enough']],
  ['tion', 'end', ['nation', 'action', 'station', 'motion']], ['ture', 'end', ['picture', 'nature', 'future', 'creature']], ['tch', 'end', ['catch', 'match', 'watch', 'witch']], ['dge', 'end', ['bridge', 'edge', 'badge', 'judge']],
  ['ck', 'end', ['back', 'pack', 'duck', 'kick']], ['ful', 'end', ['careful', 'helpful', 'playful', 'cheerful']], ['ous', 'end', ['famous', 'nervous', 'serious', 'curious']], ['ly', 'end', ['slowly', 'quickly', 'gladly', 'kindly']],
  ['ing', 'end', ['going', 'playing', 'jumping', 'singing']], ['ed', 'end', ['jumped', 'played', 'wanted', 'helped']], ['le', 'end', ['little', 'table', 'bubble', 'puzzle']],
  ['ere', 'end', ['where', 'there', 'here', 'were']], ['ear', 'any', ['hear', 'near', 'year', 'dear']], ['are', 'end', ['care', 'share', 'dare', 'spare']], ['air', 'any', ['hair', 'pair', 'chair', 'fair']],
  ['y', 'end', ['happy', 'funny', 'windy', 'sunny'], w => w.length >= 4 && !/[aeiou]y$/.test(w)],
  ['ce', 'end', ['race', 'face', 'ice', 'place', 'mice']], ['ci', 'any', ['city', 'circle', 'cinema', 'pencil']], ['cy', 'any', ['fancy', 'icy', 'cycle', 'mercy']], ['ge', 'end', ['age', 'page', 'stage', 'huge']],
  ['ph', 'any', ['phone', 'photo', 'graph', 'elephant']], ['ea', 'any', ['read', 'beat', 'team', 'speak', 'seat']], ['ee', 'any', ['tree', 'green', 'sleep', 'need']], ['oa', 'any', ['boat', 'road', 'coat', 'soap']],
  ['ai', 'any', ['rain', 'train', 'wait', 'paint']], ['ay', 'any', ['day', 'play', 'stay', 'way']], ['oo', 'any', ['moon', 'room', 'school', 'cool']], ['ie', 'any', ['field', 'piece', 'chief', 'brief']], ['ei', 'any', ['ceiling', 'receive', 'neighbour', 'eight']],
  ['ou', 'any', ['house', 'cloud', 'mouth', 'round']], ['ow', 'any', ['down', 'town', 'flower', 'brown']], ['oy', 'any', ['boy', 'toy', 'enjoy', 'royal']], ['oi', 'any', ['coin', 'noise', 'point', 'voice']],
  ['au', 'any', ['because', 'haunt', 'launch', 'author']], ['aw', 'any', ['saw', 'draw', 'claw', 'paw']], ['ar', 'any', ['car', 'star', 'park', 'farm']], ['or', 'any', ['for', 'sport', 'short', 'storm']],
  ['er', 'any', ['her', 'water', 'sister', 'letter']], ['ir', 'any', ['girl', 'first', 'third', 'bird']], ['ur', 'any', ['turn', 'hurt', 'burst', 'nurse']], ['ss', 'any', ['dress', 'glass', 'class', 'mess']],
  ['ll', 'any', ['bell', 'tall', 'small', 'hill']], ['ff', 'any', ['off', 'cliff', 'puff', 'sniff']]
];
// What the pattern sounds like and how it works, in plain words, said aloud with the rule. Basic phonics.
const PNOTE = {
  th: 'The two letters t and h work together to make one sound, the sound at the start of this and thin.', sh: 'The two letters s and h work together to make one sound, sh.', ch: 'The two letters c and h work together to make one sound, ch.',
  wh: 'The letters w and h together say w.', kn: 'The k is silent. The two letters say n.', wr: 'The w is silent. The two letters say r.', qu: 'Q is always followed by u, and together they say kw.',
  ph: 'The letters p and h together say f.', ck: 'The letters c and k together say k, at the end of a word.', tion: 'The letters t i o n together say shun.', tch: 'The letters t c h together say ch.', dge: 'The letters d g e together say j.',
  ight: 'The letters i g h t together say ite. The g and h are silent.', ough: 'The letters o u g h can be said in lots of different ways, so this one needs to be learned.',
  ea: 'The letters e a usually say ee.', ee: 'The letters e e say ee.', oa: 'The letters o a say oh.', ai: 'The letters a i say ay. A i goes in the middle of a word. A y goes at the end.', ay: 'The letters a y say ay. A y goes at the end of a word. A i goes in the middle.',
  oo: 'The letters o o say oo, as in moon.', ou: 'The letters o u say ow, as in house.', ow: 'The letters o w say ow, as in down.', oi: 'The letters o i say oi. O i goes in the middle. O y goes at the end.', oy: 'The letters o y say oi. O y goes at the end. O i goes in the middle.',
  au: 'The letters a u say or.', aw: 'The letters a w say or.', ar: 'The letters a r say ar, as in car.', or: 'The letters o r say or.', er: 'E r, i r and u r all say er.', ir: 'I r, e r and u r all say er.', ur: 'U r, e r and i r all say er.',
  ss: 'At the end of a short word, we often double the s, the l and the f.', ll: 'At the end of a short word, we often double the l, the s and the f.', ff: 'At the end of a short word, we often double the f, the l and the s.',
  ere: 'The letters e r e at the end can say air, as in where, or eer, as in here.', ear: 'The letters e a r usually say eer, as in hear.', are: 'The letters a r e at the end say air, as in care.', air: 'The letters a i r say air, as in hair.',
  ce: 'Sometimes the s sound is made with the letter c. When a c comes before e, i or y, it says s, as in ice, city and fancy.', ci: 'Sometimes the s sound is made with the letter c. When a c comes before e, i or y, it says s, as in ice, city and fancy.', cy: 'Sometimes the s sound is made with the letter c. When a c comes before e, i or y, it says s, as in ice, city and fancy.',
  ge: 'Sometimes the j sound is made with the letter g. When a g comes before e, i or y, it can say j, as in age, giant and gym.',
  y: 'The letter y at the end of a longer word usually says ee.',
  ould: 'The letters o u l d say ood.', le: 'The letters l e at the end of a word say ul.', ie: 'The letters i e can say ee, as in field, or eye, as in pie.'
};
// The sound each pattern makes, written the way a speech voice will say it as a sound, not as letter names. Not checked by ear yet.
const PSOUND = { y: 'ee', th: 'thhh', sh: 'shhh', ch: 'chhh', wh: 'wuh', kn: 'nnn', wr: 'rrr', qu: 'kwuh', ph: 'fff', ck: 'kuh', tion: 'shun', tch: 'chhh', dge: 'juh', ight: 'ite', ea: 'ee', ee: 'ee', oa: 'oh', ai: 'ay', ay: 'ay', oo: 'oo', ie: 'ee', ei: 'ay', ou: 'ow', ow: 'ow', oy: 'oy', oi: 'oy', au: 'or', aw: 'or', ar: 'ar', or: 'or', er: 'er', ir: 'er', ur: 'er', ss: 'sss', ll: 'lll', ff: 'fff', ould: 'ood', le: 'ul' };
const listOf = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0];
// Which letters of the word did she get wrong? Uses the best match between what she typed and the word.
const lastTyped = new Map();
const noteTyped = (w, typed) => { if (typed && typed !== w) lastTyped.set(w, typed); else lastTyped.delete(w); };
function errorSpan(w, typed) {
  if (!typed || typed === w) return null;
  let pre = 0; while (pre < w.length && pre < typed.length && w[pre] === typed[pre]) pre++;
  let suf = 0; while (suf < w.length - pre && suf < typed.length - pre && w[w.length - 1 - suf] === typed[typed.length - 1 - suf]) suf++;
  const idx = []; for (let i = pre; i < w.length - suf; i++) idx.push(i);
  if (!idx.length) { if (pre > 0) idx.push(pre - 1); if (pre < w.length) idx.push(pre); } // an extra letter: the place it went in
  return idx.length ? idx : null;
}
const whereInWord = (w, idx) => { const m = idx.reduce((a, b) => a + b, 0) / idx.length / w.length; return m < 0.34 ? 'at the start' : m > 0.66 ? 'near the end' : 'in the middle'; };
function phonicsRule(w, typed) {
  const err = errorSpan(w, typed), cands = [];
  for (const [pat, where, ex, test] of PHONICS) {
    if (test && !test(w)) continue;
    let at = [];
    if (where === 'start') { if (w.startsWith(pat)) at = [0]; }
    else if (where === 'end') { if (w.endsWith(pat) && w.length > pat.length) at = [w.length - pat.length]; }
    else { let i = w.indexOf(pat); while (i >= 0) { at.push(i); i = w.indexOf(pat, i + 1); } }
    if (!at.length) continue;
    const family = ex.filter(e => e !== w).slice(0, 3);
    if (family.length < 2) continue;
    const hit = err ? at.find(p => err.some(i => i >= p && i < p + pat.length)) : undefined;
    cands.push({ pat, where, family, hits: hit !== undefined, p0: hit !== undefined ? hit : at[0] });
  }
  // the rule for the part she got wrong; with no attempt to go on, the first pattern that fits. If what she got wrong is covered by no pattern, say only where it is.
  const c = err ? cands.find(x => x.hits) : cands[0];
  const sp0 = w.match(/([aeiou])[^aeiouwy]e$/);
  if (err && !c && !sp0) {
    const ord = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
    const k = err[0], nth = ord[k] || ('number ' + (k + 1));
    const msg = typed.length > w.length ? 'The word has ' + w.length + ' letters, and you have written ' + typed.length + '. There is one letter too many.'
      : typed.length < w.length ? 'The word has ' + w.length + ' letters, and you have written ' + typed.length + '. A letter is missing.'
      : 'The word has ' + w.length + ' letters. Look again at the ' + nth + ' letter.';
    return { rule: '', hint: msg, spoken: 'There is no spelling rule for this one, but here is a hint. ' + msg, family: [] };
  }
  if (c) {
    const place = c.where === 'start' ? 'It starts with ' + c.pat : c.where === 'end' ? 'It ends with ' + c.pat : 'It has ' + c.pat + ' in it';
    const letters = c.pat.split('').join(' '), snd = PSOUND[c.pat];
    const loc = c.where === 'start' ? 'at the start' : c.where === 'end' ? 'near the end' : whereInWord(w, Array.from({ length: c.pat.length }, (_, k) => c.p0 + k));
    const spoken = (err ? 'The tricky part is ' + loc + '. ' : '') + (c.where === 'start' ? 'It starts with ' : c.where === 'end' ? 'It ends with ' : 'It has ') + (snd ? 'the sound ' + snd + '. Listen: ' + listOf(c.family) + '. ' : 'the letters ' + letters + ', like ' + listOf(c.family) + '. ') + (PNOTE[c.pat] || (c.pat.length === 2 && !['ly', 'ed', 'le'].includes(c.pat) ? 'That is called a digraph: two letters, one sound.' : ''));
    return { rule: place + ', like ' + listOf(c.family) + '.', spoken, family: c.family };
  }
  const sp = w.match(/([aeiou])[^aeiouwy]e$/);
  if (sp) {
    const v = sp[1], ex = { a: ['make', 'game', 'late'], e: ['these', 'theme', 'complete'], i: ['time', 'bike', 'like'], o: ['hope', 'home', 'nose'], u: ['cube', 'tune', 'huge'] }[v].filter(e => e !== w);
    return { rule: 'It has a split digraph, ' + v + '_e, like ' + listOf(ex) + '.', spoken: (err ? 'The tricky part is ' + whereInWord(w, err) + '. ' : '') + 'It has a split digraph, ' + v + ' and e, like ' + listOf(ex) + '. The ' + v + ' and the e on the end work together to make one sound, with a letter in between.', family: ex };
  }
  return null;
}
// The rule and words like it for a word: from the built-in spelling patterns first, then from the AI's suggestion.
const famOf = x => { const ph = phonicsRule(x.w, lastTyped.get(x.w)); return ph || { rule: x.rule || '', family: x.family || [] }; };
// What is said aloud for Words like it: the rule and the similar words, never the word itself.
const wordAgain = x => ' Now spell the word: ' + x.w + '.'; // every spoken help ends by saying the word again
// A hint is not a spelling rule: it is about what she wrote (how many letters, which one to look at), or, before she has tried, how many letters and the first one.
function hintFor(x) {
  const w = x.w, typed = lastTyped.get(w), err = errorSpan(w, typed);
  if (!typed || !err) return 'The word has ' + w.length + ' letters and it starts with ' + w[0] + '.';
  const nth = ORD[err[0]] || ('number ' + (err[0] + 1));
  if (typed.length > w.length) return 'The word has ' + w.length + ' letters, and you wrote ' + typed.length + '. There is one letter too many.';
  if (typed.length < w.length) return 'The word has ' + w.length + ' letters, and you wrote ' + typed.length + '. A letter is missing.';
  return 'The word has ' + w.length + ' letters. Look again at the ' + nth + ' letter.';
}
const familyText = x => { const tip = trickText(x) ? spokenTip(x) : ''; if (tip) return x.w + '. ' + tip; const f = famOf(x); const body = (f.spoken || f.rule || '') + (!f.rule && f.family.length ? 'Other words spelled like it are ' + f.family.slice(0, 3).join(', ') + '.' : ''); return x.w + '. ' + (body || 'Listen carefully, and say it slowly, sound by sound.'); };
function helpContent(x, id) {
  const L = (t, v) => `<div class="helpline">${t ? '<b>' + esc(t) + '</b> ' : ''}${v}</div>`;
  if (id === 'hint') { const t = hintFor(x); return { html: '<div class="helpline"><b>A hint:</b> ' + esc(t) + '</div><button class="hearbar" id="hearsay">' + ico('speaker') + '<span>Tap to hear the hint again</span></button>', say: x.w + '. ' + t }; }
  if (id === 'family') { const tip = trickText(x); return { html: (tip ? '<div class="helpline"><b>A spelling tip:</b> ' + esc(tip) + '</div>' : '') + '<button class="hearbar" id="hearsay">' + ico('speaker') + '<span>Tap to hear the spelling tip again</span></button>', say: familyText(x) }; }
  if (id === 'voice' && x.say) return { html: L('Listen to it said the spelling way:', '<button class="btn small" id="hearsay">Hear it</button>'), say: x.say + '.' + wordAgain(x) };
  if (id === 'parts' && x.parts) return { html: L('This word is built from ' + x.parts.split('|').length + ' smaller pieces. Here is a box for each letter, so you can see how big each piece is:', '<div class="bxrow">' + boxesHtml(x, false, x.parts.split('|')) + '</div>') };
  if (id === 'hard' && x.hard) return { html: L('One box for each letter. The yellow ones are the tricky ones:', '<div class="bxrow">' + boxesHtml(x, true) + '</div>') };
  if (id === 'letters') return { html: L('', 'Say each letter out loud as you type it.') };
  if (id === 'sure') return { html: L('', "I will tell you if a letter doesn't look right.") };
  return { html: '' };
}
function toolsPanel() {
  return `<div class="toolsbar"><div class="toolcap">Tap a help to use it:</div>
    <div id="toolchips" class="chiprow">${TOOLS.map(t => `<button class="chip small${toolOn(t.id) ? ' on' : ''}" data-tool="${t.id}" aria-pressed="${toolOn(t.id)}">${esc(TOOL_SHORT[t.id] || t.label)}</button>`).join('')}</div>
    <div id="toolbody"></div></div>`;
}
// Wires the help switches. Calls after(content) now and after every change.
function wireTools(x, stage, after) {
  const body = () => {
    const c = toolContent(x, stage); $('#toolbody').innerHTML = c.html;
    const m = $('#mymnem'); if (m) m.onclick = async () => { const t = await typeText({ title: 'Your memory trick for this word', initial: '', max: 140 }); if (t && t.trim()) { x.mnem = t.trim(); x.mnemBy = 'bella'; save(); body(); } };
    if (after) after(c);
  };
  document.querySelectorAll('.chip[data-tool]').forEach(c => { c.onclick = () => { S.tools = S.tools || {}; const id = c.dataset.tool; S.tools[id] = !toolOn(id); save(); c.classList.toggle('on', toolOn(id)); c.setAttribute('aria-pressed', String(toolOn(id))); body(); }; });
  body();
}
async function aiJSON(sys, user, maxTokens) {
  aiNeedKey();
  const headers = { 'Authorization': 'Bearer ' + aiKey(), 'Content-Type': 'application/json' };
  if (/openrouter\.ai/.test(aiBase())) headers['X-Title'] = 'BellaSpeller';
  const r = await fetch(aiBase() + '/chat/completions', { method: 'POST', headers, body: JSON.stringify({ model: S.orModel || DEFAULT_MODEL, max_tokens: maxTokens || 3000, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] }) });
  if (!r.ok) throw aiFail(r.status);
  const j = await r.json(), c = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
  const t = typeof c === 'string' ? c : Array.isArray(c) ? c.map(x => x.text || '').join('') : '';
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('The reply was not usable.');
  return JSON.parse(t.slice(a, b + 1));
}
// Asks the AI to suggest tool data for each word, keeps only suggestions that pass checks, never overwrites what a grown-up or Bella typed.
async function suggestTools(wk) {
  const words = wk.words.map(x => x.w);
  const sys = 'You help a nine-year-old girl in England with dyslexia learn spellings. For each spelling word give: "hard": the 1 to 4 letters of the word that cannot be sounded out or are most often written wrongly (a run of letters that appears in the word); "say": the word spelled out as it is written but said in pieces with hyphens, so that removing the hyphens gives the word (for example w-hen); "parts": the word split with | into two or three meaningful parts such as syllables or smaller words (for example side|ways), or the word unsplit if there is no good split; "mnem": one short memory sentence or phrase in plain British English that helps hold the spelling, under 14 words (an acrostic such as Big Elephants Can Always Understand Small Elephants for because is fine); "wrong": two or three misspellings that children commonly write for this word, each a made-up string and not a real English word (for example freind for friend); "rule": one short, friendly sentence under 16 words that names the spelling pattern in the word and gives two or three common words that share it, without ever writing out the whole word (for there: It starts with th, like this, that and those. For friend: The ie is the same as in field and piece.); "family": three everyday words a nine-year-old knows that are spelled with the same pattern as this word, never the word itself (for when: what, where, why; for friend: field, piece, chief). No food or eating in any phrase. Reply with JSON only: {"words": [{"word": "...", "hard": "...", "say": "...", "parts": "...", "mnem": "...", "wrong": ["...", "..."], "rule": "...", "family": ["...", "...", "..."]}]}.';
  const o = await aiJSON(sys, 'Spelling words: ' + words.join(', '), 3000);
  let added = 0;
  (o.words || []).forEach(sg => {
    const x = wk.words.find(w => w.w === String(sg.word || '').toLowerCase()); if (!x) return;
    const w = x.w, ok = t => typeof t === 'string' && t.trim();
    if (!x.hard && ok(sg.hard) && w.includes(sg.hard.toLowerCase().trim()) && sg.hard.trim().length < w.length) { x.hard = sg.hard.toLowerCase().trim(); added++; }
    if (!x.say && ok(sg.say) && sg.say.replace(/-/g, '').toLowerCase() === w && sg.say.includes('-')) { x.say = sg.say.toLowerCase().trim(); added++; }
    if (!x.parts && ok(sg.parts) && sg.parts.replace(/\|/g, '').toLowerCase() === w && sg.parts.includes('|')) { x.parts = sg.parts.toLowerCase().trim(); added++; }
    if (!x.wrong && Array.isArray(sg.wrong)) { const good = sg.wrong.map(t => String(t).toLowerCase().trim()).filter(t => /^[a-z'-]+$/.test(t) && t !== w && Math.abs(t.length - w.length) <= 3 && !words.includes(t)).slice(0, 4); if (good.length) { x.wrong = good; added++; } }
    if (!x.rule && ok(sg.rule) && sg.rule.length <= 130 && !sg.rule.toLowerCase().includes(w) && ![...sg.rule.matchAll(US)].length) { x.rule = sg.rule.trim(); added++; }
    if (!x.family && Array.isArray(sg.family)) {
      const share = f => { let a = 0; while (a < w.length && a < f.length && w[a] === f[a]) a++; let b = 0; while (b < w.length && b < f.length && w[w.length - 1 - b] === f[f.length - 1 - b]) b++; return a >= 2 || b >= 3 || (x.hard && f.includes(x.hard)); };
      const fam = sg.family.map(t => String(t).toLowerCase().trim()).filter(f => /^[a-z]{2,12}$/.test(f) && f !== w && !words.includes(f) && share(f) && ![...f.matchAll(US)].length).slice(0, 4);
      if (fam.length) { x.family = fam; added++; }
    }
    if (!x.mnem && ok(sg.mnem) && sg.mnem.length <= 140 && ![...sg.mnem.matchAll(US)].some(m => !words.includes(m[0].toLowerCase()))) { x.mnem = sg.mnem.trim(); x.mnemBy = 'ai'; added++; }
  });
  wk.words.forEach(x => { x.sug = true; x.ruleTried = true; });
  save();
  return added;
}
// Quietly makes tool data for any word that has none yet. Needs the AI key and a connection; failure is silent.
let suggesting = false;
async function ensureTools(wk) {
  if (suggesting || !aiKey() || !navigator.onLine || !wk.words.some(x => !x.sug || !x.ruleTried)) return;
  suggesting = true;
  try { await suggestTools(wk); } catch (e) { } finally { suggesting = false; }
}
function toolsProgress() {
  const logs = S.log.filter(l => (l.mode === 'revise' || l.mode === 'story') && l.typed !== undefined);
  if (!logs.length) return '<p class="note">None yet.</p>';
  const rowFor = (label, f) => { const g = logs.filter(f); return g.length ? `<tr><td>${esc(label)}</td><td>${g.length}</td><td>${g.filter(l => l.ok).length}</td></tr>` : ''; };
  const rows = rowFor('First go, no help', l => !l.rung && !(l.tools && l.tools.length) && !l.hints && !l.remind) + rowFor('Another go, no help', l => l.rung && !(l.tools && l.tools.length)) + TOOLS.map(t => rowFor(t.label, l => (l.tools || []).includes(t.id))).join('');
  return `<table><tr><th>Help</th><th>Tries</th><th>Right</th></tr>${rows}</table><p class="note">A hint, not a finding. Bella chooses the help herself, after a word has gone wrong, so a help can look good or bad for other reasons.</p>`;
}
function misspellings(x, weekWords) {
  const w = x.w, seen = new Set([w]), out = [];
  const add = t => { t = String(t || '').toLowerCase().trim(); if (!t || seen.has(t) || !/^[a-z'-]+$/.test(t) || Math.abs(t.length - w.length) > 3 || t.length < Math.min(4, w.length) || (weekWords || []).includes(t)) return false; seen.add(t); out.push(t); return true; };
  S.log.slice().reverse().filter(l => l.w === w && !l.ok && l.typed).forEach(l => { if (out.length < 3) add(l.typed); });
  shuffle((x.wrong || []).slice()).forEach(t => { if (out.length < 3) add(t); });
  const SW = [['e', 'ea'], ['ea', 'e'], ['ea', 'ee'], ['ee', 'ea'], ['ai', 'ay'], ['ay', 'ai'], ['oa', 'ow'], ['ow', 'oa'], ['ou', 'ow'], ['ow', 'ou'], ['oo', 'u'], ['ie', 'ei'], ['ei', 'ie'], ['au', 'aw'], ['aw', 'au'], ['er', 'ur'], ['ur', 'er'], ['ir', 'er'], ['or', 'ar'], ['igh', 'ie'], ['ough', 'uff'], ['ough', 'ow'], ['ph', 'f'], ['ck', 'k'], ['tion', 'shun'], ['cial', 'shul'], ['ge', 'dge'], ['dge', 'ge'], ['c', 's'], ['s', 'c'], ['i', 'y'], ['y', 'i'], ['e', 'a'], ['a', 'e'], ['o', 'u'], ['u', 'o'], ['kn', 'n'], ['wr', 'r'], ['wh', 'w'], ['gh', ''], ['ss', 's'], ['s', 'ss'], ['ll', 'l'], ['l', 'll'], ['tt', 't'], ['t', 'tt'], ['nn', 'n'], ['n', 'nn'], ['rr', 'r'], ['r', 'rr']];
  const cands = [];
  SW.forEach(([a, b]) => { let i = w.indexOf(a); while (i >= 0) { cands.push(w.slice(0, i) + b + w.slice(i + a.length)); i = w.indexOf(a, i + 1); } });
  cands.push(w.endsWith('e') ? w.slice(0, -1) : w + 'e');
  for (let i = 1; i < w.length - 1; i++) cands.push(w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2));
  shuffle(cands).forEach(t => { if (out.length < 3) add(t); });
  for (let i = 1; i < w.length && out.length < 3; i++) add(w.slice(0, i) + w[i] + w.slice(i));
  for (let i = 1; i < w.length && out.length < 3; i++) add(w.slice(0, i) + w.slice(i + 1));
  return out.slice(0, 3);
}
function toolsPane(wk) {
  const rows = wk.words.map((x, i) => `<div class="wcard"><h3>${esc(x.w)}</h3>
    <input type="text" class="tf" data-i="${i}" data-f="mnem" value="${esc(x.mnem || '')}" placeholder="a spelling tip" aria-label="Spelling tip for ${esc(x.w)}" autocomplete="off">${x.mnemBy === 'ai' ? '<span class="note">suggested by the AI</span>' : ''}</div>`).join('');
  return `<h2>This Week's Spelling Tips</h2>
    <p class="note">The tip Bella sees and hears for each word under Spelling tips. Change any of them, or leave a box empty to show nothing for that word.</p>
    ${rows}
    <div><button id="tsave" class="btn">Save these</button> ${aiKey() ? '<button id="tsuggest" class="btn small">Fill empty boxes with AI suggestions</button>' : ''}</div>
    <p class="note">AI suggestions are only added to empty boxes, and they are worth a glance before Bella sees them.</p>`;
}

// ---------- story ideas (the shelf) ----------
// Built-in ideas first; when few unused ones are left the AI writes a fresh batch. Used ideas move to "Already told".
const SHELF_SIZE = 6;
const allIdeas = () => STORY_TYPES.map((t, i) => Object.assign({ id: 'b' + i }, t)).concat(S.ideas || []);
const isUsed = t => !!(S.used && S.used[t.id]);
function markUsed(t) { if (!t || !t.id) return; S.used = S.used || {}; S.used[t.id] = Date.now(); save(); if (allIdeas().filter(x => !isUsed(x)).length < SHELF_SIZE + 3) makeIdeas(); } // a replacement is written in the background as soon as one is used
let makingIdeas = false;
async function makeIdeas() {
  if (makingIdeas || !aiKey()) return false;
  makingIdeas = true;
  try {
    const have = allIdeas().map(t => t.title).join('; ');
    const sys = 'You suggest story ideas for a nine-year-old girl in England who writes stories with her friends. She loves the Sleepovers books by Jacqueline Wilson, detective and investigation stories, and science and engineering builds. Reply with JSON only: {"ideas": [{"title": "two to four words", "blurb": "under eight words", "idea": "one or two sentences describing the story idea"}]}. Give exactly six ideas, different from each other and from the ones already used. Modern, sensible English family life, British English. Real children with real problems and humour; fantasy is welcome. Nothing frightening or unkind. Never include food, eating, meals or drinks. Do not feature a dad or father. ' + (familyRules() ? 'Family rules: ' + familyRules() : '');
    const headers = { 'Authorization': 'Bearer ' + aiKey(), 'Content-Type': 'application/json' };
    if (/openrouter\.ai/.test(aiBase())) headers['X-Title'] = 'BellaSpeller';
    const r = await fetch(aiBase() + '/chat/completions', { method: 'POST', headers, body: JSON.stringify({ model: S.orModel || DEFAULT_MODEL, max_tokens: 2000, messages: [{ role: 'system', content: sys }, { role: 'user', content: 'Ideas already on the shelf, so do not repeat them: ' + have }] }) });
    if (!r.ok) return false;
    const j = await r.json(), c = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    const t = typeof c === 'string' ? c : Array.isArray(c) ? c.map(x => x.text || '').join('') : '';
    const o = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
    const known = new Set(allIdeas().map(x => x.title.toLowerCase()));
    const fresh = (o.ideas || []).filter(x => x && typeof x.title === 'string' && typeof x.blurb === 'string' && typeof x.idea === 'string' && x.title.length <= 40 && x.blurb.length <= 70 && !known.has(x.title.toLowerCase()) && ![x.title, x.blurb, x.idea].some(z => [...z.matchAll(US)].length)).slice(0, 6);
    if (!fresh.length) return false;
    S.ideas = (S.ideas || []).concat(fresh.map((x, i) => ({ id: 'g' + Date.now() + i, title: x.title, blurb: x.blurb, icon: ['star', 'search', 'flag', 'moon', 'heart', 'gift'][i % 6], idea: x.idea })));
    save(); return true;
  } catch (e) { return false; } finally { makingIdeas = false; }
}
const WHERE = ['A sleepover', 'At school', 'On holiday', 'At a party', 'In the park', 'At home'];
const WRONG = ['A secret gets out', 'Something goes missing', 'Two friends argue', 'Someone gets left out', 'A big mistake', 'A silly misunderstanding'];
const ENDS = ['Friends again', 'A funny disaster', 'A big surprise', 'Everyone learns something'];
const SCREEN_PROMPTS = ['Choose a story, or write your own.', 'Who is in your story?', 'Tell me your story idea.', 'Writing your story.'];
const PRAISE = ['Brilliant!', 'Well done!', 'Spot on!', 'You got it!', 'Fantastic!', 'Super spelling!'];
const FIX_TAIL = ' Have a good look. Then try once more.';
const FIX_A = 'So close. The yellow letters were hiding.', FIX_B = 'So close. Here is how it looks.';
const RED_WHY = 'This is a tricky word. It has no rule. You just have to remember it.';
const cardSpeech = (word, sentence) => (sentence ? sentence + ' ... ' + word + '. Say it out loud.' : word + '. Say it out loud.');
const CLUB_MSG = 'These are the friends in your story. Tap a name to change it.';
const COMMON = [...PRAISE, ...SCREEN_PROMPTS, 'Well done. You got there!', FIX_A + FIX_TAIL, FIX_B + FIX_TAIL, CLUB_MSG];
const effVp = () => (S.vp === undefined ? 'ms-emily' : S.vp); // Emily unless a grown-up chose otherwise
const preset = () => PRESETS.find(p => p.id === effVp());
const ttsOn = () => !!(S.orKey && preset());
const idb = new Promise(res => {
  try { const r = indexedDB.open('bellaspeller-voice', 1); r.onupgradeneeded = () => r.result.createObjectStore('clips'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch (e) { res(null); }
});
async function idbGet(k) { const db = await idb; if (!db) return null; return new Promise(res => { try { const q = db.transaction('clips').objectStore('clips').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); } catch (e) { res(null); } }); }
async function idbPut(k, v) { const db = await idb; if (!db) return; return new Promise(res => { try { const tx = db.transaction('clips', 'readwrite'); tx.objectStore('clips').put(v, k); tx.oncomplete = () => res(); tx.onerror = () => res(); } catch (e) { res(); } }); }
// ---------- handwriting test: pen input, read by an AI vision model or the device's own recognizer ----------
const HW_MODELS = ['anthropic/claude-haiku-5.5', 'google/gemini-2.5-flash-lite', 'openai/gpt-5-nano', 'qwen/qwen3.5-flash-02-23', 'google/gemma-4-26b-a4b-it'];
const hwResults = [];
function wireHandwriting() {
  const ls = $('#lsay'); if (ls) ls.onchange = () => { S.letterSay = ls.value === 'names' ? 'names' : 'phonics'; save(); };
  const wrap = $('#hwWrap'); if (!wrap) return;
  const he = $('#hwEngine'); if (he) { he.value = S.hwEngine || 'auto'; he.onchange = () => { S.hwEngine = he.value === 'vision' ? 'vision' : he.value; save(); }; }
  const det = $('#hwDetect');
  if ('createHandwritingRecognizer' in navigator) {
    det.textContent = 'This browser offers the built-in handwriting recognizer.';
    try { if (navigator.queryHandwritingRecognizerSupport) navigator.queryHandwritingRecognizerSupport({ languages: ['en'] }).then(r => { det.textContent += ' English support: ' + (r && r.languages ? 'yes' : 'no') + '.'; }, () => { }); } catch (e) { }
  } else det.textContent = 'This browser does not offer the built-in handwriting recognizer, so use the AI vision modes here.';
  const nat = $('#hwNative');
  if (nat) nat.oninput = () => { const want = $('#hwWord').value.trim().toLowerCase(), got = nat.value.trim().toLowerCase(); $('#hwOut').textContent = 'The keyboard gave: "' + got + '"' + (want ? (got === want ? ' (matches)' : ' (you wrote "' + want + '")') : ''); };
  const guide = $('#hwGuide'), ink = $('#hwInk'), W = Math.min(wrap.clientWidth || 700, 900), H = 220;
  [guide, ink].forEach(c => { c.width = W; c.height = H; c.style.width = W + 'px'; c.style.height = H + 'px'; });
  wrap.style.height = H + 'px'; wrap.style.width = W + 'px';
  const gx = guide.getContext('2d'), ix = ink.getContext('2d');
  let strokes = [], cur = null, penSeen = 0;
  const boxesN = () => Math.max(2, Math.min(14, ($('#hwWord').value.trim().length) || 6));
  const drawGuide = () => {
    gx.clearRect(0, 0, W, H); gx.fillStyle = '#fff'; gx.fillRect(0, 0, W, H);
    gx.strokeStyle = '#c9c3e6'; gx.lineWidth = 2;
    if ($('#hwMode').value === 'boxes') { const n = boxesN(), bw = W / n; for (let i = 0; i < n; i++) { gx.strokeRect(i * bw + 4, 12, bw - 8, H - 24); } }
    else { gx.beginPath(); gx.moveTo(10, H * 0.7); gx.lineTo(W - 10, H * 0.7); gx.stroke(); }
  };
  const clear = () => { ix.clearRect(0, 0, W, H); strokes = []; cur = null; };
  drawGuide();
  $('#hwMode').onchange = () => { drawGuide(); clear(); };
  $('#hwWord').oninput = () => { if ($('#hwMode').value === 'boxes') { drawGuide(); clear(); } };
  const pos = e => { const r = ink.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
  ink.style.touchAction = 'none';
  ink.onpointerdown = e => {
    if (e.pointerType === 'pen') penSeen = Date.now();
    else if (e.pointerType === 'touch' && Date.now() - penSeen < 4000) return; // a palm resting while the pen is in use
    if (e.pointerType === 'touch' && (cur || e.width > 45 || e.height > 45)) return; // for a plain stylus or a finger: ignore a second contact, and any big contact, which is a palm
    try { ink.setPointerCapture(e.pointerId); } catch (x) { }
    const [x, y] = pos(e); cur = { id: e.pointerId, pts: [{ x, y, t: Date.now() }] }; strokes.push(cur);
    ix.fillStyle = '#111'; ix.beginPath(); ix.arc(x, y, 2.5, 0, 7); ix.fill();
  };
  ink.onpointermove = e => {
    if (!cur || e.pointerId !== cur.id) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    (evs.length ? evs : [e]).forEach(ev => {
      const [x, y] = pos(ev), p = cur.pts[cur.pts.length - 1], pr = ev.pressure || 0.5;
      ix.strokeStyle = '#111'; ix.lineCap = 'round'; ix.lineWidth = 3 + pr * 4; ix.beginPath(); ix.moveTo(p.x, p.y); ix.lineTo(x, y); ix.stroke();
      cur.pts.push({ x, y, t: Date.now() });
    });
  };
  ink.onpointerup = ink.onpointercancel = () => { cur = null; };
  ink.oncontextmenu = e => e.preventDefault();
  $('#hwClear').onclick = () => { clear(); $('#hwOut').textContent = ''; };
  // a white picture of the ink, optionally just one part of it
  const snap = (sx, sy, sw, sh, outW) => {
    const c = document.createElement('canvas'), k = outW / sw; c.width = outW; c.height = Math.max(8, Math.round(sh * k));
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(ink, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  };
  const inkBounds = () => { const d = ix.getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = 0, y1 = 0; for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (d[(y * W + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return x1 > x0 ? [Math.max(0, x0 - 24), Math.max(0, y0 - 24), Math.min(W, x1 + 24), Math.min(H, y1 + 24)] : null; };
  const ask = async (model, content) => {
    const key = S.orKey || aiKey(); if (!key) throw new Error('No OpenRouter key saved.');
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'X-Title': 'BellaSpeller' }, body: JSON.stringify({ model, max_tokens: 300, temperature: 0, messages: [{ role: 'user', content }] }) });
    const txt = await r.text(); if (!r.ok) throw new Error(r.status + ' ' + txt.slice(0, 160));
    const j = JSON.parse(txt), c = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    const t = typeof c === 'string' ? c : Array.isArray(c) ? c.map(x => x.text || '').join('') : '';
    const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a < 0 || b <= a) throw new Error('The reply was not usable: ' + t.slice(0, 120));
    return JSON.parse(t.slice(a, b + 1));
  };
  $('#hwRead').onclick = async () => {
    const out = $('#hwOut'), mode = $('#hwMode').value, model = $('#hwModel').value, want = $('#hwWord').value.trim().toLowerCase();
    if (!strokes.length) { out.textContent = 'Write something first.'; return; }
    out.textContent = 'Reading...'; const t0 = Date.now(); let read = '', note = '';
    try {
      if (mode === 'builtin') {
        if (!('createHandwritingRecognizer' in navigator)) throw new Error('This device\'s browser has no built-in handwriting recognizer.');
        const rec = await navigator.createHandwritingRecognizer({ languages: ['en'] }), d = rec.startDrawing({ recognitionType: 'text', inputType: 'stylus' });
        strokes.forEach(s0 => { const st = new HandwritingStroke(); const t00 = s0.pts[0].t; s0.pts.forEach(p => st.addPoint({ x: p.x, y: p.y, t: p.t - t00 })); d.addStroke(st); });
        const pr = await d.getPrediction(); rec.finish();
        read = pr && pr[0] ? pr[0].text.toLowerCase().replace(/\s+/g, '') : ''; note = 'other guesses: ' + (pr || []).slice(1, 4).map(p => p.text).join(', ');
      } else if (mode === 'word') {
        const bb = inkBounds(); const [x0, y0, x1, y1] = bb || [0, 0, W, H];
        const img = snap(x0, y0, x1 - x0, y1 - y0, Math.min(700, Math.max(240, x1 - x0)));
        const o = await ask(model, [{ type: 'text', text: 'This image shows a word handwritten by a child. Transcribe exactly the letters that are written, in order, including any spelling mistakes. Do not correct the spelling and do not complete the word. If a letter is unclear, give your best single guess for that letter. Reply with JSON only: {"letters": ["x", "y"]}' }, { type: 'image_url', image_url: { url: img } }]);
        read = (o.letters || []).join('').toLowerCase();
      } else {
        const n = boxesN(), bw = W / n, content = [{ type: 'text', text: 'Each of the ' + n + ' images below is one box holding at most one handwritten letter, written by a child. Identify the letter in each box on its own. The boxes are not a word, so do not use context or spelling to decide. Use "" for an empty box. Reply with JSON only: {"letters": [one entry per box, in order]}' }];
        for (let i = 0; i < n; i++) { content.push({ type: 'text', text: 'Box ' + (i + 1) + ':' }); content.push({ type: 'image_url', image_url: { url: snap(i * bw, 0, bw, H, 160) } }); }
        const o = await ask(model, content);
        read = (o.letters || []).map(x => String(x || '').toLowerCase().slice(0, 1)).join('');
      }
    } catch (e) { out.textContent = 'Problem: ' + e.message; return; }
    const secs = ((Date.now() - t0) / 1000).toFixed(1), same = want && read === want;
    const diff = want ? [...Array(Math.max(want.length, read.length))].map((_, i) => (want[i] || '') === (read[i] || '') ? '' : (i + 1)).filter(Boolean) : [];
    out.textContent = 'It read: "' + read + '"' + (want ? (same ? ' (matches)' : ' (you wrote "' + want + '"; differs at letter ' + diff.join(', ') + ')') : '') + ' · ' + secs + ' s' + (note ? ' · ' + note : '');
    hwResults.push({ mode, model: mode === 'builtin' ? 'device' : model, wrote: want, read, match: !!same, secs });
    $('#hwLog').innerHTML = '<table><tr><th>Mode</th><th>Model</th><th>Wrote</th><th>Read</th><th>Match</th><th>Seconds</th></tr>' + hwResults.map(r => `<tr><td>${esc(r.mode)}</td><td>${esc(r.model)}</td><td>${esc(r.wrote)}</td><td>${esc(r.read)}</td><td>${r.match ? 'yes' : 'NO'}</td><td>${r.secs}</td></tr>`).join('') + '</table>';
  };
  $('#hwCopy').onclick = async () => { const txt = hwResults.map(r => [r.mode, r.model, r.wrote, r.read, r.match ? 'match' : 'DIFFERENT', r.secs + 's'].join(' | ')).join('\n'); try { await navigator.clipboard.writeText(txt); $('#hwOut').textContent = 'Copied. Paste it to me.'; } catch (e) { $('#hwOut').textContent = txt || 'No results yet.'; } };
}
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
// Something to look at while she waits: a dancing row of stars and a silly line that changes every few seconds.
const WAIT_LINES = ['A dragon is knitting a very, very long scarf...', 'The penguins have lost their wellies AGAIN!', 'Quick! Somebody tell the moon to stop giggling!', 'A hedgehog has stolen all the full stops. Chasing it now...', 'The octopus is putting on eight socks...', 'Teaching a goat to read the word "goat"...', 'The clouds are having a very serious meeting...', 'A wizard sneezed and all the adjectives fell out!', 'Waking up the sleepy sloth who types the plot...', 'A llama is sitting on the spare commas. Please move, llama!', 'Counting backwards from a million... lost count. Starting again!', 'Tickling the story until it gives in...', 'A squirrel in a tiny hard hat is building chapter one...', 'Sharpening 400 pencils. They keep running away!', 'Asking the moon for ideas. The moon says "OOOOH!"', 'Teaching a dragon to say please...', 'A flamingo is thinking very hard on one leg...', 'Borrowing a rainbow. Promise to give it back!', 'The characters are arguing about who gets the torch...', 'Shaking the story tree to see what falls out...', 'A tiny robot is typing with enormous gloves...', 'Reminding the owl that it is NOT a clock...', 'Polishing the stars. They are very ticklish!', 'The yeti has found the comfy chair. Nobody can move him...', 'Untangling a unicorn from the tinsel...'];
const WAIT_PARADE = ['\u{1F409}', '\u{1F984}', '\u{1F419}', '\u{1F989}', '\u{1F427}', '\u{1F680}', '\u{1F994}', '\u{1F438}', '\u{1F995}', '\u{1F9A9}'];
function waitBlock() {
  const pick = WAIT_PARADE.slice().sort(() => Math.random() - .5).slice(0, 5);
  return '<div class="parade" aria-hidden="true">' + pick.map((e, i) => `<span style="top:${(i % 3) * 22}px;animation-duration:${5 + i * 1.7}s;animation-delay:-${i * 1.9}s">${e}</span>`).join('') + '</div>'
    + '<div class="dance" aria-hidden="true"><span>&#9733;</span><span>&#9733;</span><span>&#9733;</span><span>&#9733;</span><span>&#9733;</span></div><p class="waitline" id="funline">' + esc(WAIT_LINES[Math.floor(Math.random() * WAIT_LINES.length)]) + '</p>';
}
function startWaitLines() {
  let k = Math.floor(Math.random() * WAIT_LINES.length);
  const iv = setInterval(() => {
    const el = document.getElementById('funline');
    if (!el) return clearInterval(iv); // she has moved on
    el.classList.add('fade');
    setTimeout(() => { k = (k + 1) % WAIT_LINES.length; el.textContent = WAIT_LINES[k]; el.classList.remove('fade'); }, 400);
  }, 4200);
}
// Makes sure the clips exist. Shows a short "getting ready" screen, which Bella can skip.
let prepShown = false, justWritten = false;
async function prep(texts, msg, ready) {
  if (!ttsOn()) return null;
  const need = [];
  for (const t of new Set(texts)) { if (t && sendable(t) && !(await getClipUrl(t))) need.push(t); }
  if (!need.length) return null;
  prepShown = true;
  let n = 0, skip = false, err = null;
  await new Promise(res => {
    if (ready) h(`<div class="screen cheer">${confettiHtml()}<div class="bigstar"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS.star}</svg></div><h1>${esc(msg)}</h1><p class="subtle" id="rdy">Just warming up my voice...</p><button id="go" class="btn big">Start now ${ico('next')}</button></div>`), fanfare();
    else h(`<div class="screen"><div class="spin"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS.star}</svg></div><h1>${esc(msg)}</h1><button id="go" class="btn small">Start now</button></div>`);
    on('#go', () => { skip = true; res(); });
    let i = 0;
    const worker = async () => {
      while (i < need.length && !skip && !err) {
        try { await fetchClip(need[i++]); } catch (e) { err = e; }
        n++;
      }
    };
    Promise.all([worker(), worker(), worker()]).then(() => { if (!ready || err || skip) return res(); const r = $('#rdy'); if (r) r.textContent = 'Everything is ready!'; const g = $('#go'); if (g) g.innerHTML = 'Start the story ' + ico('next'); }); // the ready screen waits for her tap
  });
  lastTtsErr = err ? err.message : '';
  return err;
}
let sayTimer = null, keepUtt = null, sayTok = 0, audioEl = null, ttsFails = 0, lastTtsErr = '';
const SAMPLE = 'Hello! Let us spell some words. Every one is a star.';
// Her own name is never sent to the voice service; those lines use the device voice.
const sendable = t => !(S.meIn && S.name && t.toLowerCase().includes(S.name.toLowerCase()));
function partTexts(beats, wk) {
  const o = [];
  if (wk) { if (wk.rule) o.push(wk.rule); o.push(RED_WHY); }
  beats.forEach(b => {
    if (b.n) o.push(fill(b.n));
    else if (b.p) o.push(fill(b.p));
    else if (b.c) { o.push(fill(b.c.q) + ' ' + b.c.o.map(x => fill(x.l)).join('. Or. ')); b.c.o.forEach(x => o.push(fill(x.n))); }
  });
  return o;
}
let speechUntil = 0; // physical-keyboard input is ignored while the app speaks and for a moment after (voice typing can hear it)
function stopAll() {
  speechUntil = Date.now() + 1500;
  clearTimeout(sayTimer);
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  if (audioEl) { audioEl.onended = audioEl.onerror = null; audioEl.pause(); audioEl = null; }
}
let wakeCtx = null, lastAudioEnd = 0, keepSrc = null;
// Speakers and Bluetooth often switch off in silence and swallow the start of the next sound. A constant signal far too quiet to hear (about one step above silence) keeps the output awake while the app is open with sound on.
function keepAwake(on) {
  try {
    if (!on) { if (keepSrc) { keepSrc.stop(); keepSrc = null; } return; }
    if (keepSrc) { if (wakeCtx && wakeCtx.state === 'suspended') wakeCtx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    wakeCtx = wakeCtx || new AC(); const c = wakeCtx; if (c.state === 'suspended') c.resume();
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.00004;
    keepSrc = c.createBufferSource(); keepSrc.buffer = buf; keepSrc.loop = true; keepSrc.connect(c.destination); keepSrc.start();
  } catch (e) { }
}
const clipBufs = new Map();
async function decodeClip(url) {
  if (clipBufs.has(url)) return clipBufs.get(url);
  const ab = await (await fetch(url)).arrayBuffer();
  const buf = await wakeCtx.decodeAudioData(ab);
  clipBufs.set(url, buf); return buf;
}
function say(t) {
  const tok = ++sayTok;
  stopAll();
  if (QUIET || (!soundOn() && !testMode)) { keepAwake(false); return; }
  if (ttsOn()) keepAwake(true);
  const warm = Date.now() - lastAudioEnd < 2500; // already talking a moment ago: no need to wake the speaker again
  speechUntil = Date.now() + 120000;
  if (!ttsOn()) return builtinSay(t);
  let began = false; // set once something is actually playing; if nothing starts, the device voice takes over
  const playTag = url => { // plain audio element (used if the audio channel is not running)
    audioEl = new Audio(url);
    audioEl.onended = () => { speechUntil = Date.now() + 2500; lastAudioEnd = Date.now(); };
    audioEl.onerror = () => { if (tok === sayTok) builtinSay(t); };
    const el = audioEl;
    el.preload = 'auto';
    setTimeout(() => { if (tok === sayTok && audioEl === el) el.play().then(() => { began = true; }, () => { if (tok === sayTok) builtinSay(t); }); }, warm ? 60 : 350);
  };
  // The recording is decoded and started on the audio channel that is already running, a fraction of a second ahead, so the first word is not lost.
  const play = url => {
    if (!wakeCtx || wakeCtx.state !== 'running') return playTag(url);
    const w = { ended: false, paused: false, onended: null, onerror: null, src: null, pause() { this.paused = true; try { this.src && this.src.stop(); } catch (e) { } } };
    audioEl = w;
    decodeClip(url).then(buf => {
      if (tok !== sayTok || w.paused) return;
      const src = wakeCtx.createBufferSource(); src.buffer = buf; src.connect(wakeCtx.destination); w.src = src;
      src.onended = () => { w.ended = true; if (!w.paused) { speechUntil = Date.now() + 2500; lastAudioEnd = Date.now(); } };
      src.start(wakeCtx.currentTime + (warm ? 0.1 : 0.3)); began = true;
    }).catch(() => { if (tok === sayTok) playTag(url); });
  };
  getClipUrl(t).then(async url => {
    if (tok !== sayTok) return;
    if (url) return play(url);
    // Not recorded yet: wait a moment for the proper voice rather than dropping straight to the device's own voice.
    if (ttsFails < 3 && sendable(t)) {
      const got = await Promise.race([fetchClip(t).then(u => { ttsFails = 0; return u; }, e => { ttsFails++; lastTtsErr = e.message; return null; }), new Promise(r => setTimeout(() => r(null), 4000))]);
      if (tok !== sayTok) return;
      if (got) return play(got);
    }
    began = true; builtinSay(t);
  }).catch(() => { if (tok === sayTok) { began = true; builtinSay(t); } });
  // If nothing has started after a few seconds (a stuck download, a sleeping speaker), the device's own voice says it instead.
  setTimeout(() => { if (tok === sayTok && !began) { began = true; builtinSay(t); } }, 7000);
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
    u.onend = u.onerror = () => { speechUntil = Date.now() + 2500; };
    keepUtt = u; // stops the browser discarding it before it has finished
    speechSynthesis.speak(u);
  }, 350);
}
const hush = () => { sayTok++; stopAll(); };
// Speak, and resolve true when the speech has ended (or, with sound off, after a reading pause); false if something else spoke or hush() was called.
function sayDone(t) {
  return new Promise(resolve => {
    say(t);
    const tok = sayTok, t0 = Date.now(), n = String(t).split(/\s+/).length, quiet = !soundOn();
    const cap = quiet ? n * 300 + 2200 : n * 450 + 3500;
    let started = false;
    const iv = setInterval(() => {
      if (tok !== sayTok) { clearInterval(iv); return resolve(false); }
      const playing = (audioEl && !audioEl.ended && !audioEl.paused) || ('speechSynthesis' in window && speechSynthesis.speaking);
      if (playing) started = true;
      const el = Date.now() - t0;
      if (quiet ? el > cap : ((started && !playing && el > 800) || el > cap)) { clearInterval(iv); resolve(true); }
    }, 200);
  });
}

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
const sndBtn = '<button id="topSnd" class="iconbtn sndtop" aria-label="Voice"></button>';
function paintSound() {
  const on = soundOn(), lab = on ? 'Voice on' : 'Voice off';
  const t = $('#topSnd'); if (t) { t.innerHTML = ico(on ? 'speaker' : 'muted') + '<span>' + lab + '</span>'; t.classList.toggle('off', !on); t.setAttribute('aria-label', lab); }
  const b = $('#snd'); if (b) { b.innerHTML = ico(on ? 'speaker' : 'muted'); b.classList.toggle('off', !on); b.title = lab; }
}
function toggleSound() { S.sound = !soundOn(); save(); if (!soundOn()) { hush(); keepAwake(false); } paintSound(); }
function h(html, opts) {
  keyHandler = null;
  const top = opts && opts.noTop ? '' : `<div class="top"><div class="lhs"><button id="goHome" class="iconbtn" aria-label="Home">${ico('home')}<span>Home</span></button></div>${testMode ? '' : sndBtn}<span class="prog">${esc(prog)}</span></div>`;
  $('#app').innerHTML = top + html;
  { const cl = document.body.classList; cl.toggle('onshelf', html.includes('shelfscreen')); cl.toggle('onwrite', html.includes('writescreen')); cl.toggle('onmn', html.includes('mnscreen')); cl.toggle('onstory', html.includes('storyscreen')); cl.remove('inkmode'); }
  const g = $('#goHome'); if (g) g.onclick = () => { hush(); home(); };
  const ts = $('#topSnd'); if (ts) { ts.onclick = toggleSound; paintSound(); }
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
const storyWordCount = ep => [].concat(...ep.parts).reduce((n, b) => n + (b.n ? b.n : b.p ? b.p : b.c ? [b.c.q].concat(b.c.o.map(o => o.l + ' ' + o.n)).join(' ') : '').split(/\s+/).filter(Boolean).length, 0);
function hlHtml(text, word) {
  const ls = lastSentence(text), cut = text.lastIndexOf(ls), sp = sentenceParts(ls, word);
  if (!sp) return esc(text);
  return esc(text.slice(0, cut)) + esc(sp.pre) + `<span class="pw hl">${esc(word)}</span>` + esc(sp.post);
}
function narrate(text, label, hl) {
  return new Promise(res => {
    h(`<div class="screen"><div class="page"><p class="story">${hl ? hlHtml(text, hl) : esc(text)}</p></div>
      <div class="row"><button id="hear" class="iconbtn big" aria-label="Hear it again">${ico('speaker')}</button><button id="next" class="btn big">${esc(label || 'Next')} ${ico('next')}</button></div></div>`);
    on('#hear', () => say(text));
    on('#next', () => { hush(); res(); });
    keyHandler = e => { if (e.key === 'Enter') { hush(); res(); } };
    backBtn(res);
    if (S.readAloud) say(text);
  });
}
// The story is a run of short sentences. A page is as many sentences as fit, broken at a sentence end. Each test word is highlighted in its own sentence.
function splitSentences(t) {
  t = String(t).trim(); const out = []; let start = 0;
  for (const m of t.matchAll(/[.!?]+["”’')]*\s+(?=["“‘'A-Z])/g)) { out.push(t.slice(start, m.index + m[0].length).trim()); start = m.index + m[0].length; }
  out.push(t.slice(start).trim());
  return out.filter(Boolean);
}
// The whole story in one scrolling window: all she has to do is read. With sound on it is read aloud and the window follows the voice.
function chunkItems(items) { // groups of sentences of about 40 words, for the voice
  const out = []; let cur = [], n = 0;
  items.forEach(q => { const w = q.t.split(/\s+/).length; if (cur.length && n + w > 18) { out.push(cur); cur = []; n = 0; } cur.push(q); n += w; });
  if (cur.length) out.push(cur);
  return out;
}
const chunkText = c => c.map(q => q.t).join(' ');

function storyScroll(items) {
  const chunks = chunkItems(items);
  return new Promise(res => {
    h(`<div class="screen storyscreen"><div class="scrollwrap"><div class="scrollpage" id="sp">${chunks.map((c, i) => `<span class="chunk" data-i="${i}"${c.find(q => q.w) ? ' data-pw="' + esc(c.find(q => q.w).w) + '"' : ''}>${c.map(q => (q.w ? hlHtml(q.t, q.w) : esc(q.t)) + (q.pic ? `<span class="scene" aria-hidden="true">${q.pic}</span>` : '')).join(' ')}</span> `).join('')}</div><div class="sidecol"><button id="sup" class="scrollbtn" aria-label="Scroll up">${ico('next')}</button><div class="sidemid"><button id="readtoggle" class="chip small${S.readAloud ? ' on' : ''}">${ico('speaker')} Read it to me</button><span class="subtle storycap">The yellow words are this week's words.</span></div><button id="sdown" class="scrollbtn" aria-label="Scroll down">${ico('next')}</button><button id="next" class="btn big">I've read it ${ico('next')}</button></div></div></div>`);
    // The window is always a whole number of lines tall, and it only ever rests on a whole line, so a word is never cut in half.
    const lineH = () => { const sp = $('#sp'); return sp ? (parseFloat(getComputedStyle(sp).lineHeight) || 40) : 40; };
    let winH = 0;
    const maxScroll = () => { const sp = $('#sp'); return sp ? Math.max(0, sp.scrollHeight - winH) : 0; };
    const snap = t => { const lh = lineH(); return Math.min(maxScroll(), Math.max(0, Math.round(t / lh) * lh)); };
    // The window takes all the height there is on this screen, as a whole number of lines. The text is padded to a whole number of lines too,
    // so the last line can always be scrolled fully into view.
    const fitLines = () => {
      const sp = $('#sp'); if (!sp) return;
      const cs = getComputedStyle(sp), b = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth), lh = lineH();
      const row = $('#next') && $('#next').parentElement, app = $('#app');
      const reserve = (app ? parseFloat(getComputedStyle(app).paddingBottom) || 0 : 0) + 10;
      const n = Math.max(3, Math.floor((innerHeight - sp.getBoundingClientRect().top - reserve - b) / lh));
      winH = n * lh; sp.style.height = (winH + b) + 'px';
      sp.style.paddingBottom = '0px'; const ch = sp.scrollHeight; sp.style.paddingBottom = (Math.ceil(ch / lh - 0.001) * lh - ch) + 'px';
      sp.scrollTop = snap(sp.scrollTop);
    };
    const onResize = () => { if (!$('#sp')) return removeEventListener('resize', onResize); fitLines(); };
    addEventListener('resize', onResize); fitLines(); setTimeout(fitLines, 300); if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitLines);
    let snapT = 0;
    $('#sp').addEventListener('scroll', () => { clearTimeout(snapT); snapT = setTimeout(() => { const sp = $('#sp'); if (!sp) return; const t = snap(sp.scrollTop); if (Math.abs(sp.scrollTop - t) > 1) sp.scrollTo({ top: t, behavior: 'smooth' }); }, 160); });
    const lines = () => Math.max(1, Math.round(winH / lineH()));
    let run = 0;
    // The voice reads a short piece at a time. The window only moves when the piece being read is not fully in view,
    // and then it moves so that piece is at the top, so what is being said is always on screen.
    const follow = el => {
      const sp = $('#sp'); if (!sp || !el) return;
      const r = el.getClientRects(), sr = sp.getBoundingClientRect(), bt = parseFloat(getComputedStyle(sp).borderTopWidth);
      if (!r.length) return;
      const rt = r[0].top - sr.top - bt + sp.scrollTop, rb = r[r.length - 1].bottom - sr.top - bt + sp.scrollTop;
      if (rt < sp.scrollTop - 1 || rb > sp.scrollTop + winH + 1) sp.scrollTo({ top: snap(Math.floor((rt + 2) / lineH()) * lineH()), behavior: 'smooth' });
    };
    const play = async () => {
      const my = ++run; hush();
      if (!soundOn() || !S.readAloud) return;
      for (let i = 0; i < chunks.length; i++) {
        if (my !== run) return;
        const el = document.querySelector(`.chunk[data-i="${i}"]`);
        document.querySelectorAll('.chunk.now').forEach(x => x.classList.remove('now'));
        if (el) { el.classList.add('now'); follow(el); }
        const ok = await sayDone(chunkText(chunks[i]));
        if (!ok || my !== run) return;
        await new Promise(r => setTimeout(r, 350)); // a breath between pieces
        if (my !== run) return;
      }
    };
    on('#sup', () => { const sp = $('#sp'); if (sp) sp.scrollTo({ top: snap(sp.scrollTop - Math.max(1, lines() - 1) * lineH()), behavior: 'smooth' }); });
    on('#sdown', () => { const sp = $('#sp'); if (sp) sp.scrollTo({ top: snap(sp.scrollTop + Math.max(1, lines() - 1) * lineH()), behavior: 'smooth' }); });
    on('#readtoggle', () => {
      S.readAloud = !S.readAloud; if (S.readAloud && !soundOn()) S.sound = true; save(); paintSound();
      $('#readtoggle').classList.toggle('on', !!S.readAloud);
      if (S.readAloud) { chunks.forEach(c => { const t = chunkText(c); getClipUrl(t).then(u => { if (!u && ttsOn() && sendable(t)) fetchClip(t).catch(() => { }); }); }); const sp = $('#sp'); if (sp) sp.scrollTo({ top: 0 }); play(); }
      else { run++; hush(); document.querySelectorAll('.chunk.now').forEach(x => x.classList.remove('now')); }
    });
    on('#next', () => { run++; hush(); res(); });
    keyHandler = e => { if (e.key === 'Enter') { run++; hush(); res(); } };
    backBtn(r => { run++; res(r); });
    play();
  });
}
const STORY_INTRO = 'Some of the words in this story are highlighted in yellow. They are this week\'s words. We will have a little go at them afterwards.';
function storySegments(beats) { // the story as sentences; only a choice breaks it into more than one window
  const steps = []; let cur = [];
  const flush = () => { if (cur.length) { steps.push({ seg: cur }); cur = []; } };
  beats.forEach(b => {
    if (b.n || b.p) { const sents = splitSentences(fill(b.n || b.p)); sents.forEach((t, k) => cur.push({ t, w: b.p && k === sents.length - 1 ? b.word : null })); }
    else if (b.c) { flush(); steps.push({ choice: b.c }); }
  });
  flush();
  return steps;
}
function choose(q, opts) {
  return new Promise(res => {
    h(`<div class="screen"><div class="page"><p class="story">${esc(q)}</p></div><div class="msg">Tap what happens next</div>
      <div class="choices">${opts.map((o, i) => `<button class="choice" id="o${i}">${esc(o)}</button>`).join('')}</div>
      <button id="hear" class="iconbtn big" aria-label="Hear it again">${ico('speaker')}</button></div>`);
    on('#hear', () => say(q + ' ' + opts.join('. Or. ')));
    opts.forEach((o, i) => on('#o' + i, () => { hush(); res(i); }));
    backBtn(res);
    if (S.readAloud) say(q + ' ' + opts.join('. Or. '));
  });
}
function learnCard(week, wobj) {
  return new Promise(res => {
    const why = wobj.red ? RED_WHY : (week.rule || '');
    const word = `<span class="grow" id="gw">${toolOn('hard') && wobj.hard ? hardHtml(wobj) : esc(wobj.w)}</span>`;
    const body = `<p class="story solo">${word}</p>`;
    const tags = wobj.red ? `<span class="tag red">Tricky word</span>` : '';
    h(`<div class="screen cardscreen"><div class="page">${body}</div>${tags ? `<div class="row">${tags}</div>` : ''}${toolsPanel()}
      <div class="row"><button id="hear" class="iconbtn big" aria-label="Hear it">${ico('speaker')}</button>${why ? `<button id="why" class="btn small">${ico('bulb')}<span>Why?</span></button>` : ''}<button id="next" class="btn big">I've said it ${ico('check')}</button></div>
      <div id="whybox" style="width:100%"></div></div>`);
    // The word starts small, in line with the sentence, then grows and changes colour as it is spoken.
    let tm = null;
    const grow = () => {
      clearTimeout(tm);
      const g = $('#gw'); if (g) g.classList.remove('big');
      tm = setTimeout(() => { const g2 = $('#gw'); if (g2) g2.classList.add('big'); }, 1900);
    };
    wireTools(wobj, 'look', () => { const g = $('#gw'); if (g) g.innerHTML = toolOn('hard') && wobj.hard ? hardHtml(wobj) : esc(wobj.w); });
    const spoken = cardSpeech(wobj.w, '');
    on('#hear', () => { grow(); say(spoken); });
    on('#why', () => { $('#whybox').innerHTML = `<div class="page small"><p class="story">${esc(why)}</p></div>`; say(why); });
    on('#next', () => { clearTimeout(tm); hush(); res(); });
    backBtn(res);
    grow(); say(spoken);
  });
}

// ---------- keyboard and writing ----------
const KB = ['qwertyuiop', 'asdfghjkl', "zxcvbnm'-"];
const kbHtml = () => `<div class="kb">${KB.map((r, i) => `<div>${[...r].map(c => `<button class="key" data-k="${esc(c)}">${esc(c)}</button>`).join('')}${i === 2 ? `<button class="key wide" data-k="del" aria-label="Delete">${ico('del')}</button><button class="key wide ok" data-k="ok" aria-label="Done">${ico('check')}</button>` : ''}</div>`).join('')}</div>`;

// Turns what she wrote with the pen into letters. Which reader is used is a setting on the grown-ups page: AI vision, the device's own recognizer, or automatic.
// The AI is told not to correct spelling, because the mistakes are what we are looking for.
async function readHandwriting(strokes, ink, W, H) {
  const engine = S.hwEngine || 'auto', key = S.orKey || aiKey();
  const clean = t => String(t || '').toLowerCase().replace(/[^a-z'-]/g, '');
  const useBuiltin = engine === 'builtin' || (engine === 'auto' && !key);
  if (useBuiltin) {
    if (!('createHandwritingRecognizer' in navigator)) throw new Error('This device has no handwriting recognizer. Use the keyboard, or ask a grown-up to add the AI key.');
    const rec = await navigator.createHandwritingRecognizer({ languages: ['en'] }), d = rec.startDrawing({ recognitionType: 'text', inputType: 'stylus' });
    strokes.forEach(s0 => { const st = new HandwritingStroke(); const t0 = s0.pts[0].t; s0.pts.forEach(p => st.addPoint({ x: p.x, y: p.y, t: p.t - t0 })); d.addStroke(st); });
    const pr = await d.getPrediction(); rec.finish();
    return clean(pr && pr[0] && pr[0].text);
  }
  if (!key) throw new Error('This device does not have the AI key yet, so writing cannot be read. Use the keyboard.');
  // a white picture of just the ink
  const data = ink.getContext('2d').getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (data[(y * W + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 <= x0) return '';
  x0 = Math.max(0, x0 - 24); y0 = Math.max(0, y0 - 24); x1 = Math.min(W, x1 + 24); y1 = Math.min(H, y1 + 24);
  const outW = Math.min(420, Math.max(200, x1 - x0)), k = outW / (x1 - x0), c = document.createElement('canvas'); c.width = outW; c.height = Math.max(8, Math.round((y1 - y0) * k));
  const cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height); cx.drawImage(ink, x0, y0, x1 - x0, y1 - y0, 0, 0, c.width, c.height);
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'X-Title': 'BellaSpeller' }, body: JSON.stringify({ model: S.hwModel || 'anthropic/claude-haiku-5.5', max_tokens: 60, temperature: 0, messages: [{ role: 'user', content: [{ type: 'text', text: 'This image shows a word handwritten by a child. Transcribe exactly the letters that are written, in order, including any spelling mistakes. Do not correct the spelling and do not complete the word. If a letter is unclear, give your best single guess for that letter. Reply with JSON only: {"letters": ["x", "y"]}' }, { type: 'image_url', image_url: { url: c.toDataURL('image/png') } }] }] }) });
  if (!r.ok) throw aiFail(r.status);
  const j = await r.json(), t = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
  const txt = typeof t === 'string' ? t : Array.isArray(t) ? t.map(z => z.text || '').join('') : '', a = txt.indexOf('{'), b = txt.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('I could not read that. Please try again.');
  return clean((JSON.parse(txt.slice(a, b + 1)).letters || []).join(''));
}
function writeWord(word, noBack, remind, wobj, force, cue, help, ask, autoSure, note) {
  return new Promise(res => {
    let typed = '', hints = 0, done = false, reminded = false;
    const used = new Set();
    const sp = cue && sentenceParts(cue, word);
    const sayIt = () => say((help === 'family' || help === 'hint') && wobj ? helpContent(wobj, help).say : sp ? cueSpoken(cue, word) : word); // with a help showing, she hears the word and then the help, not the whole sentence again
    if (help) used.add(help);
    h(`<div class="screen writescreen">
      ${sp ? `<div class="page small gapcard"><p class="story">${esc(sp.pre)}<span class="gapw"></span>${esc(sp.post)}</p></div>` : `<div class="cue">${ico('speaker')}<span>${soundOn() ? 'Listen, then write the word' : 'Write the word'}</span></div>`}
      ${note ? `<p class="msg smallmsg">${esc(note)}</p>` : ''}<div id="helpbox" class="helpbox"></div>
      <div id="surebox" class="surebox"></div>
      <div id="remindbox" style="width:100%"></div>
      <div id="slots" class="slots"></div>
      <div class="row"><button id="hear" class="btn small" aria-label="Hear it again">${ico('speaker')}<span>Hear it again</span></button><button id="modesw" class="btn small"></button>${remind ? `<button id="remind" class="btn small">${ico('bulb')}<span>Remind me</span></button>` : ''}${ask && wobj && !help ? `<button id="helpfirst" class="btn small">${ico('bulb')}<span>Help me first</span></button>` : ''}<button id="hint" class="btn small" style="display:${help === 'nextletter' ? '' : 'none'}">${ico('bulb')}<span>Next letter</span></button></div>
      <div id="wpanel" class="wpanel" style="display:none"><div id="wread" class="wread"></div><div id="wwrap" class="wwrap"><canvas id="wguide"></canvas><canvas id="wink"></canvas></div>
        <div class="row"><button id="wclear" class="btn small">Clear</button><button id="wlines" class="btn small">Letter lines</button><button id="wdone" class="btn">Done ${ico('check')}</button></div></div>
      ${kbHtml()}</div>`);
    const draw = () => {
      $('#slots').innerHTML = typed ? [...typed].map(c => `<span class="slot">${esc(c)}</span>`).join('') : '<span class="slot empty">&nbsp;</span>';
      const okk = document.querySelector('.key[data-k="ok"]'); if (okk) okk.disabled = !typed;
      const sb = $('#surebox'); if (sb && sb.textContent && word.startsWith(typed)) sb.textContent = ''; // she has put it right herself
    };
    let sureShown = false, armed = false;
    setTimeout(() => { armed = true; }, 700); // taps from the screen before can land here; ignore input for the first moments
    // The word is finished as soon as it is spelled right; for anything else she taps the tick.
    const add = c => { if (!armed) return; if (typed.length < Math.min(24, word.length + 3)) { typed += c; draw(); if (wobj && (help === 'sure' || autoSure) && !sureShown && !word.startsWith(typed)) { sureShown = true; used.add('sure'); $('#surebox').textContent = SURE_MSG; say(SURE_MSG); } } }; // nothing is decided until she presses the finished key (extra letters such as wente for went are common)
    const del = () => { typed = typed.slice(0, -1); draw(); };
    const finish = () => {
      if (typed && !done && wobj && (help === 'sure' || autoSure) && typed !== word && !sureShown) { sureShown = true; used.add('sure'); $('#surebox').textContent = SURE_MSG; say(SURE_MSG); return; } // she can change it, or press the finished key again to keep it
      if (typed && !done) { done = true; hush(); const tl = [...used]; res({ typed, hints, reminded, tools: tl, aided: !!help || tl.some(id => REVEALS.includes(id)) }); } };
    const hint = () => {
      let i = 0;
      while (i < typed.length && i < word.length && typed[i] === word[i]) i++;
      if (i < word.length) { typed = word.slice(0, i + 1); hints++; used.add('nextletter'); draw(); }
    };
    document.querySelectorAll('.key').forEach(b => { b.onclick = () => { if (!armed) return; const k = b.dataset.k; k === 'del' ? del() : k === 'ok' ? finish() : add(k); }; });
    // Physical keyboard: each key waits a moment to see whether more follow right behind it. Dictation software types in a burst, and a burst is ignored.
    let pendingKey = null, burstUntil = 0;
    keyHandler = e => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || !armed) return;
      const now = Date.now(), k = e.key;
      if (!(k === 'Backspace' || k === 'Enter' || /^[a-zA-Z'-]$/.test(k))) return;
      e.preventDefault();
      if (now < burstUntil || now < speechUntil) return; // a burst just happened, or the app is speaking
      if (pendingKey) { clearTimeout(pendingKey); pendingKey = null; burstUntil = now + 500; return; }
      pendingKey = setTimeout(() => { pendingKey = null; if (k === 'Backspace') del(); else if (k === 'Enter') finish(); else add(k.toLowerCase()); }, 35);
    };
    on('#hear', sayIt); on('#hint', hint);
    on('#helpfirst', () => { if (done) return; done = true; hush(); res({ askHelp: true, typed: '', hints: 0, reminded: false, tools: [], aided: true }); });
    if (wobj && help) { const hc = helpContent(wobj, help); $('#helpbox').innerHTML = hc.html; const hs = $('#hearsay'); if (hs) hs.onclick = () => say(hc.say); }
    if (wobj && (force || help === 'choice')) {
      used.add('choice');
      const opts = shuffle([word].concat(misspellings(wobj, (curWeek().words || []).map(q => q.w))));
      const cueEl = document.querySelector('.cue span'); if (cueEl) cueEl.textContent = soundOn() ? 'Listen, then pick the right spelling' : 'Pick the right spelling';
      ['#slots', '.kb', '#done', '#hint'].forEach(q => { const e = document.querySelector(q); if (e) e.style.display = 'none'; });
      const box = document.createElement('div'); box.className = 'choices mcbox';
      box.innerHTML = opts.map(o => `<button class="choice" data-o="${esc(o)}">${esc(o)}</button>`).join('');
      const anchor = document.querySelector('.kb'); anchor.parentNode.insertBefore(box, anchor);
      keyHandler = null;
      box.querySelectorAll('.choice').forEach(b => { b.onclick = () => { if (done) return; done = true; hush(); const tl = [...used]; res({ typed: b.dataset.o, hints: 0, reminded, tools: tl, aided: true }); }; });
    }
    on('#remind', () => { reminded = true; $('#remindbox').innerHTML = `<div class="page small"><p class="story">${remind.html}</p></div>`; say(remind.spoken); });
    // ----- keyboard or writing: she (or a grown-up) chooses, and the choice is remembered -----
    const pre = { t: 0, n: 0, p: null }; let paintGuide = () => { };
    let mode = S.input === 'write' ? 'write' : 'keyboard', inkReady = false, strokes = [], cur = null, penSeen = 0, W = 0, H = 0, ix = null;
    const initInk = () => {
      if (inkReady) return; inkReady = true;
      const wrap = $('#wwrap'), guide = $('#wguide'), ink = $('#wink');
      W = Math.max(380, Math.min(Math.round((wrap.parentNode.clientWidth || 800) * 0.8), 1100)); H = Math.max(150, Math.min(300, Math.round(innerHeight * 0.27)));
      [guide, ink].forEach(c => { c.width = W; c.height = H; c.style.width = W + 'px'; c.style.height = H + 'px'; });
      wrap.style.width = W + 'px'; wrap.style.height = H + 'px';
      paintGuide = () => {
        const gx = guide.getContext('2d'); gx.fillStyle = '#fff'; gx.fillRect(0, 0, W, H); gx.lineWidth = 2;
        if (S.hwLines !== false) { gx.strokeStyle = '#ddd8f0'; gx.setLineDash([3, 9]); const n = Math.max(2, word.length), x0 = W * 0.15, wd = W * 0.7; for (let i = 0; i <= n; i++) { const x = x0 + wd * i / n; gx.beginPath(); gx.moveTo(x, 12); gx.lineTo(x, H - 12); gx.stroke(); } gx.setLineDash([]); }
      }; paintGuide();
      ix = ink.getContext('2d', { willReadFrequently: true }); ink.style.touchAction = 'none';
      const pos = e => { const r = ink.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
      ink.onpointerdown = e => {
        if (!armed) return;
        if (e.pointerType === 'pen') penSeen = Date.now(); else if (e.pointerType === 'touch' && (Date.now() - penSeen < 600 || (cur && Date.now() - cur.pts[cur.pts.length - 1].t < 400) || e.width > 60 || e.height > 60)) return; // a palm, or a second contact; a stroke left open by a lost pen-up never blocks for long
        try { ink.setPointerCapture(e.pointerId); } catch (x) { }
        const [x, y] = pos(e); cur = { id: e.pointerId, pts: [{ x, y, t: Date.now() }] }; strokes.push(cur);
        ix.fillStyle = '#111'; ix.beginPath(); ix.arc(x, y, 2.5, 0, 7); ix.fill();
      };
      ink.onpointermove = e => {
        if (!cur || e.pointerId !== cur.id) return;
        const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        ix.strokeStyle = '#111'; ix.lineCap = 'round'; ix.lineJoin = 'round'; ix.lineWidth = 4;
        (evs.length ? evs : [e]).forEach(ev => {
          const [x, y] = pos(ev), p = cur.pts[cur.pts.length - 1];
          if (Math.hypot(x - p.x, y - p.y) < 1.5) return; // ignore tiny jitter, which is what makes the line look shaky
          const m0 = cur.mid || { x: p.x, y: p.y }, m1 = { x: (p.x + x) / 2, y: (p.y + y) / 2 };
          ix.beginPath(); ix.moveTo(m0.x, m0.y); ix.quadraticCurveTo(p.x, p.y, m1.x, m1.y); ix.stroke();
          cur.mid = m1; cur.pts.push({ x, y, t: Date.now() });
        });
      };
      // start reading as soon as the pen pauses, so the answer is usually ready by the time she presses Done
      ink.onpointerup = ink.onpointercancel = () => {
        if (cur && cur.mid) { const l = cur.pts[cur.pts.length - 1]; ix.beginPath(); ix.moveTo(cur.mid.x, cur.mid.y); ix.lineTo(l.x, l.y); ix.stroke(); }
        cur = null; clearTimeout(pre.t);
        pre.t = setTimeout(() => { if (!strokes.length || done) return; const n = strokes.length; pre.n = n; pre.p = readHandwriting(strokes, ink, W, H); pre.p.catch(() => { }); }, 1500);
      };
      ink.oncontextmenu = e => e.preventDefault();
    };
    const wrow = () => document.querySelector('#wpanel > .row');
    const clearInk = () => { clearTimeout(pre.t); pre.n = 0; pre.p = null; if (ix) ix.clearRect(0, 0, W, H); strokes = []; cur = null; $('#wread').innerHTML = ''; const r = wrow(); if (r) r.style.display = ''; };
    const setMode = m => {
      mode = m; S.input = m; save(); document.body.classList.toggle('inkmode', m === 'write');
      const kb = document.querySelector('.kb'), wp = $('#wpanel'), sw = $('#modesw');
      if (kb) kb.style.display = m === 'write' ? 'none' : '';
      if (wp) wp.style.display = m === 'write' ? '' : 'none';
      if (sw) sw.innerHTML = m === 'write' ? 'Use the keyboard' : 'Write it by hand';
      if (m === 'write') initInk();
      typed = ''; draw(); clearInkIfReady();
    };
    const clearInkIfReady = () => { if (inkReady) clearInk(); };
    on('#modesw', () => { if (armed) setMode(mode === 'write' ? 'keyboard' : 'write'); });
    on('#wlines', () => { S.hwLines = S.hwLines === false; save(); paintGuide(); });
    on('#wclear', () => { clearInk(); typed = ''; draw(); });
    on('#wdone', async () => {
      if (!armed || done) return;
      if (!strokes.length) { $('#wread').textContent = 'Write the word first.'; return; }
      $('#wread').textContent = 'Reading...';
      let text = '';
      try { try { text = (pre.p && pre.n === strokes.length) ? await pre.p : await readHandwriting(strokes, $('#wink'), W, H); } catch (e0) { pre.p = null; text = await readHandwriting(strokes, $('#wink'), W, H); } }
      catch (e) { $('#wread').textContent = e.message || 'I could not read that.'; return; }
      if (!text) { $('#wread').textContent = 'I could not read that. Please write it again.'; return; }
      typed = text.slice(0, Math.min(24, word.length + 3)); draw();
      $('#wread').innerHTML = '<div class="readback"><span>I read:</span> <b class="readword">' + esc(typed) + '</b></div><div class="row"><button id="wyes" class="btn">Yes, that is what I wrote</button><button id="wagain" class="btn small">Write it again</button></div>';
      const r0 = wrow(); if (r0) r0.style.display = 'none'; // the read-back has its own buttons
      on('#wyes', () => finish()); on('#wagain', () => { clearInk(); typed = ''; draw(); });
    });
    if (!noBack) backBtn(res);
    draw(); sayIt();
    if (!(wobj && (force || help === 'choice')) && mode === 'write') setMode('write'); else { const sw = $('#modesw'); if (sw) sw.innerHTML = 'Write it by hand'; }
    if (wobj && (force || help === 'choice')) { const sw = $('#modesw'); if (sw) sw.style.display = 'none'; }
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
// ---- celebrating a word: a little trumpet, a spoken well done that counts the words, and confetti ----
const ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth'];
function celebrateText(n, N, clean) {
  if (n >= N && N > 1) return clean ? 'Brilliant, first time! That is the last one, and you have done all ' + N + ' words. Fantastic!' : 'Well done, you stuck with it! That is the last one, and you have done all ' + N + ' words. Fantastic!';
  const o = ORD[n - 1] || n + 'th';
  return clean ? 'Brilliant, first time! That is the ' + o + ' one done.' : 'Well done, you worked it out! That is the ' + o + ' one done.';
}
let fanCtx = null;
function fanfare() {
  if (QUIET || !soundOn()) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    fanCtx = fanCtx || new AC(); const c = fanCtx; if (c.state === 'suspended') c.resume();
    const t0 = c.currentTime + 0.03;
    [[523.25, 0], [659.25, 0.13], [783.99, 0.26], [1046.5, 0.39]].forEach(([f, dt], i) => {
      const o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter(), t = t0 + dt, d = i === 3 ? 0.55 : 0.13;
      o.type = 'sawtooth'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = 2200;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.025); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.06);
      o.connect(lp); lp.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + 0.1);
    });
  } catch (e) { }
}
function confettiHtml() {
  const cols = ['#ff6b9d', '#ffd54a', '#4dd4ac', '#6fb1ff', '#c58bff'];
  return '<div class="confetti" aria-hidden="true">' + Array.from({ length: 26 }, (_, i) => `<i style="left:${Math.round(Math.random() * 100)}%;background:${cols[i % cols.length]};animation-delay:${(Math.random() * 0.8).toFixed(2)}s;animation-duration:${(2 + Math.random() * 1.5).toFixed(2)}s"></i>`).join('') + '</div>';
}
const progressStars = (n, N) => '<div class="pstars" aria-label="' + n + ' of ' + N + ' done">' + Array.from({ length: N }, (_, i) => `<span class="${i < n ? 'on' : ''}">&#9733;</span>`).join('') + '</div>';
function praise(word, clean) {
  return new Promise(res => {
    const p = clean ? PRAISE[Math.floor(Math.random() * PRAISE.length)] : 'Well done. You got there!';
    h(`<div class="screen"><div class="bigstar"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS.star}</svg></div><h1>${esc(p)}</h1><div class="wordtile small">${esc(word)}</div>
      <button id="next" class="btn big">Next ${ico('next')}</button></div>`);
    on('#next', () => { hush(); res(); });
    keyHandler = e => { if (e.key === 'Enter') { hush(); res(); } };
    backBtn(res);
    fanfare(); setTimeout(() => { if ($('#next')) say(p); }, 800);
  });
}

// ---------- starting a story: shelf, cast, Bella's own idea ----------
function waiting(msg) {
  h(`<div class="screen"><div class="spin"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS.star}</svg></div><h1>${esc(msg)}</h1>${waitBlock()}</div>`);
  startWaitLines();
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
function shelf(ep, st) {
  return new Promise(res => {
    let hasStory, done;
    const card = (id, icon, title, blurb, cls) => `<button class="shelfcard ${cls || ''}" id="${id}"><span class="ticon">${ico(icon)}</span><div><b>${esc(title)}</b><small>${esc(blurb)}</small></div></button>`;
    let resetFlash = false;
    const render = () => {
      hasStory = ep && st; done = hasStory && st.part >= ep.parts.length;
      const all = allIdeas(), unused = all.filter(t => !isUsed(t)).slice(0, SHELF_SIZE);
      const told = all.filter(isUsed).sort((x, y) => S.used[y.id] - S.used[x.id]);
      h(`<div class="screen shelfscreen"><div class="shelfmain"><h1>Choose your story</h1>
      ${aiKey() ? '' : '<p class="subtle">Stories are written by AI. Add the AI key with the settings gear to use these.</p>'}
      ${hasStory ? `<div class="againrow">${card('again', 'book', (done ? 'Play again: ' : st.part > 0 ? 'Carry on: ' : 'Play: ') + ep.title, done ? 'Tell this story again' : st.part > 0 ? 'Not finished yet' : 'Not played yet', 'wide')}<button id="resetstory" class="optchip">Reset</button></div>` : ''}
      <div class="shelf">${unused.map(t => card('i' + all.indexOf(t), t.icon, t.title, t.blurb)).join('')}</div>
      ${card('own', 'pencil', 'Write my own story', 'Tell me your idea', 'wide own')}
      ${told.length ? `<div class="toldblock"><h2 class="shelfhead">Already told</h2><div class="shelf told">${told.map(t => card('i' + all.indexOf(t), t.icon, t.title, t.blurb)).join('')}</div></div>` : ''}
      </div><div class="shelfside"><div class="optrow"><button id="caststrip" class="optchip">Characters: <b>${esc(S.girls.slice(0, castN()).join(', '))}</b></button><button id="chtoggle" class="optchip">Choices: <b id="chstate">${nChoices() || 'off'}</b></button><button id="lentoggle" class="optchip">Length: <b id="lenstate">${curLen().label.toLowerCase()}</b></button></div></div></div>`);
      on('#own', () => { hush(); res({ kind: 'own' }); });
      on('#caststrip', () => { hush(); res({ kind: 'cast' }); });
      on('#lentoggle', () => { const k = Object.keys(LENGTHS), n = k[(k.indexOf(S.len in LENGTHS ? S.len : 'standard') + 1) % k.length]; S.len = n; save(); $('#lenstate').textContent = LENGTHS[n].label.toLowerCase(); });
      on('#chtoggle', () => { S.choices = (nChoices() + 1) % 4; save(); $('#chstate').textContent = nChoices() || 'off'; });
      all.forEach((t, i) => on('#i' + i, () => { hush(); res({ kind: 'type', type: t }); }));
      on('#again', () => { hush(); res({ kind: 'again' }); });
      on('#resetstory', () => { const wk0 = curWeek(); hush(); if (S.due) delete S.due[wk0.id]; if (ep && ep.idea) { save(); return res({ kind: 'redo' }); } delete S.story[wk0.id]; wk0.ep = null; save(); ep = null; st = undefined; render(); }); // same storyline, a new story around the same words (an older story with no saved storyline is just put away) // back to the beginning of this story, with no missed words carried over
      backBtn(res);
    };
    render();
    say(SCREEN_PROMPTS[0]);
    // running low on fresh ideas: ask the AI for a new batch, then refresh the shelf if she is still on it
    if (allIdeas().filter(t => !isUsed(t)).length < SHELF_SIZE + 3) makeIdeas().then(ok => { if (ok && document.getElementById('own') && !document.getElementById('typeOverlay')) render(); });
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
    let n = castN();
    h(`<div class="screen"><h1>Who is in your story?</h1><p class="subtle">Tap Girl or Boy to choose a name. Then pick a trait if you like.</p>
      <div class="chiprow" id="castcount">${[2, 3, 4].map(k => `<button class="chip small${k === n ? ' on' : ''}" data-k="${k}">${k} characters</button>`).join('')}</div>
      <div class="cast" id="castlist"></div>
      ${S.name ? `<label class="toggle"><input type="checkbox" id="meIn" ${S.meIn ? 'checked' : ''}> Put me in the story as the first one</label>` : ''}
      <button id="next" class="btn big">Use these ${ico('check')}</button></div>`);
    const others = i => cast.filter((_, j) => j !== i).map(c => c.name);
    const choose_ = async i => { const c = cast[i]; const n = await pickName(c.boy, c.name, others(i)); if (n) c.name = n; draw(); };
    const draw = () => {
      $('#castlist').innerHTML = cast.slice(0, n).map((c, i) => `<div class="castrow2"><div class="seg"><button class="segbtn${c.boy ? '' : ' on'}" data-g="${i}" data-v="0">Girl</button><button class="segbtn${c.boy ? ' on' : ''}" data-g="${i}" data-v="1">Boy</button></div><button class="namebtn" data-n="${i}">${esc(c.name)}</button><button class="chip small" data-t="${i}">${esc(c.trait || '+ trait')}</button></div>`).join('');
      document.querySelectorAll('#castlist [data-g]').forEach(b => { b.onclick = () => { const i = +b.dataset.g, boy = b.dataset.v === '1', c = cast[i]; if (boy !== c.boy) { c.boy = boy; if (!(boy ? BOYS : POOL).includes(c.name)) c.name = (boy ? BOYS : POOL).find(n => !others(i).includes(n)); } draw(); choose_(i); }; });
      document.querySelectorAll('#castlist [data-n]').forEach(b => { b.onclick = () => choose_(+b.dataset.n); });
      document.querySelectorAll('#castlist [data-t]').forEach(b => { b.onclick = async () => { const c = cast[+b.dataset.t]; const t = await pickTrait(c.trait); if (t !== null) { c.trait = t; draw(); } }; });
    };
    draw();
    document.querySelectorAll('#castcount .chip').forEach(b => { b.onclick = () => { n = +b.dataset.k; document.querySelectorAll('#castcount .chip').forEach(x => x.classList.toggle('on', +x.dataset.k === n)); draw(); }; });
    on('#next', () => {
      hush(); S.castN = n;
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
    const names = S.girls.slice(0, castN());
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
    try { const ep = await draftStory(wk, { idea }); ep.idea = idea; justWritten = true; return ep; }
    catch (e) { hush(); if ((await failScreen(e.message || 'Something went wrong.')) === BACK) return BACK; }
  }
}
async function storyStart(wk) {
  // Quick route: pick a story and it starts. Characters are optional (the Change strip on the shelf).
  // Steps: shelf, outline (own story only), confirm, ready (start or change characters), write. Back goes one step back.
  let step = 'shelf', pick = null, idea = null, final = null;
  for (;;) {
    if (step === 'shelf') {
      if (epOf(wk) && !S.story[wk.id]) { S.story[wk.id] = { part: 0 }; save(); } // a saved story not yet started still shows on the shelf
      pick = await shelf(epOf(wk), S.story[wk.id]);
      if (pick === BACK) return false;
      if (pick.kind === 'cast') { await castScreen(); continue; }
      if (pick.kind === 'again') { const e0 = epOf(wk), s0 = S.story[wk.id]; if (e0 && s0 && s0.part >= e0.parts.length) { S.story[wk.id] = { part: 0 }; save(); } return true; }
      if (pick.kind === 'redo') { final = epOf(wk).idea; step = 'write'; }
      else if (pick.kind === 'type') { final = pick.type.idea; step = 'ready'; } else step = 'outline';
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
      const id = 'ai' + Date.now(); S.eps = S.eps || {}; S.eps[id] = made; wk.ep = id; S.story[wk.id] = { part: 0 }; if (pick.kind === 'type') markUsed(pick.type); save();
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
function storyReadyScreen() {
  return new Promise(res => {
    h(`<div class="screen cheer">${confettiHtml()}<div class="bigstar"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS.star}</svg></div><h1>Your story is ready!</h1><button id="next" class="btn big">Start the story ${ico('next')}</button></div>`);
    on('#next', () => { hush(); res(); }); keyHandler = e => { if (e.key === 'Enter') { hush(); res(); } };
    fanfare();
  });
}
async function storyDay() {
  const wk = curWeek();
  if (!(await storyStart(wk))) return home();
  const ep = epOf(wk), st = S.story[wk.id], sound = true;
  const beats = [].concat(...ep.parts);
  const order = beats.filter(b => b.p && b.word).map(b => b.word);
  wk.words.forEach(x => { if (!order.includes(x.w)) order.push(x.w); });
  const steps = storySegments(beats);
  prepShown = false;
  await prep((S.readAloud ? [].concat(...steps.filter(x => x.seg).map(x => chunkItems(x.seg).map(chunkText))).concat(partTexts(beats.filter(b => b.c), wk)) : []).concat(spellTexts(wk)), 'Your story is ready!', true);
  if (justWritten) { justWritten = false; if (!prepShown) await storyReadyScreen(); }
  prog = ep.title;
  let i = 0;
  while (i < steps.length) {
    const st0 = steps[i];
    let r;
    if (st0.seg) r = await storyScroll(st0.seg);
    else {
      const b = { c: st0.choice };
      for (;;) {
        const k = await choose(fill(b.c.q), b.c.o.map(o => fill(o.l)));
        if (k === BACK) { r = BACK; break; }
        if ((await narrate(fill(b.c.o[k].n))) !== BACK) break;
      }
    }
    if (r === BACK) { if (i === 0) return home(); i--; } else i++;
  }
  // The story is over. Now each word is said in its sentence, in the order it came, and she spells it.
  const go = await pauseScreen('That was the story!', 'Now let us see which of the yellow words you remember. I will say each one, and you can have a go at spelling it.', 3500);
  if (go === BACK) return home();
  const queue = order.map(w => wk.words.find(q => q.w === w)).filter(Boolean).map(x => ({ x, look: false, counts: true, mode: 'story', context: true }));
  const firsts = await runWords(wk, queue, new Set());
  if (!firsts) return home();
  st.part = ep.parts.length; save();
  await finishSitting(wk, firsts, sound, 'story');
}
// ---------- Revise: the words in random order, like the school test ----------
// The story sentence for a word (the last sentence of its paragraph), or null if the week has no story.
function storySentence(wk, w) {
  const ep = epOf(wk); if (!ep) return null;
  // The sentence used for a word must really contain that exact word (not a longer or shorter form such as shining for shiny).
  // If the saved one does not, look through the whole story for a sentence that does, and use nothing rather than a wrong one.
  const ok = t => t && wholeWord(w, t) === 1;
  if (ep.sentences && ok(fill(ep.sentences[w] || ''))) return fill(ep.sentences[w]);
  for (const part of ep.parts || []) for (const b of part) if (b.p && b.word === w && ok(fill(lastSentence(b.p)))) return fill(lastSentence(b.p));
  for (const part of ep.parts || []) for (const b of part) if (b.p) for (const t of splitSentences(fill(b.p))) if (ok(t)) return t;
  return null;
}
function picFor(word) {
  const ep = epOf(curWeek()); if (!ep) return '';
  for (const part of ep.parts || []) for (const b of part) if (b.p && b.word === word && b.pic) return b.pic;
  return '';
}
const sceneBar = () => ''; // the emoji pictures were dropped; a better picture idea is still to come
function sentenceParts(sentence, word) {
  const m = new RegExp("(^|[^A-Za-z'’])(" + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ")(?![A-Za-z]|['’][A-Za-z])", 'i').exec(sentence);
  if (!m) return null;
  const at = m.index + m[1].length;
  return { pre: sentence.slice(0, at), post: sentence.slice(at + word.length) };
}
const remindOf = (sentence, word) => { const sp = sentence && sentenceParts(sentence, word); return sp ? { html: esc(sp.pre) + '<span class="blank"></span>' + esc(sp.post), spoken: sp.pre + ' blank ' + sp.post } : null; };
function praiseSentence(word, sentence, clean, n, N) {
  return new Promise(res => {
    const text = n && N ? celebrateText(n, N, clean) : (clean ? PRAISE[Math.floor(Math.random() * PRAISE.length)] : 'Well done. You got there!');
    const sp = sentence && sentenceParts(sentence, word);
    const page = sp ? `<div class="page small"><p class="story">${esc(sp.pre)}<span class="pw set">${esc(word)}</span>${esc(sp.post)}</p></div>` : `<div class="wordtile small">${esc(word)}</div>`;
    h(`<div class="screen wordpage cheer">${confettiHtml()}${page}<div class="bigstar"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS.star}</svg></div><p class="msg">${esc(text)}</p>${n && N ? progressStars(n, N) : ''}
      <button id="next" class="btn big">${n && N && n >= N ? 'See how I did' : 'Next word'} ${ico('next')}</button></div>`);
    on('#next', () => { hush(); res(); });
    keyHandler = e => { if (e.key === 'Enter') { hush(); res(); } };
    backBtn(res);
    fanfare();
    setTimeout(() => { if ($('#next')) say(text); }, 800);
  });
}
// Trace it, copy it, wait a moment: then she writes it from memory. Returns true, or BACK.
function traceFlow(word) {
  return new Promise(async res => {
    h(`<div class="screen"><p class="msg">Trace the word with your finger</p><div class="page"><div class="tracebox"><div class="traceword">${esc(word)}</div><canvas id="tc"></canvas></div></div><button id="tdone" class="btn big">Done tracing ${ico('check')}</button></div>`);
    const cv = $('#tc'), box = cv.parentElement; cv.width = box.clientWidth; cv.height = box.clientHeight;
    const cx = cv.getContext('2d'); cx.lineWidth = 8; cx.lineCap = 'round'; cx.strokeStyle = '#d4276a';
    let down = false; const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.onpointerdown = e => { down = true; const [x, y] = pos(e); cx.beginPath(); cx.moveTo(x, y); try { cv.setPointerCapture(e.pointerId); } catch (e2) { } };
    cv.onpointermove = e => { if (!down) return; const [x, y] = pos(e); cx.lineTo(x, y); cx.stroke(); };
    cv.onpointerup = () => { down = false; };
    say(word);
    const s1 = await new Promise(r => { on('#tdone', () => r('ok')); backBtn(() => r(BACK)); });
    if (s1 === BACK) return res(BACK);
    const s2 = await new Promise(r => {
      let typed = '';
      h(`<div class="screen"><p class="msg">Now copy it</p><div class="wordtile small">${esc(word)}</div><div id="slots" class="slots"></div><p id="cmsg" class="subtle"></p>${kbHtml()}</div>`);
      const draw = () => { $('#slots').innerHTML = typed ? [...typed].map(c => `<span class="slot">${esc(c)}</span>`).join('') : '<span class="slot empty">&nbsp;</span>'; const okk = document.querySelector('.key[data-k="ok"]'); if (okk) okk.disabled = !typed; };
      let armed = false; setTimeout(() => { armed = true; }, 700);
      const submit = () => { if (!armed) return; if (typed === word) r('ok'); else if (typed) { typed = ''; $('#cmsg').textContent = 'Look closely and try again.'; draw(); } };
      document.querySelectorAll('.key').forEach(b => { b.onclick = () => { if (!armed) return; const k = b.dataset.k; if (k === 'ok') return submit(); if (k === 'del') typed = typed.slice(0, -1); else if (typed.length < Math.min(24, word.length + 3)) typed += k; draw(); }; });
      backBtn(() => r(BACK)); draw();
    });
    if (s2 === BACK) return res(BACK);
    h(`<div class="screen" id="tw"><p class="msg">Wait a moment...</p><div class="spin"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS.star}</svg></div></div>`);
    await new Promise(r => setTimeout(r, 10000));
    if (!$('#tw')) return; // she left this screen
    res(true);
  });
}
// One word in Revise. it = { x: word object, look: show it first, counts: counts towards the score }.
async function reviseWord(week, it, sentence, starred) {
  const word = it.x.w, remind = remindOf(sentence, word);
  let attempts = 0;
  for (;;) { // Back from the correction or praise screens restarts the word
    if (it.look && (await learnCard(week, it.x, null)) === BACK) return BACK;
    const traced = false;
    const cue = it.context && sentence ? sentence : null;
    let a = await writeWord(word, false, it.look || it.context ? null : remind, it.x, false, cue, null, true);
    if (a === BACK) { if (it.look) continue; return BACK; }
    if (a.askHelp) { // she asked for help before trying
      const id = await helpMenu(it.x); if (id === BACK) continue;
      a = await writeWord(word, false, null, it.x, false, cue, id); if (a === BACK) continue;
      if (id === 'choice' && a.typed === word) { if ((await pickedRight()) === BACK) continue; const b = await writeWord(word, false, null, it.x, false, cue, null, false, false, 'Now spell it again by yourself.'); if (b === BACK) continue; a = { typed: b.typed, hints: (a.hints || 0) + (b.hints || 0), reminded: a.reminded || b.reminded, tools: a.tools.concat(b.tools.filter(t => !a.tools.includes(t))), aided: true }; }
    }
    noteTyped(word, a.typed);
    const tl = a.tools.concat(traced ? ['trace'] : []), aided = a.aided || traced;
    const ok = a.typed === word;
    S.log.push({ t: Date.now(), d: today(), wk: week.id, w: word, mode: it.mode || 'revise', typed: a.typed, hints: a.hints, remind: a.reminded || undefined, tools: tl.length ? tl : undefined, aided: aided || undefined, look: it.look || undefined, ok, redo: !it.counts || attempts++ > 0 || undefined });
    save();
    let gaveUp = false;
    if (!ok) {
      const lr = await hintLadder(week, it.x, it.mode, it.context ? sentence : null, a.tools && a.tools.includes('family'));
      if (lr === BACK) continue;
      if (lr === false) { gaveUp = true; if ((await pauseScreen('That word is still hiding.', 'We will try it again in a little while.', 3500)) === BACK) continue; }
    }
    if (gaveUp) return { good: false, ok: false, typed: a.typed, aided: true };
    const sk = 'revise:' + word;
    if (!starred.has(sk)) { S.stars++; starred.add(sk); }
    save();
    const good = ok && a.hints === 0 && !a.reminded && !aided;
    if ((await praiseSentence(word, sentence, good, starred.size, week.words.length)) === BACK) continue;
    return { good, ok, typed: a.typed, aided };
  }
}
const OOPS = ['Oops, nearly!', 'Crumbs, so close!', 'Not quite, but nearly!', 'Ooh, nearly there!'];
const CLUE = 'Here is a clue.', ANSWER_MSG = 'Here it is. Have a good look.', SPELL_INTRO = 'That was the story! Now let us see which of the yellow words you remember. I will say each one, and you can have a go at spelling it.';
function hintText(x) {
  const fam = (x.family || []).slice(0, 3);
  if (fam.length) return 'Here are some words spelled in the same way: ' + fam.join(', ') + '. Have another go.';
  if (x.say) return 'Try saying it the spelling way: ' + x.say + '. Have another go.';
  if (x.parts && x.parts.includes('|')) return 'It has these parts: ' + x.parts.split('|').join(', ') + '. Have another go.';
  if (x.hard) return 'The tricky part has these letters in it: ' + x.hard.split('').join(', ') + '. Have another go.';
  return 'It starts with ' + x.w[0] + ' and has ' + x.w.length + ' letters. Have another go.';
}
// A message that stays for a few seconds and then moves on by itself (or sooner if she taps Ready). Back goes back. Not spoken.
const PICKED_RIGHT = "Well done, that is the correct word. Now go and spell it again by yourself.";
// She picked the right word from the choices: tell her so, then she writes it herself. Back goes back.
async function pickedRight() { const p = pauseScreen("Well done, that's the correct word!", 'Now go and spell it again by yourself.', 6500); say(PICKED_RIGHT); const r = await p; hush(); return r; }
function pauseScreen(msg, sub, ms) {
  return new Promise(res => {
    h(`<div class="screen"><p class="msg">${esc(msg)}</p>${sub ? `<p class="subtle">${esc(sub)}</p>` : ''}<button id="next" class="btn big">Ready ${ico('next')}</button></div>`);
    let done = false, tm = null; const go = v => { if (done) return; done = true; clearTimeout(tm); res(v); };
    tm = setTimeout(() => go(), ms || 3000);
    on('#next', () => go()); keyHandler = e => { if (e.key === 'Enter') go(); };
    backBtn(r => go(r));
  });
}
// A kind screen with one button. Back goes back a step.
function gentle(msg, sub, btn, spoken) {
  return new Promise(res => {
    h(`<div class="screen"><p class="msg">${esc(msg)}</p>${sub ? `<p class="subtle">${esc(sub)}</p>` : ''}<button id="next" class="btn big">${esc(btn || 'Try again')} ${ico('next')}</button></div>`);
    on('#next', () => { hush(); res(); });
    keyHandler = e => { if (e.key === 'Enter') { hush(); res(); } };
    backBtn(res);
    say(spoken || msg);
  });
}
function showAnswer(word) {
  return new Promise(res => {
    h(`<div class="screen"><p class="msg">${ANSWER_MSG}</p><div class="wordtile">${esc(word)}</div><button id="next" class="btn big">I've had a good look ${ico('check')}</button></div>`);
    on('#next', () => { hush(); res(); });
    keyHandler = e => { if (e.key === 'Enter') { hush(); res(); } };
    backBtn(res);
    say(ANSWER_MSG + ' ' + word);
  });
}
// She got it wrong. She is asked whether she wants another go or some help, and if help, which one. One help at a time.
// Returns 'again', 'show', {help: id}, or BACK.
// The spelling rule button is greyed out for a word that has no built-in rule.
// Are you sure? needs the letters as she types them, so it is greyed out when she writes by hand.
const hasRule = x => !!phonicsRule(x.w) || !!trickText(x); // the spelling tip help is there when the word has a tip or a rule
const helpBtns = x => helpsFor(x).map(id => { const off = (id === 'family' && !hasRule(x)) || (id === 'sure' && S.input === 'write'); return `<button class="choice${off ? ' off' : ''}" data-h="${id}"${off ? ' disabled aria-disabled="true"' : ''}>${esc(HELP_LABEL[id])}</button>`; }).join('');
function helpMenu(x) {
  return new Promise(r => {
    h(`<div class="screen"><p class="msg">Which help would you like?</p><div class="choices menu">${helpBtns(x)}</div></div>`);
    document.querySelectorAll('[data-h]').forEach(b => { b.onclick = () => { hush(); r(b.dataset.h); }; });
    backBtn(() => r(BACK)); say(HELP_MENU);
  });
}
function helpChoice(x, first) {
  return new Promise(async res => {
    for (;;) {
      const c = await new Promise(r => {
        h(`<div class="screen"><p class="msg">Not quite right.</p><p class="subtle">Would you like some help to spell this, or another go?</p>
          <div class="choices"><button class="choice" id="h-help">I'd like some help</button><button class="choice" id="h-again">Have another go</button></div></div>`);
        on('#h-help', () => { hush(); r('help'); }); on('#h-again', () => { hush(); r('again'); });
        backBtn(() => r(BACK)); say(HELP_Q);
      });
      if (c === BACK) return res(BACK);
      if (c === 'again') return res('again');
      const m = await new Promise(r => {
        h(`<div class="screen"><p class="msg">Which help would you like?</p><div class="choices menu">${helpBtns(x)}</div></div>`);
        document.querySelectorAll('[data-h]').forEach(b => { b.onclick = () => { hush(); r(b.dataset.h); }; });
        backBtn(() => r(BACK)); say(HELP_MENU);
      });
      if (m === BACK) continue;
      return res({ help: m });
    }
  });
}
// A memory trick helps hold a spelling she now knows. It is offered only when a word keeps going wrong over several sittings, and only after she has the right spelling.
// ---------- Revision: remembering the words that hide, after the story and the practice ----------
// For each tricky word: a memory trick to hold on to, then trace it, copy it, wait, and write it from memory.
const trickyWords = wk => {
  const miss = {};
  S.log.filter(l => l.wk === wk.id && !l.redo && !l.ok).forEach(l => { miss[l.w] = (miss[l.w] || 0) + 1; });
  ((S.due && S.due[wk.id]) || []).forEach(w => { miss[w] = (miss[w] || 0) + 1; });
  return wk.words.filter(x => miss[x.w]).sort((a, b) => miss[b.w] - miss[a.w]);
};
// ---------- Memory tricks: each letter of the word points to a silly word that starts with it ----------
// Silly words for each letter, in four kinds, so a sentence can be built that makes sense: adjectives, plural nouns, verbs that take an object, and adverbs.
const MN_BANK = {
  a: ['awesome,angry', 'aliens,ants', 'annoy,adore', 'amazingly,angrily'],
  b: ['bouncy,bossy', 'bananas,bears', 'bounce on,bump', 'boldly,bravely'],
  c: ['cheeky,crunchy', 'crocodiles,cows', 'chase,chew', 'carefully,cleverly'],
  d: ['dizzy,daft', 'dragons,ducks', 'dance with,drag', 'daringly,dizzily'],
  e: ['enormous,excited', 'elephants,eagles', 'eat,excite', 'eagerly,endlessly'],
  f: ['fluffy,funny', 'frogs,foxes', 'flip,follow', 'fast,fearlessly'],
  g: ['giggly,grumpy', 'goats,gorillas', 'giggle at,grab', 'gently,gladly'],
  h: ['hairy,hungry', 'hippos,hens', 'hug,hide from', 'happily,hungrily'],
  i: ['icky,itchy', 'iguanas,insects', 'inspect,invite', 'instantly,immediately'],
  j: ['jolly,jumpy', 'jellyfish,jaguars', 'juggle,jump on', 'joyfully,jauntily'],
  k: ['kooky,kind', 'kangaroos,koalas', 'kick,kiss', 'keenly,kindly'],
  l: ['lumpy,lazy', 'llamas,lions', 'leap over,lick', 'loudly,lazily'],
  m: ['mighty,messy', 'monkeys,mice', 'munch,mimic', 'madly,merrily'],
  n: ['naughty,nosy', 'noodles,newts', 'nibble,nudge', 'noisily,nervously'],
  o: ['odd,orange', 'octopuses,owls', 'order,overtake', 'oddly,openly'],
  p: ['purple,polite', 'penguins,pigs', 'poke,pinch', 'politely,proudly'],
  q: ['quirky,quiet', 'queens,quails', 'quack at,question', 'quickly,quietly'],
  r: ['rubbery,rowdy', 'rabbits,robots', 'race,rescue', 'rapidly,rowdily'],
  s: ['silly,sleepy', 'sausages,snakes', 'sneeze on,squash', 'slowly,sleepily'],
  t: ['tickly,tiny', 'trolls,tigers', 'tickle,tease', 'tenderly,tirelessly'],
  u: ['ugly,upset', 'unicorns,umpires', 'unwrap,undo', 'urgently,upside-down'],
  v: ['velvet,vain', 'vultures,vans', 'visit,vex', 'vaguely,vigorously'],
  w: ['wobbly,wild', 'walruses,wizards', 'wiggle at,watch', 'wildly,wisely'],
  x: ['xtra-spotty,xtra-big', 'xylophones,x-rays', 'x-ray,x-change', 'xtra-loudly,xtra-slowly'],
  y: ['yellow,yappy', 'yaks,yetis', 'yell at,yank', 'yummily,yearningly'],
  z: ['zany,zippy', 'zebras,zombies', 'zoom past,zap', 'zanily,zealously']
};
const MN_ROLES = ['adj', 'noun', 'verb', 'adv'];
const mnOptions = (c, role) => ((MN_BANK[c] || [])[MN_ROLES.indexOf(role)] || '').split(',').filter(Boolean);
// What kind of word each position is, so the whole thing reads as a sentence: adjectives, a noun, a verb, adjectives, a noun, and an adverb on the end.
function mnSkeleton(n) {
  if (n <= 1) return ['noun'];
  if (n === 2) return ['noun', 'verb'];
  const extras = n - 3, adv = extras >= 3 ? 1 : 0, adj = extras - adv, aS = Math.ceil(adj / 2), aO = adj - aS;
  return [].concat(Array(aS).fill('adj'), ['noun', 'verb'], Array(aO).fill('adj'), ['noun'], adv ? ['adv'] : []);
}
// A silly sentence with one word for each letter. The variant picks between the two choices for each letter, so "Another one" gives something different.
function mnemonicWords(w, variant) {
  const roles = mnSkeleton(w.length);
  return [...w].map((c, i) => { const o = mnOptions(c, roles[i]); return o.length ? o[((variant >> (i % 3)) + i) % o.length] : c; });
}
// Which kind of word is this, for this letter? Used when she taps a word to change it.
const mnRoleOf = (c, word) => MN_ROLES.find(r => mnOptions(c, r).includes(word));
const mnCap = t => t.charAt(0).toUpperCase() + t.slice(1);
// Asks the AI for something funnier, if this device has the key. Each word must start with the right letter, in order.
async function aiMnemonic(w, notThese) {
  if (!aiKey()) throw new Error('no key');
  const headers = { 'Authorization': 'Bearer ' + aiKey(), 'Content-Type': 'application/json' };
  if (/openrouter\.ai/.test(aiBase())) headers['X-Title'] = 'BellaSpeller';
  const r = await fetch(aiBase() + '/chat/completions', { method: 'POST', headers, body: JSON.stringify({ model: S.orModel || DEFAULT_MODEL, max_tokens: 200, temperature: 1, messages: [{ role: 'user', content: 'Make a silly, funny memory trick for a nine-year-old in England to spell the word "' + w + '". Give one short word for each letter, in order, starting with that exact letter, so the words read as one funny sentence that makes proper grammatical sense from the first word to the last, for example an adjective, a noun, a verb, an adjective, a noun, then an adverb (' + w.length + ' words). Kind and harmless, nothing rude or scary. British English. ' + (notThese ? 'Not this one: ' + notThese + '. ' : '') + 'Reply with JSON only: {"words": [' + [...w].map(c => '"' + c + '..."').join(', ') + ']}' }] }) });
  if (!r.ok) throw aiFail(r.status);
  const j = await r.json(), c = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content, t = typeof c === 'string' ? c : Array.isArray(c) ? c.map(z => z.text || '').join('') : '';
  const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a < 0 || b <= a) throw new Error('bad');
  const words = (JSON.parse(t.slice(a, b + 1)).words || []).map(z => String(z).trim().toLowerCase());
  if (words.length !== w.length || !words.every((z, i) => /^[a-z' -]{2,22}$/.test(z) && z[0] === w[i])) throw new Error('bad');
  return words;
}
// The memory trick screen for one word: the word along the top, an arrow from each letter, and the silly word it points to. They appear one by one, then the whole trick is written underneath.
// The memory tricks made so far, in rows of two, shown underneath.
const mnDoneHtml = made => (made && made.length) ? `<div class="mndone">${made.map(m => `<div class="mncard"><b>${esc(m.w)}</b><span>${esc(m.sentence)}</span></div>`).join('')}</div>` : '';
function mnemonicScreen(x, made) {
  return new Promise(res => {
    const w = x.w, n = w.length;
    let words = (x.mnemWords && x.mnemWords.length === n && x.mnemWords.every((t, i) => t[0] === w[i])) ? x.mnemWords.slice() : null, variant = w.length % 3, custom = '', shown = 0, timer = null, gone = false, busy = false;
    if (!words && !custom) words = mnemonicWords(w, variant);
    const arrow = '<svg class="mnarrow" viewBox="0 0 24 40" aria-hidden="true"><path d="M12 2 V32 M4 24 L12 34 L20 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const sentence = () => custom || words.map(mnCap).join(' ') + '.';
    const draw = () => {
      const cols = words ? [...w].map((c, i) => `<div class="mncol"><div class="mnletter">${esc(c)}</div><div class="mnarr${i < shown ? ' on' : ''}">${arrow}</div><button class="mnword${i < shown ? ' on' : ''}" data-i="${i}" ${i < shown ? '' : 'tabindex="-1"'}>${i < shown ? esc(words[i]) : '&nbsp;'}</button></div>`).join('') : '';
      h(`<div class="screen mnscreen"><p class="msg">Let us make a mnemonic for this word.</p>
        ${words ? `<div class="mngrid" style="grid-template-columns:repeat(${n}, minmax(0,1fr))">${cols}</div>` : `<div class="wordtile">${esc(w)}</div>`}
        <div class="mntrick" id="mntrick">${(!words || shown >= n) ? esc(sentence()) : '&nbsp;'}</div>
        <div class="row"><button id="mnhear" class="iconbtn big" aria-label="Hear it">${ico('speaker')}</button><button id="mnanother" class="btn small">Another one</button><button id="mnok" class="btn big">Got it ${ico('next')}</button></div>
        ${words ? '<p class="subtle">Tap any word to change it.</p>' : ''}${mnDoneHtml(made)}</div>`);
      on('#mnhear', () => say(w + '. ' + sentence()));
      on('#mnok', () => { gone = true; clearTimeout(timer); hush(); x.mnemWords = words ? words.slice() : undefined; x.mnemonic = sentence(); save(); res(); });
      on('#mnanother', another);
      document.querySelectorAll('.mnword').forEach(b => { b.onclick = () => { if (!words || +b.dataset.i >= shown) return; const i = +b.dataset.i, c = w[i], role = mnRoleOf(c, words[i]) || mnSkeleton(n)[i], opts = mnOptions(c, role), at = opts.indexOf(words[i]); if (opts.length > 1) { words[i] = opts[(at + 1) % opts.length]; draw(); } }; });
      backBtn(() => { gone = true; clearTimeout(timer); hush(); res(BACK); });
    };
    const reveal = () => { if (gone) return; if (shown < n) { shown++; draw(); timer = setTimeout(reveal, 650); } else { say(w + '. ' + sentence()); } };
    const another = async () => {
      if (busy) return; busy = true; clearTimeout(timer); const was = words ? words.join(' ') : '';
      const t = $('#mnanother'); if (t) t.textContent = 'Thinking...';
      try { words = await aiMnemonic(w, was); custom = ''; } catch (e) { variant++; words = mnemonicWords(w, variant % 3); custom = ''; }
      busy = false; shown = 0; draw(); timer = setTimeout(reveal, 400);
    };
    const own = async () => {
      clearTimeout(timer);
      const t = await typeText({ title: 'Your mnemonic for ' + w, initial: '', max: 140 });
      if (t && t.trim()) {
        const ws = t.trim().toLowerCase().split(/\s+/);
        if (ws.length === n && ws.every((z, i) => z[0] === w[i])) { words = ws; custom = ''; shown = n; } else { words = null; custom = mnCap(t.trim()); }
      }
      draw();
    };
    shown = 0; draw(); timer = setTimeout(reveal, 500);
  });
}
function trickScreen(x) {
  return new Promise(res => {
    const msg = 'Let us remember this word.';
    h(`<div class="screen"><p class="msg">${msg}</p><div class="wordtile">${esc(x.w)}</div>
      ${x.mnem ? `<div class="helpline"><b>Memory trick:</b> ${esc(x.mnem)}</div>` : '<p class="subtle">Make up a trick to help you remember it.</p>'}
      <div class="row"><button id="hear" class="iconbtn big" aria-label="Hear it">${ico('speaker')}</button><button id="mk" class="btn">${x.mnem ? 'Change my trick' : 'Make my own trick'}</button><button id="next" class="btn big">Now trace it ${ico('next')}</button></div></div>`);
    const sayAll = () => say(msg + ' ' + x.w + '. ' + (x.mnem || ''));
    on('#hear', sayAll); on('#next', () => { hush(); res(); });
    on('#mk', async () => { const t = await typeText({ title: 'Your memory trick for ' + x.w, initial: '', max: 140 }); if (t && t.trim()) { x.mnem = t.trim(); x.mnemBy = 'bella'; save(); trickScreen(x).then(res); } });
    backBtn(res); sayAll();
  });
}
// She ticks the tricky words she wants a memory trick for, or ticks them all with the master tick. Returns the chosen words, or null for Back.
// Each word of the week with its spelling trick, if it has one.
const TIP_TABLE = {
  many: 'Many is said "menny", but it is spelt with an a: m-a-n-y.',
  enough: 'Enough ends with ough, which says "uff" here: e-n-ough.',
  friend: 'Friend has ie in it: fr-ie-nd. A friend is there to the end.',
  because: 'Because is be and cause joined together: be-cause.',
  answer: 'Answer has a silent w after the s: ans-w-er.',
  colour: 'Colour has a u before the r: colo-u-r.',
  great: 'Great has ea, which says "ay" here: gr-ea-t.',
  decide: 'The c says s in decide: de-c-ide.',
  used: 'Used is use with a d on the end: u-s-e-d.',
  special: 'Special has ci in the middle: spe-ci-al.'
};
// What the voice says for a tip. A voice reads a letter group such as "ough" as a word and a sound such as "uff" as nonsense, so the spoken version names the letters one by one and spells the sounds the way they are said.
const LETTER_NAMES = { a: 'ay', b: 'bee', c: 'see', d: 'dee', e: 'ee', f: 'ef', g: 'jee', h: 'aitch', i: 'eye', j: 'jay', k: 'kay', l: 'el', m: 'em', n: 'en', o: 'oh', p: 'pee', q: 'queue', r: 'ar', s: 'ess', t: 'tee', u: 'you', v: 'vee', w: 'double you', x: 'ex', y: 'why', z: 'zed' };
// The sound each letter makes, written so that a voice says it as a sound and not as a name (a short sound for a vowel, a short puff for a stop).
const LETTER_SOUNDS = { a: 'ah', b: 'buh', c: 'kuh', d: 'duh', e: 'eh', f: 'fff', g: 'guh', h: 'huh', i: 'ih', j: 'juh', k: 'kuh', l: 'lll', m: 'mmm', n: 'nnn', o: 'oh', p: 'puh', q: 'kwuh', r: 'rrr', s: 'sss', t: 'tuh', u: 'uh', v: 'vvv', w: 'wuh', x: 'ks', y: 'yuh', z: 'zzz' };
const letterSayMode = () => 'names'; // letter names are the default: the voice cannot say bare phonics sounds properly (tried 3.88)
// Letters to be spoken are written in curly braces, for example {o,u,g,h}; they are said as phonics sounds or as letter names, whichever is chosen.
const speakLetters = t => String(t).replace(/\{([a-z, ]+)\}/gi, (m, g) => g.toLowerCase().split(/[\s,]+/).filter(Boolean).map(c => (letterSayMode() === 'names' ? LETTER_NAMES : LETTER_SOUNDS)[c] || c).join(', '));
// What the voice says for a tip. A voice reads a letter group such as "ough" as a word and a sound such as "uff" as nonsense, so the spoken version puts the letters in braces and spells the sounds the way they are said.
const TIP_SAY = {
  many: 'Many is said menny, but it is spelt with the letter {a}: {m,a,n,y}.',
  enough: 'Enough ends with the letters {o,u,g,h}. Together they say uff, like in stuff: {e,n,o,u,g,h}.',
  friend: 'Friend has the letters {i} and {e} in it: {f,r,i,e,n,d}. A friend is there to the end.',
  because: 'Because is the word be and the word cause joined together: be, cause.',
  answer: 'Answer has a silent {w} after the {s}: {a,n,s,w,e,r}. You do not say the {w}.',
  colour: 'Colour has the letter {u} before the {r}: {c,o,l,o,u,r}.',
  great: 'Great has the letters {e} and {a}, which say ay here, like in steak: {g,r,e,a,t}.',
  decide: 'The letter {c} says s in decide: {d,e,c,i,d,e}.',
  used: 'Used is the word use with a {d} on the end: {u,s,e,d}.',
  special: 'Special has the letters {c} and {i} in the middle: {s,p,e,c,i,a,l}.'
};
const spokenTip = x => speakLetters(x.mnemSay || (!x.mnem && TIP_SAY[x.w]) || trickText(x));
function trickText(x) {
  return x.mnem || TIP_TABLE[x.w] || ''; // only a real spelling trick: the built-in phonics rules can be wrong for a particular word (great does not say ee), so they are not used here
}
// Asks the AI for one short, accurate spelling tip for each word that has none. Needs this device to have the key.
async function aiTips(words) {
  aiNeedKey();
  const headers = { 'Authorization': 'Bearer ' + aiKey(), 'Content-Type': 'application/json' };
  if (/openrouter\.ai/.test(aiBase())) headers['X-Title'] = 'BellaSpeller';
  const r = await fetch(aiBase() + '/chat/completions', { method: 'POST', headers, body: JSON.stringify({ model: S.orModel || DEFAULT_MODEL, max_tokens: 1500, temperature: 0.2, messages: [{ role: 'user', content: 'For a nine-year-old in England who finds spelling hard, give one short, accurate spelling tip for each of these words (British spelling): ' + words.join(', ') + '. The tip should point out the tricky part of the word in plain words, for example a silent letter, a letter pair that makes a sound, or how the word is built from a smaller word. Do not make up word origins, do not write a silly sentence or mnemonic, and keep each tip under 90 characters. If there is no honest tip for a word, use an empty string. Also give a "say" version for a text-to-speech voice: the same tip, but put every letter or letter group that should be said as letters inside curly braces with commas between them (for example {o,u,g,h}, never ough), and write any sound the way it is said (for example uff), because the voice cannot read letter groups or sounds properly. Reply with JSON only, like {"word": {"tip": "...", "say": "..."}}.' }] }) });
  if (!r.ok) throw aiFail(r.status);
  const j = await r.json(), c = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content, t = typeof c === 'string' ? c : Array.isArray(c) ? c.map(z => z.text || '').join('') : '';
  const i0 = t.indexOf('{'), i1 = t.lastIndexOf('}'); if (i0 < 0 || i1 <= i0) throw new Error('The reply was not a list of tips.');
  const o = JSON.parse(t.slice(i0, i1 + 1)), out = {};
  words.forEach(w => { const e = o[w], v = String(e && typeof e === 'object' ? e.tip : e || '').trim(); if (v && v.length <= 140) out[w] = { tip: v, say: e && typeof e === 'object' && e.say ? String(e.say).trim().slice(0, 300) : '' }; });
  return out;
}
// The spelling tips one at a time: each word and its tip appear and are said once, then she looks at it for as long as she likes and taps Next.
function tipsOneByOne(all) {
  return new Promise(res => {
    const list = all.filter(x => trickText(x)); // words with no tip are left out
    if (!list.length) { res(); return; }
    let i = 0;
    const finish = () => { hush(); prog = ''; res(); };
    const show = () => {
      const x = list[i], tip = trickText(x), last = i === list.length - 1;
      prog = `Word ${i + 1} of ${list.length}`;
      h(`<div class="screen onetip"><div class="wordtile">${esc(x.w)}</div>
        <p class="tipbig">${esc(tip)}</p>
        <div class="row"><button id="tphear" class="iconbtn big" aria-label="Say it again">${ico('speaker')}</button>${i > 0 ? '<button id="tpprev" class="btn">Previous</button>' : ''}<button id="tpnext" class="btn big">${last ? 'Done' : 'Next'} ${ico(last ? 'check' : 'next')}</button></div></div>`);
      on('#tphear', () => say(x.w + '. ' + spokenTip(x)));
      on('#tpprev', () => { hush(); i--; show(); });
      on('#tpnext', () => { hush(); if (last) finish(); else { i++; show(); } });
      backBtn(finish);
      say(x.w + '. ' + spokenTip(x));
    };
    show();
  });
}
function tricksScreen(all) {
  return new Promise(res => {
    const draw = (note) => {
      const missing = all.filter(x => !trickText(x));
      h(`<div class="screen mnscreen"><p class="msg">The words and their spelling tips</p>
        <div class="trgrid">${all.map(x => `<b class="trw">${esc(x.w)}</b><span class="trt${trickText(x) ? '' : ' none'}">${esc(trickText(x) || 'No spelling tip yet.')}</span>`).join('')}</div>
        ${missing.length ? '<div class="row"><button id="trfind" class="btn small">Look up the missing spelling tips</button></div>' : ''}${note ? `<p class="subtle">${esc(note)}</p>` : ''}</div>`);
      on('#trfind', async () => {
        const b = $('#trfind'); if (b) { b.disabled = true; b.textContent = 'Looking them up...'; }
        try {
          const tips = await aiTips(missing.map(x => x.w));
          missing.forEach(x => { if (tips[x.w]) { x.mnem = tips[x.w].tip; x.mnemSay = tips[x.w].say || undefined; x.mnemBy = 'ai'; } }); save();
          draw(Object.keys(tips).length ? 'The AI suggested these. A grown-up can change any of them under Grown-ups.' : 'No tips came back. Try again in a moment.');
        } catch (e) { draw(e.message || 'Could not look them up.'); }
      });
      backBtn(() => res());
    };
    draw();
  });
}
function pickTricky(all) {
  return new Promise(res => {
    const on0 = new Set(); // nothing is ticked at first
    const draw = () => {
      const allOn = on0.size === all.length;
      h(`<div class="screen picktrick"><p class="msg">Which words would you like a mnemonic for?</p>
        <button id="pkall" class="pkrow pkmaster${allOn ? ' on' : ''}"><span class="pkbox">${allOn ? '&#10003;' : ''}</span><span>All of them</span></button>
        <div class="pkgrid">${all.map(x => `<button class="pkrow${on0.has(x.w) ? ' on' : ''}" data-w="${esc(x.w)}"><span class="pkbox">${on0.has(x.w) ? '&#10003;' : ''}</span><span class="pktext"><b>${esc(x.w)}</b></span></button>`).join('')}</div>
        <button id="pkgo" class="btn big"${on0.size ? '' : ' disabled'}>Make my mnemonics ${ico('next')}</button><div class="row">${all.some(x => x.mnemonic) ? '<button id="pkmine" class="btn small">Show my mnemonics</button>' : ''}</div></div>`);
      on('#pkmine', () => res('mine'));
      on('#pkall', () => { if (on0.size === all.length) on0.clear(); else all.forEach(x => on0.add(x.w)); draw(); });
      document.querySelectorAll('.pkgrid .pkrow').forEach(b => { b.onclick = () => { const w = b.dataset.w; if (on0.has(w)) on0.delete(w); else on0.add(w); draw(); }; });
      on('#pkgo', () => { if (on0.size) res(all.filter(x => on0.has(x.w))); });
      backBtn(() => res(null));
    };
    draw();
  });
}
async function remember() {
  const wk = curWeek(), all = wk.words.slice();
  // My revision first asks: mnemonics, or spelling tricks.
  let list;
  for (;;) {
    const way = await new Promise(res => {
      h(`<div class="screen"><p class="msg">What would you like to do?</p><div class="choices menu"><button class="choice" id="rvmn">Mnemonics</button><button class="choice" id="rvtr">Spelling tips</button></div></div>`);
      on('#rvmn', () => res('mn')); on('#rvtr', () => res('tr')); backBtn(() => res(null));
    });
    if (!way) return home();
    if (way === 'tr') {
      const how = await new Promise(res => {
        h(`<div class="screen"><p class="msg">Spelling tips</p><div class="choices menu"><button class="choice" id="tpall">Show me all of them</button><button class="choice" id="tpone">Show me one at a time</button></div></div>`);
        on('#tpall', () => res('all')); on('#tpone', () => res('one')); backBtn(() => res(null));
      });
      if (how === 'all') await tricksScreen(all); else if (how === 'one') await tipsOneByOne(all);
      continue;
    }
    for (;;) {
      list = await pickTricky(all); // she chooses which of the week's words she wants a mnemonic for
      if (list === 'mine') { await mineScreen(all); continue; }
      break;
    }
    if (!list) continue; // Back goes to the first choice
    break;
  }
  // A mnemonic for each word she ticked, one after another, each one added underneath the last. They are saved with the word.
  const made = [];
  { let i = 0;
    while (i < list.length) {
      const x = list[i]; prog = `Word ${i + 1} of ${list.length}`;
      const m = await mnemonicScreen(x, made);
      if (m === BACK) { if (i === 0) return home(); i--; made.pop(); continue; }
      made[i] = { w: x.w, sentence: x.mnemonic }; made.length = i + 1; i++;
    }
  }
  prog = '';
  await new Promise(res => {
    h(`<div class="screen mnscreen"><p class="msg">Your mnemonics</p>${mnDoneHtml(made)}<div class="row"><button id="mnfin" class="btn big">Done ${ico('check')}</button></div></div>`);
    on('#mnfin', () => res()); backBtn(() => res());
  });
  home();
}
const MNEM_AFTER = 3;
async function memoryTrickStep(week, x) {
  const misses = S.log.filter(l => l.w === x.w && !l.redo && !l.ok).length;
  if (misses < MNEM_AFTER) return;
  const msg = 'This word keeps hiding. A memory trick can help you hold on to it.';
  await new Promise(res => {
    const body = x.mnem ? `<div class="helpline"><b>Memory trick:</b> ${esc(x.mnem)}</div>` : '';
    h(`<div class="screen"><p class="msg">${msg}</p><div class="wordtile small">${esc(x.w)}</div>${body}
      <div class="row">${x.mnem ? '' : '<button id="mk" class="btn">Make my own trick</button>'}<button id="next" class="btn big">${x.mnem ? 'Got it' : 'Not now'} ${ico('next')}</button></div></div>`);
    on('#next', () => { hush(); res(); });
    const mk = $('#mk'); if (mk) mk.onclick = async () => { const t = await typeText({ title: 'Your memory trick for ' + x.w, initial: '', max: 140 }); if (t && t.trim()) { x.mnem = t.trim(); x.mnemBy = 'bella'; save(); } res(); };
    backBtn(res);
    say(msg + (x.mnem ? ' ' + x.mnem : ''));
  });
}
async function hintLadder(week, x, mode, sentence, usedFamily) {
  const word = x.w;
  const tryLog = (a, help, n) => { noteTyped(word, a.typed); S.log.push({ t: Date.now(), d: today(), wk: week.id, w: word, mode: mode || 'revise', typed: a.typed, hints: a.hints || 0, ok: a.typed === word, rung: n, tools: help ? [help].concat(a.tools.filter(t => t !== help)) : undefined, aided: !!help || undefined, redo: true }); save(); };
  let n = 0, sureOn = false;
  for (;;) {
    // After a wrong go she chooses: another go on her own, or help (the spelling rule, or Are you sure?).
    if (n >= 3 && mode === 'revise') return false; // in practice and revision the word is never shown: it comes back later
    const c = n >= 3 ? 'show' : await helpChoice(x);
    if (c === BACK) return BACK;
    if (c === 'show') {
      if ((await showAnswer(word)) === BACK) { n = 0; continue; } // last resort: she sees the word, then writes it from memory
      const a = await writeWord(word, false, null, x, false, sentence, null, false, sureOn); if (a === BACK) continue; tryLog(a, null, ++n);
      return true;
    }
    const help = c === 'again' ? null : c.help;
    if (help === 'family') usedFamily = true;
    if (help === 'sure') sureOn = true;
    if (help === 'trace') { const t = await traceFlow(word); if (t === BACK) continue; }
    const a = await writeWord(word, false, null, x, false, sentence, help === 'trace' ? null : help, false, sureOn);
    if (a === BACK) continue;
    tryLog(a, help, ++n);
    if (help === 'choice' && a.typed === word) { // she picked it: now she writes it herself before moving on
      if ((await pickedRight()) === BACK) continue;
      const b = await writeWord(word, false, null, x, false, sentence, null, false, sureOn, 'Now spell it again by yourself.'); if (b === BACK) continue;
      tryLog(b, null, ++n); if (b.typed === word) return true; else continue;
    }
    if (a.typed === word) return true;
  }
}
function reviseEnd(wk, firsts, sound) {
  return new Promise(res => {
    const N = wk.words.length, goodN = wk.words.filter(x => firsts[x.w] && firsts[x.w].good).length, missed = wk.words.filter(x => !(firsts[x.w] && firsts[x.w].ok)), helped = wk.words.filter(x => firsts[x.w] && firsts[x.w].aided).length;
    const tiles = missed.map(x => { const t = (firsts[x.w] && firsts[x.w].typed) || '', mk = matchMask(x.w, t); return `<div class="wordtile small">${[...x.w].map((c, i) => mk[i] ? esc(c) : `<span class="hid">${esc(c)}</span>`).join('')}</div>`; }).join('');
    h(`<div class="screen"><h1>${sound ? goodN + ' out of ' + N + ' first time' : 'All done!'}</h1>
      ${sound ? '' : '<p class="subtle">Turn the sound on to get a score.</p>'}
      ${sound && missed.length ? `<p class="msg">Still hiding:</p><div class="row">${tiles}</div>` : (sound && !helped ? '<p class="msg">Every single one!</p>' : '')}
      ${helped ? `<p class="subtle">${helped} ${helped === 1 ? 'word' : 'words'} used a tool, so ${helped === 1 ? 'it is' : 'they are'} not counted in the score.</p>` : ''}
      <p class="subtle">And a star for every word.</p><button id="next" class="btn big">See my stars ${ico('next')}</button></div>`);
    on('#next', res);
  });
}
// Everything the spelling steps need spoken, fetched ahead so nothing waits.
function spellTexts(wk) {
  const texts = wk.words.map(x => x.w).concat(COMMON);
  wk.words.forEach(x => { const s0 = storySentence(wk, x.w), r = remindOf(s0, x.w); if (s0) { texts.push(s0); texts.push(cueSpoken(s0, x.w)); } if (r) texts.push(r.spoken); if (x.say) texts.push(x.say + '.' + wordAgain(x)); texts.push(familyText(x)); texts.push(hintText(x)); });
  for (let i = 1; i <= wk.words.length; i++) { texts.push(celebrateText(i, wk.words.length, true)); texts.push(celebrateText(i, wk.words.length, false)); }
  OOPS.forEach(t => texts.push(t)); texts.push('This word keeps hiding. A memory trick can help you hold on to it.'); wk.words.forEach(x => { if (x.mnem) texts.push('This word keeps hiding. A memory trick can help you hold on to it. ' + x.mnem); }); texts.push(PICKED_RIGHT, CLUE, ANSWER_MSG, 'Have another go.', SPELL_INTRO, SURE_MSG, HELP_Q, HELP_MENU); wk.words.forEach(x => texts.push(ANSWER_MSG + ' ' + x.w));
  return texts;
}
// Runs the queue of words. A missed word comes back later in the same run. Returns the first-go results, or null if she went back to the start.
async function runWords(wk, queue, starred) {
  testMode = true;
  try { return await runWordsInner(wk, queue, starred); } finally { testMode = false; }
}
async function runWordsInner(wk, queue, starred) {
  const N = wk.words.length, firsts = {};
  let i = 0;
  while (i < queue.length) {
    const it = queue[i];
    if (it.counts && firsts[it.x.w]) { for (let k = queue.length - 1; k > i; k--) if (queue[k].x.w === it.x.w && !queue[k].counts) queue.splice(k, 1); }
    prog = `Word ${Math.min(i + 1, N)} of ${N}`;
    const r = await reviseWord(wk, it, storySentence(wk, it.x.w), starred);
    if (r === BACK) { if (i === 0) return null; i--; continue; }
    if (it.counts) { firsts[it.x.w] = r; if (!r.good) queue.splice(Math.min(i + 3, queue.length), 0, { x: it.x, look: false, counts: false, mode: it.mode, context: it.mode === 'revise' }); }
    i++;
  }
  return firsts;
}
async function finishSitting(wk, firsts, sound, kind) {
  prog = '';
  S.due = S.due || {}; S.due[wk.id] = wk.words.filter(x => firsts[x.w] && !firsts[x.w].ok).map(x => x.w); // missed words come back next sitting
  if (sound) { S.sittings = S.sittings || []; S.sittings.push({ t: Date.now(), d: today(), wk: wk.id, kind, score: wk.words.filter(x => firsts[x.w] && firsts[x.w].good).length, of: wk.words.length }); }
  save();
  await reviseEnd(wk, firsts, sound);
  await ceiling();
  home();
}
async function revise() {
  const wk = curWeek(), sound = true;
  const met = w => S.log.some(l => l.wk === wk.id && l.w === w);
  const due = (S.due && S.due[wk.id]) || [];
  const queue = shuffle(wk.words.slice()).sort((p, q) => (due.includes(q.w) ? 1 : 0) - (due.includes(p.w) ? 1 : 0)).map(x => ({ x, look: false, counts: true, mode: 'revise', context: true })); // the same flow as the story: the sentence, then she spells it. The word is never shown first.
  ensureTools(wk);
  await prep(spellTexts(wk), 'Getting the words ready');
  const firsts = await runWords(wk, queue, new Set());
  if (!firsts) return home();
  await finishSitting(wk, firsts, sound, 'revision');
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
// The BellaSpeller logo: a pink script wordmark with a white outline, a swoosh, and sparkling stars around it.
const SPARK = 'M0 -1 C0 -.25 .25 0 1 0 C.25 0 0 .25 0 1 C0 .25 -.25 0 -1 0 C-.25 0 0 -.25 0 -1Z';
function logoSvg(cls) {
  const sp = [[40, 52, 17, '#ffe27a', 0], [488, 40, 21, '#fff', 1], [470, 178, 13, '#ffe27a', 2], [26, 168, 11, '#fff', 3], [255, 12, 12, '#ffd1ea', 1.5], [340, 205, 10, '#fff', 2.5], [118, 12, 9, '#fff', .5]];
  return `<svg class="logo ${cls || ''}" viewBox="0 0 520 230" role="img" aria-label="BellaSpeller">
    <defs><linearGradient id="lgPink" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb6df"/><stop offset=".55" stop-color="#ff5fb0"/><stop offset="1" stop-color="#e0197f"/></linearGradient>
    <linearGradient id="lgSwoosh" x1="0" x2="1"><stop offset="0" stop-color="#ffe27a" stop-opacity="0"/><stop offset=".5" stop-color="#ffe27a"/><stop offset="1" stop-color="#ffe27a" stop-opacity="0"/></linearGradient>
    <filter id="lgGlow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="5" stdDeviation="3" flood-color="#8e1648" flood-opacity=".6"/></filter></defs>
    <g filter="url(#lgGlow)" font-family="Pacifico, 'Segoe Script', 'Brush Script MT', cursive" text-anchor="middle" paint-order="stroke" stroke-linejoin="round">
      <text x="236" y="108" font-size="112" fill="url(#lgPink)" stroke="#fff" stroke-width="9" transform="rotate(-4 236 108)">Bella</text>
      <text x="282" y="190" font-size="88" fill="url(#lgPink)" stroke="#fff" stroke-width="8" transform="rotate(-4 282 190)">Speller</text>
    </g>
    <path d="M70 206 C170 224 330 224 450 200" fill="none" stroke="url(#lgSwoosh)" stroke-width="5" stroke-linecap="round"/>
    ${sp.map(([x, y, r, c, d]) => `<path class="lgspark" style="animation-delay:${d}s" d="${SPARK}" transform="translate(${x} ${y}) scale(${r})" fill="${c}"/>`).join('')}
  </svg>`;
}
function home() {
  testMode = false; // leaving a test by any route
  if (pendingReload) { pendingReload = false; location.reload(); return; }
  prog = '';
  const wk = curWeek(), ep = epOf(wk);
  const stNow = S.story[wk.id];
  const sub = 'The words inside a story';
  const storyBtn = `<button id="story" class="tile t-story"><span class="ticon">${ico('book')}</span><div class="tt"><b>${S.name ? esc(S.name) + "'s story" : "My story"}</b><small>${esc(sub)}</small></div></button>`;
  h(`<div class="top homebar"><span class="homelogo">${logoSvg()}</span><div class="hello one"><h1>Hello${S.name ? ' ' + esc(S.name) : ''}!</h1><p>What shall we do today?</p></div>${sndBtn}</div>
    <div class="screen">
    <div class="tiles">${storyBtn}
    <button id="quick" class="tile t-quick"><span class="ticon">${ico('bolt')}</span><div class="tt"><b>${S.name ? esc(S.name) + "'s practice" : "My practice"}</b><small>Just the words</small></div></button>
    <button id="remember" class="tile t-rem"><span class="ticon">${ico('bulb')}</span><div class="tt"><b>${S.name ? esc(S.name) + "'s revision" : "My revision"}</b><small>Mnemonics and spelling tips</small></div></button>
    <button id="grown" class="tile t-grown"><span class="ticon">${ico('users')}</span><div class="tt"><b>Grown-ups</b><small>Words, progress and settings</small></div></button></div></div>`, { noTop: true });
  on('#story', storyDay); on('#quick', revise); on('#remember', remember); on('#grown', adultGate);
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
function owned() {
  const days = {};
  S.log.forEach(l => { if (l.ok && !l.hints && !l.redo) (days[l.w] = days[l.w] || new Set()).add(l.d); });
  return Object.keys(days).filter(w => days[w].size >= 2);
}
// ---------- The record: one row per week, and a week-by-week graph ----------
let recView = 'table';
function weekRecord(w, i) {
  const logs = S.log.filter(l => l.wk === w.id), sits = (S.sittings || []).filter(x => x.wk === w.id);
  const best = sits.length ? sits.reduce((a, x) => (x.score / (x.of || 1) > a.score / (a.of || 1) ? x : a), sits[0]) : null;
  const aids = logs.filter(l => l.aided || l.hints > 0 || (l.tools && l.tools.length)).length;
  const days = new Set(logs.map(l => l.d).concat(sits.map(x => x.d))), first = [...days].sort()[0] || '';
  const mn = w.words.filter(x => x.mnemonic).length;
  const pct = (a, b) => (b ? Math.round(100 * a / b) : null);
  return { n: i + 1, w, sits, best, aids, days: days.size, first, mn, app: best ? pct(best.score, best.of) : null, sch: w.score == null ? null : pct(w.score, w.words.length) };
}
// The record as plain rows, for a spreadsheet. Same figures as the table on screen.
function recordRows() {
  const head = ['Week', 'Label', 'First used', 'Test words', 'Best right first time', 'Out of', 'Sittings', 'Days used', 'Times a spelling aid was used', 'Words with mnemonics', 'School score', 'Out of'];
  const rows = S.weeks.map(weekRecord).map(r => [r.n, r.w.label, r.first, r.w.words.map(x => x.w).join(' '), r.best ? r.best.score : '', r.best ? r.best.of : '', r.sits.length, r.days, r.aids, r.mn, r.w.score == null ? '' : r.w.score, r.w.words.length]);
  return [head].concat(rows);
}
function saveCsv(rows, base) {
  const q = v => '"' + String(v).replace(/"/g, '""') + '"';
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + rows.map(r => r.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  a.download = base + '-' + today() + '.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
// The Details page as rows: this week word by word, then every sitting.
function detailRows() {
  const wk = curWeek(), own = owned(), rows = [['Word by word: ' + wk.label], ['Word', 'Tries', 'Right first time', 'Hints', 'What she typed when wrong', 'Owned']];
  wk.words.forEach(x => { const logs = S.log.filter(l => l.wk === wk.id && l.w === x.w && !l.redo); rows.push([x.w, logs.length, logs.filter(l => l.ok && !l.hints).length, logs.reduce((a, l) => a + (l.hints || 0), 0), logs.filter(l => !l.ok).map(l => l.typed).join(' / '), own.includes(x.w) ? 'yes' : '']); });
  rows.push([], ['Sittings'], ['Week', 'Day', 'Right first time', 'Out of', 'After']);
  (S.sittings || []).forEach(x => { const i = S.weeks.findIndex(w => w.id === x.wk); rows.push([i < 0 ? '' : i + 1, x.d, x.score, x.of, x.kind === 'story' ? 'the story' : 'revision']); });
  return rows;
}
function downloadRecord(kind) {
  const rows = recordRows(); let blob, name = 'bellaspeller-record-' + today();
  if (kind === 'csv') {
    const q = v => '"' + String(v).replace(/"/g, '""') + '"';
    blob = new Blob(['\ufeff' + rows.map(r => r.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }); name += '.csv';
  } else {
    const t = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="1">' + rows.map((r, i) => '<tr>' + r.map(v => (i ? '<td>' : '<th>') + esc(String(v)) + (i ? '</td>' : '</th>')).join('') + '</tr>').join('') + '</table></body></html>';
    blob = new Blob([t], { type: 'application/vnd.ms-excel' }); name += '.xls';
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
// Wipes the history so the real weeks can start clean. The words of the week in use are kept so the app always has a week; the grown-up replaces them next.
function backupNow() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(Object.assign({}, S, { orKey: undefined, aiKey: undefined }), null, 1)], { type: 'application/json' }));
  a.download = 'bellaspeller-backup-' + today() + '.json'; document.body.appendChild(a); a.click(); a.remove();
}
function startAgainDialog() {
  const { ov, close } = qrOverlay('Start the record again', `<p><b>Are you sure?</b> This clears every sitting, every answer, all the stars and every school score, and removes all weeks except the one now in use. It cannot be undone.</p>
    <p class="note">It is a good idea to save a backup file first. If you change your mind, the backup can be loaded again from Settings.</p>
    <div class="row" style="justify-content:flex-start"><button class="btn small" id="sa-bk">Save a backup file first</button></div>
    <p class="note" id="sa-msg"></p>
    <div class="row" style="justify-content:flex-start"><button class="btn small" id="sa-no">No, keep everything</button><button class="btn small" id="sa-yes" style="border-color:#b3261e;color:#b3261e">Yes, clear it all</button></div>`);
  ov.querySelector('#sa-bk').onclick = () => { backupNow(); ov.querySelector('#sa-msg').textContent = 'Backup saved to this device\'s Downloads folder.'; };
  ov.querySelector('#sa-no').onclick = close;
  ov.querySelector('#sa-yes').onclick = () => {
    const wk = curWeek();
    S.weeks = [wk]; S.cur = wk.id; wk.score = null; wk.ep = null;
    S.log = []; S.sittings = []; S.due = {}; S.story = {}; S.stars = 0; save(); close();
    adultTab = 'words'; adultFlash = 'The record is cleared. Next: put in the real words for this week below, add them as a new week, then use "Remove this week" on the old one.'; adult();
  };
}
function recordPane() {
  const recs = S.weeks.map(weekRecord);
  const sw = `<div class="row" style="justify-content:flex-start"><button class="btn small recv${recView === 'table' ? ' on' : ''}" data-v="table">Week by week</button><button class="btn small recv${recView === 'graph' ? ' on' : ''}" data-v="graph">Graph</button><button class="btn small" id="recCsv">Save as CSV</button><button class="btn small" id="recXls">Save as Excel</button></div><div class="row" style="justify-content:flex-start;margin-top:18px"><button class="btn small" id="recReset">Start again from scratch…</button><button class="btn small" id="restore2">Load a backup file</button></div><p class="note">If you clear by mistake, "Load a backup file" puts back everything from a backup you saved earlier.</p><p class="note">The saved file has one row per week with every figure, ready to open in Excel or Google Sheets.</p>`;
  if (recView === 'graph') {
    const pts = recs.filter(r => r.app != null || r.sch != null);
    if (!pts.length) return sw + '<p class="note">Nothing to draw yet. The graph fills in as Bella finishes sittings and you enter the school scores.</p>';
    const W = 640, H = 300, L = 46, R = 16, T = 18, B = 40, pw = W - L - R, ph = H - T - B;
    const x = k => L + (pts.length === 1 ? pw / 2 : pw * k / (pts.length - 1)), y = v => T + ph * (1 - v / 100);
    const line = (key, col) => {
      let d = '', pen = false, dots = '';
      pts.forEach((r, k) => { const v = r[key]; if (v == null) { pen = false; return; } d += (pen ? 'L' : 'M') + x(k).toFixed(1) + ' ' + y(v).toFixed(1) + ' '; pen = true; dots += `<circle cx="${x(k).toFixed(1)}" cy="${y(v).toFixed(1)}" r="5" fill="${col}"/><text x="${x(k).toFixed(1)}" y="${(y(v) - 10).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="700" fill="${col}">${v}</text>`; });
      return `<path d="${d}" fill="none" stroke="${col}" stroke-width="3"/>${dots}`;
    };
    const grid = [0, 25, 50, 75, 100].map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#d8d2ee"/><text x="${L - 8}" y="${y(v) + 5}" text-anchor="end" font-size="13" fill="#4a4270">${v}%</text>`).join('');
    const xl = pts.map((r, k) => `<text x="${x(k).toFixed(1)}" y="${H - 14}" text-anchor="middle" font-size="14" font-weight="700" fill="#2a1f4d">Wk ${r.n}</text>`).join('');
    return sw + `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:760px;height:auto;background:#fff;border-radius:14px;margin-top:10px" role="img" aria-label="Scores week by week">${grid}${xl}${line('sch', '#d98200')}${line('app', '#5b3fc4')}</svg>
      <p class="note"><b style="color:#5b3fc4">Purple</b>: Bella's best sitting in the app (right first time, no help). <b style="color:#d98200">Orange</b>: the school score. Both are shown as a percentage of that week's words.</p>`;
  }
  const rows = recs.map(r => `<tr><td><b>Week ${r.n}</b><br><span class="note">${esc(r.w.label)}${r.w.id === S.cur ? ' (current)' : ''}${r.first ? '<br>from ' + esc(r.first) : ''}</span></td>
    <td>${esc(r.w.words.map(x => x.w).join(', '))}</td>
    <td>${r.sits.length ? 'Best ' + r.best.score + ' of ' + r.best.of + '<br><span class="note">' + r.sits.length + (r.sits.length === 1 ? ' sitting' : ' sittings') + ', ' + r.days + (r.days === 1 ? ' day' : ' days') + '</span>' : (r.days ? 'no full sitting' : '')}</td>
    <td>${r.aids}</td><td>${r.mn ? 'Yes, ' + r.mn + ' of ' + r.w.words.length : 'No'}</td>
    <td style="white-space:nowrap"><input class="rsc" data-w="${esc(r.w.id)}" type="number" inputmode="numeric" min="0" max="${r.w.words.length}" value="${r.w.score == null ? '' : r.w.score}" placeholder="score" aria-label="School score for week ${r.n}" style="width:76px;padding:6px 8px;font-size:16px"> of ${r.w.words.length}</td></tr>`).join('');
  return sw + `<table><tr><th>Week</th><th>Bella's test words</th><th>Right first time in the app</th><th>Times a spelling aid was used</th><th>Mnemonics made</th><th>School score</th></tr>${rows}</table>
    <p class="note">"Right first time" counts a word only when she wrote it right first go, without a hint or other help. Weeks are numbered in the order they were added. Type or change a school score in its box at any time: it is saved as soon as you leave the box.</p>`;
}
// The Help tab: five headings, each closed until tapped.
function helpPane() {
  const sec = (t, body, cls) => `<details class="hsec${cls ? ' ' + cls : ''}"><summary>${t}</summary>${body}</details>`;
  const sub = (t, body) => sec(t, body, 'sub');
  return `<h2>Help</h2>
  <p class="note">Tap a heading to open it. This is version ${esc(APP_VERSION)}.</p>

  ${sec('1. How the app works', `
    ${sub('The four boxes on her home screen', `
      <p><b>Her story.</b> She chooses a story idea, or tells her own, and the app writes a short story for her to read (it can read it aloud). The week's words are highlighted in yellow inside it. Afterwards the app says each word in its sentence and she spells it. This needs the AI key and an internet connection.</p>
      <p><b>Her practice.</b> The same spelling without a story. The word is never shown: she hears it in its sentence and writes it.</p>
      <p><b>Her revision.</b> Mnemonics (she builds a silly sentence, with an arrow from each letter) or Spelling tips (a short tip for each word, which she can read or hear).</p>
      <p><b>Grown-ups.</b> This area. Her name appears on the boxes once it is saved under Settings.</p>`)}
    ${sub('Spelling a word', `
      <p>She hears the word in its sentence, then writes it on the keyboard or by hand with a finger or pen. The choice is remembered on that device. Right first time earns a star and praise. If it is wrong, she is asked whether she would like some help or another go.</p>
      <p>After three wrong goes in practice or revision, the app says the word is still hiding and brings it back in a later sitting rather than showing it. In her story, after three wrong goes it shows her the word once and she writes it from memory. <b>Hear it again</b> repeats the word.</p>`)}
    ${sub('The spelling helps', `
      <p>Each use is recorded, and a word where she used a help does not count as right first time.</p>
      <p><b>A spelling tip.</b> Says the word, then its spelling tip (or a spelling pattern if it has no tip). Greyed out for a word with neither.</p>
      <p><b>A hint.</b> Says how many letters the word has and where her go went wrong. It never gives the letter away.</p>
      <p><b>I will tell you if a letter doesn't look right.</b> A nudge once per word. It never says which letter. Not available when she writes by hand.</p>
      <p><b>Multiple choice.</b> She picks the right spelling from several, then goes back and spells it herself.</p>`)}
    ${sub('Writing by hand', `
      <p>The button under the word switches between <b>Write it by hand</b> and <b>Use the keyboard</b>. The app reads what she wrote and shows it as "I read: ..." above the box, so she can see what it understood. Reading uses the AI when the device has the key, and the device's own reader otherwise (which not every device has).</p>`)}
    ${sub('Mnemonics and spelling tips', `
      <p>A <b>mnemonic</b> is a silly sentence whose words start with the letters of the word in order, such as <i>Big Elephants Can Always Understand Small Elephants</i> for because. Bella builds them herself and they are saved.</p>
      <p>A <b>spelling tip</b> is a short note about the tricky part of a word. Some are built in and the AI can look up missing ones. Spoken tips use letter names. You can edit them under This Week's Spelling Tips.</p>`)}`)}

  ${sec('2. What grown-ups do', `
    <ol>
      <li><b>Each week, add the new words.</b> Under <b>This week</b>, add the week's list (one per line, or separated by commas). Use <b>Remove this week</b> on an old week only if you no longer want it in the record.</li>
      <li><b>Look over the spelling tips.</b> Under <b>This Week's Spelling Tips</b>, check the tip for each word and change any that are wrong. Empty boxes can be filled by the AI.</li>
      <li><b>Put Bella's name in</b> under Settings, so the boxes say "Bella's story" and so on.</li>
      <li><b>Encourage short, regular sittings</b> rather than one long one. The app records the day of every sitting.</li>
      <li><b>When the school test result arrives, enter it</b> on the Progress tab. It can be entered late, even after you have moved on to the next week.</li>
      <li><b>If another device needs the week's words</b>, show them as a QR code under Settings and scan it on the other device.</li>
    </ol>`)}

  ${sec('3. How to track Bella\'s progress', `
    ${sub('The Progress tab', `
      <p>One row for each week, with: the week number and date first used, the test words, her best sitting in the app (for example "Best 7 of 10"), how many sittings and days it took, how many times a spelling help was used, whether mnemonics were made, and the school score.</p>
      <p>The school score is a box you can type in. It is saved when you leave the box. Press <b>Graph</b> for a week-by-week chart: purple is her best sitting in the app and orange is the school score, both as a percentage of that week's words, so weeks with different numbers of words can be compared.</p>
      <p><b>Save as CSV</b> and <b>Save as Excel</b> save the same table as a file you can keep, sort or chart yourself.</p>`)}
    ${sub('What the figures mean', `
      <p><b>Right first time:</b> she wrote the word correctly on her first go, with no hint or other help. The app's score for a sitting is the number of words she got right first time.</p>
      <p><b>A sitting:</b> one run through the week's words. Words she gets wrong come back in a later sitting.</p>
      <p><b>Times a spelling help was used:</b> every time she used a hint, rule, nudge or multiple choice. One tricky word can count several times.</p>
      <p><b>Mnemonics made:</b> whether she built mnemonics for that week, and for how many words. It does not record how often she looks at them afterwards.</p>`)}
    ${sub('The Details tab', `
      <p>For the current week: for each word, how many tries, how many right first time, how many hints, and what she typed when it was wrong. Below that, every sitting with its day and score. A word counts as <b>owned</b> once she has it right first time, without help, on two different days.</p>
      <p>Looking at what she typed when wrong shows which words she confuses and how.</p>`)}
    ${sub('Starting again, or undoing it', `
      <p><b>Start again from scratch</b> (on the Progress and Details tabs) clears every answer, star, sitting and school score and removes all weeks except the one in use. It offers to save a backup first. <b>Load a backup file</b> next to it puts everything back from that backup.</p>`)}`)}

  ${sec('4. Updating the app, and what to do if it stops working', `
    ${sub('Updating', `
      <p>When a new version is ready, a pink <b>Update</b> button appears on the home screen. Tap it. On a larger screen the version number at the bottom left also works as an update button. If it does not seem to update, open the app's web address with <b>?u=</b> and the new version number on the end, for example the usual address followed by ?u=3.114.</p>
      <p>The address is case-sensitive: the part after the slash starts with a capital B and a capital S.</p>`)}
    ${sub('If it freezes or a screen is blank', `
      <p>Press <b>Home</b> or <b>Back</b> at the top if you can. If not, close the page or app and open it again. Her answers and settings are saved on the device as she goes, so nothing is lost.</p>`)}
    ${sub('If the voice is silent or says a word wrongly', `
      <p>Check the device volume and that the sound button on the home screen says <b>Voice on</b>. On a spelling screen, press <b>Hear it again</b>. If the app's voice does not start within a few seconds, the device's own voice takes over. The voice can mispronounce unusual words, especially names. A different voice can be chosen under Settings.</p>`)}
    ${sub('If stories will not write, or her handwriting is not read', `
      <p>Both need the AI key on that device and an internet connection. Check the connection, and that the key is saved under Settings. A key can be moved to another device by QR code. If the AI reading is wrong, she can clear the box and write the word again.</p>`)}
    ${sub('If a screen looks wrong on a small tablet', `
      <p>The app resizes itself to the screen, but a very small tablet is the least tested. Installing it as an app (browser menu, then Add to Home screen) gives more room, because the browser bars disappear.</p>`)}
    ${sub('If the record was cleared by mistake', `
      <p>Use <b>Load a backup file</b> on the Progress tab, if a backup was saved first.</p>`)}`)}

  ${sec('5. How the app is built, and how to keep it going', `
    ${sub('The structure in plain words', `
      <p>BellaSpeller is a <b>web app</b>: a set of ordinary files (a page, a program called app.js, a style sheet, a few libraries and fonts) that run entirely in the browser on Bella's device. There is no database or server of its own. It is published on <b>GitHub Pages</b>, which simply hands the files to any device that asks, at the address you use to open it. It can be installed on a tablet's home screen like an app, and once loaded it keeps a copy of itself on the device so it starts quickly.</p>
      <p>Everything Bella does, her words, answers, stars, mnemonics, tips and your school scores, is saved <b>on that device only</b>. There is no sync between devices. Moving data between devices is done with the backup file or the QR codes under Settings.</p>
      <p>Because data belongs to the address the app is opened from, a copy of the app at a different web address starts empty.</p>`)}
    ${sub('The AI back end: OpenRouter', `
      <p>The parts that need artificial intelligence do not run on the device. The app sends a request over the internet to a service called <b>OpenRouter</b>, which passes it to an AI model and returns the answer. It is used to write stories, to build and look up spelling tips and mnemonics, to read handwriting (a picture of what she wrote is sent for reading), and, if a recorded voice is chosen, to produce spoken audio. The spelling practice itself, the scoring and the progress record do not need it, and the device's own voice is used when no recorded voice is set.</p>
      <p>OpenRouter needs an <b>API key</b>, a long private code tied to an OpenRouter account. The key is typed or scanned into Settings on each device and stays on that device. It is left out of backup files, so it never travels with them. Keep it private: anyone who has it can spend the account's credit. Each device that uses the AI needs its own copy of the key, so after changing to a new tablet or computer the key must be moved across (scan the key QR code from a device that already has it, or paste it in under Settings).</p>`)}
    ${sub('What it costs', `
      <p>Using OpenRouter costs money as it is used, but at the level of one child's weekly practice the cost is low. When it was checked in November 2026, the whole account's spend for the month was a few dollars, including all the building and testing of the app. Stories and handwriting reading are the main uses, each costing a small fraction of a penny. Credit is bought in advance on the OpenRouter website. It is sensible to set a spending limit on the key there, so a lost or misused key cannot cost much.</p>
      <p>Hosting on GitHub Pages is free.</p>`)}
    ${sub('Releasing a change', `
      <p>The files live in a code repository on GitHub. Pushing a change to its main branch publishes it within about a minute. Every release must change two things so devices notice it: the version number <b>APP_VER</b> near the top of app.js, and the cache name near the top of sw.js (the file that keeps the device's offline copy). If either is left alone, some devices will keep showing the old version.</p>`)}
    ${sub('Moving the app to a new owner, or making your own copy', `
      <ol>
        <li><b>Get the files.</b> Take the whole app folder (index.html, app.js, style.css, episodes.js, sw.js, manifest.json, the icons, the fonts folder, qrgen.js, jsqr.js). The easiest way is the code repository itself, which can have its ownership transferred on GitHub (Settings, then Transfer) or be copied to a new repository. The project folder with the handover and design notes should be kept with it.</li>
        <li><b>Publish it.</b> Make a new repository, put the files in it, and turn on GitHub Pages (Settings, Pages, deploy from the main branch). Any other host that serves plain files over a secure (https) address works too, for example Netlify or Cloudflare Pages. A secure address is needed for the camera, installing and the offline copy.</li>
        <li><b>Make a new OpenRouter account</b> (or use the existing one), add credit, create a key, and put it in Settings on each device. Set a spending limit on the key.</li>
        <li><b>Move each device.</b> The new web address starts empty. Before leaving the old address, on each device use <b>Save a backup file</b> (Settings). Then open the new address and use <b>Load a backup file</b>. Then add the key.</li>
        <li><b>Make changes with care.</b> The app is written to be edited by an AI coding assistant such as Claude Code working in the folder. Keep the handover notes up to date, test on the real tablet, and follow the release rule above.</li>
      </ol>`)}`)}`;
}
// ---------- Bug reports and change requests, kept on the device for whoever maintains the app ----------
function requestsText(openOnly) {
  const list = (S.reqs || []).filter(q => !openOnly || !q.done);
  const block = (kind, head) => {
    const rows = list.filter(q => q.kind === kind);
    return head + '\n' + (rows.length ? rows.map((q, i) => (i + 1) + '. [' + (q.done ? 'done' : 'open') + '] ' + q.d + ', v' + q.ver + ', screen ' + q.scr + (q.wk ? ', ' + q.wk : '') + '\n   ' + q.text.replace(/\n/g, '\n   ')).join('\n') : '   none') + '\n';
  };
  return 'BellaSpeller v' + APP_VER + ', ' + today() + '\n\n' + block('bug', 'BUG REPORTS') + '\n' + block('change', 'CHANGE REQUESTS');
}
function requestsPane() {
  const all = S.reqs || [];
  const panel = (kind, title, hint, ph) => {
    const rows = all.filter(q => q.kind === kind);
    return `<div class="reqpanel"><h3>${title}</h3><p class="note">${hint}</p>
      <textarea class="reqbox" id="rq-${kind}" rows="4" placeholder="${ph}"></textarea>
      <div><button class="btn small reqadd" data-k="${kind}">Add</button></div>
      ${rows.length ? rows.slice().reverse().map(q => `<div class="reqitem${q.done ? ' done' : ''}"><div class="reqmeta">${esc(q.d)} · v${esc(q.ver)} · screen ${esc(q.scr)}${q.wk ? ' · ' + esc(q.wk) : ''}</div><div class="reqtext">${esc(q.text)}</div>
        <div><button class="btn small reqdone" data-id="${q.id}">${q.done ? 'Mark as open' : 'Mark as done'}</button><button class="btn small reqdel" data-id="${q.id}">Delete</button></div></div>`).join('') : '<p class="note">Nothing here yet.</p>'}
    </div>`;
  };
  return `<h2>Bug reports and change requests</h2>
    <p class="note">Anyone can note a problem or an idea here. Each note is saved on this device with the date, the app version and the screen size, which helps with finding the cause. To pass them on, use <b>Copy the open ones</b> or <b>Save as a text file</b> below and send the text to whoever looks after the app.</p>
    <div class="reqgrid">${panel('bug', 'Bug reports', 'Something that went wrong or did not work as expected. Say which screen it was on and what happened.', 'What went wrong?')}${panel('change', 'Change requests', 'Something you would like the app to do differently or something new.', 'What would you like changed or added?')}</div>
    <div class="row" style="justify-content:flex-start"><button class="btn small" id="reqCopy">Copy the open ones</button><button class="btn small" id="reqSave">Save as a text file</button></div>
    <p class="note" id="reqMsg"></p>`;
}
let adultTab = 'words', adultFlash = '';
const ADULT_TABS = [['words', 'This week'], ['tools', "This Week's Spelling Tips"], ['record', 'Progress'], ['progress', 'Details'], ['settings', 'Settings'], ['requests', 'Bugs and changes'], ['help', 'Help']];
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
    <div class="tabs">${ADULT_TABS.map(t => `<button class="tab${t[0] === adultTab ? ' on' : ''}" data-t="${t[0]}">${t[1]}</button>`).join('')}</div>
    ${adultFlash ? `<p class="flash">${esc(adultFlash)}</p>` : ''}
    <div class="tabpane" data-tab="words"><h2>This week</h2>
    <label>Week in use</label><select id="cur">${S.weeks.map(w => `<option value="${w.id}" ${w.id === wk.id ? 'selected' : ''}>${esc(w.label)}</option>`).join('')}</select>
    <div><button id="delWeek" class="btn small">Remove this week</button></div>

    <h2>Words for this week (${wk.words.length})</h2>
    <p class="note">Tick the red words from the school list.</p>
    ${wk.words.map((x, i) => `<div class="wl"><input type="checkbox" class="redtick" data-i="${i}" ${x.red ? 'checked' : ''}><b>${esc(x.w)}</b>${x.say ? ' <span class="note">' + esc(x.say) + '</span>' : ''}</div>`).join('')}
    <div style="margin-top:10px"><button id="chWords" class="btn small">Change the words</button></div>
    <div id="chBox" hidden>
      <label>Type or paste the words, separated by spaces, commas or new lines. To change, add or remove words, edit the list.</label>
      <textarea id="cw" spellcheck="false">${esc(wk.words.map(x => x.w + (x.say ? ' | ' + x.say : '')).join('\n'))}</textarea>
      <p class="note">${epOf(wk) ? 'The story for this week was written for the old words, so it will be removed. Her stars and past answers are kept.' : ''}</p>
      <button id="saveWords" class="btn">Save the new words</button>
    </div>

    <h2>Add a new week</h2>
    <label>Day of the spelling test</label><input id="nl" type="date" value="${new Date(Date.now() + 4 * 864e5).toISOString().slice(0, 10)}" style="max-width:220px">
    <label>The spelling rule, as printed on the sheet (optional)</label><input id="nr" type="text">
    <label>Paste the words here, separated by spaces, commas or new lines</label><textarea id="nw" spellcheck="false"></textarea>
    <p class="note">To add a spelling voice for a tricky word, write it after a bar, like this: every | ev-er-y</p>
    <button id="read" class="btn">Add these words</button>
    <div id="preview"></div>

    <h2>School test score</h2>
    <p class="note">Enter this at the end of the week, when the marked test is back.</p>
    <label>Score for ${esc(wk.label)}, out of ${wk.words.length}</label><input id="score" type="number" min="0" max="${wk.words.length}" value="${wk.score == null ? '' : wk.score}" style="max-width:120px">
    <div><button id="saveScore" class="btn">Save score</button></div>
    </div><div class="tabpane" data-tab="progress"><h2>Progress</h2>
    <p>Words she owns (right first time, without a hint, on two different days): <b>${own.length}</b>.</p>
    <table><tr><th>Week</th><th>School score</th><th>Days used</th><th>Right first time, no hint</th><th>Story</th></tr>${rows}</table>
    <h2>Revision sittings</h2>
    ${(S.sittings || []).filter(x => x.wk === wk.id).length ? `<table><tr><th>Day</th><th>Right first time</th><th>After</th></tr>${(S.sittings || []).filter(x => x.wk === wk.id).map(x => `<tr><td>${esc(x.d)}</td><td>${x.score} out of ${x.of}</td><td>${x.kind === 'story' ? 'the story' : 'revision'}</td></tr>`).join('')}</table>` : '<p class="note">None yet. The score counts a word only when she writes it right first time, without Remind me or Next letter.</p>'}
    <h2>This week, word by word</h2>
    <table><tr><th>Word</th><th>Tries</th><th>Right first time</th><th>Hints</th><th>What she typed when wrong</th><th>Owned</th></tr>${wordRows}</table>
    <div class="row" style="justify-content:flex-start;margin-top:18px"><button class="btn small" id="detCsv">Save as CSV</button><button class="btn small" id="recReset2">Start again from scratch…</button><button class="btn small" id="restore3">Load a backup file</button></div>

    </div><div class="tabpane" data-tab="record"><h2>Progress, week by week</h2>${recordPane()}</div><div class="tabpane" data-tab="requests">${requestsPane()}</div><div class="tabpane" data-tab="help">${helpPane()}</div><div class="tabpane" data-tab="tools">${toolsPane(wk)}</div><div class="tabpane" data-tab="settings"><h2>Settings</h2>
    <label>Her first name (saved as soon as you leave the box; it appears on the home screen)</label><input id="name" type="text" value="${esc(S.name)}" maxlength="14">
    <label>Voice that reads aloud (try each one)</label><select id="vsel"><option value="">Automatic</option>${('speechSynthesis' in window ? speechSynthesis.getVoices() : []).filter(x => /^en/i.test(x.lang)).map(x => `<option value="${esc(x.name)}" ${S.voiceName === x.name ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
    <p class="note">This is the device's own free voice. It is used when no recorded voice is chosen, while a recorded phrase is not ready yet, and for any line that contains her name.</p>
    <label>Recorded voice (uses the OpenRouter key below; saved on this device after first use)</label><select id="psel"><option value="">None: use this device's voice</option>${PRESETS.map(p => `<option value="${p.id}" ${effVp() === p.id ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}</select>
    <div><button id="psample" class="btn small">Hear a sample</button> <button id="pready" class="btn small">Get this week's words ready</button></div>
    <p id="pstat" class="note">${esc(lastTtsErr)}</p>
    <label>OpenRouter key, for writing stories (stays on this device, and is left out of backups)</label><input id="orKey" type="password" autocomplete="off" value="${esc(S.orKey || '')}">
    <div class="row"><button id="qrShow" class="btn small">Show the key as a QR code</button><button id="qrWeek" class="btn small">Show this week's words as a QR code</button><button id="qrScan" class="btn small">Scan a QR code</button></div>
    <p class="note">To set up Bella's tablet: show a QR code here (the key, then this week's words), and on the tablet press Scan a QR code and point it at this screen each time.</p>
    <label>Family rules for the stories (added to every story request)</label><textarea id="famRules" style="min-height:110px">${esc(S.familyRules === undefined ? DEFAULT_FAMILY_RULES : S.familyRules)}</textarea>
    <label>AI model for writing stories</label>${modelSelect('orModel')}
    <label>Or type another model name (optional)</label><input id="orModelOther" type="text" autocomplete="off" placeholder="for example openai/gpt-6.1-sol">
    <label>Story AI address (leave blank for OpenRouter; any OpenAI-style service works, for example Z.ai)</label><input id="aiBase" type="text" autocomplete="off" placeholder="https://openrouter.ai/api/v1" value="${esc(S.aiBase || '')}">
    <label>Story AI key (leave blank to use the OpenRouter key)</label><input id="aiKey" type="password" autocomplete="off" value="${esc(S.aiKey || '')}">
    <div><button id="saveName" class="btn">Save settings</button> <button id="backup" class="btn small">Save a backup file</button> <button id="restore" class="btn small">Load a backup file</button><input id="restoreFile" type="file" accept=".json,application/json" hidden></div>
    <p class="note">To move everything to another device (told stories, words, settings, her answers): save a backup file here, send it to the other device (email or Google Drive), then press Load a backup file there. This device keeps its own OpenRouter key.</p>
    <details class="adv"><summary>Testing (not needed day to day)</summary>
    ${aiKey() ? `<h2>Compare models</h2><p class="note">Writes this week's story with each model so you can choose on evidence. One attempt each, so the results show how often each gets it right first time.</p>
    <input id="cm1" type="text" value="anthropic/claude-sonnet-5.5"><input id="cm2" type="text" value="openai/gpt-6.1-sol" style="margin-top:8px"><input id="cm3" type="text" value="google/gemini-4-hydrogen" style="margin-top:8px">
    <button id="compare" class="btn">Write with all three</button><div id="cmpOut"></div>` : ''}

    <h2>Handwriting test</h2><p class="note">A test of reading handwriting from a pen. Type the word you are going to write, write it below with the pen, and press Read it. To see whether the AI "corrects" mistakes, write a word with a deliberate misspelling and type it exactly as you wrote it. Nothing here is saved except the results list below.</p>
    <label>When she writes with the pen on the spelling screen, read it with</label><select id="hwEngine"><option value="auto">Automatic (the AI if there is a key, otherwise the device)</option><option value="vision">The AI vision model</option><option value="builtin">The device's own recognizer</option></select>
    <label>The word you will write, exactly as you write it</label><input id="hwWord" type="text" autocomplete="off" spellcheck="false" placeholder="for example because">
    <label>How to read it</label><select id="hwMode"><option value="word">The whole word at once (AI vision)</option><option value="boxes">One letter per box (AI vision)</option><option value="builtin">The device's own recognizer, if it has one</option></select>
    <label>AI vision model</label><select id="hwModel">${HW_MODELS.map(m => `<option value="${m}">${esc(m)}</option>`).join('')}</select>
    <p id="hwDetect" class="note"></p>
    <label>Or try the device's own handwriting keyboard: tap in this box, switch the on-screen keyboard to handwriting, and write the word</label><input id="hwNative" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
    <div id="hwWrap" class="hwwrap"><canvas id="hwGuide"></canvas><canvas id="hwInk"></canvas></div>
    <div><button id="hwClear" class="btn small">Clear</button> <button id="hwRead" class="btn small">Read it</button> <button id="hwCopy" class="btn small">Copy the results</button></div>
    <p id="hwOut" class="note"></p><div id="hwLog"></div>
    </details>
    <p class="note">BellaSpeller ${APP_VERSION}. Everything is stored on this device only.</p></div></div>`);
  adultFlash = '';
  const showTab = t => { adultTab = t; document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.t === t)); document.querySelectorAll('.tabpane').forEach(d => { d.hidden = d.dataset.tab !== t; }); };
  document.querySelectorAll('.tab').forEach(b => { b.onclick = () => showTab(b.dataset.t); });
  showTab(adultTab);
  document.querySelectorAll('.rsc').forEach(i => { i.onchange = () => { const w = S.weeks.find(x => x.id === i.dataset.w); if (!w) return; const v = i.value.trim(); w.score = v === '' ? null : Math.max(0, Math.min(w.words.length, parseInt(v, 10) || 0)); save(); adultTab = 'record'; adult(); }; });
  on('#recReset', () => startAgainDialog()); on('#recReset2', () => startAgainDialog()); on('#detCsv', () => saveCsv(detailRows(), 'bellaspeller-details')); on('#restore2', () => $('#restoreFile').click()); on('#restore3', () => $('#restoreFile').click());
  document.querySelectorAll('.reqadd').forEach(b => { b.onclick = () => {
    const k = b.dataset.k, box = $('#rq-' + k), t = box ? box.value.trim() : ''; if (!t) { box && box.focus(); return; }
    S.reqs = S.reqs || []; S.reqs.push({ id: 'q' + Date.now(), kind: k, text: t.slice(0, 2000), d: today(), ver: APP_VER, scr: innerWidth + 'x' + innerHeight, wk: curWeek().label || '', done: false });
    save(); adultTab = 'requests'; adult();
  }; });
  document.querySelectorAll('.reqdone').forEach(b => { b.onclick = () => { const q = (S.reqs || []).find(x => x.id === b.dataset.id); if (q) { q.done = !q.done; save(); adultTab = 'requests'; adult(); } }; });
  document.querySelectorAll('.reqdel').forEach(b => { b.onclick = () => { if (!confirm('Delete this note?')) return; S.reqs = (S.reqs || []).filter(x => x.id !== b.dataset.id); save(); adultTab = 'requests'; adult(); }; });
  on('#reqCopy', async () => { const t = requestsText(true), m = $('#reqMsg'); try { await navigator.clipboard.writeText(t); m.textContent = 'Copied. Paste it into a message.'; } catch (e) { m.textContent = 'Could not copy on this device. Use Save as a text file instead.'; } });
  on('#reqSave', () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([requestsText(false)], { type: 'text/plain;charset=utf-8' })); a.download = 'bellaspeller-requests-' + today() + '.txt'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); });
  on('#recCsv', () => downloadRecord('csv')); on('#recXls', () => downloadRecord('xls'));
  document.querySelectorAll('.recv').forEach(b => { b.onclick = () => { recView = b.dataset.v; adultTab = 'record'; adult(); }; });
  on('#qrShow', () => showKeyQr()); on('#qrWeek', () => showWeekQr()); on('#qrScan', () => scanKeyQr());
  if ($('#name')) $('#name').onchange = () => { S.name = $('#name').value.trim(); save(); };
  on('#saveName', () => { S.name = $('#name').value.trim(); S.orKey = $('#orKey').value.trim(); S.orModel = $('#orModelOther').value.trim() || $('#orModel').value || DEFAULT_MODEL; S.aiBase = $('#aiBase').value.trim(); S.aiKey = $('#aiKey').value.trim(); S.familyRules = $('#famRules').value; save(); adult(); });
  wireHandwriting();
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
      if (u) u.onclick = () => { const ep = r.ep; ep.title = String(ep.title || "This week's story"); ep.words = words; addSentences(ep); const id = 'ai' + Date.now(); S.eps = S.eps || {}; S.eps[id] = ep; wk.ep = id; delete S.story[wk.id]; save(); adult(); };
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
  on('#restore', () => $('#restoreFile').click());
  const rf = $('#restoreFile'); if (rf) rf.onchange = async () => {
    const f = rf.files && rf.files[0]; if (!f) return;
    try {
      const n = JSON.parse(await f.text());
      if (!n || !Array.isArray(n.weeks) || !n.weeks.length) throw new Error('bad');
      if (!confirm('Replace everything on this device with the contents of this backup (' + n.weeks.length + ' weeks of words, ' + Object.keys(n.used || {}).length + ' stories told)? The OpenRouter key on this device is kept.')) { rf.value = ''; return; }
      const keep = { orKey: S.orKey, aiKey: S.aiKey, aiBase: S.aiBase };
      S = Object.assign({}, n); Object.keys(keep).forEach(k => { if (keep[k]) S[k] = keep[k]; });
      save(); alert('Done. This device now has everything from the backup.'); location.reload();
    } catch (e) { alert('That file is not a BellaSpeller backup.'); rf.value = ''; }
  };
  document.querySelectorAll('.redtick').forEach(c => { c.onchange = () => { wk.words[+c.dataset.i].red = c.checked || undefined; save(); }; });
  document.querySelectorAll('.toolsw').forEach(c => { c.onchange = () => { S.tools = S.tools || {}; S.tools[c.dataset.t] = c.checked; save(); }; });
  on('#tsave', () => {
    document.querySelectorAll('.tf').forEach(f => { const x = wk.words[+f.dataset.i], v = f.value.trim().toLowerCase(); const k = f.dataset.f;
      const bad = (k === 'hard' && v && !x.w.includes(v)) || (k === 'parts' && v && v.replace(/\|/g, '') !== x.w) || (k === 'say' && v && v.replace(/-/g, '') !== x.w);
      if (k === 'wrong') { const list = f.value.split(',').map(t => t.trim().toLowerCase()).filter(t => /^[a-z'-]+$/.test(t) && t !== x.w).slice(0, 6); x.wrong = list.length ? list : undefined; return; }
      if (k === 'mnem') { const t = f.value.trim(); if (t !== (x.mnem || '')) { x.mnem = t || undefined; x.mnemSay = undefined; x.mnemBy = t ? 'grown-up' : undefined; } return; }
      x[k] = bad ? x[k] : (v || undefined); });
    wk.words.forEach((x, i) => { if (x.family) { const keep = [...document.querySelectorAll('.fam')].filter(c => +c.dataset.i === i && c.checked).map(c => c.dataset.f); x.family = keep.length ? keep : undefined; } });
    save(); adultTab = 'tools'; adultFlash = 'Saved. A box that does not match its word (for example hard letters that are not in the word) is ignored.'; adult();
  });
  on('#tsuggest', async () => {
    const b = $('#tsuggest'); b.disabled = true; b.textContent = 'Asking the AI...';
    try { const n = await suggestTools(wk); adultTab = 'tools'; adultFlash = n ? 'Added ' + n + ' suggestions to empty boxes. Please glance over them.' : 'Nothing new to add.'; }
    catch (e) { adultTab = 'tools'; adultFlash = 'Could not get suggestions: ' + (e.message || 'something went wrong.'); }
    adult();
  });
  on('#chWords', () => { $('#chBox').hidden = !$('#chBox').hidden; });
  on('#saveWords', () => {
    const nw = parseWords($('#cw').value);
    if (!nw.length) return;
    nw.forEach(x => { const old = wk.words.find(o => o.w === x.w); if (old) { x.red = old.red; if (!x.say) x.say = old.say; ['hard', 'parts', 'mnem', 'mnemSay', 'mnemonic', 'mnemWords', 'mnemBy', 'wrong', 'family', 'rule', 'ruleTried', 'sug'].forEach(k => { x[k] = old[k]; }); } });
    const changed = nw.map(x => x.w).join() !== wk.words.map(x => x.w).join();
    wk.words = nw;
    if (changed) { wk.ep = null; delete S.story[wk.id]; }
    save(); ensureTools(wk); adultFlash = 'Saved. This week now has ' + nw.length + ' words.' + (changed ? '' : ''); adult();
  });
  on('#read', () => {
    const ws = parseWords($('#nw').value);
    if (!ws.length) { $('#preview').innerHTML = '<p class="note">No words found.</p>'; return; }
    const redFrom = ws.length >= 6 ? ws.length - 3 : ws.length;
    $('#preview').innerHTML = `<p>Nearly done. Tick any red words from the school list, then save.</p>` +
      ws.map((x, i) => `<div class="wl"><input type="checkbox" id="r${i}" ${i >= redFrom ? 'checked' : ''}><b>${esc(x.w)}</b>${x.say ? ' <span class="note">' + esc(x.say) + '</span>' : ''}</div>`).join('') +
      `<p class="note">Bella can make a story with these words from her own home screen.</p><button id="saveWeek" class="btn">Save this week and use it</button>`;
    on('#saveWeek', () => {
      ws.forEach((x, i) => { x.red = $('#r' + i).checked || undefined; });
      const id = 'w' + Date.now();
      S.weeks.push({ id, label: $('#nl').value ? 'Test on ' + new Date($('#nl').value + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Week added ' + today(), rule: $('#nr').value.trim(), words: ws, score: null, ep: null });
      S.cur = id; save(); ensureTools(S.weeks[S.weeks.length - 1]); adultTab = 'words'; adultFlash = 'Saved. This week is now: ' + ws.map(x => x.w).join(', ') + '.'; adult();
    });
  });
}

// ---------- Setting up another device by QR code ----------
// The device that has the OpenRouter key shows it as a QR code; the other device scans it with its camera. The key never goes through a server.
// Nothing here writes the key to the screen as text or to any log: it is only drawn inside the QR picture, and only while a grown-up has the window open.
const QR_PREFIX = 'BELLASPELLER-KEY-1:';
const loadScriptOnce = (src) => new Promise((res, rej) => {
  if (document.querySelector('script[data-lib="' + src + '"]')) return res();
  const e = document.createElement('script'); e.src = src + (typeof __s === 'string' ? __s : ''); e.dataset.lib = src; e.onload = () => res(); e.onerror = () => rej(new Error('Could not load ' + src));
  document.body.appendChild(e);
});
function qrOverlay(title, bodyHtml, onClose) {
  const ov = document.createElement('div'); ov.className = 'overlay'; ov.id = 'qrOverlay';
  ov.innerHTML = `<div class="pickcard"><div class="dbghead"><b>${esc(title)}</b><button class="btn small" id="qr-x">Close</button></div>${bodyHtml}</div>`;
  document.body.appendChild(ov);
  const close = () => { try { onClose && onClose(); } catch (e) { } ov.remove(); };
  ov.querySelector('#qr-x').onclick = close;
  return { ov, close };
}
const WEEK_PREFIX = 'BELLASPELLER-WEEK-1:';
const b64enc = buf => { let s0 = ''; new Uint8Array(buf).forEach(c => { s0 += String.fromCharCode(c); }); return btoa(s0); };
const b64dec = t => Uint8Array.from(atob(t), c => c.charCodeAt(0));
// Squeezes text smaller, where the browser can, so more fits in one QR code. 'Z' marks squeezed text, 'R' plain text.
async function packText(txt) {
  if ('CompressionStream' in window) { const cs = new CompressionStream('deflate-raw'), w = cs.writable.getWriter(); w.write(new TextEncoder().encode(txt)); w.close(); return 'Z' + b64enc(await new Response(cs.readable).arrayBuffer()); }
  return 'R' + btoa(unescape(encodeURIComponent(txt)));
}
async function unpackText(p) {
  if (p[0] === 'Z') { const ds = new DecompressionStream('deflate-raw'), w = ds.writable.getWriter(); w.write(b64dec(p.slice(1))); w.close(); return new TextDecoder().decode(await new Response(ds.readable).arrayBuffer()); }
  return decodeURIComponent(escape(atob(p.slice(1))));
}
// This week's words and their spelling tips, as one small QR code. The key is not in it.
async function showWeekQr() {
  const wk = curWeek();
  try { await loadScriptOnce('qrgen.js'); } catch (e) { alert('Could not load the QR code maker. Check the internet connection and try again.'); return; }
  const slim = lvl => ({ v: 1, n: S.name || undefined, l: wk.label, r: wk.rule, w: wk.words.map(x => { const o = { w: x.w }; if (x.red) o.d = 1; if (x.say) o.s = x.say; if (lvl < 2 && x.mnem) o.m = x.mnem; if (lvl < 1 && x.mnemSay) o.y = x.mnemSay; return o; }) }); // words and spelling tips only: she makes the mnemonics herself on the other device
  let text = '', lvl = 0;
  for (; lvl <= 2; lvl++) { text = WEEK_PREFIX + await packText(JSON.stringify(slim(lvl))); if (text.length <= 2400) break; }
  const qr = qrcode(0, 'L'); qr.addData(text); qr.make();
  const n = qr.getModuleCount(), cell = Math.max(3, Math.floor(Math.min(innerWidth - 60, innerHeight - 240, 560) / (n + 8))), size = (n + 8) * cell;
  const { ov, close } = qrOverlay('This week\'s words', `<p class="note">On the other device, open Grown-ups, Settings, and press <b>Scan a QR code</b>, then hold it up to this screen. It adds this week's words and their spelling tips${lvl > 0 ? ' (some tips were left out to fit)' : ''}. Turn the screen brightness up and keep the tablet steady.</p><div style="display:flex;justify-content:center"><canvas id="qrCanvas" width="${size}" height="${size}" style="max-width:100%;height:auto;background:#fff;border-radius:12px"></canvas></div>`);
  const c = ov.querySelector('#qrCanvas'), x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, size, size); x.fillStyle = '#000';
  for (let r = 0; r < n; r++) for (let q = 0; q < n; q++) if (qr.isDark(r, q)) x.fillRect((q + 4) * cell, (r + 4) * cell, cell, cell);
}
// Adds a week from a scanned code. The words are checked before anything is saved.
async function addWeekFromQr(packed) {
  let o; try { o = JSON.parse(await unpackText(packed)); } catch (e) { return false; }
  if (!o || o.v !== 1 || !Array.isArray(o.w) || !o.w.length || o.w.length > 60) return false;
  const txt = (t, n) => typeof t === 'string' ? t.slice(0, n) : undefined;
  const words = [];
  for (const x of o.w) {
    if (!x || typeof x.w !== 'string' || !/^[a-z' -]{1,30}$/.test(x.w)) return false;
    const w = { w: x.w };
    if (x.d) w.red = true; if (x.s) w.say = txt(x.s, 60); if (x.m) { w.mnem = txt(x.m, 200); w.mnemBy = 'ai'; } if (x.y) w.mnemSay = txt(x.y, 300);
    words.push(w);
  }
  const id = 'w' + Date.now();
  S.weeks.push({ id, label: txt(o.l, 80) || 'Words from another device', rule: txt(o.r, 200) || '', words, score: null, ep: null });
  S.cur = id;
  if (typeof o.n === 'string' && o.n && !S.name) S.name = o.n.slice(0, 20);
  save(); return true;
}
// Shows the key as a QR code, for another device to scan. Closes itself after two minutes.
async function showKeyQr() {
  const key = S.orKey || S.aiKey;
  if (!key) { alert('This device has no AI key to share yet.'); return; }
  try { await loadScriptOnce('qrgen.js'); } catch (e) { alert('Could not load the QR code maker. Check the internet connection and try again.'); return; }
  const payload = QR_PREFIX + JSON.stringify({ k: S.orKey || undefined, a: S.aiKey || undefined, b: S.aiBase || undefined });
  const qr = qrcode(0, 'M'); qr.addData(payload); qr.make();
  const n = qr.getModuleCount(), cell = Math.max(4, Math.floor(Math.min(innerWidth - 80, innerHeight - 260, 440) / (n + 8))), size = (n + 8) * cell;
  const { ov, close } = qrOverlay('Set up another device', `<p class="note">On the other device, open Grown-ups, Settings, and press <b>Scan a QR code</b>. Hold it up to this screen. This picture contains the AI key, so only show it to the device you are setting up. It closes by itself in two minutes.</p><div style="display:flex;justify-content:center"><canvas id="qrCanvas" width="${size}" height="${size}" style="max-width:100%;height:auto;background:#fff;border-radius:12px"></canvas></div>`);
  const c = ov.querySelector('#qrCanvas'), x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, size, size); x.fillStyle = '#000';
  for (let r = 0; r < n; r++) for (let q = 0; q < n; q++) if (qr.isDark(r, q)) x.fillRect((q + 4) * cell, (r + 4) * cell, cell, cell);
  setTimeout(close, 120000);
}
// Scans a QR code from another device with the camera, and saves the key on this device.
async function scanKeyQr() {
  let stream = null, stop = false, raf = 0;
  const done = () => { stop = true; cancelAnimationFrame(raf); try { stream && stream.getTracks().forEach(t => t.stop()); } catch (e) { } };
  const { ov, close } = qrOverlay('Scan the QR code', `<p class="note" id="qrMsg">Hold this camera up to the QR code on the other device.</p><video id="qrVideo" playsinline muted style="width:100%;border-radius:12px;background:#000;max-height:60vh"></video><canvas id="qrWork" hidden></canvas>`, done);
  const msg = t => { const m = ov.querySelector('#qrMsg'); if (m) m.textContent = t; };
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { msg('This device cannot use its camera here.'); return; }
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }); }
  catch (e) { msg('The camera could not be opened. Allow the camera for this page and try again.'); return; }
  const v = ov.querySelector('#qrVideo'); v.srcObject = stream; try { await v.play(); } catch (e) { }
  const det = 'BarcodeDetector' in window ? new BarcodeDetector({ formats: ['qr_code'] }) : null;
  if (!det) { try { await loadScriptOnce('jsqr.js'); } catch (e) { msg('Could not load the QR reader.'); done(); return; } }
  const wk = ov.querySelector('#qrWork'), wx = wk.getContext('2d', { willReadFrequently: true });
  // Returns what the code was ('key' or 'week'), or false. Nothing is saved unless the contents check out.
  const accept = async text => {
    if (typeof text !== 'string') return false;
    if (text.startsWith(WEEK_PREFIX)) return (await addWeekFromQr(text.slice(WEEK_PREFIX.length))) ? 'week' : false;
    if (!text.startsWith(QR_PREFIX)) return false;
    let o; try { o = JSON.parse(text.slice(QR_PREFIX.length)); } catch (e) { return false; }
    const ok = t => typeof t === 'string' && /^[A-Za-z0-9_.:\/-]{8,300}$/.test(t);
    if (!o || !(ok(o.k) || ok(o.a))) return false;
    if (ok(o.k)) S.orKey = o.k; if (ok(o.a)) S.aiKey = o.a; if (typeof o.b === 'string' && /^https:\/\/[A-Za-z0-9.\/_-]{4,200}$/.test(o.b)) S.aiBase = o.b;
    save(); return 'key';
  };
  const tick = async () => {
    if (stop) return;
    try {
      if (v.readyState >= 2 && v.videoWidth) {
        let text = null;
        if (det) { const r = await det.detect(v); if (r && r[0]) text = r[0].rawValue; }
        else { wk.width = v.videoWidth; wk.height = v.videoHeight; wx.drawImage(v, 0, 0); const im = wx.getImageData(0, 0, wk.width, wk.height), r = jsQR(im.data, im.width, im.height); if (r) text = r.data; }
        if (text) {
          const got = await accept(text);
          if (got) { done(); msg(got === 'week' ? 'Done. The words have been added and are this week\'s words.' : 'Done. The AI key is now saved on this device.'); setTimeout(() => { close(); adult(); }, 1800); return; }
          msg('That QR code is not from BellaSpeller. Try again.');
        }
      }
    } catch (e) { }
    raf = requestAnimationFrame(() => setTimeout(tick, 120));
  };
  tick();
}
// ---------- debug settings: a button on every screen, no PIN. Set DEBUG to false for release. ----------
// Goes to the page under a new address that carries the version (?u=3.80). The server and the browser have never seen that address, so every file
// (the page, the script, the styles) is fetched fresh and cannot come back from a saved copy of the old version.
async function freshReload(ver) {
  // Clear the saved copies, but never wait more than a couple of seconds for it: some installed windows stall on this.
  const clear = (async () => { try { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); for (const k of await caches.keys()) await caches.delete(k); } catch (e) { } })();
  await Promise.race([clear, new Promise(r => setTimeout(r, 2500))]);
  const q = new URLSearchParams(location.search); q.set('u', (ver || 'x') + '-' + Date.now().toString(36)); // a new address every time, so no stale copy can be reused
  location.replace(location.pathname + '?' + q.toString());
}
// A big square Update button in the top right corner. It is only there when a newer version is waiting.
function initUpdater() {
  const b = document.createElement('button');
  b.id = 'updbtn'; b.hidden = true; b.setAttribute('aria-label', 'Update the app');
  b.innerHTML = '<span class="updico">&#8635;</span><span>Update</span><small id="updver"></small>';
  b.onclick = async () => { b.disabled = true; b.querySelector('span:nth-child(2)').textContent = 'Updating...'; await freshReload(latest); };
  document.body.appendChild(b);
  // a small version label on every screen; tapping it fetches the newest files and reloads, whatever the check says
  const v = document.createElement('button'); v.id = 'vlabel'; v.textContent = 'v' + APP_VER; v.setAttribute('aria-label', 'Version ' + APP_VER + '. Tap to update.');
  v.onclick = async () => { v.textContent = 'updating...'; await freshReload(latest); };
  document.body.appendChild(v);
  let latest = null;
  const check = async () => {
    try {
      const t = await (await fetch('app.js?chk=' + Date.now(), { cache: 'no-store' })).text();
      const m = t.match(/const APP_VER = '([^']+)'/); if (!m) return;
      latest = m[1];
      const show = newer(m[1], APP_VER);
      b.hidden = !show; document.body.classList.toggle('hasupdate', show); const uv = document.getElementById('updver'); if (uv) uv.textContent = 'version ' + m[1] + ' is ready';
    } catch (e) { }
  };
  check();
  setInterval(check, 30000);
  window.addEventListener('focus', check); window.addEventListener('online', check);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
}
const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0; } return false; };
function debugUI() {
  if (!DEBUG || location.search.indexOf('debug') < 0) return; // the debug gear only appears when the address ends ?debug=1
  const b = document.createElement('button');
  b.id = 'dbg'; b.className = 'dbgbtn'; b.setAttribute('aria-label', 'Settings (debug)'); b.innerHTML = ico('gear');
  b.onclick = toggleDebug;
  document.body.appendChild(b);
  const sb = document.createElement('button');
  sb.id = 'snd'; sb.className = 'dbgbtn snd';
  sb.onclick = toggleSound;
  document.body.appendChild(sb);
  paintSound();
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
    <label>Story model</label>${modelSelect('dmodel')}
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
    S.stars = 0; S.log = []; S.story = {}; S.sittings = []; S.due = {}; save(); sure = false; $('#dclear').textContent = 'Clear stars and answers'; msg('Cleared.');
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
initUpdater();
home();
// Ask the browser to keep the data permanently, and restore from the safety copy if the main store came back empty.
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { }
if (loadedFresh) mirrorGet().then(j => { try { const m = JSON.parse(j); if (m && !looksFresh(m)) { S = m; localStorage.setItem(KEY, j); home(); } } catch (e) { } });
