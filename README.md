# UCLuster Too · CIUK 2026 qualifier talk

These are the slides for our CIUK Cluster Challenge 2026 qualifier presentation. They cover all three sub-challenges in the order we did them.

**Live site** → https://ucluster-too-qualifier.vercel.app
**Edit it on the page** → https://ucluster-too-qualifier.vercel.app/?edit

Every change to `main` updates the live site within about a minute. Nothing needs installing to edit a slide.

## Edit on the page

This is the easiest route. Open https://ucluster-too-qualifier.vercel.app/?edit on a laptop or iPad. Add a slide number to start there, as in `/?edit#11`.

1. Click any text on a slide and type. Headlines, labels, big numbers, source lines and table cells can all be changed. Press Enter to finish, or Shift and Enter for a new line.
2. Speaker notes for the slide on screen sit in the panel at the bottom. On a phone they appear under each slide.
3. **Chart numbers** opens the values behind the roofline and the scaling chart. The charts redraw as you type.
4. Edits are saved in your browser as you go, so a reload or a closed tab loses nothing. **Discard** throws them away.
5. Press **Publish** (or Ctrl and S). You see every change marked up by slide.
6. Send the changes to GitHub in one of two ways.
   - **Publish from the page.** Sign in with GitHub the first time. The page opens a pull request, shows the automatic check as it runs, then links to Vercel's preview. Once the check passes, press **Make it live**. This needs the one-time setup at the end of this guide.
   - **Download and upload.** Press **Download the edited files**. The next screen opens GitHub's upload page for this repository and lists the four steps. Drag the file in, choose to start a pull request, and merge it once the check is green. Pushing the file from your own copy of the repository works too.
7. The live site updates about a minute after the merge.

The editor looks after the details that are easy to get wrong by hand.

- When you change a big number such as 15,345, its count-up value changes with it.
- When you change a bar's label such as +48%, the bar's length follows.
- While you type, the editor runs the same tests as the automatic check. A slide that no longer fits its frame is outlined in red and blocks publishing. House-style slips such as a semicolon show as notes that do not block anything.
- Your edit is applied to the newest version of the deck, so two people editing different slides never overwrite each other. If someone changed the same sentence first, the editor says which one and keeps the rest of your work.

The page editor cannot add, remove or reorder slides. Do that on GitHub as described below.

Publishing from the page, uploading and pushing all need collaborator access to this repository. Someone without it can still upload. GitHub then turns the upload into a pull request from their own copy, which a collaborator merges.

## Edit on GitHub

Use this route to add or remove slides, or for any change to the layout.

1. Open [`index.html`](index.html) on GitHub and click the pencil icon. Pressing `.` opens a fuller editor instead.
2. Find your slide by its number. Each slide starts with a comment such as `<!-- 5. Scaling out at constant energy -->`, and the list of all slides is at the top of the file.
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
| `index.html` | the words, numbers and speaker notes for all 23 slides | almost always |
| `deck.js` | chart numbers in `DECK_DATA` at the top, then the slide logic | a chart number changes |
| `deck.css` | slide layout and the phone layout | the layout itself needs to change |
| `house.css` | the shared design system | rarely |
| `edit/` | the page editor, loaded only with `?edit` | the editor changes |
| `api/` | sign-in and publishing for the page editor, run by Vercel | the editor changes |
| `lib/htmlmap.mjs` | finds each slide element in `index.html`, for the editor and `api/` | rarely |
| `tools/check.py` | the automatic check | the rules change |
| `tools/test_editor.py` | the page editor's own test, against a stand-in GitHub | the editor changes |

## Common edits on GitHub

**A sentence.** Edit the text in `index.html`.

**A big number that counts up.** These carry the value twice, once as text and once in `data-to`. Change both.

```html
<span data-count data-from="0" data-to="15345">15,345</span>
```

Decimals also need `data-dec`, which is the number of decimal places.

**A bar.** The bar length `--v` must match the label next to it.

```html
<span class="lv-t"><i style="--v:48"></i></span><b>+48%</b>
```

**A chart.** Edit `DECK_DATA` at the top of `deck.js`. Then update any slide text that quotes the same number.

**Speaker notes.** Each slide ends with `<aside class="notes">`. Presenters see them with the N key. Phone readers see them as an expandable block under each slide.

**Add or remove a slide.** Copy or delete a whole `section` block together with its numbered comment. Then update the slide list at the top of `index.html`. The slide counter and progress bar update by themselves. Close every tag you open, or the page editor stops with a message naming the line.

## Writing rules

The check warns about the punctuation and word rules. Warnings do not block a merge.

- Every number needs a source. Put the file name and job IDs in the small grey line at the bottom of the slide, which is the `<div class="srcl">`.
- Each headline states one finding with its number, as a single sentence.
- Write without colons, semicolons or em dashes. Split the sentence instead.
- Avoid the words gap, bridges and shifts.
- Say what we do not know. Limitations belong on slide 21.

## What the check tests

It runs on every pull request and every push to `main` through GitHub Actions. It fails if any of these happen.

- A JavaScript error appears in Chromium or in WebKit, which is the engine behind Safari.
- A slide's content no longer fits the 1920 × 1080 frame.
- The page scrolls sideways on an iPhone in either orientation, or something is wider than the screen.
- The iPad layout loses its two-column panels.
- A counter, bar or chart dot no longer matches the label next to it.
- The page editor cannot start, which usually means a tag in `index.html` is not closed.
- The page editor's own test fails. It edits slides, publishes through a stand-in GitHub and compares the files line by line.

## Viewing modes

- **Desktop and iPad** show slides. Use the arrow keys, click either half, or swipe. F toggles full screen and N shows speaker notes.
- **Phones** show one scrolling page with each slide stacked below the last.
- Add `?mode=slides` or `?mode=read` to the address to force one layout. Add `?static` to turn off animation, and `?edit` to edit.
- Printing to PDF from a desktop browser gives one slide per page.

## Deployment

The Vercel project `ucluster-too-qualifier` is connected to this repository. Pushes to `main` go to the live site, and every other branch gets its own preview address. Teammates need no Vercel account.

**Keep this repository public.** On Vercel's free plan, a private repository only deploys commits written by the Vercel account owner, and Vercel blocks everyone else's with the status "Deployment was blocked". A public repository deploys commits from anyone with write access. The slides were public on the live site already, so making the repository public exposed only the code, this guide and the commit history.

Preview addresses are public like the live address, so anyone with the link can open one. Do not put anything on a branch that should not be seen outside the team. If a deploy fails, the commit or pull request shows a red Vercel status with a link to the log.

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

## Where the numbers come from

- Round 1, EPCC Cirrus, from `BigBouncyBoii/CIUK-UCLusters` (private)
- Round 2, DiRAC Durham, from [`bobby-ta/cluster-challenge-durham`](https://github.com/bobby-ta/cluster-challenge-durham)
- Round 3, UCL Condenser, from [`Adellama75/cluster-challenge-ucl`](https://github.com/Adellama75/cluster-challenge-ucl)

The round 3 data is synthetic. Rounds 1 and 2 are measured runs.
