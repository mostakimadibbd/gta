// Harborfall — character select (Phase 4). The 3D stage is the live world:
// App parks the player at the overlook with a slow turntable while this
// dark-glass picker is open. Story text always follows Rayan Kade; presets
// are who you play as in Port Sable.
import { CHARACTERS } from "../game/characters";

export default function CharacterSelect({ selectedId, variant, onSelect, onVariant, onDone, started }: {
  selectedId: string; variant: number;
  onSelect: (id: string) => void; onVariant: (v: number) => void;
  onDone: () => void; started: boolean;
}) {
  const idx = Math.max(0, CHARACTERS.findIndex((c) => c.id === selectedId));
  const preset = CHARACTERS[idx];
  const step = (d: number) => onSelect(CHARACTERS[(idx + d + CHARACTERS.length) % CHARACTERS.length].id);
  return (
    <div className="charselect" role="dialog" aria-label="Choose your character">
      <div className="charselect-top">
        <div className="charselect-kicker">HARBORFALL</div>
        <h2 className="charselect-title">Choose your character</h2>
        <p className="charselect-note">Story follows Rayan Kade — choose who you play as in Port Sable.</p>
      </div>
      <div className="charselect-stage">
        <button type="button" className="charselect-arrow" onClick={() => step(-1)} aria-label="Previous character">‹</button>
        <div className="charselect-who">
          <div className="charselect-name">{preset.name}</div>
          <div className="charselect-tag">{preset.tagline}</div>
          <div className="charselect-variants">
            <span>OUTFIT</span>
            {preset.variants.map((v, i) => (
              <button key={i} type="button" className={`charselect-swatch${i === variant ? " on" : ""}`} style={{ background: v }} onClick={() => onVariant(i)} aria-label={`Outfit colour ${i + 1}`} />
            ))}
          </div>
        </div>
        <button type="button" className="charselect-arrow" onClick={() => step(1)} aria-label="Next character">›</button>
      </div>
      <div className="charselect-cards">
        {CHARACTERS.map((c) => (
          <button key={c.id} type="button" className={`charselect-card${c.id === selectedId ? " on" : ""}`} onClick={() => onSelect(c.id)}>
            <span className="charselect-dot" style={{ background: c.variants[variant] ?? c.variants[0] }} />
            {c.name}
          </button>
        ))}
      </div>
      <button type="button" className="charselect-done" onClick={onDone}>{started ? "Done" : "Play as " + preset.name}</button>
    </div>
  );
}
