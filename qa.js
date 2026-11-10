/* Q&A for the presenter view (press P on the deck, then the Q&A tab).
   Most likely questions first. Edit the text freely. Keep every answer true to the slides.
   likely     Very likely, Likely or Possible. It sets the order and the label.
   slide      a CSS selector for something that only the matching slide holds, so the link survives slides being reordered.
              tools/check.py fails if a selector no longer finds a slide.
   say        the answer to say aloud, about 30 seconds.
   numbers    the figures to hold. followups are the likely next questions. background explains the idea from zero.
   This file is public once it is on the site, like the slides. */
window.DECK_QA_EDIT = 'https://github.com/kaihuang1425/ucluster-too-qualifier/edit/main/qa.js';   // where the presenter's Edit answers link goes
window.DECK_QA = [
 {
  "q": "You say memory bandwidth limits HPCG. How do you know?",
  "likely": "Very likely",
  "topic": "Round 1 · HPCG",
  "slide": ".nodes2",
  "say": "We have two pieces of evidence and one limit. First, HPCG kept its speed when we left half the cores idle. 144 ranks gave 134.5 GFLOPS and 288 ranks gave 133.7. If the cores were the limit, halving them would have cut the speed. Second, a simple estimate from the node's theoretical bandwidth puts the ceiling near 160 GFLOPS, and we measured 134. The limit is that we never measured bandwidth on Cirrus. So on Cirrus it is a hypothesis, and our report says so.",
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
  "say": "One thing per round. On Cirrus, measure memory bandwidth directly, and test whether the 144-rank HPCG layout keeps its advantage on four nodes. On DiRAC, count FLOPs and bytes for a single Grid kernel, because our counters cover the whole process. At UCL, repeat the analysis on representative data with a larger test set, because ours had only 60 resistant patients. On process, we would run a recon job before any benchmark from day one. We only started doing that in round 2.",
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
  "say": "DINE2 has two processors, called sockets. It numbers its cores even on one socket and odd on the other. The default OpenMP setting, close binding, puts consecutive threads on consecutive core numbers. So thread 0 landed on socket 0, thread 1 on socket 1, and so on. Neighbouring threads share lattice data, so that data kept crossing between sockets. When we listed the cores socket by socket, neighbours sat together, and Grid ran up to 58% faster at L = 24.",
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
  "say": "Only 24% of patients are resistant. A model that calls everyone susceptible is 76% accurate and useless, and that is what our first tree did. It flagged 0 of the 60 resistant test patients. ROC AUC did not catch this, because it scores how well a model ranks patients and ignores where the decision threshold sits. Balanced accuracy averages the hit rate on resistant patients and the hit rate on susceptible patients, so a model that ignores one group scores 0.5. With class weights and balanced accuracy, the tree flagged 39 of 60.",
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
  "say": "A roofline shows the fastest any code can run on a machine. There are two limits. One is peak arithmetic, which is a flat line. The other is memory bandwidth multiplied by the FLOPs a code does per byte it moves, which is a slope. They meet at the ridge point. Grid does about 1.6 to 2.1 FLOPs per byte, and the ridge points are 14.5 and 23.3, so Grid sits at about a tenth of either ridge point, on the slope where memory sets the ceiling. At Grid's intensity the roof allows about 363 GFLOP/s on DINE and 826 on DINE2. Grid reached 259 and 506, which is 71% and 61% of the roof.",
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
  "say": "We tested each factor on its own against chance. For each column we fitted a model on that column alone and scored it with cross-validated ROC AUC. Then we shuffled the column 100 times. Shuffling keeps the values and breaks any link with resistance, so the shuffled scores show what chance produces. A factor passed only if both a logistic regression and a depth-2 tree beat 95% of their shuffled copies. Only age passed, with 0.71 against about 0.54. We also added a column of random numbers as a control, and it failed, as it should.",
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
  "say": "The difference is inside the noise. On cross-validated balanced accuracy the forest scored 0.670, the regression 0.660 and the tree 0.659. The fold-to-fold standard deviation is 0.024 to 0.032, so we did not treat a lead of 0.011 as a real difference. The brief asked which tree best identifies people at risk, so we chose the single tree, which can be read and checked by hand. It is three questions about age. The ranking held across four random seeds.",
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
  "say": "We did both, and they agree. Alone, each factor went into a logistic regression and a depth-2 tree, scored against shuffled copies. Together, we fitted one logistic regression for adjusted odds ratios, and a random forest that was also given two columns of random numbers. In the regression only age has an interval clear of 1, at 1.59 per decade. In the forest, shuffling age cuts the test AUC by 0.20, and shuffling any other column cuts it by 0.004 or less, the same as the random columns.",
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
  "say": "On the 250 held-out patients, 60 are resistant. The tree flags 116 patients. 39 of them are resistant and 77 are not, and it misses 21. So it finds 65% of resistant patients, and about one flag in three is right. Its plain accuracy is 61%, lower than the 76% of the first tree, which flagged nobody. That is the trade we chose.",
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
  "say": "In cross-validation, yes. The class-balanced trees of depth 1 and depth 2 score 0.655, against 0.659 for depth 3, which is a tie. On the test set the depth-1 tree did better. It flagged 44 of the 60 resistant patients, against 39. The difference is the 62 to 64 branch, which the deeper tree calls lower risk. We chose by cross-validation before looking at the test set, and we kept that choice. A single split would be just as defensible.",
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
  "say": "We divided the GFLOPS that HPL reports by the job's average power. GFLOPS covers only the timed solve, and the average power covers the whole job, including setup. That overstates efficiency by the ratio of job time to solve time. For a short run the ratio is large. At N = 50,000 the solve took 11 seconds of a 32-second job. At N = 250,000 it was 1,124 of 1,151 seconds. The corrected score divides the work done in the solve by the whole job's energy.",
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
  "say": "No, and we say so. The data is synthetic, modelled on UK Health Security Agency data. It covers only ages 20 to 79. White patients are 17.6% of the records, against about 82% of the population of England and Wales. The test set has only 60 resistant patients. So this is a demonstration of method. What we would carry over is the process of checking each factor against chance before believing it.",
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
  "say": "Slurm records the energy each job uses. We divided the work done in the benchmark's timed section by the whole job's energy. That energy includes setup and validation, which the GFLOPS figure does not, so our efficiency numbers are conservative. Every job ran with exclusive use of its nodes. For HPCG our best figure was 0.1376 GFLOPS per watt on one node.",
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
  "say": "They do different work per byte. HPL multiplies dense matrices, and it reuses each number many times while it sits in cache. HPCG works on a sparse matrix, where each grid point touches its 26 neighbours. It reads a value, does a little arithmetic and moves on, so it spends its time waiting for memory. On one node HPL reached 15,345 GFLOPS and HPCG 134.5, at a similar power draw. That is a ratio of 114.",
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
  "say": "In each round our first reading turned out to describe our method. On Cirrus our first efficiency formula favoured short runs. In Durham a compiler difference was really thread placement. At UCL deprivation looked important until a column of random numbers scored higher. Each time a check on our method caught it. So we now check the method before we credit a result to the system.",
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
  "say": "The same five steps each time. Get access, check the hardware and run a small test job. Read up on the problem and run a baseline. Change one parameter per experiment with the rest held fixed. Run each sweep as a batch of jobs and keep every raw result. Draw each figure from the raw data with a script, then interpret it. Round 3 was a modelling task, so step three meant comparing models on the same data split.",
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
  "say": "The file arrived readable by every user on the machine. We recorded that first. Then we moved it into a folder only our account can open, and made the file readable only by us. Both scripts set umask 027, so their outputs are not world-readable. Access was through JupyterHub and an SSH key, and the public repository holds no credentials or addresses.",
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
  "say": "From round 2 we had four fixed roles, each with a written guide. In Durham we held two 15-minute syncs a day, and at UCL an evening check-in. Every work session left a log entry on what failed and how we fixed it. In round 3, Ada set up the VM environment and ReadMe, explored the data and chose the evaluation metric. Bobby kept the VM updated and tested a fresh install. James wrote the modelling script. I tested the risk factors against noise, ran the logistic regression, and led the slides and video.",
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
  "say": "Both nodes get faster with more threads but stay below the ideal line. DINE reaches 17.2 times on 32 threads, which is 54% efficiency. DINE2 reaches 21.4 times on 64 threads, which is 34%. DINE2 has twice the cores but only about 1.7 times the memory bandwidth, so each core gets less, 6.2 GB/s against 7.2. A code limited by bandwidth should behave like this. We say consistent with, because a scaling curve alone cannot separate bandwidth from other effects.",
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
  "say": "The reference HPCG code does not thread its smoother, the Gauss-Seidel step where it spends much of its time. With 12 threads per rank, the extra threads cannot help in that step. With one rank per core, every core works. Pure MPI was about 1.95 times faster than 24 ranks of 12 threads, and about 5 times faster than 8 ranks of 36.",
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
  "say": "Grid is a C++ library for lattice QCD, which simulates quarks and gluons on a four-dimensional grid. It is one of the main science workloads on DiRAC, so it shows how the nodes behave on real research code. We ran its single-precision domain-wall kernel. L is the lattice size, so a larger L means more data per thread.",
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
  "say": "Yes, and one nearly did. Seven factors other than age, each in two models, give 14 scores. Each has a 1 in 20 chance of clearing its band by luck, so we expect about 0.7 lucky passes. The diagnosis-chapter tree scored 0.524 against a band top of 0.519. The regression on the same factor did not pass. That is why a factor had to pass in both models.",
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
  "say": "For each factor we made 100 shuffled copies and scored each one the same way as the real column. The band shows the score that 95% of those copies stay below. A factor passes if its real score is above that, which is a p-value of 0.05 or less. With 100 copies the smallest p-value we can report is 0.01, and age reached it. The script has an option to run more copies.",
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
  "say": "We cannot rule it out, and this data does not show it. In the adjusted regression, deprivation quintile 3 has an odds ratio of 0.60 with an interval of 0.36 to 0.97, just under 1. But there are 10 intervals for factors other than age, each with a 1 in 20 chance of missing 1 by luck. There is also no gradient. Quintiles 2 to 5 give 0.69, 0.60, 0.92 and 0.90, and the raw resistance rates are 26, 21, 20, 29 and 25%. A real effect would rise or fall steadily.",
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
  "say": "The first forest gave deprivation an importance of 0.09, and we read that as evidence. That score is impurity importance, which rewards columns with many distinct values, because they offer more places to split. In our check forest a continuous column of random numbers scored 0.16, more than deprivation at 0.07. We then used permutation importance on held-out patients, which does not have that bias. There deprivation sits level with the random columns.",
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
  "say": "Five kinds of tree model at depths 1 to 8, so 40 models. They were plain trees, class-balanced trees, bagging, random forests and gradient boosting. We split the data once into 750 training and 250 test patients, keeping the share of resistant patients the same. We ranked models by 5-fold cross-validated balanced accuracy on the training patients. The test set was used only to report the chosen models.",
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
  "say": "We repeated the whole run with four seeds, which change the train and test split, the folds and the models' own randomness. The class-balanced tree was the best single tree every time, and the random forest was the best model overall every time. Age carried over 90% of the importance every time. The best tree depth moved between 1 and 3, which is why we treat shallow trees as tied.",
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
  "say": "We ran both compilers with the same explicit thread placement. With socket-ordered places, GCC caught up with Clang. The mechanism is that DINE2 numbers its cores even on one socket and odd on the other, so the default close binding puts neighbouring Grid threads on opposite sockets. Clang looked faster only because LLVM's OpenMP runtime placed threads differently. Socket ordering raised throughput by up to 58% at L = 24.",
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
  "say": "We kept the raw record of every run. From round 2, each job stored its git hash, loaded modules, build flags and host, and repeats ran as separate jobs. The overnight Grid campaign kept all 97 raw records. At UCL the script reproduces the committed numbers exactly, and a rerun the same day was byte-identical. So when a result looked wrong we could recompute it from the logs.",
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
  "say": "Odds are the chance of resistance divided by the chance of no resistance. In our logistic regression, each extra ten years of age multiplies those odds by 1.59, with the other factors held fixed. The 95% confidence interval is 1.44 to 1.76. It does not include 1, so the trend is unlikely to be chance. In plain shares, resistance rises from 8% at ages 20 to 40 to 41% at ages 71 to 79.",
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
  "say": "It scaled almost perfectly. Four nodes gave 531.8 GFLOPS in the final 30-minute runs, about four times one node. Efficiency fell slightly, from 0.1274 to 0.1204 GFLOPS per watt, which is about 6%. So HPCG scaled out with a small energy cost.",
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
  "say": "It is a simplified ceiling. It multiplies the node's theoretical memory bandwidth, about 1,228 GB/s, by an estimated 0.13 FLOPs per byte for HPCG. Real bandwidth is lower than theoretical. We saw that in Durham, where the nodes reached 56% and 71% of their memory specification. So it is a rough figure, and its job is to show the order of magnitude.",
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
  "say": "A plain tree flags a group only when more than half of it is resistant. Only 24% of patients are resistant overall, and even the oldest age group is about 41%. So no group crossed one half, and the tree called everyone susceptible. It was still 76% accurate, which is why accuracy hid the problem.",
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
  "say": "Probably not. The tree calls patients aged 62 to 64 lower risk, between two flagged groups. We know of no reason for that, and shallower trees without that branch score within one standard deviation. We kept the tree as fitted and marked that leaf with a question mark.",
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
  "say": "The scripts run in a virtual environment with only the three packages they import, which are pandas, scikit-learn and matplotlib, pinned in requirements.txt. Bobby tested a fresh install from the ReadMe. A full run takes 34 seconds on the VM and matches a run on a laptop.",
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
  "say": "Each DINE2 core can run two hardware threads. Once placement was fixed, using both added a further 9% on DINE2, so our best figure there, 864 GFLOP/s, used all 128 at L = 24. On DINE the same setting cost about 30%, so its best run used 32 threads.",
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
  "say": "The two questions are different. Here we ask whether a factor ranks resistant patients above susceptible ones better than chance. That needs no threshold, and 0.5 means chance, so ROC AUC fits. For choosing a model that has to flag patients, the threshold matters, and that is where ROC AUC let through a tree that flagged nobody.",
  "numbers": [
   "0.5 = chance",
   "age 0.708 in the regression, 0.685 in the tree"
  ],
  "followups": [],
  "background": ""
 },
 {
  "q": "Which columns did you leave out, and why not use the other antibiotic results?",
  "likely": "Possible",
  "topic": "Round 3 · UCL",
  "slide": ".nz",
  "say": "We kept only what is known before the lab result. The ciprofloxacin and gentamicin results come from the same sample, so using them would be using the answer. Co-resistance is weak here anyway, at 28% against 24% and 22% against 24%. We also left out the identifier, date of birth because age comes from it, the organism because it is always E. coli, and the specimen date because all 36 dates fall within five weeks.",
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
  "say": "Resistance rises from 8% at ages 20 to 40 to 41% at ages 71 to 79. Each decade multiplies the odds by 1.59. Age alone ranks patients with an AUC of 0.71. We do not claim cause. The data is synthetic, so this is a pattern its generator put in, and it shows an association only.",
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
  "say": "They are Wald intervals, which are approximations, and so are permutation p-values. We fitted the regression to a tight tolerance, because the default setting in scikit-learn stops early enough to move three of the odds ratios by 0.01. With 1,000 patients the intervals are wide for everything except age.",
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
  "say": "The brief asks about age and deprivation, so the model was given those two columns. The fitted tree has two deprivation splits, but both leaves under each one predict the same class, so they change no prediction. That is why the drawing leaves them out. Adding sex and recent surgery did not help either. The best single tree with all four columns scored 0.655.",
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
  "say": "The tree scores 0.659 in cross-validation and 0.622 on the test set. That is a drop of 0.037, a little over one fold-to-fold standard deviation, on a single split of 250 patients. The forest goes the other way, from 0.670 to 0.675. So we read it as noise in a small test set, with some cost from the 62 to 64 branch.",
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
  "say": "The fitted splits are at 48.5, 64.5 and 61.5 years. Ages are whole years, so the drawing shows them as 49 or over, 65 or over, and 62 to 64. Under 49 is lower risk, 49 to 61 is flagged, 62 to 64 is lower risk and 65 or over is flagged.",
  "numbers": [
   "48.5, 64.5, 61.5",
   "class weights: balanced"
  ],
  "followups": [],
  "background": ""
 },
 {
  "q": "Were these control experiments, or just corrections?",
  "likely": "Possible",
  "topic": "Whole talk",
  "slide": ".tbl",
  "say": "They are three different kinds of check. On Cirrus it was a check of the arithmetic, comparing the time window each term covers. In Durham it was a controlled comparison, with placement held the same for both compilers. At UCL it was a negative control, a column of random numbers, together with shuffled copies of each factor. What they share is that each tested our method before we credited the result to the system.",
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
  "say": "Four things, and they are on our limitations slide. On Cirrus we did not isolate which components drew the extra power on several nodes. In Durham our Grid counters cover the whole process and not one kernel, and we did not verify the memory module speeds behind the specification. At UCL the test set has only 60 resistant patients, so we cannot claim one competitive model is better.",
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
