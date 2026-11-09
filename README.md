# UCLuster Too · CIUK 2026 qualifier talk

These are the slides for our CIUK Cluster Challenge 2026 qualifier presentation. They cover all three sub-challenges in the order we did them.

**Live site** → https://ucluster-too-qualifier.vercel.app

Every push to `main` updates the live site within about a minute. Nothing needs installing to edit a slide.

## Edit a slide in the browser

This is the easiest route and needs no setup.

1. Open [`index.html`](index.html) on GitHub and click the pencil icon. Pressing `.` opens a fuller editor instead.
2. Find your slide by its number. Each slide starts with a comment such as `<!-- 5. Scaling out at constant energy -->`, and the list of all slides is at the top of the file.
3. Change the words between the tags. Leave `class="..."` and `style="..."` as they are.
4. Click **Commit changes** and choose **Create a new branch for this commit and start a pull request**.
5. Open the pull request. The automatic check runs in about three minutes, and Vercel adds a preview link. Vercel protects preview links, so only the repository owner can open them. To see your change yourself, open the page locally (see below) or merge and check the live site.
6. Merge once the check is green. The live site updates by itself.

A one-word fix can go straight to `main`. Anything bigger should go through a pull request so the check runs first.

## Edit on your own machine

```bash
git clone git@github.com:kaihuang1425/ucluster-too-qualifier.git
cd ucluster-too-qualifier
python -m http.server 8000
```

Then open http://localhost:8000. Double-clicking `index.html` also works.

Run the same check that GitHub runs before you push.

```bash
pip install playwright
python -m playwright install chromium webkit
python tools/check.py
```

## Where things are

| File | What it holds | Edit it when |
|---|---|---|
| `index.html` | the words, numbers and speaker notes for all 23 slides | almost always |
| `deck.js` | chart numbers in `DECK_DATA` at the top, then the slide logic | a chart number changes |
| `deck.css` | slide layout and the phone layout | the layout itself needs to change |
| `house.css` | the shared design system | rarely |
| `tools/check.py` | the automatic check | the rules change |

## Common edits

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

**Add or remove a slide.** Copy or delete a whole `section` block together with its numbered comment. Then update the slide list at the top of `index.html`. The slide counter and progress bar update by themselves.

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

## Viewing modes

- **Desktop and iPad** show slides. Use the arrow keys, click either half, or swipe. F toggles full screen and N shows speaker notes.
- **Phones** show one scrolling page with each slide stacked below the last.
- Add `?mode=slides` or `?mode=read` to the address to force one layout. Add `?static` to turn off animation.
- Printing to PDF from a desktop browser gives one slide per page.

## Deployment

The Vercel project `ucluster-too-qualifier` is connected to this repository. Pushes to `main` go to the live site, and every other branch gets its own preview address. Teammates need no Vercel account, because the repository belongs to a personal GitHub account. Preview addresses sit behind Vercel's login, while the live address is public. If a deploy fails, the commit or pull request shows a red Vercel status with a link to the log.

## Where the numbers come from

- Round 1, EPCC Cirrus, from `BigBouncyBoii/CIUK-UCLusters` (private)
- Round 2, DiRAC Durham, from [`bobby-ta/cluster-challenge-durham`](https://github.com/bobby-ta/cluster-challenge-durham)
- Round 3, UCL Condenser, from [`Adellama75/cluster-challenge-ucl`](https://github.com/Adellama75/cluster-challenge-ucl)

The round 3 data is synthetic. Rounds 1 and 2 are measured runs.
