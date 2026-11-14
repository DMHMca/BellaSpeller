// Story episodes. Each is matched to a week by its set of words.
// {g1}..{g4} are the girls' names, chosen on the tablet. Nothing personal is stored here.
// Beats: {n: narration} | {c: {q, o:[{l, n}]}} choice | {w: {word, lead, before, after}} a word she writes.
window.EPISODES = {
  'shiny-shoes': {
    title: 'The Silver Shoes Sleepover',
    words: ['nice', 'nicer', 'shiny', 'shining', 'being', 'every', 'everyone', 'other'],
    parts: [
      [
        { n: "{g1} was planning the best sleepover ever. Pizza, a film, and a midnight feast." },
        { n: "Then {g2} folded her arms. \"If the new girl is coming, I'm not,\" she said. \"{g4} laughed at my new shoes.\"" },
        { w: { word: 'nice', lead: "{g1} passed {g2} a note in maths.", before: "Your shoes are really ", after: "." } },
        { c: { q: "What does {g1} do next?", o: [
          { l: "Ask {g4} why she laughed", n: "{g1} found {g4} by the coat pegs. \"I wasn't laughing at her,\" said {g4}. \"I've got the same shoes at home. Mine are just covered in mud.\"" },
          { l: "Hide the invitation list", n: "{g1} hid the list in her lunch box, under a banana. By lunchtime the list smelled of banana, and {g3} had read it anyway." }
        ] } },
        { w: { word: 'shiny', lead: "That night {g2} wrote in her diary.", before: "My shoes are silver and ", after: " and I love them." } },
        { w: { word: 'every', lead: "{g1} wrote the invitation.", before: "Sleepover at mine! Bring a pillow and ", after: " snack you can carry." } },
        { w: { word: 'other', lead: "The next day, a note came from {g4}.", before: "Sorry about the shoes. Can I sit with you and the ", after: " girls at lunch?" } },
        { n: "{g2} read the note twice. Then she picked up her pen. What she wrote back would change the whole sleepover..." }
      ],
      [
        { n: "Saturday came. {g4} did come to the sleepover. She brought her own silver shoes, and they were covered in mud." },
        { w: { word: 'nicer', lead: "{g3} wrote in the club notebook.", before: "{g4} is much ", after: " than we thought." } },
        { c: { q: "It is nearly midnight. What happens?", o: [
          { l: "Ghost stories with a torch", n: "{g3} held the torch under her chin. It made her nose look enormous. {g2} laughed so much she got hiccups." },
          { l: "A shoe-cleaning competition", n: "{g4} scrubbed her muddy shoes with a toothbrush. It was {g1}'s dad's toothbrush. Nobody told {g1}'s dad." }
        ] } },
        { w: { word: 'shining', lead: "{g1} wrote the next line in the notebook.", before: "At midnight something silver was ", after: " in the dark." } },
        { w: { word: 'being', lead: "{g2} got out her diary.", before: "I am sorry for ", after: " grumpy about my shoes." } },
        { w: { word: 'everyone', lead: "{g4} made a sign for the bedroom door.", before: "This club is for ", after: "." } },
        { n: "Then they heard footsteps on the stairs. It was half past midnight. And the footsteps were getting closer..." }
      ],
      [
        { n: "The door opened. It was {g1}'s little brother, in a dinosaur onesie. He wanted to join the club." },
        { n: "\"Read the door,\" said {g4}. \"You're in.\" So the club wrote down its rules, properly this time." },
        { w: { word: 'nice', lead: "Rule one.", before: "Be ", after: " to new people." } },
        { w: { word: 'nicer', lead: "Rule two.", before: "Be even ", after: " on Mondays." } },
        { w: { word: 'shiny', lead: "Rule three.", before: "Wear ", after: " shoes, or muddy ones." } },
        { w: { word: 'shining', lead: "Rule four.", before: "Keep the torch ", after: " until the story ends." } },
        { w: { word: 'being', lead: "Rule five.", before: "No ", after: " grumpy for more than five minutes." } },
        { w: { word: 'every', lead: "Rule six.", before: "A feast at ", after: " sleepover." } },
        { w: { word: 'everyone', lead: "Rule seven.", before: "The club is for ", after: "." } },
        { w: { word: 'other', lead: "Rule eight.", before: "Look after each ", after: "." } },
        { n: "The little brother signed the rules with a dinosaur footprint. The end. Until next week." }
      ]
    ]
  }
};
