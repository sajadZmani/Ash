# آش

A Persian party game for the browser, a copy of **دور** (Night Games) for a group of friends.
Made for fun. Some players are kids, so the word list has no rude words.

Players sit around **one phone** in **teams of two**. The phone shows a word to one player, who
explains it to their teammate with words only: not the word or part of it, no synonyms, no
translations, no acting or sounds. When the teammate gets it, press «درست!» and the phone goes to
the next team. Each team has its own clock that only runs during its turn. A team whose time runs
out is out, and the last team left wins. «عوض کن» changes the word and «خطا» marks a broken rule;
both cost a few seconds.

## Play

Online (after GitHub Pages is on): **https://sajadzmani.github.io/Ash/**

No build step to play. Open `index.html` in a browser (it works from disk too), or serve the
folder (`python3 -m http.server`) and open `http://localhost:8000`.

- 4, 6 or 8 players (2, 3 or 4 teams). Teams are picked at random («گروه‌بندی تصادفی», with a
  re-shuffle) or by hand. Tap ⇅ on two players to swap them. Team names can be edited. The last
  names used are filled in next time.
- Turn order: `A1→A2, B1→B2, … then A2→A1, B2→B1, …`; teams that are out are skipped.
- Settings: time per team (1, 1.5, **2** or 3 minutes), penalty (0, **5** or 10 seconds),
  difficulty, categories, show category above the word, sound (**off** by default), vibration.
- Pause hides the word and stops the clock. Leaving the app pauses too. A refresh brings the game
  back with the clock paused. The screen stays awake during a game where the browser allows it.

Everything (settings, names, words already seen, the game in progress) is saved in the browser's
`localStorage`, so each phone has its own.

### Hosting on GitHub Pages

1. Settings → Pages → Build and deployment → Source: **Deploy from a branch**, pick `main` and
   the `/ (root)` folder, then Save. (A free account needs the repo to be public.)
2. After a minute the game is live at `https://sajadzmani.github.io/Ash/`. `.nojekyll` makes
   GitHub serve the files as they are.

## Words

The official دور list was not reachable, so the words were written for آش: **2036 words in 27
categories**, each marked easy, medium or hard.

| Level | What |
|---|---|
| ۱ آسان (easy) | everyday things any child knows: سیب، گربه، توپ، نانوا |
| ۲ متوسط (medium) | less common or compound: آبمیوه‌گیری، کرگدن، تخت جمشید، تعارف کردن |
| ۳ سخت (hard) | rare, specialist or abstract: باستان‌شناس، شفق قطبی، رودربایستی, and proverbs |

Categories: آشپزخانه، اتاق نشیمن، اتاق خواب، حمام و دستشویی (the house rooms from دور), خوراکی‌ها،
میوه و سبزی، حیوانات، شغل‌ها، مکان‌ها، طبیعت و گیاهان، فضا و علم، بدن، لباس و پوشاک، وسایل نقلیه، مدرسه،
ورزش، فناوری، موسیقی و هنر، اسباب‌بازی و بازی، جشن‌ها و رسم‌ها، کارها (actions), احساس‌ها و خصلت‌ها،
قصه‌ها و افسانه‌ها (Shahnameh, folk tales, fairy tales), ایران‌گردی (Iranian cities and sights),
دور دنیا (countries, cities, landmarks), مشاهیر (poets, scientists, artists), and
ضرب‌المثل‌ها و اصطلاح‌ها (proverbs and idioms, hard only).

Difficulty setting:

- **آسان**: easy words only, good for kids
- **قاطی** (default): all three levels mixed
- **سخت**: medium and hard words
- **پله‌پله**: easy for the first two rounds, then medium for two rounds, then hard

**No repeats:** every word shown on a phone (guessed, changed or lost) is remembered and does not
come back, in this game or later ones. When a category has no unseen words left at the chosen
difficulty, that category starts over, but a word is never shown twice in the same game. Settings
shows how many words have been seen and can start them over.

### Changing the words

Edit `words.txt`: `# name` starts a category, then one word per line as `word|level` (1, 2 or 3).
Then run:

```sh
node tools/build_words.js
```

It writes `data/words.js` (the game reads that file, so it also works from disk) and prints the
count per category and level. It drops and reports duplicates, even across categories, and any
word with a part in `tools/blocked_words.txt` (the blocklist from کلمچین: swearing, insults,
sexual words, drugs and alcohol).

## Files

| Path | What |
|---|---|
| `index.html`, `js/app.js` | screens: home, players and teams, pass the phone, turn, result, popups |
| `js/game.js` | rules: teams, turn order, clocks, penalties |
| `js/words.js` | picks the next word: difficulty, categories, no repeats |
| `js/storage.js` | `localStorage` layer |
| `js/sound.js` | sounds made in code (Web Audio, no files); off until turned on |
| `words.txt` | the word list |
| `data/words.js` | built from `words.txt` |
| `tools/build_words.js`, `tools/blocked_words.txt` | word builder and blocklist |
| `css/style.css`, `fonts/` | look and the Vazirmatn font (from کلمچین) |
