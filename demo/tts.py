"""Narration with the locally cached Chatterbox (ResembleAI) voice. Usage: python tts.py <pylibs_dir> [exaggeration] [cfg]"""
import sys, os, json, glob
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, sys.argv[1]); os.environ['HF_HUB_OFFLINE'] = '1'
exag = float(sys.argv[2]) if len(sys.argv) > 2 else 0.55
cfg = float(sys.argv[3]) if len(sys.argv) > 3 else 0.4
import torch, numpy as np, soundfile as sf
from chatterbox.tts import ChatterboxTTS
ck = glob.glob(os.path.expanduser('~/.cache/huggingface/hub/models--ResembleAI--chatterbox/snapshots/*'))[0]
model = ChatterboxTTS.from_local(ck, device='cuda')
lines = json.load(open(os.path.join(HERE, 'lines.json')))
os.makedirs(os.path.join(HERE, 'audio'), exist_ok=True)
durs = {}
for k, t in lines.items():
    torch.manual_seed(7)
    w = model.generate(t, exaggeration=exag, cfg_weight=cfg, temperature=0.8).squeeze(0).cpu().numpy()
    nz = np.where(np.abs(w) > 0.008)[0]; w = w[max(nz[0] - 800, 0): nz[-1] + 2400]
    sf.write(os.path.join(HERE, 'audio', f'{k}.wav'), w, model.sr)
    durs[k] = round(len(w) / model.sr, 2); print(k, durs[k], flush=True)
json.dump(durs, open(os.path.join(HERE, 'audio', 'durations.json'), 'w'), indent=1)
print('total', round(sum(durs.values()), 1))
