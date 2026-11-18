'use strict';
// BellaSpeller, version 1. Everything is stored on this device only.

const KEY = 'star-speller-1';
const DEBUG = true; // true: settings button on every screen and no PIN. Set false for release.
function soundOn() { return S.sound === undefined ? !DEBUG : S.sound === true; } // off by default while debugging
const APP_VER = '3.04'; // bump with every release
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
      score: null, ep: null
    }],
    cur: 'w1', log: [], stars: 0, story: {}
  };
}
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.weeks && s.weeks.length) { if (s.girls && s.girls.join() === 'Priya,Maya,Jess,Tilly') s.girls = ['Imogen', 'Persephone', 'Florence', 'Tabitha']; return s; } } catch (e) { } loadedFresh = true; return fresh(); }
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
{"p": "a paragraph of two or three sentences whose LAST sentence contains the spelling word", "word": "the spelling word", "scene": "one sentence an illustrator could draw"}
{{CHOICE_FORMAT}}

Rules:
1. Every spelling word is the "word" of exactly one p beat in the whole story, and no other word is. The word is in lower case exactly as given, and appears exactly once, as a whole word, in the last sentence of that paragraph. Do not use a longer form in its place (for "nice" do not write "nicer" there).
{{CHOICE_RULE}}
3. Every part except the last ends with a cliffhanger. The last part resolves the story and ends warmly. Do not end by repeating the words.
4. A spelling word may also appear naturally elsewhere in the story, in narration, in other paragraphs and in choices. Write natural prose, and never avoid an ordinary word just because it is one of this week's spelling words.
5. The "scene" of each p beat is one sentence for an illustrator, describing the picture that goes with that paragraph: where it is, who is there (always written as {g1}, {g2} and so on, never as names), what they are doing, and the main objects, for example the paper bridge or the torch. It must show what is really happening in that paragraph, not something abstract. Nothing frightening, no food or drink, and no writing or signs in the picture.
6. Reply with the JSON object only.`;

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
async function askAI(wk, problems, model, extra) {
  const words = wk.words.map(x => x.w);
  let ask = 'This week\'s spelling words: ' + words.join(', ') + '.';
  const plan = partPlan(words.length);
  ask += '\nWrite ' + plan.length + ' part' + (plan.length === 1 ? '' : 's') + ', with ' + plan.join(', ') + ' word paragraph' + (plan.length === 1 && plan[0] === 1 ? '' : 's') + ' in each (' + words.length + ' words in all).';
  ask += storyBrief(extra);
  if (problems && problems.length) ask += '\n\nYour last draft had these problems. Write a new story that avoids them:\n- ' + problems.join('\n- ');
  const headers = { 'Authorization': 'Bearer ' + aiKey(), 'Content-Type': 'application/json' };
  if (/openrouter\.ai/.test(aiBase())) headers['X-Title'] = 'BellaSpeller';
  const t0 = Date.now();
  const r = await fetch(aiBase() + '/chat/completions', {
    method: 'POST', headers,
    body: JSON.stringify({ model: model || S.orModel || DEFAULT_MODEL, max_tokens: 8000, messages: [{ role: 'system', content: storyRules() }, { role: 'user', content: ask }] })
  });
  if (!r.ok) throw new Error('The AI service answered ' + r.status + '. ' + (await r.text()).slice(0, 200));
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
const cueSpoken = (sentence, word) => sentence + ' ... So the word I would like you to try to spell is ' + word + '.';
const HELP_Q = 'That is not quite right. Would you like some help to spell this, or would you like to have another go?';
const HELP_MENU = 'Which help would you like?';
function helpsFor(x) {
  // The three main helps first, then the smaller ones. None of them shows the word.
  const out = [];
  { const f = famOf(x); if (f.rule || f.family.length) out.push('family'); }
  out.push('sure', 'choice');
  if (x.say) out.push('voice');
  if (x.hard) out.push('hard');
  if (x.parts && x.parts.includes('|')) out.push('parts');
  return out;
}
const HELP_LABEL = { sure: 'Are you sure?', voice: 'Spelling voice', family: 'Words like it', hard: 'Hard part', parts: 'Word parts', choice: 'Pick the right spelling' };
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
  ould: 'The letters o u l d say ood.', le: 'The letters l e at the end of a word say ul.', ie: 'The letters i e can say ee, as in field, or eye, as in pie.'
};
// The sound each pattern makes, written the way a speech voice will say it as a sound, not as letter names. Not checked by ear yet.
const PSOUND = { th: 'thhh', sh: 'shhh', ch: 'chhh', wh: 'wuh', kn: 'nnn', wr: 'rrr', qu: 'kwuh', ph: 'fff', ck: 'kuh', tion: 'shun', tch: 'chhh', dge: 'juh', ight: 'ite', ea: 'ee', ee: 'ee', oa: 'oh', ai: 'ay', ay: 'ay', oo: 'oo', ie: 'ee', ei: 'ay', ou: 'ow', ow: 'ow', oy: 'oy', oi: 'oy', au: 'or', aw: 'or', ar: 'ar', or: 'or', er: 'er', ir: 'er', ur: 'er', ss: 'sss', ll: 'lll', ff: 'fff', ould: 'ood', le: 'ul' };
const listOf = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0];
function phonicsRule(w) {
  for (const [pat, where, ex] of PHONICS) {
    const hit = where === 'start' ? w.startsWith(pat) : where === 'end' ? w.endsWith(pat) && w.length > pat.length : w.includes(pat);
    if (!hit) continue;
    const family = ex.filter(e => e !== w).slice(0, 3);
    if (family.length < 2) continue;
    const place = where === 'start' ? 'It starts with ' + pat : where === 'end' ? 'It ends with ' + pat : 'It has ' + pat + ' in it';
    const letters = pat.split('').join(' ');
    const snd = PSOUND[pat];
    const spoken = (where === 'start' ? 'It starts with ' : where === 'end' ? 'It ends with ' : 'It has ') + (snd ? 'the sound ' + snd + '. ' + 'Listen: ' + listOf(family) + '. ' : 'the letters ' + letters + ', like ' + listOf(family) + '. ') + (PNOTE[pat] || '') + (pat.length === 2 && !['ly', 'ed', 'le'].includes(pat) ? ' That is called a digraph: two letters, one sound.' : '');
    return { rule: place + ', like ' + listOf(family) + '.', spoken, family };
  }
  const sp = w.match(/([aeiou])[^aeiouwy]e$/);
  if (sp) {
    const v = sp[1], ex = { a: ['make', 'game', 'late'], e: ['these', 'theme', 'complete'], i: ['time', 'bike', 'like'], o: ['hope', 'home', 'nose'], u: ['cube', 'tune', 'huge'] }[v].filter(e => e !== w);
    return { rule: 'It has a split digraph, ' + v + '_e, like ' + listOf(ex) + '.', spoken: 'It has a split digraph, ' + v + ' and e, like ' + listOf(ex) + '. The ' + v + ' and the e on the end work together to make one sound, with a letter in between.', family: ex };
  }
  return null;
}
// The rule and words like it for a word: from the built-in spelling patterns first, then from the AI's suggestion.
const famOf = x => { const ph = phonicsRule(x.w); return ph || { rule: x.rule || '', family: x.family || [] }; };
// What is said aloud for Words like it: the rule and the similar words, never the word itself.
const familyText = x => { const f = famOf(x); return (f.spoken || f.rule || '') + (!f.rule && f.family.length ? 'Other words spelled like it are ' + f.family.slice(0, 3).join(', ') + '.' : ''); };
function helpContent(x, id) {
  const L = (t, v) => `<div class="helpline">${t ? '<b>' + esc(t) + '</b> ' : ''}${v}</div>`;
  if (id === 'family') { const f = famOf(x); if (f.rule || f.family.length) return { html: '<button class="hearbar" id="hearsay">' + ico('speaker') + '<span>Tap to hear the spelling rule again</span></button>', say: familyText(x) }; }
  if (id === 'voice' && x.say) return { html: L('Listen to it said the spelling way:', '<button class="btn small" id="hearsay">Hear it</button>'), say: x.say };
  if (id === 'parts' && x.parts) return { html: L('This word is built from ' + x.parts.split('|').length + ' smaller pieces. Here is a box for each letter, so you can see how big each piece is:', '<div class="bxrow">' + boxesHtml(x, false, x.parts.split('|')) + '</div>') };
  if (id === 'hard' && x.hard) return { html: L('One box for each letter. The yellow ones are the tricky ones:', '<div class="bxrow">' + boxesHtml(x, true) + '</div>') };
  if (id === 'letters') return { html: L('', 'Say each letter out loud as you type it.') };
  if (id === 'sure') return { html: L('', 'I will tell you if a letter does not look right.') };
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
  const headers = { 'Authorization': 'Bearer ' + aiKey(), 'Content-Type': 'application/json' };
  if (/openrouter\.ai/.test(aiBase())) headers['X-Title'] = 'BellaSpeller';
  const r = await fetch(aiBase() + '/chat/completions', { method: 'POST', headers, body: JSON.stringify({ model: S.orModel || DEFAULT_MODEL, max_tokens: maxTokens || 3000, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] }) });
  if (!r.ok) throw new Error('The AI service answered ' + r.status);
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
  const SW = [['ea', 'ee'], ['ee', 'ea'], ['ai', 'ay'], ['ay', 'ai'], ['oa', 'ow'], ['ow', 'oa'], ['ou', 'ow'], ['ow', 'ou'], ['oo', 'u'], ['ie', 'ei'], ['ei', 'ie'], ['au', 'aw'], ['aw', 'au'], ['er', 'ur'], ['ur', 'er'], ['ir', 'er'], ['or', 'ar'], ['igh', 'ie'], ['ough', 'uff'], ['ough', 'ow'], ['ph', 'f'], ['ck', 'k'], ['tion', 'shun'], ['cial', 'shul'], ['ge', 'dge'], ['dge', 'ge'], ['c', 's'], ['s', 'c'], ['i', 'y'], ['y', 'i'], ['e', 'a'], ['a', 'e'], ['o', 'u'], ['u', 'o'], ['kn', 'n'], ['wr', 'r'], ['wh', 'w'], ['gh', ''], ['ss', 's'], ['s', 'ss'], ['ll', 'l'], ['l', 'll'], ['tt', 't'], ['t', 'tt'], ['nn', 'n'], ['n', 'nn'], ['rr', 'r'], ['r', 'rr']];
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
  const rows = wk.words.map((x, i) => `<tr><td><b>${esc(x.w)}</b></td>
    <td><input type="text" class="tf" data-i="${i}" data-f="hard" value="${esc(x.hard || '')}" placeholder="hard letters" autocomplete="off"></td>
    <td><input type="text" class="tf" data-i="${i}" data-f="parts" value="${esc(x.parts || '')}" placeholder="side|ways" autocomplete="off"></td>
    <td><input type="text" class="tf" data-i="${i}" data-f="say" value="${esc(x.say || '')}" placeholder="w-hen" autocomplete="off"></td>
    <td>${(x.family || []).map(f => `<label class="famchk"><input type="checkbox" class="fam" data-i="${i}" data-f="${esc(f)}" checked> ${esc(f)}</label>`).join(' ') || '<span class="note">none</span>'}</td>
    <td><input type="text" class="tf" data-i="${i}" data-f="wrong" value="${esc((x.wrong || []).join(', '))}" placeholder="freind, frend" autocomplete="off"></td>
    <td><input type="text" class="tf" data-i="${i}" data-f="mnem" value="${esc(x.mnem || '')}" placeholder="a memory trick" autocomplete="off">${x.mnemBy === 'ai' ? '<span class="note">suggested by the AI</span>' : ''}</td></tr>`).join('');
  return `<h2>Support tools</h2>
    <p class="note">Bella chooses which tools to use, with the Tools button on the revision pages. Each use is recorded, so the Progress tab can show what she tries. This page sets what each tool shows for each word. The evidence for every tool is a bet, not a finding.</p>
    ${TOOLS.map(t => `<div class="wl"><div><b>${esc(t.label)}.</b> <span class="note">${esc(t.note)}</span></div></div>`).join('')}
    <h2>Tool details for this week's words</h2>
    <p class="note">What the tools show for each word. Leave a box empty to show nothing for that word. Common wrong spellings are used by Pick the right spelling, after her own past mistakes.</p>
    <table><tr><th>Word</th><th>Hard part</th><th>Word parts</th><th>Spelling voice</th><th>Same-pattern words (untick to remove)</th><th>Common wrong spellings</th><th>Memory trick</th></tr>${rows}</table>
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
// ---------- story pictures: drawn by an image model, one for each word paragraph, kept on this device ----------
const IMG_MODELS = ['qwen/qwen-image-3', 'bytedance-seed/seedream-5-0-lite', 'google/gemini-3.1-flash-lite-image', 'recraft/recraft-v4.1-flash', 'black-forest-labs/flux-3-image-klein'];
const imgModel = () => S.imgModel || IMG_MODELS[0];
const picsOn = () => S.pics !== false && !!(S.orKey || aiKey());
const PIC_STYLE = "Children's picture-book illustration in soft watercolour, warm friendly colours, gentle and cheerful, a simple clear scene with the main object easy to see, suitable for a nine-year-old.";
const LOOKS = {
  girl: ['a girl with long dark hair and a red jumper', 'a girl with curly ginger hair and a yellow raincoat', 'a girl with brown skin, black braids and a green cardigan', 'a girl with a blonde ponytail and a blue hoodie'],
  boy: ['a boy with short brown hair and a blue jumper', 'a boy with curly black hair and a yellow t-shirt', 'a boy with short ginger hair and a green coat', 'a boy with sandy hair and a red hoodie']
};
const castLooks = () => [0, 1, 2, 3].map(i => { const m = (S.cast || [])[i] || {}; return LOOKS[m.boy ? 'boy' : 'girl'][i % 4]; });
// The picture prompt never contains a name: characters are described by how they look.
function picPrompt(scene) {
  const looks = castLooks();
  const txt = String(scene).replace(/\{g([1-4])\}/g, (m, k) => looks[+k - 1]);
  return PIC_STYLE + ' ' + txt + ' Cosy, kind, nothing frightening. No text, no letters, no words, no signs, no food or drink in the picture.';
}
let picErr = '';
// ---------- handwriting test: pen input, read by an AI vision model or the device's own recognizer ----------
const HW_MODELS = ['anthropic/claude-haiku-5.5', 'google/gemini-2.5-flash-lite', 'openai/gpt-5-nano', 'qwen/qwen3.5-flash-02-23', 'google/gemma-4-26b-a4b-it'];
const hwResults = [];
function wireHandwriting() {
  const wrap = $('#hwWrap'); if (!wrap) return;
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
async function genImage(model, prompt) {
  const key = S.orKey || aiKey();
  if (!key) throw new Error('No OpenRouter key.');
  const first = /^(google|openai)\//.test(model) ? ['image', 'text'] : ['image'];
  let last = '';
  for (const modalities of [first, first.length === 2 ? ['image'] : ['image', 'text']]) {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'X-Title': 'BellaSpeller' }, body: JSON.stringify({ model, modalities, messages: [{ role: 'user', content: prompt }] }) });
    const txt = await r.text();
    if (!r.ok) { last = r.status + ' ' + txt.slice(0, 160); if (r.status === 400) continue; throw new Error(last); }
    let j; try { j = JSON.parse(txt); } catch (e) { throw new Error('The picture service sent something unreadable.'); }
    const msg = j.choices && j.choices[0] && j.choices[0].message; let url = '';
    if (msg && Array.isArray(msg.images) && msg.images[0]) url = (msg.images[0].image_url || {}).url || msg.images[0].url || '';
    if (!url && msg && Array.isArray(msg.content)) { const p = msg.content.find(c => c && (c.image_url || c.type === 'image_url' || c.type === 'output_image')); if (p) url = (p.image_url && p.image_url.url) || p.url || ''; }
    if (!url && msg && typeof msg.content === 'string') { const m = msg.content.match(/data:image\/[a-z]+;base64,[A-Za-z0-9+\/=]+/); if (m) url = m[0]; }
    if (!url) { last = 'No picture came back from ' + model + '.'; continue; }
    const blob = await (await fetch(url)).blob();
    if (!blob || blob.size < 1000) throw new Error('The picture was empty.');
    return blob;
  }
  throw new Error(last || 'No picture came back.');
}
const picUrls = new Map(), picState = {};
const picKey = (epId, w) => 'pic|' + epId + '|' + w;
async function loadPics(wk) {
  const ep = epOf(wk); if (!ep || !wk.ep) return;
  for (const part of ep.parts || []) for (const b of part) if (b.p && b.word) {
    const k = picKey(wk.ep, b.word); if (picUrls.has(k)) continue;
    const blob = await idbGet(k); if (blob) picUrls.set(k, URL.createObjectURL(blob));
  }
}
const picUrl = w => picUrls.get(picKey(curWeek().ep, w)) || '';
const picHtml = w => { const u = picUrl(w); return u ? `<img class="cuepic" alt="" src="${u}">` : ''; };
// Draws the pictures for a story in the background, three at a time. A failure is kept for the grown-ups page and never stops the story.
async function startPictures(epId, force) {
  if (!picsOn() || picState[epId] === 'running') return;
  const ep = S.eps && S.eps[epId]; if (!ep) return;
  const jobs = []; for (const part of ep.parts || []) for (const b of part) if (b.p && b.word) jobs.push(b);
  picState[epId] = 'running'; picErr = ''; let done = 0;
  let i = 0;
  const worker = async () => {
    while (i < jobs.length) {
      const b = jobs[i++], k = picKey(epId, b.word);
      if (!force && (picUrls.has(k) || await idbGet(k))) { done++; continue; }
      const prompt = picPrompt(b.scene || b.p);
      for (let tryN = 0; tryN < 2; tryN++) {
        try { const blob = await genImage(imgModel(), prompt); await idbPut(k, blob); picUrls.set(k, URL.createObjectURL(blob)); done++; break; }
        catch (e) { picErr = e.message; }
      }
      const st = document.getElementById('picStat'); if (st) st.textContent = done + ' of ' + jobs.length + ' pictures drawn' + (picErr ? '. Last problem: ' + picErr : '');
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  picState[epId] = 'done';
  const st = document.getElementById('picStat'); if (st) st.textContent = done + ' of ' + jobs.length + ' pictures drawn' + (picErr ? '. Last problem: ' + picErr : '.');
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
  if (!ttsOn() || !soundOn()) return null;
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
let wakeCtx = null;
// Speakers and Bluetooth often switch off in silence and swallow the first second of the next sound. A very quiet hiss just before each clip keeps them awake.
function wakeAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    wakeCtx = wakeCtx || new AC(); const c = wakeCtx; if (c.state === 'suspended') c.resume();
    const len = Math.floor(c.sampleRate * 0.6), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.0007;
    const src = c.createBufferSource(); src.buffer = buf; src.connect(c.destination); src.start();
  } catch (e) { }
}
function say(t) {
  const tok = ++sayTok;
  stopAll();
  if (!soundOn()) return;
  if (ttsOn()) wakeAudio();
  speechUntil = Date.now() + 120000;
  if (!ttsOn()) return builtinSay(t);
  getClipUrl(t).then(url => {
    if (tok !== sayTok) return;
    if (url) {
      audioEl = new Audio(url);
      audioEl.onended = () => { speechUntil = Date.now() + 2500; };
      audioEl.onerror = () => { if (tok === sayTok) builtinSay(t); };
      const el = audioEl; // a short lead-in: the sound device needs a moment to wake, or the first word is clipped
      el.preload = 'auto';
      setTimeout(() => { if (tok === sayTok && audioEl === el) el.play().catch(() => { if (tok === sayTok) builtinSay(t); }); }, 550);
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
    say(text);
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
  items.forEach(q => { const w = q.t.split(/\s+/).length; if (cur.length && n + w > 26) { out.push(cur); cur = []; n = 0; } cur.push(q); n += w; });
  if (cur.length) out.push(cur);
  return out;
}
const chunkText = c => c.map(q => q.t).join(' ');
function storyScroll(items) {
  const chunks = chunkItems(items);
  return new Promise(res => {
    h(`<div class="screen storyscreen"><div class="scrollpage" id="sp">${chunks.map((c, i) => `<span class="chunk" data-i="${i}"${c.find(q => q.w) ? ' data-pw="' + esc(c.find(q => q.w).w) + '"' : ''}>${c.map(q => (q.w ? hlHtml(q.t, q.w) : esc(q.t)) + (q.pic ? `<span class="scene" aria-hidden="true">${q.pic}</span>` : '')).join(' ')}</span> `).join('')}</div>
      <div class="storypic" id="spic"></div>
      <div class="row"><button id="hear" class="iconbtn big" aria-label="Read it to me again">${ico('speaker')}</button><button id="next" class="btn big">I've read it ${ico('next')}</button></div></div>`);
    // The picture under the box follows the story: the latest word paragraph the voice (or her scrolling) has reached.
    let shownPic = '';
    const showPic = () => {
      const sp = $('#sp'), box = $('#spic'); if (!sp || !box) return;
      const cs = [...sp.querySelectorAll('.chunk[data-pw]')]; if (!cs.length) return;
      const edge = sp.getBoundingClientRect().top + sp.clientHeight * 0.75;
      let pick = cs[0]; cs.forEach(c => { if (c.getBoundingClientRect().top <= edge) pick = c; });
      const w = pick.dataset.pw, u = picUrl(w);
      if (u && u !== shownPic) { shownPic = u; box.innerHTML = `<img class="storyimg" alt="" src="${u}">`; }
    };
    loadPics(curWeek()).then(showPic);
    const picTimer = setInterval(() => { if (!$('#spic')) return clearInterval(picTimer); loadPics(curWeek()).then(showPic); }, 2000);
    $('#sp').addEventListener('scroll', showPic);
    let run = 0;
    const play = async () => {
      const my = ++run; hush();
      if (!soundOn()) return;
      for (let i = 0; i < chunks.length; i++) {
        if (my !== run) return;
        const el = document.querySelector(`.chunk[data-i="${i}"]`), sp = $('#sp');
        document.querySelectorAll('.chunk.now').forEach(x => x.classList.remove('now'));
        if (el && sp) { el.classList.add('now'); sp.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top - sp.getBoundingClientRect().top + sp.scrollTop - 16), behavior: 'smooth' }); }
        const ok = await sayDone(chunkText(chunks[i]));
        if (!ok || my !== run) return;
        await new Promise(r => setTimeout(r, 900)); // a breath between pieces, so it is not rushed
        if (my !== run) return;
      }
    };
    on('#hear', () => { const sp = $('#sp'); if (sp) sp.scrollTo({ top: 0 }); play(); });
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
    say(q + ' ' + opts.join('. Or. '));
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

function writeWord(word, noBack, remind, wobj, force, cue, help, ask, autoSure, note) {
  return new Promise(res => {
    let typed = '', hints = 0, done = false, reminded = false;
    const used = new Set();
    const sp = cue && sentenceParts(cue, word);
    const sayIt = () => say(help === 'family' && wobj && familyText(wobj) ? familyText(wobj) : sp ? cueSpoken(cue, word) : word);
    if (help) used.add(help);
    h(`<div class="screen writescreen">
      ${sp ? `<div class="page small gapcard"><p class="story">${esc(sp.pre)}<span class="gapw"><i>&#9660;</i></span>${esc(sp.post)}</p></div>` : `<div class="cue">${ico('speaker')}<span>${soundOn() ? 'Listen, then write the word' : 'Write the word you just looked at'}</span></div>`}
      ${wobj ? picHtml(word) : ''}${note ? `<p class="msg smallmsg">${esc(note)}</p>` : ''}<div id="helpbox" class="helpbox"></div>
      <div id="surebox" class="surebox"></div>
      <div id="remindbox" style="width:100%"></div>
      <div id="slots" class="slots"></div>
      <div class="row"><button id="hear" class="iconbtn big" aria-label="Hear it">${ico('speaker')}</button>${remind ? `<button id="remind" class="btn small">${ico('bulb')}<span>Remind me</span></button>` : ''}${ask && wobj && !help ? `<button id="helpfirst" class="btn small">${ico('bulb')}<span>Help me first</span></button>` : ''}<button id="hint" class="btn small" style="display:${help === 'nextletter' ? '' : 'none'}">${ico('bulb')}<span>Next letter</span></button></div>
      ${kbHtml()}</div>`);
    const draw = () => {
      $('#slots').innerHTML = typed ? [...typed].map(c => `<span class="slot">${esc(c)}</span>`).join('') : '<span class="slot empty">&nbsp;</span>';
      const okk = document.querySelector('.key[data-k="ok"]'); if (okk) okk.disabled = !typed;
      const sb = $('#surebox'); if (sb && sb.textContent && word.startsWith(typed)) sb.textContent = ''; // she has put it right herself
    };
    let sureShown = false, armed = false;
    setTimeout(() => { armed = true; }, 700); // taps from the screen before can land here; ignore input for the first moments
    // The word is finished as soon as it is spelled right; for anything else she taps the tick.
    const add = c => { if (!armed) return; if (typed.length < Math.min(24, word.length + 3)) { typed += c; draw(); if (wobj && (help === 'sure' || autoSure) && !sureShown && !word.startsWith(typed)) { sureShown = true; used.add('sure'); $('#surebox').textContent = SURE_MSG; say(SURE_MSG); } if (typed === word) setTimeout(() => { if (typed === word) finish(); }, 350); } };
    const del = () => { typed = typed.slice(0, -1); draw(); };
    const finish = () => { if (typed && !done) { done = true; hush(); const tl = [...used]; res({ typed, hints, reminded, tools: tl, aided: !!help || tl.some(id => REVEALS.includes(id)) }); } };
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
// ---- celebrating a word: a little trumpet, a spoken well done that counts the words, and confetti ----
const ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth'];
function celebrateText(n, N, clean) {
  if (n >= N && N > 1) return clean ? 'Brilliant, first time! That is the last one, and you have done all ' + N + ' words. Fantastic!' : 'Well done, you stuck with it! That is the last one, and you have done all ' + N + ' words. Fantastic!';
  const o = ORD[n - 1] || n + 'th';
  return clean ? 'Brilliant, first time! That is the ' + o + ' one done.' : 'Well done, you worked it out! That is the ' + o + ' one done.';
}
let fanCtx = null;
function fanfare() {
  if (!soundOn()) return;
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
      h(`<div class="screen"><h1>Choose your story</h1>
      <div class="optrow"><button id="caststrip" class="optchip">Characters: <b>${esc(S.girls.slice(0, castN()).join(', '))}</b></button><button id="chtoggle" class="optchip">Choices: <b id="chstate">${nChoices() || 'off'}</b></button><button id="lentoggle" class="optchip">Length: <b id="lenstate">${curLen().label.toLowerCase()}</b></button></div>
      ${aiKey() ? '' : '<p class="subtle">Stories are written by AI. Add the AI key with the settings gear to use these.</p>'}
      ${hasStory ? `<div class="againrow">${card('again', 'book', (done ? 'Play again: ' : st.part > 0 ? 'Carry on: ' : 'Play: ') + ep.title, done ? 'Tell this story again' : st.part > 0 ? 'Not finished yet' : 'Not played yet', 'wide')}<button id="resetstory" class="optchip">Reset</button></div>` : ''}
      <div class="shelf">${unused.map(t => card('i' + all.indexOf(t), t.icon, t.title, t.blurb)).join('')}</div>
      ${card('own', 'pencil', 'Write my own story', 'Tell me your idea', 'wide own')}
      ${told.length ? `<h2 class="shelfhead">Already told</h2><p class="subtle">Pick one to tell it again with this week's words.</p><div class="shelf told">${told.map(t => card('i' + all.indexOf(t), t.icon, t.title, t.blurb)).join('')}</div>` : ''}
      </div>`);
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
      const id = 'ai' + Date.now(); S.eps = S.eps || {}; S.eps[id] = made; wk.ep = id; S.story[wk.id] = { part: 0 }; if (pick.kind === 'type') markUsed(pick.type); save(); startPictures(id);
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
  const ep = epOf(wk), st = S.story[wk.id], sound = soundOn();
  const beats = [].concat(...ep.parts);
  const order = beats.filter(b => b.p && b.word).map(b => b.word);
  wk.words.forEach(x => { if (!order.includes(x.w)) order.push(x.w); });
  const steps = storySegments(beats);
  prepShown = false;
  await prep([].concat(...steps.filter(x => x.seg).map(x => chunkItems(x.seg).map(chunkText))).concat(partTexts(beats.filter(b => b.c), wk), spellTexts(wk), [STORY_INTRO]), 'Your story is ready!', true);
  if (justWritten) { justWritten = false; if (!prepShown) await storyReadyScreen(); }
  prog = ep.title;
  if ((await gentle('Some words in this story are highlighted in yellow.', 'They are this week\'s words. We will have a little go at them afterwards.', 'Start the story', STORY_INTRO)) === BACK) return home();
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
  const go = await gentle('That was the story!', 'Now let us see which of the yellow words you remember. I will say each one, and you can have a go at spelling it.', 'Ready', SPELL_INTRO);
  if (go === BACK) return home();
  await loadPics(wk);
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
  if (ep.sentences && ep.sentences[w]) return fill(ep.sentences[w]);
  for (const part of ep.parts || []) for (const b of part) if (b.p && b.word === w) return fill(lastSentence(b.p));
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
    h(`<div class="screen wordpage cheer">${confettiHtml()}${page}${picHtml(word)}<div class="bigstar"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS.star}</svg></div><p class="msg">${esc(text)}</p>${n && N ? progressStars(n, N) : ''}
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
      document.querySelectorAll('.key').forEach(b => { b.onclick = () => { if (!armed) return; const k = b.dataset.k; if (k === 'ok') return submit(); if (k === 'del') typed = typed.slice(0, -1); else if (typed.length < Math.min(24, word.length + 3)) typed += k; draw(); if (typed === word) setTimeout(() => { if (typed === word) submit(); }, 350); }; });
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
      const id = helpsFor(it.x).includes('family') ? 'family' : await helpMenu(it.x); if (id === BACK) continue;
      a = await writeWord(word, false, null, it.x, false, cue, id); if (a === BACK) continue;
    }
    const tl = a.tools.concat(traced ? ['trace'] : []), aided = a.aided || traced;
    const ok = a.typed === word;
    S.log.push({ t: Date.now(), d: today(), wk: week.id, w: word, mode: it.mode || 'revise', typed: a.typed, hints: a.hints, remind: a.reminded || undefined, tools: tl.length ? tl : undefined, aided: aided || undefined, look: it.look || undefined, ok, redo: !it.counts || attempts++ > 0 || undefined });
    save();
    if (!ok) { if ((await hintLadder(week, it.x, it.mode, it.context ? sentence : null, a.tools && a.tools.includes('family'))) === BACK) continue; }
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
function helpMenu(x) {
  return new Promise(r => {
    h(`<div class="screen"><p class="msg">Which help would you like?</p><div class="choices menu">${helpsFor(x).map(id => `<button class="choice" data-h="${id}">${esc(HELP_LABEL[id])}</button>`).join('')}</div></div>`);
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
      if (first && helpsFor(x).includes('family')) return res({ help: 'family' }); // the first help is always the spoken rule
      const m = await new Promise(r => {
        h(`<div class="screen"><p class="msg">Which help would you like?</p><div class="choices menu">${helpsFor(x).map(id => `<button class="choice" data-h="${id}">${esc(HELP_LABEL[id])}</button>`).join('')}</div></div>`);
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
function trickScreen(x) {
  return new Promise(res => {
    const msg = 'Let us remember this word.';
    h(`<div class="screen"><p class="msg">${msg}</p><div class="wordtile">${esc(x.w)}</div>${picHtml(x.w)}
      ${x.mnem ? `<div class="helpline"><b>Memory trick:</b> ${esc(x.mnem)}</div>` : '<p class="subtle">Make up a trick to help you remember it.</p>'}
      <div class="row"><button id="hear" class="iconbtn big" aria-label="Hear it">${ico('speaker')}</button><button id="mk" class="btn">${x.mnem ? 'Change my trick' : 'Make my own trick'}</button><button id="next" class="btn big">Now trace it ${ico('next')}</button></div></div>`);
    const sayAll = () => say(msg + ' ' + x.w + '. ' + (x.mnem || ''));
    on('#hear', sayAll); on('#next', () => { hush(); res(); });
    on('#mk', async () => { const t = await typeText({ title: 'Your memory trick for ' + x.w, initial: '', max: 140 }); if (t && t.trim()) { x.mnem = t.trim(); x.mnemBy = 'bella'; save(); trickScreen(x).then(res); } });
    backBtn(res); sayAll();
  });
}
async function remember() {
  const wk = curWeek(), list = trickyWords(wk);
  if (!list.length) {
    await gentle('No tricky words yet.', 'Do the story or the practice first. Any word that hides will come here.', 'Back home', 'No tricky words yet. Do the story or the practice first. Any word that hides will come here.');
    return home();
  }
  await loadPics(wk);
  await prep(list.map(x => x.w).concat(list.filter(x => x.mnem).map(x => 'Let us remember this word. ' + x.w + '. ' + x.mnem), ['Let us remember this word.']), 'Getting your tricky words ready');
  let i = 0; const starred = new Set();
  while (i < list.length) {
    const x = list[i]; prog = `Word ${i + 1} of ${list.length}`;
    let ok = false, tries = 0;
    while (!ok && tries < 3) {
      tries++;
      await trickScreen(x);
      const t = await traceFlow(x.w); if (t === BACK) { if (i === 0 && tries === 1) return home(); continue; }
      const a = await writeWord(x.w, false, null, x);
      if (a === BACK) continue;
      S.log.push({ t: Date.now(), d: today(), wk: wk.id, w: x.w, mode: 'remember', typed: a.typed, hints: 0, ok: a.typed === x.w, redo: true }); save();
      ok = a.typed === x.w;
    }
    if (!starred.has(x.w)) { S.stars++; starred.add(x.w); save(); }
    if ((await praise(x.w, ok)) === BACK) continue;
    i++;
  }
  prog = '';
  await gentle('All done!', 'The more you do this, the easier those words get.', 'Home', 'All done! The more you do this, the easier those words get.');
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
  const tryLog = (a, help, n) => { S.log.push({ t: Date.now(), d: today(), wk: week.id, w: word, mode: mode || 'revise', typed: a.typed, hints: a.hints || 0, ok: a.typed === word, rung: n, tools: help ? [help].concat(a.tools.filter(t => t !== help)) : undefined, aided: !!help || undefined, redo: true }); save(); };
  let n = 0;
  for (;;) {
    // After the first miss she is not asked anything: the spoken rule comes straight away, and Are you sure? is on for every go from here.
    const auto = !usedFamily && helpsFor(x).includes('family');
    const c = n >= 3 ? 'show' : auto ? { help: 'family', auto: true } : await helpChoice(x, !usedFamily);
    if (c === BACK) return BACK;
    if (c === 'show') {
      if ((await showAnswer(word)) === BACK) { n = 0; continue; } // last resort: she sees the word, then writes it from memory
      const a = await writeWord(word, false, null, x, false, sentence, null, false, true); if (a === BACK) continue; tryLog(a, null, ++n);
      return true;
    }
    const help = c === 'again' ? null : c.help;
    if (help === 'family') usedFamily = true;
    if (help === 'trace') { const t = await traceFlow(word); if (t === BACK) continue; }
    const a = await writeWord(word, false, null, x, false, sentence, help === 'trace' ? null : help, false, true, c.auto ? 'Not quite. Listen to the rule, then have another go.' : '');
    if (a === BACK) continue;
    tryLog(a, help, ++n);
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
  wk.words.forEach(x => { const s0 = storySentence(wk, x.w), r = remindOf(s0, x.w); if (s0) { texts.push(s0); texts.push(cueSpoken(s0, x.w)); } if (r) texts.push(r.spoken); if (x.say) texts.push(x.say); if (familyText(x)) texts.push(familyText(x)); texts.push(hintText(x)); });
  for (let i = 1; i <= wk.words.length; i++) { texts.push(celebrateText(i, wk.words.length, true)); texts.push(celebrateText(i, wk.words.length, false)); }
  OOPS.forEach(t => texts.push(t)); texts.push('This word keeps hiding. A memory trick can help you hold on to it.'); wk.words.forEach(x => { if (x.mnem) texts.push('This word keeps hiding. A memory trick can help you hold on to it. ' + x.mnem); }); texts.push(CLUE, ANSWER_MSG, 'Have another go.', SPELL_INTRO, SURE_MSG, HELP_Q, HELP_MENU); wk.words.forEach(x => texts.push(ANSWER_MSG + ' ' + x.w));
  return texts;
}
// Runs the queue of words. A missed word comes back later in the same run. Returns the first-go results, or null if she went back to the start.
async function runWords(wk, queue, starred) {
  const N = wk.words.length, firsts = {};
  let i = 0;
  while (i < queue.length) {
    const it = queue[i];
    if (it.counts && firsts[it.x.w]) { for (let k = queue.length - 1; k > i; k--) if (queue[k].x.w === it.x.w && !queue[k].counts) queue.splice(k, 1); }
    prog = `Word ${Math.min(i + 1, N)} of ${N}`;
    const r = await reviseWord(wk, it, storySentence(wk, it.x.w), starred);
    if (r === BACK) { if (i === 0) return null; i--; continue; }
    if (it.counts) { firsts[it.x.w] = r; if (!r.good) queue.splice(Math.min(i + 3, queue.length), 0, { x: it.x, look: false, counts: false, mode: it.mode, context: false }); }
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
  const wk = curWeek(), sound = soundOn();
  const met = w => S.log.some(l => l.wk === wk.id && l.w === w);
  const due = (S.due && S.due[wk.id]) || [];
  const queue = shuffle(wk.words.slice()).sort((p, q) => (due.includes(q.w) ? 1 : 0) - (due.includes(p.w) ? 1 : 0)).map(x => ({ x, look: !sound || !met(x.w), counts: true, mode: 'revise' }));
  ensureTools(wk);
  await prep(spellTexts(wk), 'Getting the words ready');
  await loadPics(wk);
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
function home() {
  if (pendingReload) { pendingReload = false; location.reload(); return; }
  prog = '';
  const wk = curWeek(), ep = epOf(wk);
  const stNow = S.story[wk.id];
  const sub = !ep || !stNow ? 'Choose a story' : stNow.part >= ep.parts.length ? 'Choose or play again' : 'Carry on';
  const storyBtn = `<button id="story" class="tile t-story"><span class="ticon">${ico('book')}</span><div class="tt"><b>${S.name ? esc(S.name) + "'s story" : "My story"}</b><small>${esc(sub)}</small></div></button>`;
  h(`<div class="top"><span class="wordmark">${ico('star')}<span>BellaSpeller</span></span></div>
    <div class="screen"><div class="hello"><h1>Hello${S.name ? ' ' + esc(S.name) : ''}!</h1><p>What shall we do today?</p></div>
    <div class="tiles">${storyBtn}
    <button id="quick" class="tile t-quick"><span class="ticon">${ico('bolt')}</span><div class="tt"><b>${S.name ? esc(S.name) + "'s practice" : "My practice"}</b><small>Just the ${wk.words.length} words</small></div></button>
    <button id="remember" class="tile t-rem"><span class="ticon">${ico('bulb')}</span><div class="tt"><b>${S.name ? esc(S.name) + "'s revision" : "My revision"}</b><small>Remember the tricky words</small></div></button>
    <button id="grown" class="tile t-grown"><span class="ticon">${ico('users')}</span><div class="tt"><b>Grown-ups</b><small>This week's words and story</small></div></button></div></div>`, { noTop: true });
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
let adultTab = 'words', adultFlash = '';
const ADULT_TABS = [['words', 'This week'], ['story', 'Story'], ['tools', 'Tools'], ['progress', 'Progress'], ['settings', 'Settings']];
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
      <label>One word per line. To change, add or remove words, edit the list.</label>
      <textarea id="cw" spellcheck="false">${esc(wk.words.map(x => x.w + (x.say ? ' | ' + x.say : '')).join('\n'))}</textarea>
      <p class="note">${epOf(wk) ? 'The story for this week was written for the old words, so it will be removed. Her stars and past answers are kept.' : ''}</p>
      <button id="saveWords" class="btn">Save the new words</button>
    </div>

    <h2>Add a new week</h2>
    <label>Day of the spelling test</label><input id="nl" type="date" value="${new Date(Date.now() + 4 * 864e5).toISOString().slice(0, 10)}" style="max-width:220px">
    <label>The spelling rule, as printed on the sheet (optional)</label><input id="nr" type="text">
    <label>Paste the words here, one per line or separated by commas</label><textarea id="nw" spellcheck="false"></textarea>
    <p class="note">To add a spelling voice for a tricky word, write it after a bar, like this: every | ev-er-y</p>
    <button id="read" class="btn">Add these words</button>
    <div id="preview"></div>

    <h2>School test score</h2>
    <p class="note">Enter this at the end of the week, when the marked test is back.</p>
    <label>Score for ${esc(wk.label)}, out of ${wk.words.length}</label><input id="score" type="number" min="0" max="${wk.words.length}" value="${wk.score == null ? '' : wk.score}" style="max-width:120px">
    <div><button id="saveScore" class="btn">Save score</button></div>
    </div><div class="tabpane" data-tab="story"><h2>Story for this week</h2>
    <p>${epOf(wk) ? 'A story is ready: "' + esc(epOf(wk).title) + '" (' + storyWordCount(epOf(wk)) + ' words).' + (storyWordCount(epOf(wk)) > curLen().max ? ' <b>This is over the ' + curLen().max + '-word limit. Press Write a different story.</b>' : '') : 'No story yet. Revision works without one.'}</p>
    ${aiKey() ? `${epOf(wk) ? '<button id="readStory" class="btn">Read this story</button> ' : ''}<button id="draft" class="btn">${epOf(wk) ? 'Write a different story' : 'Write the story'}</button>` : '<p class="note">To have stories written by AI, add an OpenRouter key under Settings, at the bottom of this page.</p>'}
    <div id="draftOut"></div>

    ${aiKey() ? `<h2>Compare models</h2><p class="note">Writes this week's story with each model so you can choose on evidence. One attempt each, so the results show how often each gets it right first time.</p>
    <input id="cm1" type="text" value="anthropic/claude-sonnet-5.5"><input id="cm2" type="text" value="openai/gpt-6.1-sol" style="margin-top:8px"><input id="cm3" type="text" value="google/gemini-4-hydrogen" style="margin-top:8px">
    <button id="compare" class="btn">Write with all three</button><div id="cmpOut"></div>` : ''}

    ${aiKey() || S.orKey ? `<h2>Story pictures</h2><p class="note">Each story gets one picture for each word, drawn by an image model, shown under the story and again when she spells the word. They are drawn in the background after the story is written and kept on this device. An image costs a fraction of a penny.</p>
    <label><input type="checkbox" id="picsOn" ${S.pics !== false ? 'checked' : ''}> Draw pictures for stories</label>
    <label>Picture model</label><select id="imgSel">${IMG_MODELS.map(m => `<option value="${m}" ${imgModel() === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select>
    <div><button id="imgTry" class="btn small">Try a sample with every model</button> <button id="drawPics" class="btn small">${epOf(wk) ? 'Draw pictures for this story' : 'No story yet'}</button></div>
    <p id="picStat" class="note"></p><div id="imgOut"></div>` : ''}
    <h2>Handwriting test</h2><p class="note">A test of reading handwriting from a pen. Type the word you are going to write, write it below with the pen, and press Read it. To see whether the AI "corrects" mistakes, write a word with a deliberate misspelling and type it exactly as you wrote it. Nothing here is saved except the results list below.</p>
    <label>The word you will write, exactly as you write it</label><input id="hwWord" type="text" autocomplete="off" spellcheck="false" placeholder="for example because">
    <label>How to read it</label><select id="hwMode"><option value="word">The whole word at once (AI vision)</option><option value="boxes">One letter per box (AI vision)</option><option value="builtin">The device's own recognizer, if it has one</option></select>
    <label>AI vision model</label><select id="hwModel">${HW_MODELS.map(m => `<option value="${m}">${esc(m)}</option>`).join('')}</select>
    <div id="hwWrap" class="hwwrap"><canvas id="hwGuide"></canvas><canvas id="hwInk"></canvas></div>
    <div><button id="hwClear" class="btn small">Clear</button> <button id="hwRead" class="btn small">Read it</button> <button id="hwCopy" class="btn small">Copy the results</button></div>
    <p id="hwOut" class="note"></p><div id="hwLog"></div>
    </div><div class="tabpane" data-tab="progress"><h2>Progress</h2>
    <p>Words she owns (right first time, without a hint, on two different days): <b>${own.length}</b>.</p>
    <table><tr><th>Week</th><th>School score</th><th>Days used</th><th>Right first time, no hint</th><th>Story</th></tr>${rows}</table>
    <h2>Revision sittings</h2>
    ${(S.sittings || []).filter(x => x.wk === wk.id).length ? `<table><tr><th>Day</th><th>Right first time</th><th>After</th></tr>${(S.sittings || []).filter(x => x.wk === wk.id).map(x => `<tr><td>${esc(x.d)}</td><td>${x.score} out of ${x.of}</td><td>${x.kind === 'story' ? 'the story' : 'revision'}</td></tr>`).join('')}</table>` : '<p class="note">None yet. The score counts a word only when she writes it right first time, without Remind me or Next letter.</p>'}
    <h2>Tools Bella has tried</h2>
    ${toolsProgress()}
    <h2>This week, word by word</h2>
    <table><tr><th>Word</th><th>Tries</th><th>Right first time</th><th>Hints</th><th>What she typed when wrong</th><th>Owned</th></tr>${wordRows}</table>

    </div><div class="tabpane" data-tab="tools">${toolsPane(wk)}</div><div class="tabpane" data-tab="settings"><h2>Settings</h2>
    <label>Her first name (stays on this device)</label><input id="name" type="text" value="${esc(S.name)}" maxlength="14">
    <label>Voice that reads aloud (try each one)</label><select id="vsel"><option value="">Automatic</option>${('speechSynthesis' in window ? speechSynthesis.getVoices() : []).filter(x => /^en/i.test(x.lang)).map(x => `<option value="${esc(x.name)}" ${S.voiceName === x.name ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
    <p class="note">This is the device's own free voice. It is used when no recorded voice is chosen, while a recorded phrase is not ready yet, and for any line that contains her name.</p>
    <label>Recorded voice (uses the OpenRouter key below; saved on this device after first use)</label><select id="psel"><option value="">None: use this device's voice</option>${PRESETS.map(p => `<option value="${p.id}" ${effVp() === p.id ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}</select>
    <div><button id="psample" class="btn small">Hear a sample</button> <button id="pready" class="btn small">Get this week's words ready</button></div>
    <p id="pstat" class="note">${esc(lastTtsErr)}</p>
    <label>OpenRouter key, for writing stories (stays on this device, and is left out of backups)</label><input id="orKey" type="password" autocomplete="off" value="${esc(S.orKey || '')}">
    <label>Family rules for the stories (added to every story request)</label><textarea id="famRules" style="min-height:110px">${esc(S.familyRules === undefined ? DEFAULT_FAMILY_RULES : S.familyRules)}</textarea>
    <label>AI model for writing stories</label>${modelSelect('orModel')}
    <label>Or type another model name (optional)</label><input id="orModelOther" type="text" autocomplete="off" placeholder="for example openai/gpt-6.1-sol">
    <label>Story AI address (leave blank for OpenRouter; any OpenAI-style service works, for example Z.ai)</label><input id="aiBase" type="text" autocomplete="off" placeholder="https://openrouter.ai/api/v1" value="${esc(S.aiBase || '')}">
    <label>Story AI key (leave blank to use the OpenRouter key)</label><input id="aiKey" type="password" autocomplete="off" value="${esc(S.aiKey || '')}">
    <div><button id="saveName" class="btn">Save settings</button> <button id="backup" class="btn small">Save a backup file</button></div>
    <p class="note">BellaSpeller ${APP_VERSION}. Everything is stored on this device only.</p></div></div>`);
  adultFlash = '';
  const showTab = t => { adultTab = t; document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.t === t)); document.querySelectorAll('.tabpane').forEach(d => { d.hidden = d.dataset.tab !== t; }); };
  document.querySelectorAll('.tab').forEach(b => { b.onclick = () => showTab(b.dataset.t); });
  showTab(adultTab);
  on('#saveName', () => { S.name = $('#name').value.trim(); S.orKey = $('#orKey').value.trim(); S.orModel = $('#orModelOther').value.trim() || $('#orModel').value || DEFAULT_MODEL; S.aiBase = $('#aiBase').value.trim(); S.aiKey = $('#aiKey').value.trim(); S.familyRules = $('#famRules').value; save(); adult(); });
  wireHandwriting();
  if ($('#picsOn')) $('#picsOn').onchange = e => { S.pics = e.target.checked; save(); };
  if ($('#imgSel')) $('#imgSel').onchange = e => { S.imgModel = e.target.value; save(); };
  if ($('#drawPics')) $('#drawPics').onclick = async () => {
    if (!epOf(wk)) return;
    const st = $('#picStat'); st.textContent = 'Drawing...'; $('#drawPics').disabled = true;
    await startPictures(wk.ep, true);
    $('#drawPics').disabled = false;
  };
  if ($('#imgTry')) $('#imgTry').onclick = async () => {
    const out = $('#imgOut'), btn = $('#imgTry'); btn.disabled = true;
    const scene = 'Two friends ' + '{g1} and {g2}' + ' kneel at a living-room table building a bridge from folded paper that spans the gap between two stacks of books, with a pile of paper clips on the bridge.';
    out.innerHTML = '<p class="note">Drawing the same scene with ' + IMG_MODELS.length + ' models. This can take up to a minute.</p>';
    const res = await Promise.all(IMG_MODELS.map(async m => { const t0 = Date.now(); try { const b = await genImage(m, picPrompt(scene)); return { m, url: URL.createObjectURL(b), secs: ((Date.now() - t0) / 1000).toFixed(1) }; } catch (e) { return { m, err: e.message }; } }));
    out.innerHTML = res.map(r => `<div class="cmp"><b>${esc(r.m)}</b>${r.secs ? ' · ' + r.secs + ' seconds' : ''}<br>${r.err ? esc(r.err) : `<img class="sampleimg" src="${r.url}" alt=""><div><button class="btn small" data-use="${esc(r.m)}">Use this one</button></div>`}</div>`).join('');
    out.querySelectorAll('[data-use]').forEach(b => { b.onclick = () => { S.imgModel = b.dataset.use; save(); $('#imgSel').value = S.imgModel; $('#picStat').textContent = 'Now using ' + S.imgModel + '.'; }; });
    btn.disabled = false;
  };
  on('#readStory', () => { $('#draftOut').innerHTML = storyPreview(epOf(wk)); });
  on('#draft', async () => {
    const out = $('#draftOut'), btn = $('#draft');
    btn.disabled = true; out.innerHTML = '<p class="note">Writing the story. This can take up to a minute.</p>';
    try {
      const ep = await draftStory(wk);
      out.innerHTML = `<p class="note">Please read it through before she sees it.</p>${storyPreview(ep)}<button id="useStory" class="btn">Use this story</button>`;
      on('#useStory', () => {
        const id = 'ai' + Date.now();
        S.eps = S.eps || {}; S.eps[id] = ep; wk.ep = id; delete S.story[wk.id]; save(); startPictures(id); adult();
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
  document.querySelectorAll('.redtick').forEach(c => { c.onchange = () => { wk.words[+c.dataset.i].red = c.checked || undefined; save(); }; });
  document.querySelectorAll('.toolsw').forEach(c => { c.onchange = () => { S.tools = S.tools || {}; S.tools[c.dataset.t] = c.checked; save(); }; });
  on('#tsave', () => {
    document.querySelectorAll('.tf').forEach(f => { const x = wk.words[+f.dataset.i], v = f.value.trim().toLowerCase(); const k = f.dataset.f;
      const bad = (k === 'hard' && v && !x.w.includes(v)) || (k === 'parts' && v && v.replace(/\|/g, '') !== x.w) || (k === 'say' && v && v.replace(/-/g, '') !== x.w);
      if (k === 'wrong') { const list = f.value.split(',').map(t => t.trim().toLowerCase()).filter(t => /^[a-z'-]+$/.test(t) && t !== x.w).slice(0, 6); x.wrong = list.length ? list : undefined; return; }
      if (k === 'mnem') { const t = f.value.trim(); if (t !== (x.mnem || '')) { x.mnem = t || undefined; x.mnemBy = t ? 'grown-up' : undefined; } return; }
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
    nw.forEach(x => { const old = wk.words.find(o => o.w === x.w); if (old) { x.red = old.red; if (!x.say) x.say = old.say; ['hard', 'parts', 'mnem', 'mnemBy', 'wrong', 'family', 'rule', 'ruleTried', 'sug'].forEach(k => { x[k] = old[k]; }); } });
    const changed = nw.map(x => x.w).join() !== wk.words.map(x => x.w).join();
    wk.words = nw;
    if (changed) { wk.ep = null; delete S.story[wk.id]; }
    save(); ensureTools(wk); adultFlash = 'Saved. This week now has ' + nw.length + ' words.' + (changed ? ' Write a new story on the Story tab.' : ''); adult();
  });
  on('#read', () => {
    const ws = parseWords($('#nw').value);
    if (!ws.length) { $('#preview').innerHTML = '<p class="note">No words found.</p>'; return; }
    const redFrom = ws.length >= 6 ? ws.length - 3 : ws.length;
    $('#preview').innerHTML = `<p>Nearly done. Tick any red words from the school list, then save.</p>` +
      ws.map((x, i) => `<div class="wl"><input type="checkbox" id="r${i}" ${i >= redFrom ? 'checked' : ''}><b>${esc(x.w)}</b>${x.say ? ' <span class="note">' + esc(x.say) + '</span>' : ''}</div>`).join('') +
      `<p class="note">You can write a story for these words on the Story tab. Revision works without one.</p><button id="saveWeek" class="btn">Save this week and use it</button>`;
    on('#saveWeek', () => {
      ws.forEach((x, i) => { x.red = $('#r' + i).checked || undefined; });
      const id = 'w' + Date.now();
      S.weeks.push({ id, label: $('#nl').value ? 'Test on ' + new Date($('#nl').value + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Week added ' + today(), rule: $('#nr').value.trim(), words: ws, score: null, ep: null });
      S.cur = id; save(); ensureTools(S.weeks[S.weeks.length - 1]); adultTab = 'story'; adultFlash = 'Saved. This week is now: ' + ws.map(x => x.w).join(', ') + '. Next: press "Write with all three" below to have stories written for these words.'; adult();
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
home();
// Ask the browser to keep the data permanently, and restore from the safety copy if the main store came back empty.
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { }
if (loadedFresh) mirrorGet().then(j => { try { const m = JSON.parse(j); if (m && !looksFresh(m)) { S = m; localStorage.setItem(KEY, j); home(); } } catch (e) { } });
