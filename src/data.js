// Timeline data. Every date below was checked against the primary source listed in `src`.
// Dates are first public release (arXiv v1 submission date, blog/post date, or release announcement).

const THREADS = {
  exact:    { label: "Exact attention",      desc: "Make the full softmax lookup better or faster without changing what it computes." },
  position: { label: "Position",             desc: "Tell attention where tokens are, or how far apart." },
  length:   { label: "Longer context",       desc: "Run past the length the model was trained on." },
  decode:   { label: "Decoding memory",      desc: "Shrink the KV cache that grows with every generated token." },
  sparse:   { label: "Sparsity",             desc: "Attend to a chosen subset of tokens instead of all of them." },
  state:    { label: "Recurrent state",      desc: "Replace the growing cache with a fixed-size memory." },
  compress: { label: "Compression",          desc: "Store fewer, smaller numbers per token." }
};

const ERAS = [
  { before: "bahdanau", years: "2014 – 2017", title: "Make it exact",
    text: "Attention starts as a helper bolted onto RNN translators and ends up as the whole model. The priority is quality: an exact, global, content-based lookup that every token can use in one step." },
  { before: "shaw", years: "2018 – 2020", title: "Pay the bills",
    text: "Once the Transformer wins, its three costs show up: compute that grows with N², a KV cache that slows generation, and position handling that does not travel past the training length. Different groups attack different bills: relative positions, fixed sparsity, shared K/V heads, and a first attempt at replacing the cache with a recurrent state." },
  { before: "delta", years: "2021 – 2022", title: "Fix the foundations",
    text: "Better position schemes (RoPE, ALiBi) and better GPU kernels (FlashAttention) make exact attention work at longer lengths without changing what it computes. Recurrent memory gets its first real repair: the delta rule." },
  { before: "gqa", years: "2023", title: "Serve it, stretch it",
    text: "Open models reach millions of users and the limits move to serving. The KV cache and the trained context length become the bottlenecks, and fixes arrive in weeks, some from papers, some from Reddit and blogs." },
  { before: "mla", years: "2024 – 2026", title: "Hybrids, sparsity, compression",
    text: "Targets move toward a million tokens. Recurrent state returns in delta-rule form, learned sparsity returns at token level, and KV compression gets aggressive. Models stop using one attention everywhere and mix several in one stack." }
];

const ENTRIES = [
{
  id: "bahdanau", date: "2014-09-01", dateLabel: "1 Sep 2014", added: true,
  name: "Additive attention",
  who: "Bahdanau, Cho, Bengio",
  src: { label: "arXiv 1409.0473", url: "https://arxiv.org/abs/1409.0473" },
  threads: ["exact"], responds: [],
  before: "Neural translators read a sentence with an RNN, a network that reads one word at a time and carries a running summary, then wrote the translation from that single summary vector.",
  problem: "RNN translators squeezed a whole source sentence into one fixed-length vector before writing a single word. Long sentences lost detail.",
  mechanism: "While producing each output word, the decoder scores every encoder state with a small neural network, turns the scores into weights with softmax, and takes the weighted sum. Attention begins as a soft, learned lookup.",
  buys: ["No single-vector bottleneck: the decoder can look back at any source word.", "Readable alignments between source and target words."],
  costs: ["Still wrapped around an RNN, so training is sequential and slow.", "Scoring every source–target pair costs source length × target length."],
  choose: "Historical. You meet it today only inside RNN sequence-to-sequence systems.",
  leaves: "Keep the soft lookup, drop the RNN."
},
{
  id: "learned", date: "2017-05-08", dateLabel: "8 May 2017",
  name: "Learned absolute positions",
  who: "Gehring et al., ConvS2S (Facebook AI Research)",
  src: { label: "arXiv 1705.03122", url: "https://arxiv.org/abs/1705.03122" },
  threads: ["position"], responds: [],
  note: "Often credited to the Transformer or BERT. ConvS2S used learned position embeddings a month before the Transformer paper, which reports trying them too. GPT-1 (Jun 2018) and BERT (Oct 2018) then made them the default for a while.",
  before: "An RNN knows word order for free, because it reads left to right. Models that look at every word at once, like the convolutional translators of 2017, do not.",
  problem: "A model that reads all tokens at once, rather than one after another, needs some other way to know which token came first.",
  mechanism: "Keep a table with one learned vector per position (0 to max − 1) and add the row for position p to the token at position p.",
  buys: ["The simplest possible scheme; the model learns whatever position signal helps.", "No extra cost inside attention."],
  costs: ["Hard ceiling: position max has no row, so the model cannot run past its training length at all.", "Each position is learned separately, and late positions see the least training.", "Encodes where a token is, not how far apart two tokens are."],
  choose: "Short, fixed-length encoders (classification, embedding models) that will never see longer inputs.",
  leaves: "A position signal that needs no parameters and exists for every position."
},
{
  id: "transformer", date: "2017-06-12", dateLabel: "12 Jun 2017",
  name: "Scaled dot-product self-attention",
  who: "Vaswani et al., Google",
  src: { label: "arXiv 1706.03762", url: "https://arxiv.org/abs/1706.03762" },
  threads: ["exact"], responds: ["bahdanau"],
  before: "Attention existed, but only as a helper bolted onto an RNN, which still read one word at a time.",
  problem: "RNN-based attention models were accurate but sequential: token t waits for token t − 1, so training could not use the GPU's parallelism, and information between distant words passed through many steps.",
  mechanism: "Drop the RNN. Every token makes a query, key and value. Scores are dot products q·k, scaled by 1/√d so softmax does not saturate, masked so a decoder cannot see the future, softmaxed, and used to mix the values. Several heads do this in parallel on slices of the vector. This is the pipeline in the lab at the top of the page.",
  fig: { type: "mask", pattern: "causal", legend: { 1: "attended" } },
  buys: ["Fully parallel training across all positions.", "Any token reaches any other in one step: an exact, global, content-based lookup.", "A simple, uniform block that scales."],
  costs: ["Compute and score memory grow with N²: double the context, four times the work.", "At inference every past token's K and V must be kept (the KV cache), and it grows with every generated token.", "Attention has no sense of word order on its own."],
  choose: "Still the default core for contexts up to tens of thousands of tokens, whenever exact recall matters.",
  leaves: "Three bills to pay: N² compute, a growing KV cache, and position."
},
{
  id: "sinusoidal", date: "2017-06-12", dateLabel: "12 Jun 2017",
  name: "Sinusoidal positions",
  who: "Vaswani et al., Google (same paper)",
  src: { label: "arXiv 1706.03762", url: "https://arxiv.org/abs/1706.03762" },
  threads: ["position"], responds: ["learned"],
  before: "Same paper. With the RNN gone, attention sees a sentence as a bag of words. ConvS2S, a month earlier, had used a learned table of position vectors.",
  problem: "Self-attention treats its input as a set. Shuffle the words and every score stays the same.",
  mechanism: "Add a fixed pattern of sine and cosine waves to each token embedding, with wavelengths from 2π up to 10000·2π. Each position gets a unique fingerprint, and nothing is learned.",
  buys: ["Zero parameters, defined for any position.", "The shift between two positions is a fixed linear transform, so relative distance is learnable in principle."],
  costs: ["Position is mixed into the token's content at the input, before attention sees it.", "In practice models still degrade past their training length.", "The paper found learned embeddings performed about the same."],
  choose: "Rarely today. It survives as a baseline and in some encoder models.",
  leaves: "Put distance, not absolute position, inside the attention score."
},
{
  id: "shaw", date: "2018-03-06", dateLabel: "6 Mar 2018", added: true,
  name: "Relative position representations",
  who: "Shaw, Uszkoreit, Vaswani (Google)",
  src: { label: "arXiv 1803.02155", url: "https://arxiv.org/abs/1803.02155" },
  threads: ["position"], responds: ["sinusoidal"],
  before: "Position was absolute: added once to each word at the input, as “I am word 7”.",
  problem: "Absolute positions tell the model where a token is. Most language patterns care about how far apart two tokens are.",
  mechanism: "Learn one vector per clipped relative distance (−k to +k) and add it into the key, and the value, whenever token i attends to token j.",
  buys: ["Distance-aware attention that does not depend on absolute location.", "Somewhat better behaviour on unseen lengths."],
  costs: ["Extra work inside every attention score.", "All distances beyond k are treated as the same.", "Harder to make fast."],
  choose: "Mostly superseded by RoPE and ALiBi, which deliver relative position more cheaply.",
  leaves: "A cheaper way to make q·k depend on distance."
},
{
  id: "txl", date: "2019-01-09", dateLabel: "9 Jan 2019", added: true,
  name: "Segment recurrence (Transformer-XL)",
  who: "Dai et al. (CMU, Google)",
  src: { label: "arXiv 1901.02860", url: "https://arxiv.org/abs/1901.02860" },
  threads: ["length", "state"], responds: ["transformer"],
  before: "Transformers were trained on fixed chunks, say 512 tokens, cut from long text. Each chunk was processed alone.",
  problem: "Training on fixed-length chunks cut text into unrelated pieces. Nothing crossed a chunk boundary.",
  mechanism: "Cache the hidden states of the previous segment and let the current segment attend to them, without backpropagating into them. Relative positions keep the cached states meaningful.",
  buys: ["Effective context longer than the training window.", "Much faster evaluation, because earlier segments are reused instead of recomputed."],
  costs: ["The cache is more memory to carry.", "Information beyond the cached segment still fades.", "Requires a relative position scheme."],
  cls: "The course's own V4 model carries an idea like this across chunk boundaries, shrunk to its minimum. Its Memory Stream is one model-width vector, the previous chunk's final hidden state, passed forward with gradients stopped and added through a small learned gate. The lesson reports the injected memory at about 6% of the token's own size, so it is a nudge, not a copy of the old chunk. It is unpublished course work, so it has no dated entry here.",
  choose: "Historical, but the idea of carrying a state from chunk to chunk returns in 2020–2025.",
  leaves: "Reach longer inputs without paying N²."
},
{
  id: "sparse", date: "2019-04-23", dateLabel: "23 Apr 2019",
  name: "Fixed sparse patterns (Sparse Transformer)",
  who: "Child, Gray, Radford, Sutskever (OpenAI)",
  src: { label: "arXiv 1904.10509", url: "https://arxiv.org/abs/1904.10509" },
  threads: ["sparse"], responds: ["transformer"],
  before: "Full attention: every token scores every earlier token, N² pairs.",
  problem: "For images, audio and long text, N² was a wall. Sequences of tens of thousands of elements did not fit.",
  mechanism: "Each token attends to a structured subset: a local band of recent positions plus every s-th earlier position. Two hops through these patterns connect any pair, for about N·√N work.",
  fig: { type: "mask", pattern: "strided", legend: { 1: "local band", 2: "strided" } },
  buys: ["Sequences tens of thousands long became trainable.", "Still exact softmax over the pairs that are kept."],
  costs: ["The pattern is fixed by hand and may skip the pair that mattered.", "Needs custom GPU kernels.", "Works best on data with regular structure, such as images and audio."],
  choose: "Very long structured signals. For text, learned selection later replaced fixed patterns.",
  leaves: "Let the model decide which pairs matter."
},
{
  id: "mqa", date: "2019-11-06", dateLabel: "6 Nov 2019",
  name: "Multi-query attention (MQA)",
  who: "Shazeer (Google)",
  src: { label: "arXiv 1911.02150", url: "https://arxiv.org/abs/1911.02150" },
  threads: ["decode"], responds: ["transformer"],
  before: "Multi-head attention: each of many heads keeps its own keys and values, and the KV cache stores and re-reads all of them for every new token.",
  problem: "Generating one token at a time is limited by memory bandwidth: every step re-reads the K and V of every head for every past token.",
  mechanism: "Keep a separate query per head, but let all heads share one K and one V.",
  fig: { type: "heads", mode: "mqa" },
  buys: ["The KV cache and its memory traffic shrink by the number of heads (for example 32×).", "Much faster token-by-token decoding."],
  costs: ["Measurable quality loss, and training can be less stable (the GQA paper reports both).", "Every head must search the same single set of keys, so heads cannot each keep their own view of the past."],
  choose: "Memory-bound serving and small on-device models, where speed matters more than the last bit of quality.",
  leaves: "A middle ground between one K/V for all heads and one per head."
},
{
  id: "topk", date: "2019-12-25", dateLabel: "25 Dec 2019",
  name: "Top-k attention",
  who: "Zhao et al., Explicit Sparse Transformer; Gupta et al. (Jun 2021)",
  src: { label: "arXiv 1912.11637", url: "https://arxiv.org/abs/1912.11637" },
  src2: { label: "arXiv 2106.06899", url: "https://arxiv.org/abs/2106.06899" },
  threads: ["sparse"], responds: ["sparse"],
  before: "Fixed sparse patterns chose which pairs to keep by position alone, the same for every input.",
  problem: "Softmax gives every token some weight, so attention leaks onto many irrelevant tokens.",
  mechanism: "Compute all the scores, keep the k largest in each row, set the rest to −∞, then softmax. Gupta et al. later showed a chunked version that also cuts memory.",
  fig: { type: "mask", pattern: "topk", legend: { 1: "kept (top 3)", 3: "scored, then dropped" } },
  buys: ["Sharper, more focused attention.", "Gupta et al. (2021): chunked top-k makes memory linear in length while matching dense quality."],
  costs: ["All N² scores are still computed to find the top k, so compute alone is not saved.", "Selection is a hard choice, and k is one more hyperparameter."],
  cls: "The class example: 12 earlier tokens, keep the best k. The work on values falls with k, but all 12 scores are still computed. The course's V4 capped its budget at 256 tokens, down from 1,024. That was a kernel limit on that hardware, not a finding that 256 is the right number.",
  choose: "When focus matters; and as the seed of later designs where a cheap scorer chooses the k tokens for the expensive attention.",
  leaves: "A cheap way to find the k tokens without scoring all of them in full."
},
{
  id: "longformer", date: "2020-04-10", dateLabel: "10 Apr 2020",
  name: "Sliding window + global tokens (Longformer)",
  who: "Beltagy, Peters, Cohan (Allen Institute for AI)",
  src: { label: "arXiv 2004.05150", url: "https://arxiv.org/abs/2004.05150" },
  threads: ["sparse"], responds: ["sparse"],
  before: "Fixed patterns worked for images and audio. Text models still paid full N², which is why BERT stopped at 512 tokens.",
  problem: "Document-length inputs of thousands of tokens were too long for full attention.",
  mechanism: "Each token attends to a window of w neighbours on both sides. A few chosen global tokens, such as the question, attend to and from everything. Stacking L layers widens each token's reach to about L × w.",
  fig: { type: "mask", pattern: "longformer", legend: { 1: "window", 2: "global token" } },
  buys: ["Cost grows as N·w, linear in length.", "Global tokens keep a direct path for task-critical information."],
  costs: ["Anything outside the window must hop layer by layer or pass through a global token.", "Which tokens are global is a per-task design choice."],
  choose: "Long-document encoders, and the local layers of later hybrid models.",
  leaves: "Apply the same idea to decoders, where the KV cache is the cost."
},
{
  id: "linear", date: "2020-06-29", dateLabel: "29 Jun 2020",
  name: "Linear attention",
  who: "Katharopoulos, Vyas, Pappas, Fleuret (Idiap, EPFL)",
  src: { label: "arXiv 2006.16236", url: "https://arxiv.org/abs/2006.16236" },
  threads: ["state"], responds: ["transformer", "txl"],
  before: "Every speed-up so far still kept softmax, so each query scored keys one by one, and the KV cache still grew with every token.",
  problem: "Softmax forces every query to score every key, so the N × N table can never be skipped.",
  mechanism: "Replace exp(q·k) with φ(q)·φ(k). Then (QKᵀ)V can be regrouped as Q(KᵀV): add each token's outer product kᵀv into a fixed D × D state S, and each query reads q·S. At inference it runs like an RNN.",
  fig: { type: "memory", mode: "linear", modes: ["linear", "delta"] },
  build: [
    { h: "Start with attention, minus the softmax",
      p: "Use plain numbers first. One query q and three earlier tokens, each with a key k and a value v. The score for each token is q × k, and the output is every value times its score, added up.",
      calc: `q = 2
k₁ = 0.5   v₁ = 10      score 2 × 0.5 = 1
k₂ = 1.0   v₂ = 20      score 2 × 1.0 = 2
k₃ = 1.5   v₃ = 30      score 2 × 1.5 = 3

output = 1×10 + 2×20 + 3×30 = 140` },
    { h: "Notice that q is in every term",
      p: "Each term is (q × k) × v. The same q appears three times, so it can be pulled out to the front. What is left in the brackets does not contain q at all. It can be worked out as the tokens arrive, before any question is asked.",
      calc: `output = q × (k₁v₁ + k₂v₂ + k₃v₃)
       = 2 × (0.5×10 + 1.0×20 + 1.5×30)
       = 2 × 70
       = 140        same answer` },
    { h: "Call the bracket S, the running memory",
      p: "S = k₁v₁ + k₂v₂ + k₃v₃. Every new token adds its own k × v into S. A query then needs only S, not the list of old tokens. After ten tokens or ten million, S is still one object of the same size. That is the whole saving: no growing KV cache, and no N × N table of scores.",
      calc: `write:  S ← S + k × v       once per token
read:   output = q × S      once per query` },
    { h: "With real vectors, k × v becomes a small table",
      p: "Keys and values are lists of numbers, not single numbers. Multiplying a key (standing up as a column, written kᵀ) by a value (lying down as a row) gives a table: row i of the table is the value v scaled by the i-th number of the key. So a key of [1, 0] files the value into row 1 and leaves row 2 empty. The key decides where the value is stored.",
      calc: `k = [1, 0]    v = [2, 1]        “meeting at 2 pm”

kᵀv = [ 1×[2, 1] ]  =  [ 2  1 ]
      [ 0×[2, 1] ]     [ 0  0 ]` },
    { h: "Write two tokens, then read them back",
      p: "Token 2 has a different key, [0, 1], so its value lands in row 2. Asking with q = [1, 0] returns row 1, and asking with q = [0, 1] returns row 2. The table behaves like a dictionary, built from nothing but multiplying and adding. Step through this in the memory lab beside this card.",
      calc: `token 1: k = [1, 0], v = [2, 1]      S = [ 2  1 ]
token 2: k = [0, 1], v = [3, 0]          [ 3  0 ]

q = [1, 0]:  q·S = 1×[2, 1] + 0×[3, 0] = [2, 1]   the meeting time
q = [0, 1]:  q·S = 0×[2, 1] + 1×[3, 0] = [3, 0]   the room` },
    { h: "Why softmax had to go for this to work",
      p: "Softmax divides every score by the sum over all scores. Scores 1, 2, 3 become weights 0.09, 0.24, 0.67, and the output becomes 0.09×10 + 0.24×20 + 0.67×30 ≈ 25.8. To get the weight for token 1 you need the scores of tokens 2 and 3 as well, and those change with every new query. So q can no longer be pulled out to the front, and the old tokens cannot be folded into S ahead of time. Removing softmax is the price of the fixed-size memory. It also gives up what softmax provided: weights that are positive, add to 1, and compete." },
    { h: "The flaw: this memory can only add",
      p: "Token 3 says the meeting moved to 5 pm. It uses the same key as token 1, so its value lands in the same row, on top of what was there. The old 2 pm is not replaced. It is still inside the sum.",
      calc: `token 3: k = [1, 0], v = [5, 5]      “meeting moved to 5 pm”

S = [ 2+5  1+5 ]  =  [ 7  6 ]
    [  3    0  ]     [ 3  0 ]

q = [1, 0]:  q·S = [7, 6]      wanted [5, 5]. 2 pm and 5 pm piled up.` }
  ],
  buys: ["Compute grows linearly with N.", "Constant memory per generated token, however long the text."],
  costs: ["No softmax means no sharp focus; weights are raw similarities.", "The state only adds, so a second write under the same key piles on top of the first. In the lab, 2 pm then 5 pm reads back as 7.", "A clear quality gap to softmax attention, worst on exact recall."],
  choose: "Very long streams where approximate memory is acceptable. Today mostly the cheap layer in hybrids.",
  leaves: "A way to overwrite memory instead of piling on."
},
{
  id: "delta", date: "2021-02-22", dateLabel: "22 Feb 2021",
  name: "Delta rule for linear attention",
  who: "Schlag, Irie, Schmidhuber (IDSIA)",
  src: { label: "arXiv 2102.11174", url: "https://arxiv.org/abs/2102.11174" },
  threads: ["state"], responds: ["linear"],
  note: "Dated to 2024 in class. The delta-rule update for linear Transformers was published in February 2021. The 2024 paper (Yang et al., June 2024, further down) made it fast to train.",
  before: "Linear attention: a fixed-size memory S that every token adds into.",
  problem: "Linear attention's memory only adds. Writing a new value under an existing key mixes the old and new values.",
  mechanism: "Before writing, read what the memory currently returns for this key, then write only the difference: S ← S + β·kᵀ(v − k·S). β, between 0 and 1, is a learned write strength.",
  fig: { type: "memory", mode: "delta", modes: ["linear", "delta"] },
  build: [
    { h: "First, what does k·S actually compute?",
      p: "Take a memory holding one thing: S = kᵀv, the key [1, 0] with the value [2, 1] (the linear attention card above builds this). Now multiply S from the left by some key you want to ask with, call it k′. Swap S for what it is made of, kᵀv, and regroup the brackets. The grouping can change because the order of the three pieces does not.",
      calc: `k′·S = k′·(kᵀv)
     = (k′·kᵀ)·v
        └────┘
        one number: how similar the asking key is to the stored key` },
    { h: "So a read is: similarity × stored value",
      p: "k′·kᵀ is a dot product: multiply the two keys slot by slot and add. It is 1 when the keys are the same (and have length 1), 0 when they have nothing in common, and in between when they partly overlap. The read hands back the stored value scaled by that number.",
      calc: `stored: k = [1, 0], v = [2, 1]

ask with [1, 0]:      similarity 1×1 + 0×0     = 1     read = 1 × [2, 1]   = [2, 1]
ask with [0, 1]:      similarity 0×1 + 1×0     = 0     read = 0 × [2, 1]   = [0, 0]
ask with [0.6, 0.8]:  similarity 0.6×1 + 0.8×0 = 0.6   read = 0.6 × [2, 1] = [1.2, 0.6]` },
    { h: "With many memories, one multiplication checks them all",
      p: "A real S is a sum of many writes: S = k₁ᵀv₁ + k₂ᵀv₂ + … Multiplying by k′ spreads across the sum. Each stored key gets its own similarity score, each score scales its own value, and the results are added. It is a soft dictionary lookup: no searching and no if-statements, one multiplication.",
      calc: `S holds:  k₁ = [1, 0] → v₁ = [2, 1]      k₂ = [0, 1] → v₂ = [3, 0]

k′·S = (k′·k₁ᵀ)·v₁ + (k′·k₂ᵀ)·v₂

ask with [0.6, 0.8]:   0.6 × [2, 1] + 0.8 × [3, 0] = [1.2, 0.6] + [2.4, 0] = [3.6, 0.6]` },
    { h: "The delta idea: read before you write",
      p: "A new token arrives with its key k and value v. Before storing anything, ask the memory with the token's own key: what do you already return for this key? Call the answer v_old. If the key is new, v_old is all zeros. If the key was used before, v_old is the stale value.",
      calc: `token 3: k = [1, 0], v = [5, 5]      “meeting moved to 5 pm”

S = [ 2  1 ]        v_old = k·S = 1×[2, 1] + 0×[3, 0] = [2, 1]
    [ 3  0 ]        memory still says 2 pm` },
    { h: "Write only the gap",
      p: "Compare what you want stored (v) with what is already there (v_old). The difference is the gap, the “delta” in the name. Store the gap under the key, exactly the way linear attention stores a value.",
      calc: `gap = v − v_old = [5, 5] − [2, 1] = [3, 4]

kᵀ·gap = [ 3  4 ]        S = [ 2  1 ] + [ 3  4 ] = [ 5  5 ]
         [ 0  0 ]            [ 3  0 ]   [ 0  0 ]   [ 3  0 ]` },
    { h: "Check: the same key now returns the new value",
      p: "Reading with k after the write gives the old answer plus similarity × gap. For a key of length 1 the similarity with itself is 1, so the old value cancels and exactly v is left. The room in row 2 was never touched.",
      calc: `new read = v_old + (k·kᵀ) × gap
         = [2, 1] + 1 × [3, 4]
         = [5, 5]                      linear attention gave [7, 6]

q = [0, 1]:  q·S = [3, 0]             the room, unchanged` },
    { h: "When nothing is there, delta is just linear attention",
      p: "For tokens 1 and 2 the keys were new, so v_old was [0, 0] and the gap was the whole value. The delta rule wrote exactly what linear attention would have. The two differ only when a new key overlaps something already in memory.",
      calc: `token 1: v_old = [0, 0]    gap = [2, 1] − [0, 0] = [2, 1]    same write as linear
token 2: v_old = [0, 0]    gap = [3, 0] − [0, 0] = [3, 0]    same write as linear
token 3: v_old = [2, 1]    gap = [5, 5] − [2, 1] = [3, 4]    different: corrects` },
    { h: "β: how hard to write",
      p: "The full rule has one more learned number per token, β, between 0 and 1. It scales the gap. β = 1 overwrites fully, as in every step above. β = 0 ignores the token. Values in between move the stored value part of the way.",
      calc: `S ← S + β · kᵀ(v − k·S)
              └── gap ──┘

β = 1:    [2, 1] + 1.0 × [3, 4] = [5, 5]
β = 0.5:  [2, 1] + 0.5 × [3, 4] = [3.5, 3]
β = 0:    [2, 1] + 0   × [3, 4] = [2, 1]` },
    { h: "Where this sits in the layer",
      p: "Only the write changed. The token still makes q, k and v from x with the learned tables W_Q, W_K, W_V. The read is still q·S. After that the output goes through one more learned table (W_O), is added back onto x, and moves on to the rest of the layer, exactly as in standard attention. The layer takes token vectors in and gives token vectors out, so the rest of the model cannot tell the difference. That is why delta layers and attention layers can be mixed in one stack.",
      calc: `x → q, k, v              same as always
  → write into S         the only change: S ← S + β·kᵀ(v − k·S)
  → read: out = q·S      same as linear attention
  → out·W_O, add to x    same as always` },
    { h: "What the tidy example hides",
      p: "The keys here are [1, 0] and [0, 1]: no overlap, length exactly 1. Real keys partly overlap, like [0.6, 0.8]. DeltaNet scales keys to length 1 so the overwrite stays exact for that key, but correcting one entry still disturbs any entry whose key overlaps it. And a 2 × 2 table holds only two clean pairs. A D × D state holds about D. Past that, memories blur into each other however good the write rule is." }
  ],
  buys: ["Clean overwrites: the same key now returns its latest value.", "Much better associative recall for the same state size."],
  costs: ["Each update reads the previous state, so training runs step by step and is slow on GPUs.", "Fixed capacity: about D clean key → value pairs.", "No way to forget a whole topic at once."],
  choose: "A recurrent layer where in-context recall matters, once it became trainable at scale.",
  leaves: "Make it parallel to train, and give it a way to forget."
},
{
  id: "rope", date: "2021-04-20", dateLabel: "20 Apr 2021",
  name: "Rotary position embedding (RoPE)",
  who: "Su et al. (Zhuiyi Technology)",
  src: { label: "arXiv 2104.09864", url: "https://arxiv.org/abs/2104.09864" },
  threads: ["position"], responds: ["sinusoidal", "shaw"],
  before: "Two ways to give position: absolute vectors added at the input (sinusoidal, learned), or distance vectors added inside attention (Shaw), which cost extra work in every score.",
  problem: "Relative position worked better than absolute, but existing schemes either added cost inside attention or mixed position into the token's content.",
  mechanism: "Split q and k into pairs of dimensions and rotate each pair by an angle proportional to the token's position, at a different speed per pair. The dot product of q rotated to position m and k rotated to position n depends only on m − n.",
  fig: { type: "rope" },
  buys: ["Relative distance falls out of q·k with no parameters.", "Applied only to q and k, so it works with KV caching and with linear attention.", "Many speeds: fast pairs track nearby order, slow pairs track long range."],
  costs: ["Past the trained length the angles are unseen and quality collapses.", "The slowest pairs never complete a full turn during training, so they are the least reliable.", "Longer contexts need extra tricks (interpolation, NTK, YaRN, below)."],
  choose: "The default in nearly every modern decoder LLM (Llama, Qwen, DeepSeek, Mistral).",
  leaves: "Run past the trained length."
},
{
  id: "alibi", date: "2021-08-27", dateLabel: "27 Aug 2021",
  name: "Linear biases (ALiBi)",
  who: "Press, Smith, Lewis (University of Washington, Facebook AI Research)",
  src: { label: "arXiv 2108.12409", url: "https://arxiv.org/abs/2108.12409" },
  threads: ["position", "length"], responds: ["rope", "sinusoidal"],
  before: "Sinusoidal, learned, and now RoPE positions. All were trained up to some length, and all degraded beyond it.",
  problem: "Models trained on length L failed on longer inputs, whatever position scheme they used.",
  mechanism: "Use no position embedding at all. Subtract m·(i − j) from each score, so the penalty grows with distance, with a different slope m per head.",
  fig: { type: "mask", pattern: "alibi", legend: { 1: "score penalty fades with distance" } },
  buys: ["Train short, test long: perplexity holds on inputs longer than training.", "No parameters, almost free."],
  costs: ["Built-in recency bias: distant tokens are always penalised, which hurts finding one fact far back.", "Fewer large models adopted it than RoPE (BLOOM and MPT did)."],
  choose: "When steady quality on longer-than-trained inputs matters more than precise long-range retrieval.",
  leaves: "Extrapolation without a permanent recency penalty."
},
{
  id: "flash", date: "2022-05-27", dateLabel: "27 May 2022", added: true,
  name: "IO-aware exact attention (FlashAttention)",
  who: "Dao, Fu, Ermon, Rudra, Ré (Stanford)",
  src: { label: "arXiv 2205.14135", url: "https://arxiv.org/abs/2205.14135" },
  threads: ["exact"], responds: ["transformer"],
  before: "Exact attention computed the obvious way: write the full N × N score table to GPU memory, then read it back for softmax and again for × V.",
  problem: "On GPUs, attention was slow mostly because the N × N score matrix was written to and read back from slow GPU memory, not because of the arithmetic.",
  mechanism: "Process Q, K and V in tiles that fit in fast on-chip memory, keep a running softmax, and never store the full N × N matrix. Recompute it during the backward pass instead.",
  buys: ["Exactly the same output as standard attention.", "Large wall-clock speedups, and score memory that grows linearly instead of quadratically.", "Made long training contexts practical."],
  costs: ["Compute is still N².", "Does nothing for the KV cache at inference.", "Hand-tuned, hardware-specific kernels; unusual masks and biases need kernel support."],
  choose: "Always, for exact attention on modern GPUs. It is an implementation, not an approximation.",
  leaves: "With training fast, the KV cache becomes the bottleneck in serving."
},
{
  id: "gqa", date: "2023-05-22", dateLabel: "22 May 2023",
  name: "Grouped-query attention (GQA)",
  who: "Ainslie et al. (Google)",
  src: { label: "arXiv 2305.13245", url: "https://arxiv.org/abs/2305.13245" },
  threads: ["decode"], responds: ["mqa"],
  before: "Two options: MHA, where every head has its own K and V (best quality, biggest cache), or MQA, where all heads share one (smallest cache, some quality lost).",
  problem: "MHA's KV cache was too big to serve cheaply, and MQA's single K/V head cost quality.",
  mechanism: "Split the query heads into G groups; heads in a group share one K and one V. G = 1 is MQA and G = number of heads is MHA. Existing MHA checkpoints can be converted with about 5% of the original pre-training compute.",
  fig: { type: "kv" },
  buys: ["Close to MHA quality at close to MQA speed.", "A dial (G) that can be set per model size."],
  costs: ["The cache still grows linearly with context length.", "Heads in a group must agree on one K/V, a modest quality cost."],
  cls: "The lesson's yardstick: 48 layers × 8 K/V heads × 128 numbers × 2 (K and V) × 2 bytes = 196,608 bytes per token. At 32,768 tokens that is 6.44 GB for one user and 51.5 GB for eight (counting 1 GB as 10⁹ bytes). GQA lowers the slope of that line. It does not stop the line growing.",
  choose: "The default for open LLMs from 2023 on (Llama 2 70B, Llama 3, Mistral, Qwen).",
  leaves: "Shrink the per-token cache further without making heads share."
},
{
  id: "pi", date: "2023-06-20", dateLabel: "20 – 27 Jun 2023",
  name: "Position interpolation",
  who: "kaiokendev (blog, 20 Jun 2023); Chen et al., Meta (arXiv, 27 Jun 2023)",
  src: { label: "arXiv 2306.15595", url: "https://arxiv.org/abs/2306.15595" },
  src2: { label: "kaiokendev's write-up", url: "https://kaiokendev.github.io/til" },
  threads: ["length"], responds: ["rope"],
  note: "Two independent discoveries a week apart. kaiokendev's public write-up (20 Jun 2023) came before Meta's arXiv paper (27 Jun 2023).",
  before: "RoPE models such as LLaMA, trained at 2,048 tokens. People wanted to paste in longer documents.",
  problem: "LLaMA was trained on 2K-token contexts. RoPE angles beyond 2K had never been seen, and output fell apart.",
  mechanism: "Divide every position by s = new length ÷ trained length, so positions up to 8K map into the familiar 0–2K range, then fine-tune briefly.",
  buys: ["Extends RoPE models several-fold (the paper reaches 32K) with about 1,000 fine-tuning steps."],
  costs: ["Squeezes every dimension, including the fast ones that encode nearby order, so close neighbours become harder to tell apart.", "Needs fine-tuning, and quality on short inputs can dip slightly."],
  choose: "A quick extension when you have a small fine-tuning budget.",
  leaves: "Squeeze only the dimensions that need it."
},
{
  id: "ntk", date: "2023-06-29", dateLabel: "29 Jun 2023",
  name: "NTK-aware RoPE scaling",
  who: "bloc97 (Reddit, r/LocalLLaMA)",
  src: { label: "Reddit post", url: "https://www.reddit.com/r/LocalLLaMA/comments/14lz7j5/ntkaware_scaled_rope_allows_llama_models_to_have/" },
  src2: { label: "llama.cpp PR #2054 (30 Jun 2023)", url: "https://github.com/ggerganov/llama.cpp/pull/2054" },
  threads: ["length"], responds: ["pi"],
  note: "Not a paper: a Reddit post. Reddit blocks automated fetching, so the day was read from the PullPush archive record of the post (created 29 Jun 2023, 08:21 UTC). That fits llama.cpp PR #2054, which cites the post and was opened on 30 Jun 2023.",
  before: "Position interpolation, days old: squeeze every position by the same factor, then fine-tune.",
  problem: "Position interpolation blurred nearby-token order because it slowed every frequency by the same factor.",
  mechanism: "Instead of scaling positions, raise RoPE's base from 10000 to 10000·s^(d/(d−2)). Fast-rotating pairs barely change; the slowest pairs are slowed by the full factor s.",
  buys: ["Works reasonably with no fine-tuning at all.", "Keeps local order sharp. A dynamic variant (emozilla) adjusts the base as the input grows."],
  costs: ["A heuristic: some middle dimensions still land slightly outside their trained range.", "Gains shrink at large extension factors without fine-tuning."],
  choose: "Extension by a modest factor at inference time, with no fine-tuning.",
  leaves: "A principled rule per dimension."
},
{
  id: "yarn", date: "2023-08-31", dateLabel: "31 Aug 2023",
  name: "YaRN",
  who: "Peng, Quesnelle, Fan, Shippole (Nous Research, EleutherAI, University of Geneva)",
  src: { label: "arXiv 2309.00071", url: "https://arxiv.org/abs/2309.00071" },
  threads: ["length"], responds: ["pi", "ntk"],
  before: "Two community tricks from June 2023 for stretching RoPE: interpolation, which squeezes every frequency, and NTK scaling, which mostly squeezes the slow ones. Both worked, roughly.",
  problem: "Interpolation hurt local order; NTK scaling was a heuristic that left some dimensions out of range.",
  mechanism: "Decide per dimension by how many full turns it makes inside the trained window. Dimensions that turn many times are left alone, dimensions that never finish a turn are interpolated like PI, and a ramp blends the two in between. Attention is also sharpened slightly by a temperature that grows with the extension factor.",
  fig: { type: "ext" },
  buys: ["Reports 10× fewer tokens and 2.5× fewer training steps than previous methods.", "128K contexts from models trained at 4K."],
  costs: ["More hyperparameters (ramp bounds, temperature), tuned per model family.", "Still a patch on a model trained short; long-range skill must be learned in fine-tuning."],
  choose: "The standard way to extend a RoPE model today; Qwen and DeepSeek ship YaRN settings.",
  leaves: "Long contexts still pay for a full KV cache."
},
{
  id: "sinks", date: "2023-09-29", dateLabel: "29 Sep 2023",
  name: "Attention sinks (StreamingLLM)",
  who: "Xiao, Tian, Chen, Han, Lewis (MIT, Meta AI, CMU)",
  src: { label: "arXiv 2309.17453", url: "https://arxiv.org/abs/2309.17453" },
  threads: ["length"], responds: ["longformer"],
  before: "Sliding windows: keep only the last W tokens' keys and values, so memory stays fixed however long the text runs.",
  problem: "A rolling window should allow endless generation with fixed memory, but the model produced gibberish as soon as the first tokens were evicted.",
  mechanism: "Softmax must put its weight somewhere, and models learn to dump spare weight on the first tokens. Keep those few sink tokens (the paper uses 4) permanently, plus a window of recent tokens.",
  fig: { type: "mask", pattern: "sink", legend: { 1: "recent window", 2: "sink tokens (kept forever)" } },
  buys: ["Stable generation over millions of tokens with a fixed cache and no retraining."],
  costs: ["Evicted middle content is gone. This gives endless fluency, not long-context understanding.", "Positions must be re-indexed inside the cache."],
  choose: "Long-running chat or streaming on fixed memory, when forgetting old content is acceptable.",
  leaves: "Why do sinks exist at all? Answered by gated attention in 2025."
},
{
  id: "mistral", date: "2023-10-10", dateLabel: "10 Oct 2023",
  name: "Sliding-window decoding (Mistral 7B)",
  who: "Jiang et al. (Mistral AI)",
  src: { label: "arXiv 2310.06825", url: "https://arxiv.org/abs/2310.06825" },
  threads: ["decode", "sparse"], responds: ["longformer", "gqa"],
  before: "GQA had shrunk each token's cache entry, but the cache still gained one entry per token, forever.",
  problem: "Even with GQA, a decoder's KV cache grows with every token.",
  mechanism: "Each layer attends only to the last W = 4,096 tokens, and the cache is a rolling buffer of W slots. Because layers stack, information can still travel about W × layers tokens.",
  fig: { type: "mask", pattern: "window", legend: { 1: "last W tokens" } },
  buys: ["Fixed cache size at any length.", "Faster long generation."],
  costs: ["Far tokens are reached only indirectly, through many layers, so exact recall of distant facts weakens."],
  choose: "Local layers in interleaved designs; later models such as Gemma alternate local and global layers.",
  leaves: "Keep exact global layers, but make their cache tiny."
},
{
  id: "mla", date: "2024-05-07", dateLabel: "7 May 2024",
  name: "Multi-head latent attention (MLA)",
  who: "DeepSeek-AI, DeepSeek-V2",
  src: { label: "arXiv 2405.04434", url: "https://arxiv.org/abs/2405.04434" },
  threads: ["decode", "compress"], responds: ["gqa"],
  before: "GQA, the standard by 2024: query heads share K and V in groups.",
  problem: "GQA saves cache by making heads share, which costs some quality. DeepSeek wanted MHA quality with a much smaller cache.",
  mechanism: "Cache one small latent vector per token (512 numbers in DeepSeek-V2) instead of full K and V for every head. Each head rebuilds its K and V from the latent with learned up-projections. RoPE does not survive that trick, so a small separate RoPE key (64 numbers) is cached alongside.",
  fig: { type: "heads", mode: "mla" },
  buys: ["DeepSeek reports a 93.3% smaller KV cache than DeepSeek 67B, with quality on par with or better than MHA.", "The up-projections can be folded into the query and output matrices at inference."],
  costs: ["More matrix multiplications and a more complex implementation.", "The decoupled RoPE key is a workaround with its own design choices.", "Serving frameworks needed time to support it."],
  choose: "Large models where KV memory dominates serving cost (DeepSeek-V2 and V3, Kimi's models).",
  leaves: "The cache is small, but each new token still attends over every past token."
},
{
  id: "deltanet24", date: "2024-06-10", dateLabel: "10 Jun 2024",
  name: "DeltaNet, trainable at scale",
  who: "Yang, Wang, Zhang, Shen, Kim",
  src: { label: "arXiv 2406.06484", url: "https://arxiv.org/abs/2406.06484" },
  threads: ["state"], responds: ["delta"],
  note: "This is the 2024 DeltaNet paper discussed in class. The delta rule itself is from 2021.",
  before: "The 2021 delta rule: clean overwrites, but each step had to wait for the one before it.",
  problem: "The delta rule's read-before-write made each step depend on the previous one, so it trained token by token and could not scale.",
  mechanism: "A chunkwise parallel algorithm, using a compact representation of many stacked delta updates, computes a whole chunk of steps at once on GPU tensor cores.",
  buys: ["DeltaNet trained at language-model scale and beat earlier linear models on recall-heavy tasks."],
  costs: ["Complex custom kernels.", "Still no forgetting, and still a fixed-size memory."],
  choose: "When you want a delta-rule layer in a real model; superseded months later by the gated version.",
  leaves: "Add forgetting."
},
{
  id: "gdn", date: "2024-12-09", dateLabel: "9 Dec 2024",
  name: "Gated DeltaNet",
  who: "Yang, Kautz, Hatamizadeh (NVIDIA)",
  src: { label: "arXiv 2412.06464", url: "https://arxiv.org/abs/2412.06464" },
  threads: ["state"], responds: ["deltanet24"],
  before: "Two recurrent memories with opposite strengths. DeltaNet (June 2024) overwrites one entry precisely. Mamba2 forgets quickly through a decay gate.",
  problem: "DeltaNet overwrites precisely but cannot clear stale memory quickly. Mamba2's gate forgets quickly but cannot overwrite one entry.",
  mechanism: "Before each delta update, scale the whole state by a learned gate α between 0 and 1: first S ← α·S, then S ← S + β·kᵀ(v − k·S). α near 0 wipes memory when the topic changes; α near 1 keeps it.",
  fig: { type: "memory", mode: "gated", modes: ["delta", "gated"] },
  build: [
    { h: "What the delta rule cannot do",
      p: "The delta rule fixes one key at a time, and only when that key comes up again. Suppose the conversation moves to a new topic. The memory is full of the old topic, and none of those keys will ever be written again. Nothing clears them. They sit there and bleed into every later read whose key partly overlaps." },
    { h: "Add one step before each write: shrink everything",
      p: "Multiply the whole table by a number α between 0 and 1. With α = 1 nothing changes. With α = 0 the memory is wiped. In between, every stored value fades a little.",
      calc: `α = 0.8

S = [ 2  1 ]   →   0.8 × S = [ 1.6  0.8 ]
    [ 3  0 ]                 [ 2.4  0   ]` },
    { h: "Then do the delta write on the faded table",
      p: "The rest is the delta rule from the card above, unchanged: read with the token's key, find the gap, write the gap. The read just sees the faded memory. The numbers below follow all three tokens with α = 0.8, and match the memory lab beside this card.",
      calc: `token 1: fade (nothing yet)   write [2, 1]              S = [ 2  1 ]
                                                            [ 0  0 ]

token 2: fade → [1.6, 0.8]    write the room [3, 0]     S = [ 1.6  0.8 ]
                                                            [ 3    0   ]

token 3: fade → [1.28, 0.64] and [2.4, 0]
         v_old = k·S = [1.28, 0.64]
         gap   = [5, 5] − [1.28, 0.64] = [3.72, 4.36]
         write the gap                                  S = [ 5    5 ]
                                                            [ 2.4  0 ]` },
    { h: "Read it back: one exact, one faded",
      p: "The meeting time is exact, because the gap is measured against the faded value and so makes up the full difference. The room was written once and never refreshed, so it has faded to 80%. That is the trade inside this layer: the gate that clears stale memory also dims memory you still wanted.",
      calc: `q = [1, 0]:  q·S = [5, 5]       the latest meeting time, exact
q = [0, 1]:  q·S = [2.4, 0]     the room, 80% of [3, 0]` },
    { h: "α is learned, and set fresh for every token",
      p: "α is not one fixed dial. Like β, the model computes it from each token. It can learn to keep α close to 1 through ordinary text, so little fades, and drop it toward 0 when it sees a boundary such as a new document. In the lab the slider is fixed so the effect is easy to see.",
      calc: `S ← α·S                          forget   (the gate)
S ← S + β·kᵀ(v − k·S)            correct  (the delta rule)` }
  ],
  buys: ["Fast forgetting and targeted overwriting in one layer.", "The strongest linear-time layer in the paper's comparisons, especially on retrieval and long context."],
  costs: ["Still a fixed-size memory: exact recall of one detail far back is weaker than softmax attention.", "The gate fades the whole state, including facts that were still wanted. In the lab, the room number fades along with the old meeting time.", "On its own it trails Transformers on retrieval, so it is used in hybrids."],
  choose: "The cheap layer in hybrid stacks, such as Qwen3-Next and the course's DDDG design.",
  leaves: "How many exact attention layers do you still need?"
},
{
  id: "minimax", date: "2025-01-14", dateLabel: "14 Jan 2025", added: true,
  name: "Linear–softmax hybrid at scale (MiniMax-01)",
  who: "MiniMax",
  src: { label: "arXiv 2501.08313", url: "https://arxiv.org/abs/2501.08313" },
  threads: ["state"], responds: ["linear"],
  before: "Two separate kinds of model: linear (cheap, fixed memory, weak recall) and softmax (exact, expensive).",
  problem: "Pure linear models lost recall, and pure softmax models could not afford million-token contexts.",
  mechanism: "Place one softmax attention layer after every seven lightning (linear) attention layers.",
  fig: { type: "stack", pattern: "LLLLLLLS" },
  buys: ["Training contexts up to 1M tokens, and inference extended to about 4M.", "Most layers cost linear time and constant memory."],
  costs: ["The softmax layers still keep a full KV cache.", "The ratio is a bet: too few exact layers and retrieval suffers."],
  choose: "Very long contexts where most work is local but some exact lookup is still needed.",
  leaves: "Make the exact layers cheaper as well."
},
{
  id: "nsa", date: "2025-02-16", dateLabel: "16 Feb 2025",
  name: "Native sparse attention (NSA)",
  who: "Yuan et al. (DeepSeek-AI, Peking University, University of Washington)",
  src: { label: "arXiv 2502.11089", url: "https://arxiv.org/abs/2502.11089" },
  threads: ["sparse", "compress"], responds: ["topk", "longformer"],
  before: "Sparse attention in many forms (fixed patterns, top-k, windows), mostly added at inference to models trained with full attention.",
  problem: "Earlier sparse methods were bolted on at inference, were often slower in practice than on paper, and were not trained end to end.",
  mechanism: "Three branches per query, mixed by learned gates: attention over compressed summaries of blocks (a coarse view), full attention inside the few blocks those summaries rate highest (a fine view), and a sliding window over recent tokens. The kernels are designed for the GPU from the start.",
  fig: { type: "mask", pattern: "nsa", legend: { 3: "compressed block summaries", 2: "selected blocks", 1: "sliding window" } },
  buys: ["Sparse during training as well as inference, so the model learns to use it.", "Reported large speedups at 64K length while matching or beating full attention on the paper's benchmarks."],
  costs: ["Complex kernels; selection works on blocks, not single tokens.", "Block size and the number of selected blocks are new hyperparameters."],
  choose: "Training long-context models where full attention is the main cost.",
  leaves: "Select individual tokens with an even cheaper scorer."
},
{
  id: "gatedattn", date: "2025-05-10", dateLabel: "10 May 2025", added: true,
  name: "Gated attention",
  who: "Qiu et al. (Qwen team, Alibaba)",
  src: { label: "arXiv 2505.06708", url: "https://arxiv.org/abs/2505.06708" },
  threads: ["exact"], responds: ["sinks"],
  before: "Attention sinks (2023): models dump spare attention on the first few tokens, because softmax weights must always add up to 1.",
  problem: "Attention sinks showed that softmax had no way to say \"nothing here is relevant\", so models wasted the first tokens as a dumping ground.",
  mechanism: "Multiply each head's attention output by a sigmoid gate computed from the current token. A head can now output close to nothing instead of attending to a sink.",
  buys: ["Per the paper: removes attention sinks and improves training stability and long-context extrapolation."],
  costs: ["A few extra parameters and a little compute.", "Methods that rely on sinks, such as StreamingLLM, no longer apply as they are."],
  choose: "The full-attention layers of hybrids such as Qwen3-Next.",
  leaves: "Pair it with Gated DeltaNet."
},
{
  id: "hybrid", date: "2025-09-12", dateLabel: "12 Sep 2025", added: true,
  name: "3 : 1 delta-to-attention hybrids",
  who: "Qwen3-Next (Alibaba, 12 Sep 2025); Kimi Linear (Moonshot AI, 30 Oct 2025)",
  src: { label: "Qwen3-Next announcement (via S. Willison)", url: "https://simonwillison.net/2025/Sep/12/qwen3-next/" },
  src2: { label: "arXiv 2510.26692 (Kimi Linear)", url: "https://arxiv.org/abs/2510.26692" },
  threads: ["state"], responds: ["gdn", "gatedattn", "minimax"],
  cls: "The course's V4 uses the same 3 : 1 shape, DDDGDDDG, except that its G layers are sparse top-k attention rather than full attention. Per the lesson, making all eight layers G would cost 8× the KV cache for only about 1.41× the compute, so memory is the price of exact layers. The schedule held from 1.78B to 120B parameters, but neighbouring ratios were never tested. It is a working choice, not a proven best.",
  before: "The parts were ready: Gated DeltaNet (Dec 2024), gated attention (May 2025), and MiniMax-01's evidence that a 7 : 1 mix can work.",
  problem: "What mix of cheap recurrent layers and exact attention layers keeps quality?",
  mechanism: "Three Gated DeltaNet layers, then one gated full-attention layer, repeated (Qwen3-Next 80B: 36 + 12). Kimi Linear uses a similar ratio of its Kimi Delta Attention to MLA.",
  fig: { type: "stack", pattern: "DDDGDDDGDDDG" },
  buys: ["Three quarters of the layers keep a fixed-size state, so the KV cache shrinks roughly fourfold.", "Exact layers remain for precise retrieval."],
  costs: ["Two kinds of layers mean two sets of kernels to maintain.", "The ratio is empirical; pure-attention models may still win on the hardest retrieval."],
  choose: "Long-context assistants and agents where decoding cost matters.",
  leaves: "Make the remaining full-attention layers sparse too."
},
{
  id: "dsa", date: "2025-09-29", dateLabel: "29 Sep 2025",
  name: "DeepSeek Sparse Attention (DSA)",
  who: "DeepSeek-AI, DeepSeek-V3.2-Exp",
  src: { label: "vLLM launch-day post", url: "https://vllm.ai/blog/2025-09-29-deepseek-v3-2" },
  src2: { label: "TechCrunch, 29 Sep 2025", url: "https://techcrunch.com/2025/09/29/deepseek-releases-sparse-attention-model-that-cuts-api-costs-in-half/" },
  threads: ["sparse"], responds: ["mla", "nsa", "topk"],
  before: "MLA had made DeepSeek's cache small, but each new token still ran full attention over every earlier token.",
  problem: "MLA made the cache small, but every new token still attended over all previous tokens.",
  mechanism: "A small lightning indexer, with few heads and low precision, scores every previous token cheaply. Only the top 2,048 tokens get full MLA attention.",
  fig: { type: "mask", pattern: "dsa", legend: { 3: "scored by the cheap indexer", 2: "top-k: full attention" } },
  buys: ["The main attention costs N·k instead of N².", "DeepSeek cut its API prices by about half at launch."],
  costs: ["The indexer still looks at every token, so an N² term remains, just a cheap one.", "If the indexer misses a token, the main attention never sees it.", "One more cache, for the indexer's keys."],
  choose: "Long-context serving on an MLA model.",
  leaves: "Shrink the sequence the indexer has to search."
},
{
  id: "drope", date: "2025-12-13", dateLabel: "13 Dec 2025",
  name: "Dropping positional embeddings (DroPE)",
  who: "Gelberg, Eguchi, Akiba, Cetin (Sakana AI)",
  src: { label: "arXiv 2512.12167", url: "https://arxiv.org/abs/2512.12167" },
  threads: ["position", "length"], responds: ["yarn", "rope"],
  before: "RoPE plus stretching tricks (interpolation, NTK, YaRN): still RoPE, just with adjusted angles.",
  problem: "Every RoPE-extension trick still keeps RoPE, and RoPE's unseen angles are what break long contexts.",
  mechanism: "Pretrain with RoPE, which speeds up learning, then remove positional embeddings entirely and recalibrate briefly. The causal mask still leaks order, so the model keeps working without explicit positions.",
  buys: ["The paper reports zero-shot context extension without long-context fine-tuning, beating RoPE-scaling methods while keeping in-length quality."],
  costs: ["Needs a recalibration phase after pretraining.", "Very new (ICLR 2026) and not yet proven in large production models.", "Without explicit positions, fine ordering must be inferred."],
  cls: "The course's V4 trained at 8K tokens and reports a 256K context, 256 ÷ 8 = 32×, with DroPE applied before annealing (the final phase at a very low learning rate), so the model still had training steps left to adapt. In class the loss jumped when RoPE was removed and then recovered. That is one model's reported result. It does not promise that 320× would work, or that another model would stretch as far.",
  choose: "Worth a proxy run when context extension is the goal; not yet a default.",
  leaves: "Open: does it hold at frontier scale?"
},
{
  id: "v4", date: "2026-04-24", dateLabel: "24 Apr 2026",
  name: "Compressed sparse attention (DeepSeek-V4)",
  who: "DeepSeek-AI, DeepSeek-V4",
  src: { label: "Hugging Face DeepSeek-V4 post", url: "https://huggingface.co/blog/deepseekv4" },
  threads: ["compress", "sparse"], responds: ["dsa", "nsa", "mla"],
  note: "Not the same as NSA (Feb 2025) or DSA (Sep 2025). These are three different DeepSeek mechanisms and are easy to mix up.",
  before: "DeepSeek had three tools: MLA (a small cache entry per token), NSA and DSA (read only the tokens that matter).",
  problem: "At a million tokens, even DSA's indexer searched a million entries, and every entry was cached.",
  mechanism: "Two layer types. CSA merges every 4 tokens into one compressed KV entry; a lightning indexer picks the top-k compressed blocks, and a sliding window covers recent raw tokens. HCA merges 128 tokens per entry and attends to all of them densely. Layers alternate CSA and HCA, and most of the KV is stored as 8-bit numbers (FP8) instead of 16-bit.",
  fig: { type: "mask", pattern: "csa", legend: { 3: "compressed entries (4 tokens each)", 2: "top-k compressed entries", 1: "sliding window" } },
  buys: ["At 1M tokens, V4-Pro reports 27% of V3.2's per-token FLOPs and 10% of its KV cache.", "About 2% of the cache an 8-group GQA model would need in bf16."],
  costs: ["Compression is lossy: single-token detail outside the window must survive pooling.", "Many interacting parts (pooling, indexer, window, precision) to tune and serve.", "Released April 2026; independent evaluation is still thin."],
  choose: "Million-token agents where memory is the binding constraint.",
  leaves: "The current frontier."
}
];

const CORRECTIONS = [
  { title: "The delta rule is from 2021, not 2024.",
    text: "The delta-rule update for linear Transformers was published by Schlag, Irie and Schmidhuber on 22 Feb 2021. The June 2024 paper by Yang et al. is what made DeltaNet trainable in parallel at scale." },
  { title: "Learned absolute positions came before the Transformer.",
    text: "ConvS2S (8 May 2017) used learned position embeddings. The Transformer paper (12 Jun 2017) introduced sinusoids and reported that learned embeddings performed about the same." },
  { title: "Position interpolation was public before Meta's paper.",
    text: "kaiokendev's write-up is dated 20 Jun 2023, a week before Chen et al.'s arXiv paper (27 Jun 2023)." },
  { title: "NTK-aware scaling has no paper to date it by.",
    text: "It was a Reddit post by bloc97. The date used here, 29 Jun 2023, comes from an archive record of the post and fits llama.cpp PR #2054, which cites it on 30 Jun 2023. That is two days after Meta's interpolation paper and nine days after kaiokendev's write-up." },
  { title: "DeepSeek has three different sparse mechanisms.",
    text: "NSA (Feb 2025, a paper), DSA (Sep 2025, in V3.2-Exp) and CSA/HCA (Apr 2026, in V4). The assignment's \"compressed sparse attention\" is the V4 one." },
  { title: "The assignment's list is in teaching order, not launch order.",
    text: "Sparse and top-k attention (2019), sliding windows (2020) and linear attention (2020) all predate GQA (2023) and MLA (2024). Attention sinks (Sep 2023) come after NTK scaling (Jun 2023) and YaRN (Aug 2023). MQA (2019) came 3.5 years before GQA." }
];

const WORKLOADS = [
  { w: "2K–8K chatbot on one GPU", pick: "Standard attention with FlashAttention, RoPE, GQA.", why: "N² is small at this length. Exact attention is cheap and the best quality." },
  { w: "Short-text encoder (classification, embeddings)", pick: "Learned absolute or RoPE positions, full bidirectional attention.", why: "Inputs never exceed the trained length, so there is nothing to extrapolate." },
  { w: "32K–128K assistant (RAG, coding)", pick: "RoPE + YaRN extension, GQA or MLA, FlashAttention; optionally some sliding-window layers.", why: "The KV cache dominates serving cost, but exact retrieval still matters." },
  { w: "Endless streaming chat on fixed memory", pick: "Sliding window + attention sinks.", why: "Bounded memory and stable output, at the price of forgetting old content." },
  { w: "On-device small model", pick: "MQA or GQA with a small G, short context, sliding-window layers.", why: "Memory bandwidth is the limit; a little quality is worth trading." },
  { w: "1M-token agent", pick: "A hybrid (Gated DeltaNet 3:1 with gated attention) or compressed sparse attention on MLA.", why: "No full KV cache at 1M fits economically; most layers must have fixed or compressed memory." }
];

const GLOSSARY = [
  ["token", "A piece of text, roughly a word or part of a word. N is how many the model is looking at."],
  ["head", "One independent copy of the attention lookup. A layer runs many heads side by side, each on its own slice of the vector."],
  ["N² (quadratic)", "Work that grows with the square of the length. 1,000 tokens make 1,000,000 pairs; 2,000 tokens make 4,000,000. Double the length, four times the work."],
  ["KV cache", "While generating, the model saves every past token's key and value so it does not recompute them. It grows by one entry per token, per layer, and each user needs their own."],
  ["bf16, FP8", "How many bits store one number: bf16 uses 16 bits (2 bytes), FP8 uses 8 bits (1 byte). Fewer bits give a smaller cache and coarser numbers."],
  ["FLOPs", "A count of the arithmetic operations a computation needs. It measures compute, separately from memory."],
  ["perplexity", "How surprised a model is by real text. Lower is better."],
  ["fine-tuning", "A short extra round of training on a model that is already trained."],
  ["extrapolation", "Running a model on inputs longer than any it saw in training."],
  ["kernel", "The low-level GPU code that carries out an operation. A new attention pattern often needs a new kernel before it is fast in practice."],
  ["recall, retrieval", "Fetching one exact earlier fact, such as a name or a number, from far back in the context."]
];
