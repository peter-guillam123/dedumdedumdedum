// The nine lessons. Every line of Shakespeare is fetched from the corpus by
// reference (play, act, scene, line), never typed out here, so the quotes are
// always right. Copy: British English, plain words, choices not rules.
//
// Step types: text, line, passage, mark, count, choice, spot, reline, vp, tap, takeaway.
// In text, *x* is italic and **x** is bold.

const R = (play, a, s, from, to = from) => ({ play, a, s, from, to });

export const LESSONS = [
  {
    id: "heartbeat",
    title: "The heartbeat",
    blurb: "Hear the pulse under Shakespeare's verse, and tap along to it.",
    steps: [
      {
        type: "text",
        title: "You already speak in iambs",
        body: [
          "Say this out loud, the way you'd normally say it: **I want to go to bed.**",
          "Listen to where your voice leans: i WANT to GO to BED. Light, heavy. Light, heavy. Light, heavy.",
          "That light-heavy pair is the heartbeat of Shakespeare's verse: *de-DUM*. English falls into it all the time without trying.",
        ],
        example: "I want to go to bed.",
      },
      {
        type: "text",
        title: "Five heartbeats make a line",
        body: [
          "A light syllable followed by a heavy one is called an *iamb* (EYE-am). Put five in a row and you get a line of *iambic pentameter*. Penta means five.",
          "de-DUM de-DUM de-DUM de-DUM de-DUM.",
          "Most of the verse in Shakespeare's plays is built on that pattern. Press play to hear it.",
        ],
        pulse: 5,
      },
      {
        type: "tap",
        title: "Tap along",
        body: ["Press the big button, or the space bar, on every DUM. Two lines' worth: ten DUMs."],
      },
      {
        type: "line",
        title: "Now with words",
        ref: R("twelfth_night", 1, 1, 1),
        body: ["The first line of *Twelfth Night*. Press play and listen to the heartbeat under the words. Then say it with the heartbeat, then without."],
      },
      {
        type: "mark",
        title: "Your turn",
        ref: R("romeo_juliet", 2, 2, 2),
        body: ["Romeo, seeing Juliet at her window. Say it out loud, then tap the syllables you lean on."],
        after: ["Five beats: but SOFT! what LIGHT through YON-der WIN-dow BREAKS? About as regular as a line can be."],
      },
      {
        type: "text",
        title: "A pulse, not a drum",
        body: [
          "Nobody wants to hear de-DUM hammered out. The heartbeat isn't how to say a line. It's a pulse under the words that you, and the audience, can feel.",
          "Once you can feel it, you'll start to notice where Shakespeare breaks it. Those are often the most interesting moments in a speech, and we'll get to them in lesson 5.",
        ],
      },
      {
        type: "takeaway",
        points: ["An iamb is de-DUM: a light syllable, then a heavy one.", "Five iambs make a line of iambic pentameter.", "The rhythm is a pulse to feel, not a beat to hammer."],
        try: [{ lib: "music", label: "Orsino: If music be the food of love" }],
      },
    ],
  },

  {
    id: "ten",
    title: "Ten syllables, five beats",
    blurb: "Count a line, find the beats, and meet the light ones and the heavy ones.",
    steps: [
      {
        type: "text",
        title: "Count on your fingers",
        body: [
          "A regular line has ten syllables, and the beats fall on the even ones: 2, 4, 6, 8 and 10.",
          "When a line feels odd, counting is the quickest way to find out why. Actors do it on their fingers in rehearsal. No one minds.",
        ],
      },
      {
        type: "count",
        title: "How many syllables?",
        ref: R("merchant", 4, 1, 191),
        body: ["Portia, pleading with Shylock. Count the syllables."],
        options: [9, 10, 11, 12],
        answer: 10,
        after: ["the QUAL-i-ty of MER-cy IS not STRAIN'D. Ten."],
      },
      {
        type: "mark",
        title: "Now find the beats",
        ref: R("merchant", 4, 1, 191),
        body: ["Same line. Tap the syllables that take a beat."],
        after: [
          "The beats fall on QUAL, TY, MER, IS and STRAIN'D.",
          "Look at TY and IS. The pattern gives them a beat, but you'd never punch them. Hold that thought.",
        ],
      },
      {
        type: "text",
        title: "Not every beat is equal",
        body: [
          "The pattern says DUM on every even syllable. Real speech doesn't. Some beats land on small syllables (of, the, is, -ty), and some heavy words sit between the beats.",
          "In our marks a **hollow red circle** is a light beat: the pattern's beat on a small syllable. A **small black dot** is a weighty word off the beat.",
          "Let both happen. The pull between the pattern and the way we actually talk is what keeps verse sounding alive rather than sing-song.",
        ],
        key: true,
      },
      {
        type: "line",
        title: "Weighty words off the beat",
        ref: R("henryv", 3, 1, 1),
        force: "x/x/x/x/x/",
        body: ["Henry V, rallying tired soldiers. 'Once', 'dear' and the second 'once' are strong words sitting off the beat. Two heavy syllables side by side slow a line down: right for a king who needs every word to land."],
      },
      {
        type: "mark",
        title: "One with light beats",
        ref: R("romeo_juliet", 2, 2, 3),
        body: ["Tap the beats. Watch for the small words."],
        after: ["it IS the EAST, and JU-liet IS the SUN. Both 'is'es take a light beat. Say them lightly and the line moves."],
      },
      {
        type: "choice",
        title: "Quick check",
        prompt: "In a regular line, where do the beats fall?",
        options: [
          { text: "On syllables 1, 3, 5, 7 and 9", why: "That's the other way round: DUM-de. Shakespeare does start lines that way sometimes, but it's the exception." },
          { text: "On syllables 2, 4, 6, 8 and 10", ok: true, why: "Yes. de-DUM, five times." },
          { text: "Wherever the important words are", why: "The important words often do land on beats, but the pattern itself is fixed: 2, 4, 6, 8, 10. The fun is when the words and the pattern disagree." },
        ],
      },
      {
        type: "takeaway",
        points: ["Ten syllables, beats on the even ones.", "Light beats and weighty offbeats are normal. Let them be.", "When a line feels odd, count it."],
        try: [{ lib: "soft", label: "Romeo: But, soft! what light" }, { lib: "mercy", label: "Portia: The quality of mercy" }],
      },
    ],
  },

  {
    id: "verse-prose",
    title: "Verse or prose?",
    blurb: "Tell them apart on the page and by ear, and ask why a character switches.",
    steps: [
      {
        type: "text",
        title: "Two ways of speaking",
        body: [
          "Shakespeare's characters speak in **verse**, with a rhythm and a set line length, or in **prose**: ordinary sentences, with no set rhythm.",
          "Counting lines, 33 of the 37 plays in this site are mostly verse. *Richard II* and *King John* are almost all verse. *The Merry Wives of Windsor* is more than four-fifths prose. Nearly every play has both, and the switch from one to the other is always worth asking about.",
        ],
      },
      {
        type: "passage",
        title: "On the page: verse",
        ref: R("twelfth_night", 2, 2, 18, 21),
        plain: true,
        body: ["Verse lines start with a capital letter and stop short of the edge of the page, so the right-hand side is ragged."],
      },
      {
        type: "passage",
        title: "On the page: prose",
        ref: R("hamlet", 2, 2, 317, 321),
        plain: true,
        body: ["Prose runs across to the margin, and a new line can start with a small letter in the middle of a sentence. Those line breaks are the printer's, not Shakespeare's. Your edition will break them somewhere else."],
      },
      {
        type: "vp",
        title: "By ear",
        ref: R("julius_caesar", 3, 2, 83, 86),
        form: "verse",
        body: ["Here's a passage with the line breaks taken out. Read it aloud. Can you feel a steady de-DUM?"],
        why: "Verse. Mark Antony at Caesar's funeral: four lines, each with five beats.",
      },
      {
        type: "vp",
        title: "And another",
        ref: R("julius_caesar", 3, 2, 14, 18),
        form: "prose",
        body: ["Same scene, a few minutes earlier. Verse or prose?"],
        why: "Prose. Brutus explaining to the crowd why he killed Caesar: clear, balanced, reasonable sentences. Antony answers him in verse, and wins the crowd.",
      },
      {
        type: "text",
        title: "Who speaks what?",
        body: [
          "There are tendencies, not rules. Verse is often for high feeling, high status, public speech, love, prayer and plotting. Prose is often for comedy, servants and commoners, private talk, letters, madness, and moments when someone drops their guard.",
          "Shakespeare breaks the tendencies all the time. Shylock's 'Hath not a Jew eyes?' is prose. Caliban, called a monster by everyone else, speaks some of the loveliest verse in *The Tempest* to two drunks who speak prose.",
          "So don't ask 'what's the rule?' Ask: why is this character speaking this way, here, to this person?",
        ],
      },
      {
        type: "choice",
        title: "A switch",
        prompt: "Lady Macbeth speaks verse for most of the play. In her last scene, walking in her sleep, she speaks prose. What might the switch tell you?",
        ref: R("macbeth", 5, 1, 31, 33),
        plain: true,
        options: [
          { text: "Her control has gone, and so has the controlled verse", ok: true, why: "That's how most productions read it. The woman who once commanded spirits in tight verse now speaks in broken fragments." },
          { text: "She's talking to servants, so she drops into prose", why: "Status is a common reason for prose, but not here. She doesn't know anyone is listening." },
          { text: "It doesn't mean anything", why: "Shakespeare's switches are rarely accidents. It's always worth asking what changed." },
        ],
      },
      {
        type: "takeaway",
        points: ["Verse: a rhythm, a line length, capitals and a ragged right edge.", "Prose: sentences. The line breaks on the page mean nothing.", "A switch between them is a signal. Ask why."],
        try: [{ lib: "romans", label: "Brutus in prose" }, { lib: "friends", label: "then Antony in verse" }],
      },
    ],
  },

  {
    id: "line-end",
    title: "The end of the line",
    blurb: "Lines that land and lines that run on, last words, and where to breathe.",
    steps: [
      {
        type: "text",
        title: "Honour the line",
        body: [
          "In verse, the line is a unit of thought and of breath. Teachers of Shakespeare often say: honour the line ending.",
          "That doesn't mean stopping at the end of every line. It means not throwing the last word away.",
        ],
      },
      {
        type: "passage",
        title: "Landing and running on",
        ref: R("twelfth_night", 2, 2, 21, 22),
        body: [
          "When a line ends with punctuation, the thought lands there, and it's a natural place to breathe. When it doesn't, the sense runs on into the next line.",
          "Viola's first line here runs on: 'the cunning of her passion / Invites me'. Carry straight on, but give 'passion' a tiny lift so we still feel the shape of the line.",
        ],
      },
      {
        type: "reline",
        title: "Put the lines back",
        ref: R("twelfth_night", 1, 1, 1, 4),
        body: ["Here are the first four lines of *Twelfth Night* with the line breaks taken out. Tap the gaps between words to put them back. Each line should come to about ten syllables."],
      },
      {
        type: "text",
        title: "Last words",
        body: [
          "The last word of a line is often the most important word in it. Try this with any speech: say only the last word of each line, in order.",
          "Macbeth, told his wife is dead: **hereafter, word, to-morrow, day, time, fools, candle, player, stage, tale, fury, nothing.** That's nearly the whole speech in twelve words.",
          "The rehearsal room's *Line ends* view does this for any speech.",
        ],
      },
      {
        type: "spot",
        title: "A thought starts mid-line",
        ref: R("hamlet", 3, 1, 68),
        prompt: "Tap the word where a new sentence starts in the middle of this line.",
        answers: ["to"],
        first: true,
        after: [
          "'To die' starts a new thought halfway through the line.",
          "When a thought starts mid-line, the verse gives you no time for a long pause. The new idea arrives quickly, as if it's only just occurred to you.",
        ],
      },
      {
        type: "text",
        title: "A breath plan",
        body: [
          "A simple plan to start from: breathe at the end of a line when there's punctuation. Carry on without a breath when there isn't. Avoid breathing in the middle of a line unless the punctuation asks for it.",
          "You'll break this plan. That's fine, as long as you know when you're doing it. The rehearsal room's *Breath* view marks one way to breathe through any speech.",
        ],
      },
      {
        type: "takeaway",
        points: ["Don't throw the last word of a line away.", "Lines that run on: carry on, with a lift on the last word.", "A thought starting mid-line comes in quickly."],
        try: [{ lib: "ring", label: "Viola: I left no ring with her" }],
      },
    ],
  },

  {
    id: "breaks",
    title: "When the rhythm breaks",
    blurb: "Lines that start on the beat, extra syllables, short lines and shared lines.",
    steps: [
      {
        type: "text",
        title: "The interesting bits",
        body: [
          "A perfectly regular line is like a resting heartbeat. Many of the best moments in Shakespeare come where the beat changes.",
          "Four changes turn up again and again. Each one is a clue for the actor.",
        ],
      },
      {
        type: "line",
        title: "1. Starting on the beat",
        ref: R("richardiii", 1, 1, 1),
        body: [
          "The first two syllables are turned round: NOW is, DUM-de, instead of de-DUM. Then the line carries on as normal.",
          "It's the most common change in Shakespeare's verse, and it puts energy straight into the first word. Richard grabs the audience from his first syllable.",
        ],
      },
      {
        type: "mark",
        title: "Spot it",
        ref: R("romeo_juliet", 3, 2, 1),
        body: ["Juliet, impatient for night to come. Tap the beats. Where does the line start?"],
        after: ["GAL-lop a-PACE: the line starts on the beat. Juliet doesn't ease in. She commands."],
      },
      {
        type: "line",
        title: "2. An extra syllable at the end",
        ref: R("hamlet", 3, 1, 64),
        body: [
          "Eleven syllables. After the fifth beat comes one more light one: the end of 'question'.",
          "This is often called a feminine ending. It can leave a line open, unresolved, still thinking. Hamlet's whole speech is full of them.",
        ],
      },
      {
        type: "count",
        title: "Count this one",
        ref: R("macbeth", 2, 1, 41),
        body: ["Macbeth, alone, sees a dagger. How many syllables?"],
        options: [9, 10, 11, 12],
        answer: 11,
        after: ["is THIS a DAG-ger WHICH i SEE be-FORE me: eleven, with a light 'me' at the end. The question hangs."],
      },
      {
        type: "line",
        title: "3. Short lines",
        ref: R("macbeth", 5, 5, 19),
        body: [
          "Macbeth has just been told his wife is dead. Seven syllables: three beats where you'd expect five.",
          "A short line leaves silence. Shakespeare wrote for actors, and a gap in the verse is often a gap for something: a look, a move, a reaction, a thought you don't say.",
        ],
      },
      {
        type: "choice",
        title: "What's in the gap?",
        prompt: "Where could Macbeth's missing beats go?",
        options: [
          { text: "A silence before he speaks: the news lands first", ok: true, why: "Playable. The silence belongs to the line, so it doesn't feel like a dropped cue." },
          { text: "A pause after 'hereafter', before the next thought", ok: true, why: "Also playable. Either way, the text has given you time." },
          { text: "Nowhere: say it quickly and move on", why: "You could, but you'd be ignoring the space Shakespeare left you. Try it with the silence first." },
        ],
      },
      {
        type: "passage",
        title: "4. Shared lines",
        ref: R("macbeth", 2, 2, 20, 23),
        body: [
          "Just after the murder. Four speeches, but together they make one line of verse: ten syllables.",
          "When characters share a line, the verse leaves no room for a gap. The cues come straight in, almost on top of each other. Here they're whispering fast in the dark.",
        ],
      },
      {
        type: "line",
        title: "And one line turned upside down",
        ref: R("lear", 5, 3, 364),
        body: ["Lear, holding his dead daughter. Every pair is DUM-de. The whole pattern is back to front, five times over. It's one of the most famous broken lines in the plays."],
      },
      {
        type: "takeaway",
        points: ["Starting on the beat (DUM-de): energy into the first word.", "An extra light syllable at the end: the line stays open.", "Short lines leave silence to fill. Shared lines leave none."],
        try: [{ lib: "tomorrow", label: "Macbeth: Tomorrow, and tomorrow" }, { lib: "deed", label: "Macbeth and Lady Macbeth: shared lines" }],
      },
    ],
  },

  {
    id: "squeeze",
    title: "Squeeze and stretch",
    blurb: "When the count is wrong: o'er and heav'n, belovèd and na-ti-on.",
    steps: [
      {
        type: "text",
        title: "Wrong number of syllables?",
        body: [
          "Sometimes a line has a syllable too many or too few. Often a word needs squeezing or stretching, the way Shakespeare's actors would have said it.",
          "Squeezing: over becomes o'er, never becomes ne'er, heaven becomes heav'n. Stretching: an -ed ending gets sounded (belovèd), or -tion becomes two syllables (na-ti-on).",
        ],
      },
      {
        type: "line",
        title: "A squeeze",
        ref: R("macbeth", 1, 5, 57),
        body: ["Lady Macbeth, calling on the dark. Say 'heaven' as one syllable, heav'n, and the line comes to ten."],
      },
      {
        type: "line",
        title: "Running words together",
        ref: R("hamlet", 3, 1, 79),
        body: ["'The oppressor's' runs together into 'th'oppressor's': three syllables, not four. Many editions print it that way."],
      },
      {
        type: "choice",
        title: "Which word squeezes?",
        prompt: "Said the modern way, this line has eleven syllables. Which word squeezes to make ten?",
        ref: R("twelfth_night", 1, 1, 9),
        plain: true,
        options: [
          { text: "spirit", ok: true, why: "Yes: 'spir't' or 'sprite', one syllable. Shakespeare squeezes 'spirit' often." },
          { text: "love", why: "'Love' is already one syllable." },
          { text: "quick", why: "'Quick' is already one syllable." },
          { text: "thou", why: "'Thou' is already one syllable." },
        ],
      },
      {
        type: "line",
        title: "A stretch: sound the -ed",
        ref: R("macbeth", 2, 1, 47),
        body: ["Macbeth's 'heat-oppressed brain': say op-PRESS-èd, three syllables. Many editions print it with an accent, oppressèd, to tell you."],
      },
      {
        type: "line",
        title: "A stretch: -tion",
        ref: R("henryv", 1, 0, 2),
        body: ["From the opening of *Henry V*. 'Invention' becomes four syllables, in-VEN-ti-ON, and the last one takes a beat. Say it in full and it sounds grand, not odd."],
      },
      {
        type: "choice",
        title: "What fills the line?",
        prompt: "Said the modern way, this line has nine syllables. What makes it ten?",
        ref: R("richardiii", 1, 1, 6),
        plain: true,
        options: [
          { text: "Sound the -ed: bruis-èd", ok: true, why: "Yes: our BRUIS-èd ARMS hung UP for MON-u-MENTS." },
          { text: "Stretch 'monuments' to four syllables", why: "'Monuments' already has three, and there's no ending here that stretches." },
          { text: "Stretch 'arms'", why: "'Arms' can't stretch. Look for an -ed." },
        ],
      },
      {
        type: "line",
        title: "Stress moves too",
        ref: R("henryv", 3, 1, 9),
        body: ["Some words were stressed differently then. Shakespeare says as-PECT, not AS-pect, and this line only scans his way. Try it both ways."],
      },
      {
        type: "takeaway",
        points: ["Too many syllables? Look for a squeeze: o'er, heav'n, th'.", "Too few? Look for a stretch: -èd, -ti-on.", "Don't be shy of the stretch. Said fully, it sounds deliberate."],
        try: [{ lib: "muse", label: "The Chorus: O for a Muse of fire" }],
      },
    ],
  },

  {
    id: "opposites",
    title: "Opposites",
    blurb: "Shakespeare's characters argue in pairs. Find them, point them.",
    steps: [
      {
        type: "text",
        title: "Thinking in pairs",
        body: [
          "Shakespeare's characters think in opposites: to be or not to be, fair and foul, war and peace. The term for it is antithesis.",
          "Find the pairs and point them, and an audience can follow the argument on first hearing. Miss them, and even a clear speech turns to fog.",
        ],
      },
      {
        type: "spot",
        title: "Find the pair",
        ref: R("macbeth", 1, 1, 12),
        prompt: "The witches. Tap the two words that pull against each other.",
        answers: ["fair", "foul"],
        after: ["Fair and foul, twice over, crossed: fair is foul, foul is fair. The whole play turns on it."],
      },
      {
        type: "spot",
        title: "Find the pair",
        ref: R("julius_caesar", 3, 2, 83),
        prompt: "Mark Antony at Caesar's funeral. Tap the two words that pull against each other.",
        answers: ["bury", "praise"],
        after: ["Bury, not praise. Antony says it, then spends the whole speech doing the opposite."],
      },
      {
        type: "text",
        title: "How to point",
        body: [
          "Pointing doesn't mean shouting. Lift the second word of the pair a little, or leave a hair's breadth before it, so we hear the contrast.",
          "Try it: 'To BE, or NOT to be.' Then try it flat. Hear the difference?",
          "Prose argues in opposites too. Brutus: 'Not that I loved Caesar less, but that I loved Rome more.' Two pairs at once: Caesar and Rome, less and more.",
        ],
      },
      {
        type: "choice",
        title: "Which pair carries it?",
        prompt: "Which pair of opposites carries these two lines?",
        ref: R("richardiii", 1, 1, 1, 2),
        plain: true,
        options: [
          { text: "winter and summer", ok: true, why: "Yes. The bad times (winter) have turned good (summer), thanks to 'this sun of York': his brother, now king. Richard's whole speech is built on this kind of turn." },
          { text: "discontent and York", why: "Not opposites. York is Richard's family." },
          { text: "now and made", why: "Not a pair. Look for two things that contrast." },
        ],
      },
      {
        type: "takeaway",
        points: ["Look for pairs: be and not be, fair and foul, bury and praise.", "Point them lightly: lift the second word, or leave a hair's breadth before it.", "Prose argues in opposites too."],
        try: [{ lib: "winter", label: "Richard: Now is the winter" }, { lib: "romans", label: "Brutus: Romans, countrymen" }],
      },
    ],
  },

  {
    id: "thou-you",
    title: "Thou and you",
    blurb: "Two words for 'you', and what it means when a character switches.",
    steps: [
      {
        type: "text",
        title: "Two kinds of you",
        body: [
          "Shakespeare's English had two words for 'you'. **Thou** (with thee, thy and thine) was close: for family, lovers, friends, children, servants, God, and for insults. **You** was more formal or distant: for strangers, superiors, and in public.",
          "Neither rule is fixed, and habits vary. What matters most is when a character changes from one to the other.",
        ],
      },
      {
        type: "passage",
        title: "Thou meets you",
        ref: R("hamlet", 3, 4, 10, 11),
        body: [
          "Hamlet's mother has called him to her room. She says *thou*: she's his mother, and she's scolding him. He throws it back with *you*: cold, formal.",
          "And 'father' means two different men. Hers is his stepfather, Claudius. His is the father Claudius murdered.",
        ],
      },
      {
        type: "spot",
        title: "Spot the switch",
        ref: R("lear", 1, 1, 97, 109),
        prompt: "King Lear and his daughter Cordelia. Lear calls her 'you' at first. Tap the word where he switches.",
        answers: ["thy"],
        after: [
          "'But goes thy heart with this?' Lear moves from you to thou.",
          "It could be closeness (a father pleading) or the start of his fury. Both are playable. Cordelia goes on calling him 'you'.",
        ],
      },
      {
        type: "choice",
        title: "What could a switch mean?",
        prompt: "A character who has been saying 'you' to someone suddenly says 'thou'. What could it mean?",
        options: [
          { text: "Sudden tenderness", why: "Could be. Thou is the word of closeness." },
          { text: "Sudden contempt", why: "Could be. Thou is also the word for insults." },
          { text: "Either: the scene decides", ok: true, why: "Yes. The switch tells you the relationship has changed. What it changed to is your choice, and the rest of the scene will tell you which choice works." },
        ],
      },
      {
        type: "takeaway",
        points: ["Thou: close, warm, or contemptuous. You: formal, cool, or polite.", "A switch marks a change in the relationship, if only for a moment.", "The rehearsal room flags switches for you."],
        try: [{ lib: "closet", label: "Gertrude and Hamlet" }],
      },
    ],
  },

  {
    id: "together",
    title: "Putting it together",
    blurb: "A routine you can use on any speech, tried on Viola's ring speech.",
    steps: [
      {
        type: "text",
        title: "A routine",
        body: [
          "Here's a routine for any speech. It won't tell you how to play it. It'll show you what the text is offering, so your choices come from somewhere.",
          "We'll try it on Viola, in *Twelfth Night*. She's dressed as a young man, and Olivia has just sent a servant after her with a ring Viola never gave.",
        ],
      },
      {
        type: "passage",
        title: "1. Verse or prose?",
        ref: R("twelfth_night", 2, 2, 16, 19),
        plain: true,
        body: ["Capitals at the start of each line, a ragged right edge, and you can hear de-DUM. Verse. A moment ago, talking to Malvolio, she spoke prose. Alone, she moves into verse."],
      },
      {
        type: "mark",
        title: "2. Mark the beats",
        ref: R("twelfth_night", 2, 2, 16),
        body: ["Her first line. Tap the beats."],
        after: ["i LEFT no RING with HER: what MEANS this LA-dy? Eleven syllables, a light one at the end. The question hangs."],
      },
      {
        type: "line",
        title: "3. Look for the breaks",
        ref: R("twelfth_night", 2, 2, 17),
        force: "/xx/x/x/x/x",
        body: ["Next line: it starts on the beat, FOR-tune, and ends on an extra light syllable. A jolt, then a question that won't settle. She's working it out as she goes."],
      },
      {
        type: "text",
        title: "4. Find the thoughts",
        body: [
          "Count the sentences. Viola's speech has lots of them, many short, and several are questions. That's a mind moving fast.",
          "Each new sentence is a new thought. Give each one its own impulse. The rehearsal room's *Thoughts* view lays them out as cards.",
        ],
      },
      {
        type: "spot",
        title: "5. Who is she talking to?",
        ref: R("twelfth_night", 2, 2, 39),
        prompt: "In her last lines Viola talks to something that isn't a person. Tap it.",
        answers: ["time"],
        after: [
          "Time. Characters talk to time, fortune, the stars, and they call them 'thou'.",
          "And the last two lines rhyme: 'not I' and 'untie'. A couplet closes the speech. She can't solve it, so she hands it over.",
        ],
      },
      {
        type: "text",
        title: "6. Choose",
        body: [
          "Now make choices. What does each short line, each extra syllable, each switch give you? There's no single right answer, only choices you can back up from the text.",
          "Then forget all of it and play the scene. The work you've done stays in your body.",
        ],
      },
      {
        type: "takeaway",
        points: ["Verse or prose? Then count, and mark the beats.", "Find the breaks, the thoughts, the opposites, the thous and yous.", "Make choices you can back up from the text. Then play it."],
        try: [{ lib: "ring", label: "Viola's whole speech in the rehearsal room" }],
        final: true,
      },
    ],
  },
];
