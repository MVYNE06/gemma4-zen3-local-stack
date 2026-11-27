@echo off
title ik_llama.cpp Gemma 4 E2B Uncensored + MTP (Thinking OFF - Fast Coding)
set "PATH=C:\Users\aaron\AppData\Local\Microsoft\WinGet\Packages\BrechtSanders.WinLibs.POSIX.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\mingw64\bin;%PATH%"
echo Starting Gemma 4 E2B Uncensored (i1-Q4_0) + MTP Drafter (Thinking OFF) on port 8080...
"E:\ik_llama.cpp\build\bin\llama-server.exe" ^
  -m "E:\models\gemma-4-E2B-it-qat-q4_0-unquantized-heretic.i1-Q4_0.gguf" ^
  -md "E:\models\gemma-4-E2B-it-assistant-Q8_0.gguf" ^
  --spec-type mtp:n_max=2,p_min=0.0 ^
  -rtr ^
  --no-mmap ^
  -ngl 0 ^
  -t 4 ^
  -tb 5 ^
  -c 16384 ^
  -np 1 ^
  -ctk q8_0 ^
  -ctv q8_0 ^
  -fa on ^
  -b 512 ^
  -ub 256 ^
  --jinja ^
  --reasoning off ^
  --temp 0.4 ^
  --top-p 0.95 ^
  --top-k 64 ^
  --repeat-penalty 1.1 ^
  --host 127.0.0.1 ^
  --port 8080
pause
