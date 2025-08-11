import React, { useRef, useState } from "react";
import { NativeAudio } from "@/lib/nativeAudio";

export default function NativeDemo() {
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(5);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onLoad = async () => {
    const f = fileRef.current?.files?.[0];
    if (!f) return;
    const b64 = await toBase64(f);
    await NativeAudio.loadAudio({ base64: b64.split(",")[1] });
    setLoaded(true);
  };

  return (
    <div className="p-4 space-y-3">
      <h2 className="text-xl font-semibold">Native Audio Looper Demo</h2>
      <input type="file" accept="audio/*" ref={fileRef} />
      <button className="px-3 py-2 rounded bg-black text-white" onClick={onLoad}>Load</button>

      <div className="flex gap-3 items-center">
        <label>A</label>
        <input type="number" step="0.01" value={start} onChange={(e)=>setStart(parseFloat(e.target.value)||0)} />
        <label>B</label>
        <input type="number" step="0.01" value={end} onChange={(e)=>setEnd(parseFloat(e.target.value)||0)} />
        <button className="px-3 py-2 rounded bg-slate-800 text-white" onClick={()=>NativeAudio.setLoopPoints(start,end)}>Set A/B</button>
      </div>

      <div className="flex gap-3 items-center">
        <label>Rate</label>
        <input type="range" min="0.5" max="2" step="0.01" value={rate} onChange={(e)=>{const r=parseFloat(e.target.value); setRate(r); NativeAudio.setRate(r);}} />
        <span>{rate.toFixed(2)}x</span>
      </div>

      <div className="flex gap-3 items-center">
        <label>Pitch (st)</label>
        <input type="range" min="-12" max="12" step="1" value={pitch} onChange={(e)=>{const p=parseFloat(e.target.value); setPitch(p); NativeAudio.setPitch(p);}} />
        <span>{pitch} st</span>
      </div>

      <div className="flex gap-3">
        <button disabled={!loaded} className="px-3 py-2 rounded bg-green-600 text-white disabled:opacity-50" onClick={()=>NativeAudio.play()}>Play</button>
        <button className="px-3 py-2 rounded bg-amber-600 text-white" onClick={()=>NativeAudio.pause()}>Pause</button>
        <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={()=>NativeAudio.seek(start)}>Seek to A</button>
      </div>
    </div>
  );
}

function toBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result as string);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}
