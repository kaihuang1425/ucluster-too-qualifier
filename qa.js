/* Q&A for the presenter view (press P on the deck, then the Q&A tab).
   Most likely questions first. Edit the text freely. Keep every answer true to the slides.
   likely     Very likely, Likely or Possible. It sets the order and the label.
   slide      a CSS selector for something that only the matching slide holds, so the link survives slides being reordered.
              tools/check.py fails if a selector no longer finds a slide.
   say        the answer as text, to say aloud in about 30 seconds.
   bullets    the same answer as two to four short points. Each point is a pair, the label first and then one sentence.
              The presenter view switches between the text and the points for each question.
   check      something to confirm before the pitch. checkShort is its short form, shown with the points.
   numbers    the figures to hold. followups are the likely next questions. background explains the idea from zero.
   In say and in a point, `code` shows as code and *word* shows in italics.
   This file is public once it is on the site, like the slides. */
window.DECK_QA_EDIT = 'https://github.com/kaihuang1425/ucluster-too-qualifier/edit/main/qa.js';   // where the presenter's Edit answers link goes
window.DECK_QA = [
 {
  "q": "You say memory bandwidth limits HPCG. How do you know?",
  "likely": "Very likely",
  "topic": "Round 1 · HPCG",
  "slide": ".nodes2",
  "say": "We have two pieces of evidence and one limitation. First, HPCG maintained its throughput when we left half of the cores idle. Running 144 MPI ranks delivered 134.5 GFLOPS, while 288 ranks delivered 133.7 GFLOPS. If compute cores were the bottleneck, halving the active cores would have cut the speed. Second, a theoretical estimate based on the node's memory bandwidth places the performance ceiling near 160 GFLOPS. Our measured result of 134.5 GFLOPS sits right below that ceiling. The limitation is that we never measured memory bandwidth directly on Cirrus. Because of that, we state in our report that this remains a hypothesis on Cirrus.",
  "bullets": [
   ["Idle cores test", "Leaving half the cores idle kept throughput flat, with 144 ranks reaching 134.5 GFLOPS and 288 ranks reaching 133.7 GFLOPS."],
   ["Theoretical ceiling", "The node's theoretical memory bandwidth places the ceiling near 160 GFLOPS, right above our measured 134.5 GFLOPS."],
   ["Key limitation", "We never measured bandwidth directly on Cirrus, so our report frames this as a hypothesis."]
  ],
  "numbers": [
   "288 ranks: 133.7 GFLOPS at 1,050 W",
   "144 ranks: 134.5 GFLOPS at 977 W",
   "7% less power, 8% more GFLOPS per watt",
   "0.1274 → 0.1376 GFLOPS/W",
   "ceiling ≈ 160 = 1,228 GB/s × 0.13 FLOP/byte"
  ],
  "followups": [
   {
    "q": "Could something else explain it?",
    "a": "Yes. Our report also suggests that fewer ranks mean less MPI overhead. The two runs had the same total problem size but split it into ranks differently, so the test does not isolate bandwidth. A direct bandwidth measurement at 144 and at 288 ranks would."
   },
   {
    "q": "Why did power fall?",
    "a": "Idle cores draw less power. The node used 977 W in place of 1,050 W for the same work."
   },
   {
    "q": "Did you try this on four nodes?",
    "a": "No. The report lists that as a next step."
   }
  ],
  "background": "Memory bandwidth is how many bytes per second a node can move between its memory and its processors. All the cores share it. A code that does little arithmetic on each byte spends its time waiting for data, so extra cores have nothing to work on. That is what bandwidth-bound means."
 },
 {
  "q": "What would you do differently, or do next with more time?",
  "likely": "Very likely",
  "topic": "Whole talk",
  "slide": ".lim",
  "say": "We would focus on one targeted improvement per round. On Cirrus, we would measure memory bandwidth directly and test whether the 144-rank HPCG topology keeps its advantage across four nodes. On DiRAC, we would isolate hardware counters for a single Grid kernel, because our current counters measure the entire process. For the UCL round, we would repeat the analysis on representative clinical data with a larger validation set, since our test set contained only 60 resistant patients. Regarding our workflow, we would run a reconnaissance job before executing any benchmark from day one. We only adopted that practice in the second round.",
  "bullets": [
   ["Cirrus", "Measure memory bandwidth directly and test whether the 144-rank HPCG layout keeps its advantage across four nodes."],
   ["DiRAC", "Isolate hardware counters for a single Grid kernel instead of measuring the entire process."],
   ["UCL", "Repeat the analysis on representative clinical data with more than 60 resistant test patients."],
   ["Workflow", "Run a reconnaissance job before any benchmark from day one rather than waiting until round two."]
  ],
  "numbers": [
   "60 resistant patients in the test set",
   "counters cover the whole process",
   "recon job first from round 2"
  ],
  "followups": [
   {
    "q": "What was your biggest mistake?",
    "a": "In round 1 we learned the hardware from our own results and swept layouts without a hypothesis. From round 2 we ran a recon job first and chose layouts from the topology."
   }
  ],
  "background": "A recon job is a short first job that only reports what the node has. It lists the processors, cores, sockets, memory and loaded software, so later choices rest on facts."
 },
 {
  "q": "Why did thread placement make a 58% difference?",
  "likely": "Very likely",
  "topic": "Round 2 · Grid",
  "slide": "svg.sock",
  "say": "DINE2 has two processor sockets. The system assigns even core numbers to the first socket and odd core numbers to the second socket. By default, OpenMP uses close binding to place consecutive threads onto consecutive core numbers. This caused alternating threads to land on opposite sockets. Because neighbouring threads share lattice data, they constantly forced traffic across the inter-socket interconnect. When we explicitly pinned threads socket by socket, neighbouring threads stayed on the same processor. That single change made Grid run up to 58 percent faster at a lattice size of L equals 24.",
  "bullets": [
   ["Alternating core IDs", "DINE2 assigns even core numbers to socket 0 and odd core numbers to socket 1."],
   ["Cross-socket bottleneck", "Default OpenMP close binding placed consecutive threads onto alternating core IDs, forcing shared lattice data across the inter-socket link."],
   ["Socket pinning", "Ordering cores socket by socket kept neighbouring threads on the same processor and sped up Grid by up to 58% at L equals 24."]
  ],
  "numbers": [
   "+58% at L = 24",
   "default: OMP_PROC_BIND=close",
   "fix: OMP_PLACES={0}:32:2,{1}:32:2",
   "best DINE2: 864 GFLOP/s",
   "best DINE: 361 GFLOP/s"
  ],
  "followups": [
   {
    "q": "Why did Clang look faster than GCC?",
    "a": "Clang uses LLVM's OpenMP runtime, which happened to place threads differently from GCC's. Once both compilers used the same placement, placement explained the difference."
   },
   {
    "q": "Why does crossing sockets cost so much?",
    "a": "Each socket has its own memory. Data that lives beside the other socket takes longer to reach, so threads that share data should sit on the same socket."
   },
   {
    "q": "Was anything else explained by it?",
    "a": "Yes. One node, gc007, had looked unusually fast. It had the same explanation."
   }
  ],
  "background": "A thread is one worker inside a program. Binding, or pinning, fixes each thread to a core so the system does not move it. OMP_PROC_BIND and OMP_PLACES are the OpenMP settings that choose which cores the threads get."
 },
 {
  "q": "Why balanced accuracy? Why not accuracy or ROC AUC?",
  "likely": "Very likely",
  "topic": "Round 3 · UCL",
  "slide": ".dk[data-round=\"3\"] .duo",
  "say": "Only 24 percent of the patients in our dataset are resistant. Because the classes are imbalanced, a model that labels every patient as susceptible achieves 76 percent standard accuracy while remaining completely useless. Our initial unadjusted decision tree did exactly that and flagged zero of the 60 resistant test patients. ROC AUC failed to catch this flaw because it only evaluates how well a model ranks patients overall. It ignores where the actual decision threshold sits. In contrast, balanced accuracy averages the detection rate for resistant patients with the detection rate for susceptible patients. Under this metric, a model that ignores one class drops to a baseline score of 0.5. By applying class weights and optimizing for balanced accuracy, our final tree successfully flagged 39 out of 60 resistant patients.",
  "bullets": [
   ["Class imbalance", "Only 24% of patients are resistant, so our first unweighted tree reached 76% plain accuracy by calling everyone susceptible and flagging 0 of 60 resistant patients."],
   ["ROC AUC flaw", "ROC AUC only scores overall patient ranking and ignores where the decision threshold sits."],
   ["Balanced accuracy fix", "Averaging the hit rates on resistant and susceptible patients scores a single-class model at 0.5, helping our weighted tree flag 39 of 60 resistant cases."]
  ],
  "numbers": [
   "24.1% resistant",
   "test set: 250 patients, 60 resistant",
   "first tree: 0 of 60, 76% accurate",
   "balanced tree: 39 of 60",
   "forest: 44 of 60"
  ],
  "followups": [
   {
    "q": "What are class weights?",
    "a": "They make a mistake on the rare group cost more during training, in proportion to how rare it is. The tree then flags a group when its share of resistant patients is above the 24% base rate, not above 50%."
   },
   {
    "q": "Why not recall alone?",
    "a": "Recall alone rewards flagging everyone. Balanced accuracy counts both kinds of error."
   },
   {
    "q": "How was it estimated?",
    "a": "With 5-fold cross-validation on the training set. The 250 test patients were held out."
   }
  ],
  "background": "Accuracy is the share of predictions that are right. ROC AUC is the chance that the model gives a random resistant patient a higher score than a random susceptible one, so 0.5 is guessing and 1 is perfect. Balanced accuracy is the average of the two hit rates, one for each group."
 },
 {
  "q": "Explain the roofline. What do 71% and 61% mean?",
  "likely": "Very likely",
  "topic": "Round 2 · Grid",
  "slide": "#roofline",
  "say": "A roofline model illustrates the maximum theoretical performance of any code on a specific hardware architecture. It is defined by two hardware ceilings. The flat horizontal ceiling represents peak arithmetic throughput. The sloped ceiling represents memory bandwidth multiplied by operational intensity, which is the number of floating-point operations performed per byte of data moved. These two boundaries intersect at the ridge point. Grid executes between 1.6 and 2.1 FLOPs per byte, whereas the hardware ridge points sit at 14.5 on DINE and 23.3 on DINE2. Because Grid sits at roughly one-tenth of either ridge point, it operates firmly on the sloped boundary where memory bandwidth sets the ceiling. At Grid's operational intensity, the memory roof allows 363 GFLOPS on DINE and 826 GFLOPS on DINE2. Our runs achieved 259 GFLOPS and 506 GFLOPS respectively. Those figures represent 71 percent and 61 percent of the theoretical memory ceiling on each system.",
  "bullets": [
   ["Two hardware limits", "A flat line marks peak arithmetic speed, while a sloped line marks memory bandwidth multiplied by FLOPs per byte."],
   ["Memory-bound region", "Grid performs 1.6 to 2.1 FLOPs per byte, sitting around one-tenth of the ridge points (14.5 on DINE and 23.3 on DINE2) on the memory slope."],
   ["Percent of ceiling", "The roof at Grid's intensity allows 363 GFLOPS on DINE and 826 GFLOPS on DINE2, so our runs of 259 and 506 GFLOPS reached 71% and 61% of the ceiling."]
  ],
  "numbers": [
   "Grid: 1.57 and 2.08 FLOPs/byte",
   "ridge: 14.5 (DINE), 23.3 (DINE2)",
   "roof at that intensity: 363 and 826 GFLOP/s",
   "Grid: 259 and 506 GFLOP/s",
   "71% and 61%"
  ],
  "followups": [
   {
    "q": "Why not 100% of the roof?",
    "a": "The roof comes from a pure streaming benchmark, so it is an upper bound. Our Grid figure also averages over the whole process, including setup, and not one kernel."
   },
   {
    "q": "How did you get FLOPs per byte?",
    "a": "From hardware counters on full-node runs, with likwid-perfctr. One counter group gives single-precision FLOPs and another gives memory traffic."
   },
   {
    "q": "Is Grid wasting bandwidth?",
    "a": "No. Grid's own memory benchmark reaches 98% and 89% of the bandwidth we measured with LIKWID."
   }
  ],
  "background": "FLOPs per byte is called arithmetic intensity. The ridge point is peak FLOP/s divided by bandwidth. A code to the left of the ridge is limited by memory. A code to the right is limited by arithmetic."
 },
 {
  "q": "How did you decide which risk factors are real?",
  "likely": "Very likely",
  "topic": "Round 3 · UCL",
  "slide": ".nz",
  "say": "We evaluated each predictor individually against a random baseline. First, we fitted a model on each single variable and scored it using cross-validated ROC AUC. Next, we shuffled that variable one hundred times. Shuffling preserves the underlying value distribution while breaking any true correlation with resistance, which establishes what pure chance produces. A predictor only passed if both a logistic regression and a depth-two decision tree outperformed 95 percent of their shuffled copies. Only age cleared this threshold, scoring 0.71 against a random cutoff of roughly 0.54. We also injected a synthetic column of random noise as a negative control. As expected, that control column failed to clear the threshold.",
  "bullets": [
   ["Permutation baseline", "We fitted single-variable models using cross-validated ROC AUC and compared them against 100 shuffled copies of each column."],
   ["Breaking correlation", "Shuffling preserves value distributions while breaking any link to resistance to show what pure luck produces."],
   ["Strict dual threshold", "A predictor only passed if both a logistic regression and a depth-two tree beat 95% of their shuffled copies."],
   ["Final result", "Only age passed (0.71 vs roughly 0.54), while an injected random noise column failed as expected."]
  ],
  "numbers": [
   "age 0.71 vs shuffled 0.54",
   "deprivation 0.54, sex 0.52",
   "diagnosis 0.51, ethnicity 0.51, trust 0.50",
   "surgery 0.48, random numbers 0.48",
   "100 shuffles, 95% cut-off"
  ],
  "followups": [
   {
    "q": "Why not use the forest's feature importance?",
    "a": "We did at first, and it misled us. Our first forest gave deprivation 0.09. In the noise-check forest a column of random numbers scored 0.16 and deprivation 0.07. Impurity importance favours columns with many distinct values, because they offer more places to split."
   },
   {
    "q": "Why both a regression and a tree?",
    "a": "Requiring both is the stricter test. A regression picks up steady trends and a tree picks up thresholds."
   },
   {
    "q": "So deprivation does not matter?",
    "a": "Our claim is narrower. Deprivation did not beat its shuffled copies in this dataset. It may matter in real data."
   }
  ],
  "background": "A permutation test asks what score you would get if a factor had no link with the outcome. You make that world by shuffling the factor. If the real score is not clearly above the shuffled scores, the factor has shown nothing."
 },
 {
  "q": "The random forest scored higher. Why choose the tree?",
  "likely": "Very likely",
  "topic": "Round 3 · UCL",
  "slide": "svg.tree",
  "say": "The performance difference falls entirely within random noise. In cross-validated balanced accuracy, the random forest scored 0.670 while logistic regression scored 0.660. Our single decision tree scored right behind them at 0.659. Because the standard deviation across validation runs ranged from 0.024 to 0.032, a margin of 0.011 is statistically negligible. Furthermore, the project brief specifically asked for a tree model to identify at-risk patients. We selected the single decision tree because clinicians can read and verify it by hand. It reduces the decision to three straightforward age cutoffs, and its performance ranking held steady across four different random seeds.",
  "bullets": [
   ["Inside the noise", "In cross-validated balanced accuracy, the forest (0.670) beat logistic regression (0.660) and the depth-three tree (0.659) by only 0.011."],
   ["High variance", "That 0.011 margin sits well below the 0.024 to 0.032 standard deviation across validation runs."],
   ["Brief alignment", "The brief asked for a tree, and our single tree reduces predictions to three hand-checkable age splits whose ranking held across four random seeds."]
  ],
  "numbers": [
   "forest 0.670 · regression 0.660 · tree 0.659",
   "plain tree 0.539",
   "one SD: ±0.024 to ±0.032",
   "forest leads by 0.011",
   "age carries over 90% of importance"
  ],
  "followups": [
   {
    "q": "What does the tree say?",
    "a": "Under 49, lower risk. 65 or over, flag. From 49 to 61, flag. From 62 to 64 it says lower risk, which we think is noise."
   },
   {
    "q": "The forest flagged 44 and the tree 39.",
    "a": "Yes. With 60 resistant patients, chance alone moves that count by three or four, so a difference of five is weak evidence."
   },
   {
    "q": "Does the tree use deprivation?",
    "a": "It has deprivation splits, but they never change a prediction. In practice it is an age rule."
   },
   {
    "q": "Why depth 3?",
    "a": "It was the best single tree at our main seed. Depths 1 to 5 all score within one fold standard deviation of the best, and across four seeds the best depth moved between 1 and 3. So depth 3 is a reasonable choice, not a sharp optimum."
   }
  ],
  "background": "A decision tree is a short list of yes or no questions. Depth 3 means at most three questions. A random forest averages 200 such trees, which is steadier but cannot be read as one rule. A standard deviation here is how much the score moves between cross-validation folds."
 },
 {
  "q": "You tested each factor alone. What happens when they are all in one model?",
  "likely": "Very likely",
  "topic": "Round 3 · UCL",
  "slide": ".nz",
  "say": "We tested the predictors both individually and jointly, and both approaches reached the exact same conclusion. When tested alone, we evaluated each predictor in a logistic regression and a depth-two tree against one hundred shuffled copies. When tested together, we fitted a multivariable logistic regression to calculate adjusted odds ratios. We also trained a full random forest that included two injected columns of random noise. In the multivariable regression, age was the only predictor with a confidence interval completely clear of 1.0, showing an odds ratio of 1.59 per decade. In the random forest, permuting age reduced test AUC by 0.20. Permuting any other clinical variable reduced AUC by 0.004 or less, matching the impact of the random noise columns.",
  "bullets": [
   ["Both approaches agree", "Single-variable screening and multivariable models reached the exact same result."],
   ["Multivariable regression", "Only age had a confidence interval clear of 1.0, sitting at an adjusted odds ratio of 1.59 per decade."],
   ["Random forest check", "Shuffling age cut test AUC by 0.20, whereas shuffling any other predictor cut AUC by 0.004 or less, matching two injected random noise columns."]
  ],
  "numbers": [
   "age: 1.59 per decade (1.44 to 1.76)",
   "forest AUC drop: age 0.202 ± 0.033",
   "deprivation 0.004 ± 0.008",
   "random columns 0.001 and −0.003"
  ],
  "followups": [
   {
    "q": "Why put random columns in the forest?",
    "a": "They show what a column with no information scores. A real risk factor has to clear them, and only age did."
   },
   {
    "q": "Which factors went into the joint regression?",
    "a": "Age, sex, surgery in the past year, deprivation and ethnicity. Trust and diagnosis were left out, because with about 4 patients per trust there is nothing to estimate."
   }
  ],
  "background": "Adjusted means the effect of one factor with the others held fixed. Permutation importance is how much a model's score falls when one column is shuffled, measured on patients the model has not seen."
 },
 {
  "q": "How well does the tree do on the test set? How many does it miss and how many false alarms?",
  "likely": "Very likely",
  "topic": "Round 3 · UCL",
  "slide": "svg.tree",
  "say": "Out of the 250 held-out test patients, 60 are truly resistant. Our final tree flags 116 patients as high risk. Within that flagged group, 39 patients are genuinely resistant and 77 are false alarms. The model misses the remaining 21 resistant cases. This means our tree successfully captures 65 percent of all resistant patients, and roughly one out of every three alerts is a true positive. Although its raw accuracy is 61 percent compared to the 76 percent score of the initial unadjusted tree, that initial model achieved its high score by flagging nobody. We deliberately accepted false alarms in order to detect actual resistance.",
  "bullets": [
   ["Test split breakdown", "Out of 250 held-out patients, 60 are truly resistant and the tree flags 116 in total."],
   ["Hit rate vs false alarms", "It catches 39 resistant patients (65% sensitivity) alongside 77 false alarms, while missing 21 resistant cases."],
   ["Deliberate trade-off", "Roughly one in three flags is right, trading lower plain accuracy (61% vs 76%) to catch resistant cases instead of flagging nobody."]
  ],
  "numbers": [
   "flags 116 of 250",
   "39 resistant, 77 false alarms",
   "misses 21 of 60",
   "recall 0.65, precision 0.34",
   "accuracy 0.608, balanced accuracy 0.622"
  ],
  "followups": [
   {
    "q": "Is one in three good enough?",
    "a": "For a screening flag that prompts a lab test, a false alarm costs a test and a miss costs a failed treatment. Whether one in three is acceptable is a clinical judgement that we did not make."
   },
   {
    "q": "And the forest?",
    "a": "It flags 117, of which 44 are resistant. Recall 0.73, precision 0.38."
   }
  ],
  "background": "Recall is the share of resistant patients the model flags. Precision is the share of flags that are right. Raising one usually lowers the other."
 },
 {
  "q": "Would a single split on age do just as well?",
  "likely": "Very likely",
  "topic": "Round 3 · UCL",
  "slide": "svg.tree",
  "say": "Based on our cross-validation results, a single split performs nearly identically. Class-balanced trees of depth one and depth two both scored 0.655, while the depth-three tree scored 0.659. That tiny margin is a statistical tie. On the held-out test set, the depth-one tree actually performed slightly better by flagging 44 of the 60 resistant patients instead of 39. The difference comes from the age 62 to 64 branch, which the depth-three tree classifies as lower risk. However, we locked in our model selection using cross-validation before inspecting the test set, and we stuck to that protocol. In practice, a single split on age is equally defensible.",
  "bullets": [
   ["Cross-validation tie", "Depth-one and depth-two balanced trees scored 0.655 against 0.659 for depth three."],
   ["Test set performance", "The depth-one tree actually caught more resistant test patients (44 vs 39 of 60) because it omits the lower-risk branch for ages 62 to 64."],
   ["Selection protocol", "We locked in depth three via cross-validation before viewing the test set, though a single split is just as defensible."]
  ],
  "numbers": [
   "depth 1 and 2: 0.655 ± 0.018",
   "depth 3: 0.659 ± 0.032",
   "test: depth 1 flags 44 of 60, depth 3 flags 39",
   "best depth moved between 1 and 3 across seeds"
  ],
  "followups": [
   {
    "q": "Why not switch to depth 1 after seeing the test result?",
    "a": "Choosing a model by its test score would spend the test set. It would stop being an independent check."
   },
   {
    "q": "Why does deeper do worse?",
    "a": "All the signal is in age, so depth beyond 2 or 3 can only fit noise. Depth 8 is the worst class-balanced tree in every seed."
   }
  ],
  "background": "A held-out test set is only a fair check if it played no part in choosing the model. That is why selection used cross-validation on the training patients."
 },
 {
  "q": "Exactly what was wrong with the first efficiency formula?",
  "likely": "Very likely",
  "topic": "Whole talk",
  "slide": ".tbl",
  "say": "Our initial formula mismatched two different time windows. We divided the GFLOPS reported by HPL by the average power draw across the entire job. However, HPL calculates GFLOPS solely during the timed solving phase, whereas average power spans the whole job including low-power setup time. This mismatch artificially inflates efficiency by the ratio of total job duration to solving duration. For short runs, that distortion is severe. At a matrix size of N equals 50,000, the solving phase took only 11 seconds out of a 32-second job. At N equals 250,000, the solving phase took 1,124 seconds out of 1,151 seconds. Our corrected formula eliminates this bias by dividing the total work completed during the solving phase by the cumulative energy consumed across the entire job.",
  "bullets": [
   ["Mismatched time windows", "We divided HPL solving GFLOPS (timed solving phase only) by average power across the whole job (which includes low-power setup)."],
   ["Short-run distortion", "This inflated efficiency by the ratio of total job time to solving time, which was 32 seconds vs 11 seconds at N equals 50,000 (compared to 1,151 vs 1,124 seconds at N equals 250,000)."],
   ["Corrected metric", "We now divide total work done during the solving phase by total energy consumed across the entire job."]
  ],
  "numbers": [
   "first: solve GFLOPS ÷ average job power",
   "corrected: solve work ÷ whole-job joules",
   "N = 50,000: 11 s solve in a 32 s job",
   "N = 250,000: 1,124 s in 1,151 s"
  ],
  "followups": [
   {
    "q": "Does counting setup energy penalise you?",
    "a": "Yes, slightly. It makes every figure conservative, and it does so the same way for every run."
   },
   {
    "q": "Is solve work the same as GFLOPS?",
    "a": "Solve work is GFLOPS multiplied by solve time, which is two thirds of N cubed operations. Dividing it by joules gives GFLOP per joule, the same unit as GFLOPS per watt."
   }
  ],
  "background": "Power is energy per second. If two quantities are measured over different time windows, their ratio depends on how long each window is, and it no longer describes the machine."
 },
 {
  "q": "Could this model be used on real patients?",
  "likely": "Likely",
  "topic": "Round 3 · UCL",
  "slide": ".dk[data-round=\"3\"] .facts",
  "say": "No, and we explicitly state that limitation in our report. The dataset is synthetic and only loosely modelled on UK Health Security Agency records. It restricts age to between 20 and 79 years, and its demographic breakdown does not reflect reality. For example, White patients represent 17.6 percent of the dataset compared to roughly 82 percent of the general population in England and Wales. Furthermore, the test set contains only 60 resistant cases. Because of these constraints, our model serves as a proof of methodology rather than a clinical tool. The true takeaway for real patient data is our validation pipeline, where every candidate risk factor is tested against permutation baselines before being trusted.",
  "bullets": [
   ["Synthetic data limits", "The dataset is synthetic and restricted to ages 20 through 79, with only 60 resistant patients in the test set."],
   ["Skewed demographics", "White patients make up 17.6% of records compared to roughly 82% in England and Wales."],
   ["Methodological focus", "This project demonstrates the process of checking predictors against random chance rather than building a clinical deployment tool."]
  ],
  "numbers": [
   "1,000 synthetic records",
   "ages 20 to 79 only",
   "17.6% White vs 81.7% in the 2021 Census",
   "60 resistant patients in the test set"
  ],
  "followups": [
   {
    "q": "Why does the ethnic mix matter?",
    "a": "A model learns from the people in its data. Where a group is under-represented we have less evidence that the model works for it. Here the mix is far from the real population, so we cannot assume the result transfers."
   },
   {
    "q": "Why does this prediction matter at all?",
    "a": "Co-amoxiclav is a widely used antibiotic. If an infection is resistant, the first treatment fails and the patient loses time. A flag could prompt an earlier lab test."
   }
  ],
  "background": "Co-amoxiclav is amoxicillin combined with clavulanic acid. E. coli is a common cause of urinary and bloodstream infections. Resistant means the antibiotic does not stop that infection. Synthetic data is generated to resemble real records, so no real patient is in it."
 },
 {
  "q": "How did you measure GFLOPS per watt?",
  "likely": "Likely",
  "topic": "Round 1 · HPCG",
  "slide": ".dk[data-round=\"1\"] .duo.compact",
  "say": "We extracted the total energy consumption for each run directly from Slurm job accounting. Then, we divided the total floating-point work completed during the benchmark's timed solving phase by the cumulative energy of the entire job. Because total job energy includes uncounted setup and validation overhead, our resulting efficiency figures are intentionally conservative. Every benchmark ran with exclusive node allocation to prevent interference. For HPCG, our highest efficiency was 0.1376 GFLOPS per watt on a single node.",
  "bullets": [
   ["Slurm accounting", "We divided the floating-point work from the benchmark's timed section by the total job energy recorded by Slurm."],
   ["Conservative numbers", "Total job energy includes uncounted setup and validation overhead, keeping our efficiency estimates conservative across exclusive node runs."],
   ["Peak HPCG score", "Our best HPCG efficiency was 0.1376 GFLOPS per watt on a single node."]
  ],
  "numbers": [
   "Slurm ConsumedEnergyRaw",
   "work in the timed section ÷ whole-job joules",
   "every job ran --exclusive",
   "best HPCG: 0.1376 GFLOPS/W"
  ],
  "followups": [
   {
    "q": "Was your first formula wrong?",
    "a": "Yes. We first divided GFLOPS by average job power. GFLOPS covers only the solve and the power covered the whole job, so short runs looked better than they were. We changed to work divided by whole-job energy."
   },
   {
    "q": "Which parts of the node drew the power?",
    "a": "We did not isolate that. It is on our limitations slide."
   }
  ],
  "background": "A watt is a joule per second. GFLOPS per watt is therefore work per joule. The same number tells you how much arithmetic you get for a fixed amount of energy."
 },
 {
  "q": "Why is HPCG over 100 times slower than HPL on the same node?",
  "likely": "Likely",
  "topic": "Round 1 · HPCG",
  "slide": ".dk[data-round=\"1\"] .duo:not(.compact)",
  "say": "The two benchmarks perform vastly different amounts of computation per byte of data moved. HPL multiplies dense matrices and reuses loaded values repeatedly while they remain in fast cache memory. In contrast, HPCG operates on sparse matrices where every grid point depends on its 26 neighbours. The processor loads a value from memory and performs minimal arithmetic before moving on. As a result, HPCG spends most of its execution time stalled waiting for memory transfers. On a single node at a comparable power draw, HPL reached 15,345 GFLOPS while HPCG reached 134.5 GFLOPS. That difference represents a performance ratio of 114 to 1.",
  "bullets": [
   ["Work per byte", "HPL multiplies dense matrices and reuses cached numbers repeatedly."],
   ["Memory stalls", "HPCG uses sparse matrices where each point touches 26 neighbours, performing minimal arithmetic per read and waiting on memory."],
   ["Measured ratio", "On one node at similar power, HPL reached 15,345 GFLOPS against 134.5 GFLOPS for HPCG (a ratio of 114)."]
  ],
  "numbers": [
   "HPL 15,345 GFLOPS at 1,154 W",
   "HPCG 134.5 GFLOPS at 977 W",
   "ratio 114 in GFLOPS, 93 in GFLOPS/W"
  ],
  "followups": [
   {
    "q": "Which one is the better measure of a machine?",
    "a": "Neither alone. HPL shows peak arithmetic. HPCG behaves more like real simulation codes, which are often limited by memory."
   }
  ],
  "background": "HPCG stands for High Performance Conjugate Gradient. It solves a large sparse system of equations from a 3D grid, using the conjugate gradient method with a multigrid preconditioner. An official run must last at least 1,800 seconds, which is why our finals are 30-minute runs."
 },
 {
  "q": "What is the common thread across the three rounds?",
  "likely": "Likely",
  "topic": "Whole talk",
  "slide": ".tbl",
  "say": "In every round, our initial headline finding turned out to be an artifact of our own measurement method. On Cirrus, our original efficiency formula unfairly favoured short runs. In Durham, an apparent compiler advantage between Clang and GCC was actually caused by default thread placement. At UCL, socioeconomic deprivation looked like a major clinical predictor until a column of random noise outranked it. In all three cases, a rigorous validation check caught the flaw. Our core takeaway is that you must audit your measurement methodology before attributing a result to the underlying system.",
  "bullets": [
   ["Method artifacts", "In every round, our initial headline result turned out to describe a flaw in our measurement method."],
   ["Three catches", "Cirrus had a biased efficiency formula and Durham hid thread placement behind compiler differences. At UCL, deprivation looked important until random noise beat it."],
   ["Core lesson", "We now audit our testing methodology before crediting any result to the underlying system."]
  ],
  "numbers": [
   "Cirrus: formula favoured short runs",
   "DiRAC: placement, up to 58%",
   "UCL: random column 0.16 vs deprivation 0.07 in the check"
  ],
  "followups": [
   {
    "q": "Were the rounds really linked?",
    "a": "The tasks were set separately. The link is in how we worked. Round 1 left a question about memory bandwidth, and round 2 gave us the tools to measure that kind of limit. Round 2 gave us a rule about hidden causes, and we built it into round 3."
   }
  ],
  "background": "A control experiment changes nothing that should matter and checks that the result stays the same, or removes the thing you think matters and checks that the result goes away. A confound is a hidden difference between two runs that causes the effect you were about to credit to something else."
 },
 {
  "q": "What was your general approach to each round?",
  "likely": "Likely",
  "topic": "Whole talk",
  "slide": ".dk[data-backup] .concl",
  "say": "We followed the same five-step workflow across every round. First, we verified system access and ran a small reconnaissance job to inspect the hardware topology. Second, we reviewed the domain literature and established an unoptimized baseline run. Third, we varied one parameter at a time while holding all other variables constant. For the third round at UCL, this controlled experiment meant evaluating different model families across the exact same validation split. Fourth, we executed parameter sweeps as automated batch jobs and archived every raw log file. Finally, we generated all visual plots directly from the raw logs using reproducible scripts before drawing conclusions.",
  "bullets": [
   ["Setup and baseline", "Verify access with a small reconnaissance job, then review the literature and run a baseline."],
   ["Controlled sweeps", "Change one parameter at a time (or compare models on the exact same split at UCL) and run batch sweeps that save all raw logs."],
   ["Scripted plots", "Generate every figure directly from the raw data using reproducible scripts before interpreting results."]
  ],
  "numbers": [
   "one parameter per experiment",
   "every raw result kept",
   "figures drawn by script"
  ],
  "followups": [
   {
    "q": "How did you keep track of so many runs?",
    "a": "From round 2, one parameterised script with job arrays. Each run stored its git hash, modules, build flags and host. Repeats went in as separate jobs, so the error bars include node-to-node variation."
   }
  ],
  "background": "A baseline is the first plain run you compare everything else with. A sweep is a set of runs where one setting takes several values and nothing else changes."
 },
 {
  "q": "How did you protect the data on the shared VM?",
  "likely": "Likely",
  "topic": "Round 3 · UCL",
  "slide": ".term",
  "say": "When we first inspected the shared virtual machine, we noticed the raw dataset had world-readable permissions. After documenting this initial state, we immediately moved the dataset into a private directory restricted to our user account. We also updated the file permissions so only our account could read the data. In addition, both of our analysis scripts enforce a `umask 027` setting, ensuring that no generated output files are readable by outside users. We accessed the machine exclusively via SSH keys and JupyterHub, and we scrubbed all IP addresses and credentials from our public GitHub repository.",
  "bullets": [
   ["File permissions", "We recorded that the file arrived world-readable, then moved it into a private directory with owner-only read access."],
   ["Script security", "Both scripts set `umask 027` to block world-readable outputs, and we connected strictly via SSH keys and JupyterHub with no credentials in our public repo."]
  ],
  "numbers": [
   "arrived as -rw-r--r--",
   "folder: chmod 700 → drwx------",
   "file: chmod 600 → -rw-------",
   "umask 027: outputs not world-readable"
  ],
  "followups": [
   {
    "q": "Is that enough for real patient data?",
    "a": "No. Condenser's own documentation says it is not certified for sensitive data. Real records would need an environment approved for that purpose, and more than file permissions."
   },
   {
    "q": "What limits did the VM have?",
    "a": "No root access and no git. We reached it only through UCL's JupyterHub."
   }
  ],
  "background": "In -rw-r--r-- the three groups of letters are the owner, the owner's group and everyone else. r is read, w is write, x is run or enter. chmod 600 leaves read and write for the owner only. umask sets which permissions new files are denied by default."
 },
 {
  "q": "How did you work as a team? Who did what?",
  "likely": "Likely",
  "topic": "Whole talk",
  "slide": ".ppl",
  "say": "Starting in the second round, we divided responsibilities into four fixed roles supported by written handover guides. During the Durham round, we held two 15-minute standup syncs per day, while at UCL we ran a daily evening check-in. Every working session concluded with a shared log entry documenting what failed and how we resolved it. In the third round, Ada configured the virtual machine environment and wrote the documentation. She also conducted the exploratory data analysis and selected balanced accuracy as our primary evaluation metric. Bobby maintained the system packages and verified reproducibility through a clean installation test. James authored the decision tree and ensemble modelling scripts. On my end, I built the permutation testing pipeline to evaluate predictors against random noise and ran the multivariable logistic regression. I also led the production of our presentation slides and pitch video.",
  "bullets": [
   ["Structured process", "From round two, we used four fixed roles with written guides alongside daily syncs and failure logs."],
   ["Ada and Bobby", "Ada configured the VM and ReadMe while exploring the data and picking balanced accuracy. Bobby updated the VM and tested a clean install."],
   ["James and I", "James wrote the tree modelling script. I tested predictors against noise, ran the logistic regression, and led the slides and video."]
  ],
  "numbers": [
   "136 commits across three repositories",
   "two 15-minute syncs a day in Durham",
   "205 jobs and 28.5 node-hours in round 2"
  ],
  "followups": [
   {
    "q": "What went wrong, and what did you do about it?",
    "a": "Early DINE2 LIKWID runs were pinned incorrectly. We found it, excluded them and said so. We also never combined runs from different builds or placements in one scaling curve."
   }
  ],
  "background": ""
 },
 {
  "q": "Why does Grid scale worse on DINE2 than on DINE?",
  "likely": "Likely",
  "topic": "Round 2 · Grid",
  "slide": "#scaling",
  "say": "Both systems gain speed as thread counts increase, yet both fall below ideal linear scaling. DINE achieves a 17.2x speedup across 32 threads, representing 54 percent parallel efficiency. DINE2 achieves a 21.4x speedup across 64 threads, dropping to 34 percent parallel efficiency. The underlying hardware explains this drop. While DINE2 doubles the core count compared to DINE, it only increases total memory bandwidth by a factor of 1.7. Consequently, available memory bandwidth per core drops from 7.2 GB/s on DINE to 6.2 GB/s on DINE2. A memory-bound workload naturally exhibits this exact scaling bottleneck. Even so, we describe this behaviour as consistent with bandwidth saturation, because scaling curves alone cannot fully isolate memory traffic from cache or interconnect overhead.",
  "bullets": [
   ["Scaling efficiency", "DINE reached 17.2x speedup on 32 threads (54% efficiency), while DINE2 reached 21.4x on 64 threads (34% efficiency)."],
   ["Bandwidth per core", "DINE2 has twice the cores but only 1.7x the memory bandwidth, dropping per-core bandwidth from 7.2 GB/s down to 6.2 GB/s."],
   ["Careful phrasing", "We call this consistent with a bandwidth limit because scaling curves alone cannot rule out cache or interconnect effects."]
  ],
  "numbers": [
   "DINE: 17.2× on 32 threads, 54%",
   "DINE2: 21.4× on 64 threads, 34%",
   "7.2 vs 6.2 GB/s per core",
   "L = 32, medians of 3"
  ],
  "followups": [
   {
    "q": "And weak scaling?",
    "a": "From L = 24 on 2 threads to L = 48 on 32, DINE kept 56% of its per-thread throughput and DINE2 kept 32%."
   }
  ],
  "background": "Strong scaling keeps the problem fixed and adds workers. Speed-up is how many times faster it runs than on one thread. Parallel efficiency is speed-up divided by the number of threads, so 100% is ideal. Weak scaling grows the problem with the workers."
 },
 {
  "q": "Why was pure MPI faster than MPI with OpenMP threads for HPCG?",
  "likely": "Likely",
  "topic": "Round 1 · HPCG",
  "slide": ".nodes2",
  "say": "The reference implementation of HPCG spends a large portion of its runtime inside a Gauss-Seidel smoother routine. That specific routine lacks effective multi-threading support for OpenMP. When we assigned 12 OpenMP threads to each MPI rank, the extra worker threads sat idle during the smoothing step. By switching to pure MPI with one rank per physical core, every core participated actively through domain decomposition. As a result, pure MPI ran 1.95 times faster than a hybrid layout of 24 ranks with 12 threads each. It also ran roughly 5 times faster than 8 ranks with 36 threads each.",
  "bullets": [
   ["Unthreaded smoother", "Reference HPCG does not thread its heavy Gauss-Seidel smoother step, leaving extra OpenMP threads idle."],
   ["Active cores", "Running one MPI rank per physical core kept every core working, making pure MPI 1.95x faster than 24x12 and 5x faster than 8x36."]
  ],
  "numbers": [
   "288 × 1: 1.95× faster than 24 × 12",
   "about 5× faster than 8 × 36",
   "GNU about 29% faster than Cray at 24 × 12"
  ],
  "followups": [
   {
    "q": "Then why did 144 ranks match 288?",
    "a": "That is the half-the-cores result. Once enough ranks are working, memory looks like the limit, so the last 144 cores add power without adding speed."
   },
   {
    "q": "Which compiler did you use?",
    "a": "GNU for the finals. It gave about 29% more throughput than Cray in the 24 × 12 tests."
   }
  ],
  "background": "An MPI rank is a separate copy of the program with its own share of the problem. An OpenMP thread is a worker inside one rank. 288 × 1 means 288 ranks with one thread each. 24 × 12 means 24 ranks with 12 threads each."
 },
 {
  "q": "What is Grid, and why benchmark it?",
  "likely": "Likely",
  "topic": "Round 2 · Grid",
  "slide": "#roofline",
  "say": "Grid is a high-performance C++ library designed for Lattice Quantum Chromodynamics. It simulates the interactions of quarks and gluons across a four-dimensional spacetime lattice. Because Grid represents a primary production workload on the DiRAC supercomputing facility, benchmarking it reveals how hardware nodes perform under realistic scientific research demands. In our tests, we executed its single-precision Domain Wall Fermion kernel. The parameter L defines the lattice dimension, meaning that increasing L directly expands the memory footprint per thread.",
  "bullets": [
   ["Real workload", "Grid is a C++ Lattice QCD library simulating quarks and gluons on a 4D grid, representing a major science workload on DiRAC."],
   ["Benchmark kernel", "We ran its single-precision Domain Wall Fermion kernel, where larger lattice size L increases data per thread."]
  ],
  "numbers": [
   "single precision (FP32)",
   "lattice sizes L = 24, 32 and 48",
   "best kernel runs: 361 and 864 GFLOP/s",
   "about 11% and 9% of the FP32 ceiling"
  ],
  "followups": [
   {
    "q": "Why is Grid so far below the compute ceiling?",
    "a": "Because it is on the memory-limited side of the roofline. The compute ceiling only applies to code that does many FLOPs per byte."
   }
  ],
  "background": "QCD is the theory of the strong force that holds protons and neutrons together. Lattice QCD puts space and time on a grid so a computer can work it out. The work is mostly sweeping through very large arrays, which is why memory matters."
 },
 {
  "q": "You ran many tests. Could one of them pass by luck?",
  "likely": "Likely",
  "topic": "Round 3 · UCL",
  "slide": ".nz",
  "say": "Yes, false positives are a known risk in multiple hypothesis testing, and one predictor nearly slipped through by chance. Evaluating seven non-age predictors across two model types produced 14 separate statistical tests. At a 95 percent threshold, each test carries a 1-in-20 probability of passing by pure luck, meaning we should expect roughly 0.7 false positives across 14 runs. In fact, the decision tree for the diagnosis chapter variable scored 0.524 against a 95 percent permutation ceiling of 0.519. However, the logistic regression on that exact same variable failed to clear its threshold. That near miss is the exact reason our protocol required a predictor to pass across both model families before we accepted it.",
  "bullets": [
   ["Multiple testing risk", "Seven non-age factors across two models equal 14 tests, giving an expected 0.7 lucky passes at a 1-in-20 false-positive rate."],
   ["Dual-model filter", "The diagnosis-chapter tree barely cleared its shuffled band (0.524 vs 0.519), but failed in logistic regression, proving why we required both models to pass."]
  ],
  "numbers": [
   "14 scores, each 1 in 20",
   "about 0.7 expected by luck",
   "diagnosis tree 0.524 vs band 0.519",
   "diagnosis regression 0.510 vs band 0.547"
  ],
  "followups": [
   {
    "q": "Why would diagnosis be a lucky pass?",
    "a": "There are 964 different diagnosis codes for 1,000 patients. We grouped them by first letter into chapters, and a grouping like that is where a lucky split turns up."
   },
   {
    "q": "Did you correct for multiple testing?",
    "a": "Not with a formal correction. We required both models to pass, and we report the near-miss."
   }
  ],
  "background": "If you test 20 things that have no effect at the 5% level, one will look significant on average. Requiring two different models to agree makes a lucky pass much rarer."
 },
 {
  "q": "Why 100 shuffles, and what does the 95% line mean?",
  "likely": "Likely",
  "topic": "Round 3 · UCL",
  "slide": ".nz",
  "say": "For each predictor, we generated 100 randomly permuted copies of the column and scored each copy using the exact same cross-validation pipeline as the real data. The 95 percent threshold marks the boundary where 95 out of 100 shuffled copies fall below. If a real predictor scores above that boundary, it achieves an empirical p-value of 0.05 or lower. Using 100 permutations gives us enough resolution to detect significance down to a minimum p-value of 0.01, which is the exact ceiling age reached. Our script also includes a configurable parameter to scale up the number of permutations if finer resolution is needed.",
  "bullets": [
   ["Empirical p-value", "Scoring above 95 out of 100 shuffled copies corresponds to a p-value of 0.05 or less."],
   ["Resolution limit", "Using 100 copies sets our smallest reportable p-value at 0.01 (which age reached), and the script can scale to more copies if needed."]
  ],
  "numbers": [
   "100 shuffled copies per factor",
   "pass = above 95% of copies (p ≤ 0.05)",
   "age p = 0.01, the smallest possible",
   "about 2 minutes on a laptop"
  ],
  "followups": [
   {
    "q": "Why does every factor have a different band?",
    "a": "The score a column can reach by luck depends on its shape. 238 trusts leave far more room for a lucky score than a yes or no column. The band tops run from 0.519 for surgery to 0.551 for deprivation."
   }
  ],
  "background": "A p-value here is the share of shuffled copies that score at least as well as the real column. A small one means chance rarely does this well."
 },
 {
  "q": "One deprivation group looked significant. Is deprivation really not a risk factor?",
  "likely": "Likely",
  "topic": "Round 3 · UCL",
  "slide": ".nz",
  "say": "While we cannot rule out socioeconomic deprivation in the real world, this specific dataset provides no credible evidence for it. In our multivariable logistic regression, the third deprivation quintile showed an adjusted odds ratio of 0.60 with a confidence interval running from 0.36 to 0.97. Although that interval sits just below 1.0, our regression evaluated 10 separate non-age confidence intervals. At a 95 percent confidence level, each interval has a 1-in-20 chance of excluding 1.0 by pure luck. Furthermore, the data lacks a biological dose-response gradient. Across quintiles two through five, the odds ratios bounce around from 0.69 and 0.60 back up to 0.92 and 0.90. The raw resistance rates across the five quintiles fluctuate similarly between 20 percent and 29 percent. A genuine clinical effect would trend consistently upward or downward across deprivation levels.",
  "bullets": [
   ["Multiple interval luck", "Deprivation quintile 3 had an odds ratio of 0.60 (interval 0.36 to 0.97), but testing 10 non-age intervals gives each a 1-in-20 chance of missing 1.0 by luck."],
   ["No dose-response gradient", "Quintiles 2 to 5 bounce around (odds ratios of 0.69, 0.60, 0.92, and 0.90; raw rates of 26%, 21%, 20%, 29%, and 25%) instead of rising or falling steadily."]
  ],
  "numbers": [
   "quintile 3: 0.60 (0.36 to 0.97)",
   "quintiles 2 to 5: 0.69, 0.60, 0.92, 0.90",
   "resistance by quintile: 26.4, 20.7, 20.0, 28.9, 24.6%",
   "alone: 0.537 vs band 0.551"
  ],
  "followups": [
   {
    "q": "So is deprivation ruled out?",
    "a": "No. Not established is different from ruled out. With 1,000 patients we cannot exclude a modest effect."
   }
  ],
  "background": "IMD quintiles split areas into five groups by deprivation. Quintile 1 is the most deprived. A gradient means the rate keeps moving the same way from group to group."
 },
 {
  "q": "Why did the forest's importance score mislead you, and what did you use in its place?",
  "likely": "Likely",
  "topic": "Round 3 · UCL",
  "slide": ".nz",
  "say": "Our initial random forest assigned deprivation an importance score of 0.09, which we mistakenly treated as a real signal. That default metric relies on Gini impurity reduction, which is systematically biased toward variables with many distinct categories because they offer more splitting opportunities during training. When we injected a continuous column of random noise into a validation forest, that fake column scored 0.16 in impurity importance while deprivation scored only 0.07. To eliminate this bias, we switched to permutation importance evaluated on held-out test patients. Under permutation importance, deprivation dropped to zero and sat completely level with the random noise columns.",
  "bullets": [
   ["Impurity bias", "Default impurity importance gave deprivation 0.09 because it rewards columns with many distinct values and split points."],
   ["Random noise proof", "In our check forest, a continuous column of random numbers scored 0.16 in impurity importance, beating deprivation at 0.07."],
   ["Permutation fix", "Switching to permutation importance on held-out test patients removed that bias and dropped deprivation level with the random columns."]
  ],
  "numbers": [
   "first forest: age 0.91, deprivation 0.09",
   "check forest: random continuous 0.16",
   "deprivation 0.07, random five-level 0.05",
   "permutation: deprivation 0.004 ± 0.008"
  ],
  "followups": [
   {
    "q": "Is impurity importance useless?",
    "a": "No. It is quick and it ranked age first. It is unreliable for comparing columns of different shapes."
   }
  ],
  "background": "Impurity importance adds up how much each column's splits tidy the training data. Permutation importance asks how much worse the model does on new patients when a column is scrambled."
 },
 {
  "q": "Which models did you compare, and how?",
  "likely": "Likely",
  "topic": "Round 3 · UCL",
  "slide": "svg.tree",
  "say": "We evaluated five tree-based architectures across maximum depths ranging from one to eight, giving us 40 distinct model configurations. For single trees, we tested standard decision trees alongside class-balanced decision trees. For ensemble methods, we tested bagging classifiers alongside random forests and gradient boosted trees. Before modelling, we partitioned the dataset once into 750 training patients and 250 test patients using stratified sampling to preserve the 24 percent resistance rate. We ranked all 40 configurations using five-fold cross-validated balanced accuracy strictly within the training set. We held the 250-patient test set in reserve solely to report final performance on our selected models.",
  "bullets": [
   ["40 configurations", "We tested depths 1 to 8 across plain trees and class-balanced trees, alongside bagging, random forests, and gradient boosting."],
   ["Validation protocol", "We used a stratified split of 750 training and 250 test patients, ranking models via 5-fold cross-validated balanced accuracy on the training set alone."]
  ],
  "numbers": [
   "5 model kinds × depths 1 to 8",
   "750 train, 250 test, stratified",
   "5-fold cross-validation, seed 42",
   "forest 200 trees, bagging and boosting 100"
  ],
  "followups": [
   {
    "q": "Why did boosting and bagging rank so low?",
    "a": "They were not class-weighted. They reached 73 to 79% accuracy by rarely predicting resistance, with recall of 23% at most. It is the same failure as the plain tree, so it is not a fair verdict on those methods."
   },
   {
    "q": "Why not the logistic regression?",
    "a": "The brief asked for tree models. We ran the regression as a baseline. It scores 0.660 ± 0.036, so a straight line in age does as well as our tree, and we say so."
   }
  ],
  "background": "Stratified means each split keeps the same share of resistant patients as the whole data set."
 },
 {
  "q": "Does the result depend on the random split?",
  "likely": "Likely",
  "topic": "Round 3 · UCL",
  "slide": "svg.tree",
  "say": "No, our conclusions hold steady regardless of the random seed. We repeated the entire experimental pipeline across four distinct random seeds. Changing the seed alters both the train-test partition and the internal cross-validation splits, while also varying the stochastic initialization of the models. Across every single seed, the class-balanced decision tree ranked as the top single-tree model, and the random forest ranked as the top model overall. Furthermore, age accounted for over 90 percent of total feature importance in every run. The optimal tree depth fluctuated between one and three across seeds, which confirms that shallow trees of depths one through three are statistically tied.",
  "bullets": [
   ["Four random seeds", "We repeated the full pipeline across four seeds that varied the data splits and model randomness."],
   ["Stable rankings", "Every seed ranked the class-balanced tree as the best single tree and the random forest as best overall, with age carrying over 90% of importance and best tree depth moving between 1 and 3."]
  ],
  "numbers": [
   "seeds 42, 1, 7, 2026",
   "best tree: depth 3, 3, 2, 1",
   "tree 0.659, 0.653, 0.638, 0.684",
   "forest 0.670, 0.664, 0.655, 0.693"
  ],
  "followups": [
   {
    "q": "The forest led in all four. Is that not a real difference?",
    "a": "It may be. The lead is 0.009 to 0.017 each time, under one fold-to-fold standard deviation. The four runs reuse the same 1,000 patients, so they are not independent evidence."
   }
  ],
  "background": ""
 },
 {
  "q": "How did you show that placement, not the compiler, made the difference?",
  "likely": "Likely",
  "topic": "Whole talk",
  "slide": ".tbl",
  "say": "We proved this by running binaries from both compilers under the exact same explicit thread-pinning rules. Once we enforced socket-ordered thread placement, GCC immediately matched the performance of Clang. The root cause lies in how DINE2 numbers its physical cores, assigning even IDs to one socket and odd IDs to the other. Under default close binding, GCC placed adjacent Grid threads onto alternating sockets. Clang only appeared faster initially because LLVM's OpenMP runtime handled default core affinity differently. Enforcing explicit socket ordering eliminated the cross-socket bottleneck and boosted throughput by up to 58 percent at a lattice size of L equals 24.",
  "bullets": [
   ["Controlled pinning", "Enforcing explicit socket-ordered thread placement made GCC immediately match Clang's speed (up to 58% faster at L equals 24)."],
   ["Runtime difference", "Clang only looked faster initially because LLVM's OpenMP runtime handled DINE2's even/odd core numbering differently than GCC's default close binding."]
  ],
  "numbers": [
   "OMP_PLACES={0}:32:2,{1}:32:2",
   "up to 58% at L = 24",
   "best: 864 GFLOP/s on DINE2, 361 on DINE"
  ],
  "followups": [
   {
    "q": "Did placement explain anything else?",
    "a": "Yes. One node, gc007, had looked unusually fast for the same reason. Once placement was fixed, using both hardware threads per core added a further 9% on DINE2."
   },
   {
    "q": "What else affected the result?",
    "a": "Both nodes use first-touch memory placement. Interleaving pages across sockets cost 14 to 23%."
   }
  ],
  "background": "A fair comparison changes one thing. Here the compiler and the thread placement had changed together, so the first comparison could not say which one mattered."
 },
 {
  "q": "How were you able to go back and re-check earlier results?",
  "likely": "Likely",
  "topic": "Whole talk",
  "slide": ".tbl",
  "say": "We preserved the complete raw output logs from every benchmark run. Starting in the second round, each job script automatically recorded its Git commit hash and target host node alongside all loaded environment modules and compiler flags. We also executed every repeat trial as an independent batch job rather than averaging inside a single script. For example, our overnight Grid campaign retained all 97 individual raw log files. In the UCL round, our Python pipeline reproduces every committed metric deterministically, and a verification rerun produced byte-identical outputs. Because we archived the raw telemetry, we could recompute metrics directly from the original logs whenever a formula needed correction.",
  "bullets": [
   ["Complete provenance", "From round two, every job recorded its Git hash and host alongside loaded modules and build flags, with repeats run as separate jobs (saving all 97 raw Grid files)."],
   ["Deterministic scripts", "At UCL, our script reproduces committed numbers byte-for-byte, letting us recompute corrected metrics directly from archived logs."]
  ],
  "numbers": [
   "205 jobs in round 2",
   "97 overnight runs, every raw record kept",
   "UCL rerun byte-identical"
  ],
  "followups": [
   {
    "q": "What did you exclude?",
    "a": "Early DINE2 LIKWID runs that were pinned incorrectly. We also never combined runs from different builds or placements in one scaling curve."
   }
  ],
  "background": ""
 },
 {
  "q": "What does “odds rise 1.59 times per decade” mean?",
  "likely": "Possible",
  "topic": "Round 3 · UCL",
  "slide": ".nz",
  "say": "In statistics, odds represent the probability of a patient having antibiotic resistance divided by the probability of being susceptible. In our multivariable logistic regression, every additional ten years of age multiplies a patient's odds of resistance by 1.59 while holding all other clinical variables constant. The 95 percent confidence interval for this estimate runs from 1.44 to 1.76. Because that range stays well above 1.0, the upward trend is highly unlikely to be random noise. In practical terms, the raw prevalence of resistance climbs from 8 percent among patients aged 20 to 40 up to 41 percent among patients aged 71 to 79.",
  "bullets": [
   ["Odds definition", "Each extra ten years of age multiplies the ratio of resistance probability to susceptibility probability by 1.59 (95% confidence interval 1.44 to 1.76, clear of 1.0)."],
   ["Plain percentages", "Raw resistance climbs from 8% at ages 20 to 40 up to 41% at ages 71 to 79."]
  ],
  "numbers": [
   "odds ratio 1.59 per decade",
   "95% CI 1.44 to 1.76",
   "8% → 26% → 38% → 41% by age group"
  ],
  "followups": [
   {
    "q": "Is a 59% rise in odds a 59% rise in risk?",
    "a": "No. Odds and probability differ. At a 24% base rate, multiplying the odds by 1.59 takes the probability to about 33%."
   }
  ],
  "background": "Logistic regression turns a weighted sum of the factors into a probability. Each weight converts to an odds ratio, which says how the odds change when that factor rises by one step."
 },
 {
  "q": "Does HPCG scale across nodes, and what does it cost in energy?",
  "likely": "Possible",
  "topic": "Round 1 · HPCG",
  "slide": ".tiles",
  "say": "HPCG scaled nearly linearly across multiple nodes. In our final 30-minute benchmark runs, scaling from one node to four nodes increased performance to 531.8 GFLOPS, which is almost four times the single-node throughput. Energy efficiency dipped slightly from 0.1274 down to 0.1204 GFLOPS per watt. That drop represents a minor 6 percent efficiency penalty for inter-node communication, showing that HPCG scales out across four nodes with minimal energy overhead.",
  "bullets": [
   ["Near-linear speedup", "Four nodes reached 531.8 GFLOPS in our 30-minute runs, roughly four times single-node speed."],
   ["Small energy cost", "Efficiency fell by just 6%, dropping from 0.1274 down to 0.1204 GFLOPS per watt."]
  ],
  "numbers": [
   "1 node: 133.7 GFLOPS, 0.1274 GFLOPS/W",
   "4 nodes: 531.8 GFLOPS, 0.1204 GFLOPS/W",
   "tuning tests: 3.9× at 96 to 97% efficiency"
  ],
  "followups": [],
  "background": ""
 },
 {
  "q": "How good is the 160 GFLOPS estimate?",
  "likely": "Possible",
  "topic": "Round 1 · HPCG",
  "slide": ".dk[data-round=\"1\"] .duo:not(.compact)",
  "say": "It serves as a simplified theoretical upper bound rather than an exact target. We calculated it by multiplying the node's theoretical peak memory bandwidth of roughly 1,228 GB/s by an estimated operational intensity of 0.13 FLOPs per byte for HPCG. In practice, sustained memory bandwidth is always lower than the theoretical specification. We observed this directly during the Durham round, where the systems achieved 56 percent and 71 percent of their rated memory bandwidth. Therefore, 160 GFLOPS is an order-of-magnitude ceiling that confirms our 134.5 GFLOPS run is limited by memory rather than compute cores.",
  "bullets": [
   ["Order-of-magnitude ceiling", "It multiplies theoretical node bandwidth (1,228 GB/s) by an estimated 0.13 FLOPs per byte for HPCG."],
   ["Real vs theoretical", "Real bandwidth is always lower, as seen in Durham where nodes reached 56% and 71% of their memory specification."]
  ],
  "check": "Question 32 (Memory Specification Figures) cites 56 percent and 71 percent of rated memory specification from the Durham data. Because James updated Slide 6 to compare the two nodes head-to-head, those percentages no longer appear on the slide. Mention that those figures come from your underlying technical report if asked.",
  "checkShort": "Question 32 quotes 56% and 71% of memory specification from the Durham report, which no longer appears on Slide 6 after James switched to a head-to-head node comparison.",
  "numbers": [
   "1,228 GB/s theoretical",
   "0.13 FLOP/byte estimated",
   "≈ 160 GFLOP/s",
   "measured 134.5"
  ],
  "followups": [],
  "background": ""
 },
 {
  "q": "Why did the first tree flag no one?",
  "likely": "Possible",
  "topic": "Round 3 · UCL",
  "slide": ".dk[data-round=\"3\"] .duo",
  "say": "A standard unweighted decision tree only flags a leaf node as resistant if more than 50 percent of the patients in that group are resistant. In our dataset, only 24 percent of patients are resistant overall, and even the highest-risk elderly cohort peaks at 41 percent resistance. Because no single age bracket crossed the 50 percent majority threshold, the unadjusted tree predicted every single patient as susceptible. Despite failing to catch a single resistant case, the model still reported 76 percent plain accuracy, which demonstrates why raw accuracy hides failure on imbalanced clinical data.",
  "bullets": [
   ["Majority rule", "An unweighted tree only flags a leaf when over 50% of its patients are resistant."],
   ["Below threshold", "Overall resistance is 24% and peaks at 41% in the oldest group, so no leaf crossed 50% and the tree called everyone susceptible (scoring 76% plain accuracy)."]
  ],
  "numbers": [
   "24.1% resistant overall",
   "oldest group about 41%",
   "0 of 60 flagged"
  ],
  "followups": [],
  "background": ""
 },
 {
  "q": "Is the 62 to 64 branch of the tree real?",
  "likely": "Possible",
  "topic": "Round 3 · UCL",
  "slide": "svg.tree",
  "say": "Almost certainly not. The depth-three tree labels patients aged 62 to 64 as lower risk, even though they sit directly between two high-risk age brackets. There is no clinical mechanism to support a sudden dip in resistance across a three-year window, and shallower trees that omit this branch score within one standard deviation in cross-validation. To maintain scientific integrity, we presented the depth-three tree exactly as fitted by our training protocol, and we annotated that specific leaf with a question mark on our slide to highlight it as a sampling artifact.",
  "bullets": [
   ["Sampling noise", "Calling ages 62 to 64 lower risk between two flagged brackets has no clinical basis, and shallower trees without it score within one standard deviation."],
   ["Honest reporting", "We kept the tree as fitted by cross-validation and marked that leaf with a question mark on our slide."]
  ],
  "numbers": [
   "shallower trees within one SD"
  ],
  "followups": [],
  "background": ""
 },
 {
  "q": "How reproducible is the UCL analysis?",
  "likely": "Possible",
  "topic": "Round 3 · UCL",
  "slide": ".term",
  "say": "The entire pipeline is fully deterministic and self-contained. Our scripts execute inside an isolated Python virtual environment with exact package versions pinned in our requirements file. The environment relies strictly on `pandas` and `scikit-learn` for data processing and modelling, alongside `matplotlib` for plotting. Bobby verified reproducibility by executing a clean installation from scratch following only our ReadMe instructions. A complete end-to-end run finishes in 34 seconds on the virtual machine and reproduces the exact same results on a local laptop.",
  "bullets": [
   ["Pinned environment", "Scripts run in a virtual environment pinning only `pandas` and `scikit-learn` alongside `matplotlib` in `requirements.txt`."],
   ["Fast verification", "Bobby verified a fresh install from the ReadMe, and a full run finishes in 34 seconds on the VM while matching a laptop run."]
  ],
  "check": "Question 35 (Laptop vs. VM Reproducibility) states that a full run on the virtual machine matches a local run on a laptop. Check with Bobby before presenting to confirm whether that verification compared the terminal metric tables or the generated plot files.",
  "checkShort": "Question 35 mentions that the VM run matches a laptop run. Confirm with Bobby whether he compared the terminal output tables or the plot files.",
  "numbers": [
   "pandas, scikit-learn, matplotlib",
   "34 s for a full run",
   "matches a laptop run"
  ],
  "followups": [],
  "background": "A virtual environment is a private folder of Python packages for one project, so the versions are fixed and another person can rebuild the same set."
 },
 {
  "q": "Your best DINE2 result used 128 threads on 64 cores. Why?",
  "likely": "Possible",
  "topic": "Round 2 · Grid",
  "slide": "svg.sock",
  "say": "Each physical core on DINE2 supports two simultaneous hardware threads via Simultaneous Multithreading. Once we corrected the socket-level thread placement, enabling both hardware threads per core yielded an additional 9 percent throughput gain by hiding memory latency. Consequently, our peak DINE2 result of 864 GFLOPS utilized all 128 hardware threads at a lattice size of L equals 24. Interestingly, enabling Simultaneous Multithreading on the older DINE architecture degraded throughput by roughly 30 percent, so our peak DINE configuration used 32 physical threads without hyperthreading.",
  "bullets": [
   ["Hardware threads", "Using both hardware threads per core on DINE2 added a further 9% speedup once placement was fixed, peaking at 864 GFLOPS at L equals 24."],
   ["DINE penalty", "The same setting cost 30% on DINE, so its best run used 32 physical threads."]
  ],
  "numbers": [
   "864 GFLOP/s",
   "SMT: +9% on DINE2, −30% on DINE",
   "GCC, 128 SMT threads, L = 24"
  ],
  "followups": [],
  "background": "SMT, also called hyper-threading, lets one core run two threads that share its hardware."
 },
 {
  "q": "Why use ROC AUC here when you rejected it for choosing the model?",
  "likely": "Possible",
  "topic": "Round 3 · UCL",
  "slide": ".nz",
  "say": "We used different metrics because screening individual predictors and deploying a clinical decision model answer two distinct questions. During feature screening on Slide 10, we wanted to know whether a variable ranks resistant patients higher than susceptible patients across all possible cutoffs. That ranking task does not require a fixed decision threshold, and ROC AUC provides a clean baseline where 0.5 represents pure chance. However, when selecting a final deployment model on Slide 11, the model must make binary clinical decisions at a specific operating threshold. Because ROC AUC ignores the decision threshold, it gave a high score to an unweighted tree that flagged zero patients. Therefore, we used ROC AUC for threshold-free feature screening and balanced accuracy for threshold-dependent model selection.",
  "bullets": [
   ["Ranking vs flagging", "Screening predictors only asks if a factor ranks patients better than chance (0.5), which requires no decision threshold."],
   ["Deployment threshold", "Choosing a clinical model requires binary flags at a specific cutoff, where ROC AUC failed by passing a tree that flagged nobody."]
  ],
  "numbers": ["0.5 = chance", "age 0.708 in the regression, 0.685 in the tree"],
  "followups": [],
  "background": ""
 },
 {
  "q": "Which columns did you leave out, and why not use the other antibiotic results?",
  "likely": "Possible",
  "topic": "Round 3 · UCL",
  "slide": ".nz",
  "say": "We restricted our predictors strictly to clinical information available before laboratory culture results return. The susceptibility results for ciprofloxacin and gentamicin come from the exact same lab assay as our target variable, so including them as predictors would introduce data leakage. Even if they were available, co-resistance in this dataset is negligible, sitting at 28 percent and 22 percent compared to the 24 percent baseline. We also excluded patient IDs and dates of birth, since age is already derived directly from birth date. Finally, we dropped the organism column because every single record is *E. coli*, and we dropped the specimen date because all 36 collection dates fall within a narrow five-week window.",
  "bullets": [
   ["Data leakage", "Ciprofloxacin and gentamicin results come from the same lab sample (and show weak co-resistance at 28% and 22% vs 24%)."],
   ["Redundant columns", "We dropped patient ID and date of birth (captured by age), plus organism (always E. coli) and specimen date (all within five weeks)."]
  ],
  "numbers": [
   "cipro-resistant: 28% vs 24%",
   "gentamicin-resistant: 22% vs 24%",
   "36 specimen dates, 25 May to 29 June 2014",
   "964 diagnosis codes, grouped by first letter"
  ],
  "followups": [
   {
    "q": "What is leakage?",
    "a": "Giving a model information that would not be available when the prediction is needed. It makes results look better than they would be in use."
   }
  ],
  "background": ""
 },
 {
  "q": "How strong is the age effect, and is age a cause?",
  "likely": "Possible",
  "topic": "Round 3 · UCL",
  "slide": ".nz",
  "say": "Age exhibits a strong statistical association with resistance in this dataset. Raw resistance prevalence climbs fivefold, rising from 8 percent among patients aged 20 to 40 up to 41 percent among patients aged 71 to 79. Every additional decade of life multiplies the adjusted odds of resistance by 1.59, and age alone achieves a cross-validated ROC AUC of 0.71. Even so, we do not claim a causal relationship. Because the dataset is synthetic, this gradient simply reflects a mathematical rule programmed into the data generator, demonstrating correlation rather than biological causation.",
  "bullets": [
   ["Strong association", "Resistance rises from 8% (ages 20 to 40) to 41% (ages 71 to 79), with a 1.59 odds ratio per decade and a 0.71 single-variable AUC."],
   ["Not causal", "Because the dataset is synthetic, this reflects a rule inside the generator and shows correlation only."]
  ],
  "numbers": [
   "8.4% (335 patients) at 20 to 40",
   "25.9% (352) at 41 to 60",
   "37.5% (168) at 61 to 70",
   "40.7% (145) at 71 to 79"
  ],
  "followups": [
   {
    "q": "What about sex?",
    "a": "Male sex has an odds ratio of 1.24 with an interval of 0.91 to 1.69, which includes 1. We cannot rule out a modest effect."
   }
  ],
  "background": ""
 },
 {
  "q": "How reliable are the confidence intervals?",
  "likely": "Possible",
  "topic": "Round 3 · UCL",
  "slide": ".nz",
  "say": "Our reported confidence intervals are Wald intervals, which rely on normal approximations just as empirical permutation p-values rely on finite sampling. During implementation, we noticed that the default solver tolerance in `scikit-learn` terminated optimization slightly early, which altered three of the resulting odds ratios by 0.01. We tightened the convergence tolerance to ensure exact coefficient estimates. Because the total dataset contains only 1,000 patients, the resulting confidence intervals remain fairly wide for every categorical variable except age.",
  "bullets": [
   ["Wide approximations", "They are approximate Wald intervals, which remain wide across 1,000 patients for everything except age."],
   ["Tighter tolerance", "We tightened the `scikit-learn` solver tolerance because default early stopping shifted three odds ratios by 0.01."]
  ],
  "numbers": [
   "exact fit, tolerance 1e-10",
   "default tolerance moved 3 odds ratios by 0.01",
   "1,000 patients"
  ],
  "followups": [],
  "background": "A Wald interval is the estimate plus or minus about two standard errors. It assumes the estimate is roughly normally distributed, which holds better with more data."
 },
 {
  "q": "Why is deprivation in the tree if it is noise?",
  "likely": "Possible",
  "topic": "Round 3 · UCL",
  "slide": "svg.tree",
  "say": "Because the project brief explicitly asked us to investigate age and socioeconomic deprivation, we passed both variables into the final decision tree classifier. Although the fitted depth-three tree technically includes two internal splits on deprivation, both child leaves beneath each deprivation split predict the exact same clinical class. Because those splits never alter a single patient's final classification, we pruned them from our slide diagram for visual clarity. Including additional variables like biological sex and recent surgery provided no benefit either, as the best decision tree trained on all four features scored a slightly lower 0.655.",
  "bullets": [
   ["Inactive splits", "We included deprivation to match the brief, and while the fitted tree makes two deprivation splits, both leaves under each split predict the exact same class."],
   ["Diagram clarity", "Because those splits change no predictions, our slide drawing omits them (and adding sex and surgery lowered the best tree score to 0.655)."]
  ],
  "numbers": [
   "features: age and deprivation",
   "2 deprivation splits, no change in prediction",
   "with sex and surgery: tree 0.655, forest 0.673"
  ],
  "followups": [],
  "background": ""
 },
 {
  "q": "The tree's test score is below its cross-validation score. Is it overfitted?",
  "likely": "Possible",
  "topic": "Round 3 · UCL",
  "slide": "svg.tree",
  "say": "Our depth-three tree scored 0.659 in cross-validation and 0.622 on the held-out test set. That difference of 0.037 sits just above one standard deviation across our validation runs, which is expected variance when evaluating on a small test sample of only 250 patients. In fact, the random forest moved in the opposite direction, rising from 0.670 in cross-validation to 0.675 on the test set. Therefore, we interpret that minor drop primarily as sampling variance in a small test set, compounded slightly by the quirky age 62 to 64 branch.",
  "bullets": [
   ["Small-sample variance", "The drop from 0.659 to 0.622 is 0.037, just over one validation standard deviation on a 250-patient split (plus minor cost from the 62 to 64 branch)."],
   ["Forest comparison", "The random forest moved slightly upward (0.670 to 0.675), confirming this is test-set noise rather than systemic overfitting."]
  ],
  "numbers": [
   "tree: CV 0.659, test 0.622",
   "forest: CV 0.670, test 0.675",
   "fold SD 0.032 for the tree"
  ],
  "followups": [],
  "background": ""
 },
 {
  "q": "Where exactly are the tree's cut-offs?",
  "likely": "Possible",
  "topic": "Round 3 · UCL",
  "slide": "svg.tree",
  "say": "Mathematically, the fitted algorithm places continuous split thresholds at 48.5 years and 64.5 years, with a secondary split at 61.5 years. Because patient ages are recorded in whole years, our slide diagram translates those thresholds into integer age brackets. Patients under 49 are classified as lower risk, while patients aged 49 to 61 are flagged as high risk. Next, the narrow bracket from 62 to 64 is classified as lower risk, and everyone aged 65 or older is flagged as high risk.",
  "bullets": [
   ["Fitted thresholds", "Continuous splits sit at 48.5 and 64.5 years, with a secondary split at 61.5 years."],
   ["Whole-year brackets", "Under 49 is lower risk and 49 to 61 is flagged, while 62 to 64 is lower risk and 65 or over is flagged."]
  ],
  "numbers": ["48.5, 64.5, 61.5", "class weights: balanced"],
  "followups": [],
  "background": ""
 },
 {
  "q": "Were these control experiments, or just corrections?",
  "likely": "Possible",
  "topic": "Whole talk",
  "slide": ".tbl",
  "say": "Each round involved a distinct type of methodological validation. On Cirrus, we performed a dimensional audit of our arithmetic, verifying that the numerator and denominator covered the exact same time window. In Durham, we executed a controlled hardware comparison by holding thread placement constant across both compilers. At UCL, we implemented formal negative controls by injecting synthetic random noise columns alongside permuted copies of each clinical variable. Across all three cases, the unifying principle was validating our measurement pipeline before attributing an unexpected finding to the underlying system.",
  "bullets": [
   ["Three check types", "Cirrus was an arithmetic time-window check, while Durham was a controlled trial holding thread placement fixed across compilers."],
   ["Negative controls", "UCL used injected random noise columns and shuffled copies, uniting all three rounds around testing our method first."]
  ],
  "numbers": [
   "Cirrus: time-window check",
   "Durham: controlled comparison",
   "UCL: negative control and permutation"
  ],
  "followups": [],
  "background": "A negative control is something you know has no effect. If your method says it has one, the method is at fault."
 },
 {
  "q": "What have you not checked?",
  "likely": "Possible",
  "topic": "Whole talk",
  "slide": ".tbl",
  "say": "We highlight four open limitations on our final slide. First, on Cirrus, we did not isolate which specific hardware subsystems drew the extra power during multi-node runs. Second, in Durham, our hardware performance counters measured the entire Grid execution process rather than isolating a single compute kernel. Third, also in Durham, we did not independently verify the physical DIMM clock speeds behind the vendor's memory bandwidth specification. Fourth, at UCL, our held-out test set contains only 60 resistant cases, which leaves us without the statistical power to declare a single winner among our top-performing models.",
  "bullets": [
   ["Cirrus and Durham", "We did not isolate which components drew extra multi-node power on Cirrus. In Durham, counters covered the whole process rather than one kernel, and we did not verify physical DIMM speeds."],
   ["UCL sample size", "Having only 60 resistant test patients prevents claiming one competitive model beats another."]
  ],
  "numbers": [
   "power not split by component",
   "counters cover the whole process",
   "DIMM speeds not verified",
   "60 resistant test patients"
  ],
  "followups": [],
  "background": ""
 }
];
