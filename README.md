# How Does Attention Work Now?

A visual, chronological guide to attention mechanisms, from additive attention (2014) to DeepSeek-V4's compressed sparse attention (2026).

The page first makes standard scaled dot-product attention concrete:

```
Q × Kᵀ → scores → scale → mask → softmax → weighted sum of V
```

It then walks forward in **launch order**. Each mechanism is shown as a response to a cost of what came before, and each entry answers four questions:

- What problem existed?
- What changed?
- What did it buy, and what did it give up?
- When would I actually choose it?

ERA V5, Session 8 assignment (The School of AI).

**Live page:** https://pritish52718.github.io/attention-timeline/

## What's on the page

| Section | What it teaches |
|---|---|
| Attention lab | Five tokens, d = 4. Step 0 shows where Q, K and V come from: a token vector x times three learned tables W_Q, W_K, W_V, with every multiplication written out. Then Q×Kᵀ → scale → mask → softmax → ×V with live arithmetic. Toggle the causal mask and follow one token's row. |
| The cost | A worked example first: at 262,144 tokens the score table is 68.7 billion scores per head, 4.40 TB for one layer if stored naively, and the KV cache is 524 KB per token, 137 GB per user, 1.10 TB for eight users. Then sliders for context length and users, then a one-paragraph conclusion. |
| A way out? | Why dropping softmax lets Q·Kᵀ·V be regrouped as Q·(Kᵀ·V), turning an N × N table into a fixed 128 × 128 one per head, and the catch. It ends with “let's start from the beginning”, which hands over to the timeline. |
| Timeline | 31 entries in chronological order, grouped into five eras. Each entry tells the story before → problem → fix → what it solved → problems it introduced → what that left for the next entry, links to what it responded to, and a figure where one teaches something. Cards carry a **From class** note where the lesson gave its own numbers (the 8K → 256K DroPE stretch, the DDDGDDDG schedule, the 6.44 GB cache yardstick, the Memory Stream). |
| Build-ups | The linear attention, delta rule and Gated DeltaNet cards each carry a numbered walk-through that assumes nothing: from attention without softmax, to the running state S, to what k·S computes (similarity × stored value), to writing only the gap, to the forget gate. One running example (a meeting moved from 2 pm to 5 pm) is used in all three and in the memory lab. |
| Glossary | Plain-language meanings for the terms the cards use (KV cache, head, FLOPs, bf16, kernel and so on). |
| Looking back | Every entry plotted by date and by the cost it attacks. It shows the field's priorities moving over time. |
| Figures | Attention-pattern grids (sparse, top-k, window, sinks, ALiBi, NSA, DSA, CSA), a head-sharing diagram (MHA/GQA/MQA/MLA), a KV-cache calculator, a RoPE rotation dial, a per-dimension chart comparing PI, NTK and YaRN, and a memory lab comparing linear, delta and gated-delta updates. |
| Choosing | Which mechanism fits which workload, from a 2K chatbot to a 1M-token agent. |
| Date checks | The places where the usual story, the class notes, or the assignment list disagreed with the primary source. |

Entries marked **added** were not on the class list: additive attention, relative positions (Shaw), Transformer-XL, FlashAttention, MiniMax-01's hybrid, gated attention, and the 3:1 Gated DeltaNet hybrids (Qwen3-Next, Kimi Linear).

## Run it

It is a static page with no build dependencies and no framework.

```bash
./build.sh              # assembles index.html from src/ (Git Bash on Windows)
python build_zip.py     # writes ../attention-timeline-site.zip for Netlify Drop
```

Then double-click `index.html`. The page makes no network requests: no web fonts, no CDN scripts, no `fetch()`. It works from a `file://` path, and the only external URLs in it are the source links you click.

**Deploy:** drop `attention-timeline-site.zip` onto [Netlify Drop](https://app.netlify.com/drop), or connect this repository to Netlify (`netlify.toml` publishes the repo root), or enable GitHub Pages on the repo root. The deployable file is `index.html`.

```
src/page.html   markup + CSS (design tokens, light/dark themes)
src/data.js     the timeline: every entry, era, correction and source
src/app.js      the lab, the figures and the rendering
index.html      built page (full HTML document)
netlify.toml    publish settings
build_zip.py    deploy zip, forward-slash paths, refuses to build if an external request slipped in
```

To add a mechanism, add one object to `ENTRIES` in `src/data.js`. Give it a date, a source, the problem, the change, buys, costs, when to choose it, and what it left open. Then rebuild.

## Sources for the chronology

Each date is the **first public release**. For papers that is the arXiv v1 submission date, read from the arXiv abstract page. For things that are not papers it is the post or announcement date. All of these were checked on 12 Oct 2026.

How they were checked: for all 29 arXiv papers, the abstract page was fetched and the `[v1]` line of its submission history was compared with the date in `src/data.js`; all 29 matched. The Reddit date comes from the PullPush archive record of the post. The kaiokendev date is the page's own changelog line, "Added 'Extending Context' (6/20/23)". The DeepSeek-V4 date and figures were read from the Hugging Face post.

| Date | Mechanism | Source |
|---|---|---|
| 2014-09-01 | Additive attention (Bahdanau, Cho, Bengio) | [arXiv 1409.0473](https://arxiv.org/abs/1409.0473) |
| 2017-05-08 | Learned absolute positions (ConvS2S, Gehring et al.) | [arXiv 1705.03122](https://arxiv.org/abs/1705.03122) |
| 2017-06-12 | Scaled dot-product attention + sinusoidal positions (Vaswani et al.) | [arXiv 1706.03762](https://arxiv.org/abs/1706.03762) |
| 2018-03-06 | Relative position representations (Shaw et al.) | [arXiv 1803.02155](https://arxiv.org/abs/1803.02155) |
| 2018-10-11 | BERT (learned positions in wide use) | [arXiv 1810.04805](https://arxiv.org/abs/1810.04805) |
| 2019-01-09 | Transformer-XL (Dai et al.) | [arXiv 1901.02860](https://arxiv.org/abs/1901.02860) |
| 2019-04-23 | Sparse Transformer (Child et al.) | [arXiv 1904.10509](https://arxiv.org/abs/1904.10509) |
| 2019-11-06 | Multi-query attention (Shazeer) | [arXiv 1911.02150](https://arxiv.org/abs/1911.02150) |
| 2019-12-25 | Top-k attention, Explicit Sparse Transformer (Zhao et al.) | [arXiv 1912.11637](https://arxiv.org/abs/1912.11637) |
| 2020-04-10 | Longformer, sliding window + global (Beltagy et al.) | [arXiv 2004.05150](https://arxiv.org/abs/2004.05150) |
| 2020-06-29 | Linear attention (Katharopoulos et al.) | [arXiv 2006.16236](https://arxiv.org/abs/2006.16236) |
| 2021-02-22 | Delta rule for linear Transformers (Schlag, Irie, Schmidhuber) | [arXiv 2102.11174](https://arxiv.org/abs/2102.11174) |
| 2021-04-20 | RoPE / RoFormer (Su et al.) | [arXiv 2104.09864](https://arxiv.org/abs/2104.09864) |
| 2021-06-13 | Memory-efficient top-k attention (Gupta et al.) | [arXiv 2106.06899](https://arxiv.org/abs/2106.06899) |
| 2021-08-27 | ALiBi (Press, Smith, Lewis) | [arXiv 2108.12409](https://arxiv.org/abs/2108.12409) |
| 2022-05-27 | FlashAttention (Dao et al.) | [arXiv 2205.14135](https://arxiv.org/abs/2205.14135) |
| 2023-05-22 | Grouped-query attention (Ainslie et al.) | [arXiv 2305.13245](https://arxiv.org/abs/2305.13245) |
| 2023-06-20 | Position interpolation, kaiokendev's write-up | [kaiokendev.github.io/til](https://kaiokendev.github.io/til) (entry "Extending Context to 8K", 6/20/23) |
| 2023-06-27 | Position interpolation (Chen et al., Meta) | [arXiv 2306.15595](https://arxiv.org/abs/2306.15595) |
| 2023-06-29 | NTK-aware RoPE scaling (bloc97, Reddit) | [Reddit post](https://www.reddit.com/r/LocalLLaMA/comments/14lz7j5/ntkaware_scaled_rope_allows_llama_models_to_have/), dated from its [archive record](https://api.pullpush.io/reddit/search/submission/?ids=14lz7j5) (created 29 Jun 2023, 08:21 UTC); cited by [llama.cpp PR #2054](https://github.com/ggerganov/llama.cpp/pull/2054), opened 30 Jun 2023 |
| 2023-08-31 | YaRN (Peng et al.) | [arXiv 2309.00071](https://arxiv.org/abs/2309.00071) |
| 2023-09-29 | Attention sinks / StreamingLLM (Xiao et al.) | [arXiv 2309.17453](https://arxiv.org/abs/2309.17453) |
| 2023-10-10 | Mistral 7B sliding-window attention (Jiang et al.) | [arXiv 2310.06825](https://arxiv.org/abs/2310.06825) |
| 2024-05-07 | Multi-head latent attention, DeepSeek-V2 | [arXiv 2405.04434](https://arxiv.org/abs/2405.04434) |
| 2024-06-10 | Parallel DeltaNet training (Yang et al.) | [arXiv 2406.06484](https://arxiv.org/abs/2406.06484) |
| 2024-12-09 | Gated DeltaNet (Yang, Kautz, Hatamizadeh) | [arXiv 2412.06464](https://arxiv.org/abs/2412.06464) |
| 2025-01-14 | MiniMax-01, 7:1 lightning/softmax hybrid | [arXiv 2501.08313](https://arxiv.org/abs/2501.08313) |
| 2025-02-16 | Native Sparse Attention (Yuan et al., DeepSeek) | [arXiv 2502.11089](https://arxiv.org/abs/2502.11089) |
| 2025-05-10 | Gated attention (Qiu et al., Qwen) | [arXiv 2505.06708](https://arxiv.org/abs/2505.06708) |
| 2025-09-12 | Qwen3-Next, Gated DeltaNet + gated attention hybrid | [Simon Willison, 12 Sep 2025](https://simonwillison.net/2025/Sep/12/qwen3-next/); layer counts from [Raschka's hybrid-attention gallery](https://sebastianraschka.com/llm-architecture-gallery/hybrid-attention/) |
| 2025-09-29 | DeepSeek Sparse Attention, V3.2-Exp | [vLLM launch-day post](https://vllm.ai/blog/2025-09-29-deepseek-v3-2); [TechCrunch](https://techcrunch.com/2025/09/29/deepseek-releases-sparse-attention-model-that-cuts-api-costs-in-half/) |
| 2025-10-30 | Kimi Linear (Moonshot AI) | [arXiv 2510.26692](https://arxiv.org/abs/2510.26692) |
| 2025-12-13 | DroPE (Gelberg et al., Sakana AI) | [arXiv 2512.12167](https://arxiv.org/abs/2512.12167) |
| 2026-04-24 | DeepSeek-V4: CSA + HCA | [Hugging Face DeepSeek-V4 post](https://huggingface.co/blog/deepseekv4) |

### Dates that needed correcting

1. **The delta rule is from 2021, not 2024.** Schlag, Irie and Schmidhuber published the delta-rule update for linear Transformers on 22 Feb 2021. Yang et al. (Jun 2024) made DeltaNet trainable in parallel. In class the idea was introduced as "the delta net ... that paper came out in 2024", which is the right date for the DeltaNet paper but not for the rule.
2. **Learned absolute positions predate the Transformer.** ConvS2S used them on 8 May 2017. The Transformer paper (12 Jun 2017) reports that learned and sinusoidal performed about the same.
3. **Position interpolation was public a week before Meta's paper.** kaiokendev's write-up is dated 20 Jun 2023; Chen et al.'s arXiv paper is dated 27 Jun 2023.
4. **NTK-aware scaling has no paper to date it by.** It was a Reddit post, and Reddit blocks automated fetching. The date used, 29 Jun 2023, is from an archive record of the post, and it fits llama.cpp PR #2054, which cites the post on 30 Jun 2023.
5. **"DeepSeek's compressed sparse attention" is the V4 mechanism (Apr 2026).** It is distinct from NSA (Feb 2025) and DSA (Sep 2025).
6. **The assignment's list is in teaching order.** Sparse and top-k attention (2019), sliding windows (2020) and linear attention (2020) all predate GQA (2023) and MLA (2024). Attention sinks (Sep 2023) come after NTK scaling (Jun 2023) and YaRN (Aug 2023). MQA (Nov 2019) came 3.5 years before GQA.

### Not fully verified

- The NTK-aware date rests on a third-party archive of Reddit, not on Reddit itself.
- The **From class** notes quote the lesson page and the session transcript. The course's V4 results (8K → 256K with DroPE, the DDDGDDDG schedule, the Memory Stream) are the course's own reports and are not published, so they have no timeline entry of their own.
- Qwen3-Next's date is the day it was reported (12 Sep 2025), taken from a dated third-party post rather than Alibaba's own announcement page.
- Numbers quoted from papers, such as "93.3% smaller KV cache", "10× fewer tokens" and "27% of V3.2's FLOPs", are the authors' own claims. They have not been reproduced.
