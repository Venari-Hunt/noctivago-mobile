#!/bin/bash
# usage: compare.sh file [startSeconds]
f="$1"; ss="${2:-0}"
echo "== $(basename "$f")"
ffprobe -v error -show_entries stream=sample_rate,channels:format=duration -of csv=p=0 "$f"
ffmpeg -nostats -ss $ss -t 290 -i "$f" -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I|LRA|Peak):" | tr -s ' ' | tr '\n' ' '; echo
for b in "lowpass=f=250" "highpass=f=250,lowpass=f=2500" "highpass=f=2500"; do
  printf "%-32s" "$b"; ffmpeg -nostats -ss $ss -t 290 -i "$f" -af "$b,astats=measure_overall=RMS_level:measure_perchannel=none" -f null - 2>&1 | grep -m1 "RMS level" | awk '{print $NF" dB"}'
done
printf "%-32s" "L/R balance (RMS L, R)"; ffmpeg -nostats -ss $ss -t 290 -i "$f" -af "astats=measure_perchannel=RMS_level:measure_overall=none" -f null - 2>&1 | grep "RMS level" | awk '{printf $NF" "}'; echo
printf "%-32s" "silences >0.5 s below -60 dB"; ffmpeg -nostats -ss $ss -t 290 -i "$f" -af silencedetect=n=-60dB:d=0.5 -f null - 2>&1 | grep -c silence_start
printf "%-32s" "clicks (HP 6k jumps)"; ffmpeg -nostats -ss $ss -t 290 -i "$f" -af "highpass=f=6000,highpass=f=6000,astats=measure_overall=Peak_level+RMS_level:measure_perchannel=none" -f null - 2>&1 | grep -E "Peak level|RMS level" | awk '{printf $NF" "}'; echo " (peak, rms dB)"
