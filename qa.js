/* Q&A for the presenter view (press P on the deck, then the Q&A tab).
   Most likely questions first. Edit the text freely. Keep every answer true to the slides.
   likely     Very likely, Likely or Possible. It sets the order and the label.
   slide      a CSS selector for something that only the matching slide holds, so the link survives slides being reordered.
              tools/check.py fails if a selector no longer finds a slide.
   say        the answer to say aloud, about 30 seconds.
   numbers    the figures to hold. followups are the likely next questions. background explains the idea from zero.
   This file is public once it is on the site, like the slides. */
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
  "say": "Each DINE2 core can run two hardware threads. Our best DINE2 figure, 864 GFLOP/s, used all 128 with socket-ordered placement at L = 24.",
  "numbers": [
   "864 GFLOP/s",
   "GCC, 128 SMT threads, L = 24"
  ],
  "followups": [],
  "background": "SMT, also called hyper-threading, lets one core run two threads that share its hardware."
 }
];
