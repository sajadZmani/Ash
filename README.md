# آش

A Persian party game for the browser, for friends.
Made for fun. Some players are kids, so the word list has no rude words.

Players sit around **one phone** in **teams of two**. The phone shows a word to one player, who
explains it to their teammate with words only: not the word or part of it, no synonyms, no
translations, no acting or sounds. When the teammate gets it, press «درست!»: the next team's word
comes up and its clock starts at once, so pass the phone quickly. Only the very first turn of a
game waits behind an «آماده‌ام» (I'm ready) screen. Each team has its own clock that only runs
during its turn. A team whose time runs
out is out, and the last team left wins. «عوض کن» changes the word and «خطا» marks a broken rule;
both cost a few seconds.

## Play

Online (after GitHub Pages is on): **https://sajadzmani.github.io/Ash/**

No build step to play. Open `index.html` in a browser (it works from disk too), or serve the
folder (`python3 -m http.server`) and open `http://localhost:8000`.

- 4 to 12 players in teams of two (2 to 6 teams). Teams are picked at random
  («گروه‌بندی تصادفی», with a re-shuffle) or by hand. Tap ⇅ on two players to swap them. Team names can be edited. The last
  names used are filled in next time.
- Turn order: `A1→A2, B1→B2, … then A2→A1, B2→B1, …`; teams that are out are skipped.
- Settings: time per team (1, 1.5, **2** or 3 minutes), penalty (0, **5** or 10 seconds),
  difficulty, categories, show category above the word, sound (**off** by default), vibration.
  With sound on, a soft tick runs during each turn: every 2 seconds until 30 seconds are left,
  then smoothly faster, higher and louder until the last second.
- Pause hides the word and stops the clock. Leaving the app pauses too. A refresh brings the game
  back with the clock paused. The screen stays awake during a game where the browser allows it.

Everything (settings, names, words already seen, the game in progress) is saved in the browser's
`localStorage`, so each phone has its own.

### Hosting on GitHub Pages

1. Settings → Pages → Build and deployment → Source: **Deploy from a branch**, pick `main` and
   the `/ (root)` folder, then Save. (A free account needs the repo to be public.)
2. After a minute the game is live at `https://sajadzmani.github.io/Ash/`. `.nojekyll` makes
   GitHub serve the files as they are.

## Design

The look follows Apple's [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/),
as if Apple had made the game:

- **Hierarchy:** the word is the biggest thing on screen, and each screen has one prominent
  button («بازی جدید», «شروع بازی», «آماده‌ام», «درست», «دوباره»). Secondary actions are gray.
- **Liquid Glass only for controls:** floating glass toolbars, round glass buttons and the clock
  sit above the content; the content itself (word card, lists) is solid. Over a team colour the
  glass is the clear kind with white text.
- **Familiar iOS parts:** large titles, inset grouped lists, segmented controls, green switches,
  a bottom sheet for Settings and Rules, alerts for pause, quit and «team out» (destructive
  actions in red), and a back chevron that points right in Persian.
- **Fewer steps:** the number of players is a segmented control on the players screen.
- **System look:** system colours for teams (blue, orange, purple, pink, teal, brown; green is
  kept for «درست», red for destructive actions), the system font (SF Arabic on iPhone, Vazirmatn
  elsewhere), Apple's text sizes, capsule buttons inside concentric rounded bars, 44 pt touch
  targets.
- **Light and dark** follow the phone's setting; animations turn off with Reduce Motion.

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

The words are in `data/words.js`, in plain text between the backticks: `# name` starts a category,
then one word per line as `word|level` (1, 2 or 3). Save and reload the page; there is no build
step. A word listed twice is used only once.

After editing, you can check the list:

```sh
node tools/check_words.js
```

It prints how many words each category has at each level and points to any duplicate (even across
categories) or wrong level, with its line number.

## Files

| Path | What |
|---|---|
| `index.html`, `js/app.js` | screens: home, players and teams, pass the phone, turn, result, sheets, alerts |
| `js/game.js` | rules: teams, turn order, clocks, penalties |
| `js/words.js` | picks the next word: difficulty, categories, no repeats |
| `js/storage.js` | `localStorage` layer |
| `js/sound.js` | sounds made in code (Web Audio, no files); off until turned on |
| `data/words.js` | the word list |
| `tools/check_words.js` | checks the word list: counts, duplicates, levels |
| `css/style.css`, `fonts/` | look and the Vazirmatn font (from کلمچین) |
