# Squeezing Every Drop of Speed Out of a Laptop CPU: Recompiling `ik_llama.cpp` for Gemma 4 E2B + MTP + Pi

After my previous findings, I almost called it quits on running models locally on my hardware: an **AMD Ryzen 5 5625U** with **16 GB dual-channel 3200 MHz RAM**, locked to **"Cool" mode** with max processor state capped at **99%** (~10–12W power limit, no turbo spikes).

Before giving up, I looked into ternary models. I tried running **Ternary Bonsai 2 9B**, and it gave me similar performance to my Qwen 3.5 4B & 2B setup—around **6–10 tokens/sec** (specifically ~6 tok/s on Bonsai). Token generation was still pretty slow. It wasn't horrible, but it wasn't great either.

Then I saw a YouTube video about **Gentoo Linux**—the distro where you compile almost all software directly on your own hardware for a small performance boost. It reminded me of Formula 1: in F1, even shaving a few hundredths of a second off a lap time can be the difference between winning and losing. So I decided to recompile the inference engine myself.

I ended up recompiling **`ikawrakow/ik_llama.cpp`** specifically for my Zen 3 CPU (`-O3 -march=znver3 -mtune=znver3`) because it supports **`-rtr` (run-time repacking)**. In simple terms, `-rtr` reorganizes the model's weights in RAM into a neat 8-row interleaved layout tailored for Zen 3's AVX2 vector instructions, so the CPU can read and multiply weights much faster instead of unpacking them awkwardly on the fly.

---

### Choosing the Right Model & Tuning Threads

After consulting with **Gemini Hydrogen**, I decided to go with **Gemma 4 E2B** (essentially ~4.6B total parameters / ~2.3B active compute). For my 16 GB dual-channel RAM setup, this hits the sweet spot for speed and accuracy. Even though its standalone coding isn't quite as strong as Qwen 3.5 4B with thinking on, it works great for my workflow because I use **Hydrogen in Antigravity as the cloud orchestrator** and run Gemma 4 locally with **thinking turned off**.

The performance genuinely surprised me—I did not expect it to run this well on a 10–12W laptop cap.

Because of the Cool-mode power limit, I ran `llama-bench` (`-ngl 0 -rtr 1 --no-mmap -fa 1 -p 512 -n 128`) across 3, 4, 5, and 6 threads to find the sweet spot:

| Threads | Prompt Processing (`pp512`) | Token Generation (`tg128`) |
| :---: | :---: | :---: |
| `-t 3` | 111.69 tok/s | **9.07 tok/s** |
| **`-t 4`** | **142.74 tok/s** | **9.00 tok/s** |
| **`-t 5`** | **166.83 tok/s** | 7.84 tok/s |
| `-t 6` | 143.93 tok/s | 6.70 tok/s |

Using all 6 threads starved per-core clocks under the 10–12W cap and dropped generation to `6.70 tok/s`. Splitting it to **`-t 4` for generation** and **`-tb 5` for prompt processing** gave me the best of both worlds. I'm sure if I switched to Performance or Balanced mode at 100% power it would get an even bigger boost, but I don't want to melt my laptop.

Initially, I ran **`google_gemma-4-E2B-it-IQ4_NL.gguf`** (`3.14 GiB`, from `bartowski`) because it uses slightly less RAM with similar accuracy, paired with the **`mtp-gemma-4-E2B-it-Q8_0.gguf`** (`~95 MiB`) MTP speculative drafter. Even though the drafter cancelled out the small RAM savings, it was still much lighter than running a bigger model with MTP—and it hit **17.31 tok/s** with a **94.1% draft acceptance rate** (16/17 accepted) on a smoke test.

---

### Switching to the Uncensored Model

Around a day later, I saw a video by Kai on YouTube about uncensored models and decided it made more sense to run the uncensored variant. I switched to:
* **Main Model:** `gemma-4-E2B-it-qat-q4_0-unquantized-heretic.i1-Q4_0.gguf` (`3.12 GiB`, from `mradermacher`, skipping `mmproj` to save RAM)
* **MTP Drafter:** `gemma-4-E2B-it-assistant-Q8_0.gguf` (`94.81 MiB`, from `cafkafk`)

The performance is fantastic:
* **MTP Draft Acceptance Rate:** **80.77%** (21 accepted / 26 generated on JSON test)
* **Token Generation:** **13.04 – 15.39 tok/s** (300 tokens of Python code in ~23s)
* **Prompt Processing:** **112.70 – 172.69 tok/s**
* **Memory Footprint:** ~3.77 GB total (`3181.5 MiB` model + `q8_0` KV cache at 16K context) + ~371 MB for the drafter, with all **271 main tensors** and **23 drafter tensors** repacked via `-rtr`.

---

### Launch Profiles & Offline Pi Harness

I set up two `.bat` launchers—one with thinking turned off for when Hydrogen is orchestrating, and another with thinking turned on for standalone debugging:

**Shared Engine & Low-RAM Flags:**
```bat
-m "E:\models\gemma-4-E2B-it-qat-q4_0-unquantized-heretic.i1-Q4_0.gguf" ^
-md "E:\models\gemma-4-E2B-it-assistant-Q8_0.gguf" ^
--spec-type mtp:n_max=2,p_min=0.0 ^
-rtr --no-mmap -ngl 0 -t 4 -tb 5 -c 16384 -np 1 ^
-ctk q8_0 -ctv q8_0 -fa on -b 512 -ub 256 --jinja --host 127.0.0.1 --port 8080
```
*(Using `-ctk q8_0 -ctv q8_0` halves KV cache memory, `-np 1` keeps context to a single slot so RAM stays low, and `--spec-type mtp:n_max=2,p_min=0.0` caps draft guesses at 2 so the CPU doesn't waste cycles verifying rejected tokens.)*

* **Thinking OFF (`start-gemma4-uncensored.bat` — Fast Coding / Cloud-Orchestrated):**
  `--reasoning off --temp 0.4 --top-p 0.95 --top-k 64 --repeat-penalty 1.1`
* **Thinking ON (`start-gemma4-uncensored-thinking.bat` — Complex Debugging):**
  `--reasoning on --temp 1.0 --top-p 0.95 --top-k 64 --repeat-penalty 1.0`

I also set up **Pi** (`@earendil-works/pi-coding-agent`) with **`itayinbarr/little-coder`** (for just-in-time tool injection and small-model guardrails), the **Pi Code GUI** extension in VS Code, and a custom Pi extension that sandboxes file and bash tools strictly to my `E:\` flash drive—so I still have a capable local coding assistant even when I'm offline or don't have access to cloud models.

Looking forward to seeing what this uncensored local setup can help me build and create.
