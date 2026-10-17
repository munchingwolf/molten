// Placeholder home (task 2.3 replaces it with search, chips and live 3D preview tiles).
export default function Home() {
  return (
    <main className="mx-auto max-w-[1320px] px-4 py-14 sm:px-10">
      <p className="font-display text-[22px] font-extrabold tracking-[-0.02em]">Spatial</p>
      <h1 className="mt-14 max-w-[14ch] font-display text-[clamp(2.6rem,5.6vw,4.75rem)] font-extrabold leading-[0.98] tracking-[-0.035em]">
        Spatial UI you can see before you install it.
      </h1>
      <p className="mt-5 max-w-[52ch] text-lg text-ink-2">
        Browse XR components live, then drop them into your WebXR app. Same state, new look.
      </p>
      <button className="mt-9 border-2 border-ink bg-key px-5 py-3.5 font-semibold">Enter VR</button>
      <pre className="mt-4 max-w-md overflow-x-auto bg-letterbox px-3.5 py-3 font-mono text-sm text-tape">
        <span className="text-key">$</span> npx spatial add glass-settings
      </pre>
    </main>
  );
}
