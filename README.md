# UCLuster Too · CIUK 2026 qualifier talk

These are the slides for our CIUK Cluster Challenge 2026 qualifier presentation. Slides 1 to 13 are the five-minute talk, starting with EPCC after the title. Slides 14 to 24 are backup for questions, starting with the overview.

**Live site** → https://ucluster-too-qualifier.vercel.app
**Edit it on the page** → https://ucluster-too-qualifier.vercel.app/?edit
**PowerPoint copy** → [UCLuster-Too-qualifier.pptx](https://github.com/kaihuang1425/ucluster-too-qualifier/releases/download/pptx-latest/UCLuster-Too-qualifier.pptx), rebuilt from `main` after every change

Every change to `main` updates the live site within about a minute. Nothing needs installing to edit a slide.

## The five-minute talk

The talk is every slide before the backup section. Each talk slide's speaker notes hold its script and show the estimated timing.

- **Rehearse.** Press N on any slide to see its script, how long it takes, when it should end and the running total. On a phone, open the block under each slide.
- **Present on a call.** Press P to open the presenter view in its own window. It shows the script in large type, a stopwatch, when the slide should end and what comes next, and its arrow keys move the deck. In Teams choose Share, then Window, and pick the deck window, so the presenter view stays private. Keep the deck window uncovered, because a browser stops drawing a window that is fully hidden. Both windows must be in the same browser.
- **Timing.** The estimate assumes 140 words a minute and counts each number as 2.5 words, because "2.15" or "64%" takes longer to say than one word. If you speak faster or slower, treat the times as relative.
- **Script and background.** In a note, the plain text is what we say. Text inside `<span class="bg">` is background for questions. It shows smaller under the script and is not timed.
- **Staying in time.** The page editor shows the script's seconds and the talk's total while you type. The automatic check prints the timing for every slide and warns when the total passes 5:00.
- **Change a script.** Either open the page editor (`?edit`), where each slide's script sits in the panel at the bottom, or press **Edit script** in the presenter view and type. A presenter edit is kept in your browser and shows its new timing straight away. Press **Publish in the editor** to send it through the page editor like any other edit. Until then only you see it.
- **Questions afterwards.** The presenter view has a Q&A tab with the prepared questions and answers from `qa.js`, most likely first. On the last talk slide, Next opens it. Type a word or two to search. The search forgives typos and half-typed words. Enter switches the deck to the slide that goes with the selected answer, and the list of optional slides switches to any backup slide. **This slide only** lists the questions for the slide on show. Answers are edited in `qa.js` on GitHub.
- **The talk stops on its last slide.** A plain next there does nothing, so an optional slide never appears by accident. Press B, use the presenter's Q&A, or add the slide number to the address to open one.
- **Backup slides.** These are sections with `data-backup`. The counter shows them as "Backup 3 / 11" and they do not count towards the time. To move a slide between the talk and the backup, move its whole `section` block and add or remove `data-backup`.

Each round opens with the question it addresses and closes with what the tests showed. When you change a slide, read its script together with the one before and the one after.

## Edit on the page

This is the easiest route. Open https://ucluster-too-qualifier.vercel.app/?edit on a laptop or iPad. Add a slide number to start there, as in `/?edit#11`.

1. Click any text on a slide and type. Headlines, labels, big numbers, source lines and table cells can all be changed. Press Enter to finish, or Shift and Enter for a new line.
2. Speaker notes for the slide on screen sit in the panel at the bottom, with the script's length beside them. On a phone they appear under each slide.
3. **Chart numbers** opens the values behind the roofline and the scaling chart. The charts redraw as you type.
4. Edits are saved in your browser as you go, so a reload or a closed tab loses nothing. **Discard** throws them away.
5. Press **Publish** (or Ctrl and S). You see every change marked up by slide. Sign in with GitHub the first time.
6. Publishing opens a pull request. The page shows the automatic check as it runs, then a link to Vercel's preview.
7. Once the check passes, press **Make it live**. The live site updates about a minute later.

The editor looks after the details that are easy to get wrong by hand.

- When you change a big number such as 15,345, its count-up value changes with it.
- When you change a bar's label such as +22%, the bar's length follows.
- While you type, the editor runs the same tests as the automatic check. A slide that no longer fits its frame is outlined in red and blocks publishing. House-style slips such as a semicolon show as notes that do not block anything.
- Your edit is applied to the newest version of the deck, so two people editing different slides never overwrite each other. If someone changed the same sentence first, the editor says which one and keeps the rest of your work.

The page editor cannot add, remove or reorder slides. Do that on GitHub as described below.

You need to be a collaborator on this repository to publish. Anyone else can still make edits and press **Download the edited files**, then upload them on GitHub.

## Edit on GitHub

Use this route to add or remove slides, or for any change to the layout.

1. Open [`index.html`](index.html) on GitHub and click the pencil icon. Pressing `.` opens a fuller editor instead.
2. Find your slide by its number. Each slide starts with a comment such as `<!-- 3. Scaling out costs energy -->`, and the list of all slides is at the top of the file.
3. Change the words between the tags. Leave `class="..."` and `style="..."` as they are.
4. Click **Commit changes** and choose **Create a new branch for this commit and start a pull request**.
5. Open the pull request. The automatic check runs in about three minutes. Vercel also posts a preview link on the pull request within a minute. It shows the deck with your change, and anyone can open it without an account. Look at it on a phone before you merge.
6. Merge once the check is green. The live site updates by itself.

A one-word fix can go straight to `main`. Anything bigger should go through a pull request so the check runs first.

## Edit on your own machine

```bash
git clone git@github.com:kaihuang1425/ucluster-too-qualifier.git
cd ucluster-too-qualifier
python -m http.server 8000
```

Then open http://localhost:8000. Double-clicking `index.html` also works. To try the page editor locally, run `node tools/dev.mjs` and open http://127.0.0.1:3000/?edit instead. Publishing only works on the live site.

Run the same checks that GitHub runs before you push. The second one needs Node 20 or later.

```bash
pip install playwright
python -m playwright install chromium webkit
python tools/check.py
python tools/test_editor.py
```

## Where things are

| File | What it holds | Edit it when |
|---|---|---|
| `index.html` | the words, numbers and speaker notes for all 24 slides | almost always |
| `deck.js` | chart numbers in `DECK_DATA` at the top, then the slide logic | a chart number changes |
| `deck.css` | slide layout and the phone layout | the layout itself needs to change |
| `house.css` | the shared design system | rarely |
| `presenter.html` | the presenter view opened with P | the presenter view changes |
| `qa.js` | the prepared questions and answers shown in the presenter view | a question or answer changes |
| `edit/` | the page editor, loaded only with `?edit` | the editor changes |
| `api/` | sign-in and publishing for the page editor, run by Vercel | the editor changes |
| `lib/htmlmap.mjs` | finds each slide element in `index.html`, for the editor and `api/` | rarely |
| `tools/check.py` | the automatic check | the rules change |
| `tools/test_editor.py` | the page editor's own test, against a stand-in GitHub | the editor changes |
| `tools/export_pptx.py` | builds the PowerPoint copies | the export changes |

## Common edits on GitHub

**A sentence.** Edit the text in `index.html`.

**A big number that counts up.** These carry the value twice, once as text and once in `data-to`. Change both.

```html
<span data-count data-from="0" data-to="15345">15,345</span>
```

Decimals also need `data-dec`, which is the number of decimal places.

**A bar.** The bar length `--v` must match the label next to it.

```html
<span class="lv-t"><i style="--v:22"></i></span><b>+22%</b>
```

**A chart.** Edit `DECK_DATA` at the top of `deck.js`. Then update any slide text that quotes the same number.

**Speaker notes.** Each slide ends with `<aside class="notes">`. Presenters see them with the N key. Phone readers see them as an expandable block under each slide. On a talk slide the note is the script, so keep it short. Put extra detail in `<span class="bg">` at the end of the note.

**Add or remove a slide.** Copy or delete a whole `section` block together with its numbered comment. Then update the slide list at the top of `index.html`. The slide counter and progress bar update by themselves. Close every tag you open, or the page editor stops with a message naming the line.

## Writing rules

The check warns about the punctuation and word rules. Warnings do not block a merge.

- Every number needs a source. Put the file name and job IDs in the small grey line at the bottom of the slide, which is the `<div class="srcl">`.
- Each headline states one finding with its number, as a single sentence.
- Write without colons, semicolons or em dashes. Split the sentence instead.
- Avoid the words gap, bridges and shifts.
- Say what we do not know. Limitations belong on the Limitations slide in the backup section.

## What the check tests

It runs on every pull request and every push to `main` through GitHub Actions. It fails if any of these happen.

- A JavaScript error appears in Chromium or in WebKit, which is the engine behind Safari.
- A slide's content no longer fits the 1920 × 1080 frame.
- The page scrolls sideways on an iPhone in either orientation, or something is wider than the screen.
- The iPad layout loses its two-column panels.
- A counter, bar or chart dot no longer matches the label next to it.
- The page editor cannot start, which usually means a tag in `index.html` is not closed.
- The presenter view does not follow the deck window, or its Q&A search or slide switching stops working.
- A question in `qa.js` points at a slide that no longer exists.
- A plain next on the last talk slide shows an optional slide.
- A narrow window on a computer switches to the phone layout.
- The page editor's own test fails. It edits slides, publishes through a stand-in GitHub and compares the files line by line.

It also warns, without failing, when the talk's script runs over five minutes or a talk slide has no script.

## Viewing modes

- **Desktop and iPad** show slides at any window size, scaled to fit, so the deck can sit in a narrow window beside the presenter view. Use the arrow keys, click either half, or swipe. F toggles full screen, N shows the script with its timing, and P opens the presenter view in its own window.
- **Phones** show one scrolling page with each slide stacked below the last.
- Add `?mode=slides` or `?mode=read` to the address to force one layout. Add `?static` to turn off animation, and `?edit` to edit.
- Printing to PDF from a desktop browser gives one slide per page.

## Deployment

The Vercel project `ucluster-too-qualifier` is connected to this repository. Pushes to `main` go to the live site, and every other branch gets its own preview address. Teammates need no Vercel account, because the repository belongs to a personal GitHub account. Preview addresses are public like the live address, so anyone with the link can open one. Do not put anything on a branch that should not be seen outside the team. If a deploy fails, the commit or pull request shows a red Vercel status with a link to the log.

## Switch on publishing from the page

The repository owner does this once. It takes about five minutes. Until then the page editor works, but its Publish button offers only the download.

Teammates sign in with their own GitHub accounts through a small GitHub App. GitHub then decides who may publish, using this repository's collaborator list. Each person's sign-in stays in an encrypted cookie in their own browser, and nothing is stored on a server.

1. **Create the app.** Open [this prefilled form](https://github.com/settings/apps/new?name=UCLuster%20Too%20deck%20editor&description=Edit%20the%20UCLuster%20Too%20qualifier%20deck%20on%20its%20own%20page&url=https%3A%2F%2Fucluster-too-qualifier.vercel.app&callback_urls%5B%5D=https%3A%2F%2Fucluster-too-qualifier.vercel.app%2Fapi%2Fauth%2Fcallback&public=true&webhook_active=false&contents=write&pull_requests=write&checks=read&statuses=read) while signed in as `kaihuang1425`, then press **Create GitHub App** at the bottom. It asks for read and write access to code and pull requests, and read access to checks and commit statuses. It is marked public only so that teammates can sign in with it. Another account that installed it would grant access to its own repositories, never to this one.
2. **Make a secret.** On the app's page, copy the **Client ID**. Then press **Generate a new client secret** and copy that too. GitHub shows the secret only once.
3. **Install it here.** Choose **Install App**, pick `kaihuang1425`, choose **Only select repositories**, and select `ucluster-too-qualifier`.
4. **Give Vercel the two values.** In the Vercel project, open [Settings, Environment Variables](https://vercel.com/erichuang1425-9521s-projects/ucluster-too-qualifier/settings/environment-variables). Add `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` for the Production environment. Mark the secret as sensitive.
5. **Redeploy.** New variables reach the site with the next deployment. Push any commit, or press **Redeploy** on the latest deployment in Vercel.
6. **Try it.** Open https://ucluster-too-qualifier.vercel.app/?edit, change a word, and press **Publish**. GitHub asks you to authorise the app the first time.

If the secret ever leaks, generate a new one on the app's page, update `GITHUB_CLIENT_SECRET` in Vercel, redeploy, and delete the old secret. Everyone then signs in again.

## PowerPoint copy

Every change to `main` rebuilds two PowerPoint files and attaches them to the [PowerPoint copy release](https://github.com/kaihuang1425/ucluster-too-qualifier/releases/tag/pptx-latest). Both have every slide at 16:9 with its speaker notes, the script first and the background after it.

- [**UCLuster-Too-qualifier.pptx**](https://github.com/kaihuang1425/ucluster-too-qualifier/releases/download/pptx-latest/UCLuster-Too-qualifier.pptx) rebuilds every slide from PowerPoint's own shapes. Panels, bars, dots and lines are separate shapes, every word is a text box, and nothing is a picture. Each chart and the core map is a group, so it moves as one piece and can be ungrouped to edit a single line, point or label.
- [**UCLuster-Too-qualifier-pictures.pptx**](https://github.com/kaihuang1425/ucluster-too-qualifier/releases/download/pptx-latest/UCLuster-Too-qualifier-pictures.pptx) shows every slide as one picture. It looks identical on every computer, but nothing can be edited. Use it to present or to submit.

The shapes file matches the web deck where the fonts Google Sans Flex and Google Sans Code are installed. Both are free from [Google Fonts](https://fonts.google.com/?query=google+sans), and Google Slides has them built in. Without them PowerPoint picks a similar font, so words look slightly different and long lines run a little wider. PowerPoint offers only regular and bold, so words the web shows in a light or medium weight appear in regular. Lines break where they break on the web, so if you reword a sentence, delete the old line break too.

The charts are drawn shapes, not PowerPoint chart objects, so a changed number means moving its point by hand. Their numbers live in `DECK_DATA` in `deck.js`, and the next export redraws them.

The web deck stays the source. Edits made in PowerPoint do not reach the site or the next export, so make lasting changes here and download a fresh copy. To build the files yourself, run `python tools/export_pptx.py` after `pip install python-pptx`. They land in `export/`, which is not committed.

## Where the numbers come from

- Round 1, EPCC Cirrus, from our submitted EPCC report for the HPL sweeps, and `BigBouncyBoii/CIUK-UCLusters` (private) for the rest
- Round 2, DiRAC Durham, from [`bobby-ta/cluster-challenge-durham`](https://github.com/bobby-ta/cluster-challenge-durham)
- Round 3, UCL Condenser, from [`Adellama75/cluster-challenge-ucl`](https://github.com/Adellama75/cluster-challenge-ucl)

The round 3 data is synthetic. Rounds 1 and 2 are measured runs.
