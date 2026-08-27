import React, { useEffect, useRef, useState } from "react";

const T = {
  page: "#240c4a",
  heroCard: "rgba(87,78,173,0.56)",
  card: "rgba(255,255,255,0.035)",
  cardStrong: "rgba(255,255,255,0.055)",
  border: "rgba(255,255,255,0.08)",
  text: "#fff",
  sub: "rgba(255,255,255,0.85)",
  muted: "rgba(255,255,255,0.55)",
  dim: "rgba(255,255,255,0.32)",
  violet: "#7255e5",
  green: "#22c55e",
  orange: "#fb923c",
  red: "#f87171",
  head: "'Poppins', ui-sans-serif, system-ui, sans-serif",
  body: "'Inter', 'Poppins', ui-sans-serif, system-ui, sans-serif",
};

const UI = {
  IDLE:"idle", DOWNLOADING:"downloading", PAUSED:"paused", INSTALLING:"installing",
  INSTALLED:"installed", INSTALLED_NO_EXE:"installed_no_exe", UPDATE_AVAILABLE:"update_available",
  UPDATING:"updating", RUNNING:"running", ERROR:"error", CANCELED:"canceled",
};

const LOCAL_GAME_SHOTS = {
  ultrakill: Array.from({length:6},(_,i)=>`./images/games/ultrakill/screenshots/ss_${i+1}.jpg`),
  ravenfield: Array.from({length:5},(_,i)=>`./images/games/ravenfield/screenshots/ss_${i+1}.jpg`),
  karlson: Array.from({length:6},(_,i)=>`./images/games/karlson/screenshots/ss_${i+1}.jpg`),
  kakudo: Array.from({length:6},(_,i)=>`./images/games/kakudo/screenshots/ss_${i+1}.jpg`),
};

function humanBytes(n) {
  if (!Number.isFinite(n) || n <= 0) return null;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = n;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function coverGradient(seed) {
  const pairs = [
    ["#5a315f", "#15243e"], ["#61305c", "#1a1640"], ["#1f4965", "#17203d"],
    ["#6b3e69", "#25214d"], ["#244858", "#142d35"], ["#553475", "#23123d"],
  ];
  const index = (seed || "").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % pairs.length;
  return `linear-gradient(145deg, ${pairs[index][0]}, ${pairs[index][1]})`;
}

function PlayIcon({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>;
}

function DownloadIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>;
}

function PauseIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>;
}

function ctaConfig(uiState, hasAccess, game, dl, busy) {
  if (game?.comingSoon) return { label: "COMING SOON", action: null, disabled: true };
  if (!hasAccess) return { label: "SUBSCRIBE TO PLAY", action: "subscribe", disabled: false };
  // A download-only game (Website-First, gameId absent from the catalog —
  // see buildShadowGame() in launcher-games.jsx) has no downloadUrl/sha256
  // to install from, and its backend installation_job has zero outgoing
  // transitions once failed (state-machine `failed: []`) — "RETRY INSTALL"
  // would silently do nothing useful. Catalog games are untouched.
  const isDownloadOnly = game?._source === "download-only";
  switch (uiState) {
    case UI.DOWNLOADING: return { label: `DOWNLOADING ${dl?.percent ?? 0}%`, action: "pause", icon: <PauseIcon/>, disabled: busy };
    case UI.PAUSED:
      // Resume is a real action only when the backend says the job can
      // actually resume (canResume:true) — otherwise the button would call
      // resumeDownload() against a download the Runtime already knows is a
      // dead end. Applies to catalog and download-only games alike.
      return dl?.canResume === true
        ? { label: "RESUME DOWNLOAD", action: "resume", icon: <PlayIcon/>, disabled: busy }
        : { label: "PAUSED", action: null, disabled: true };
    case UI.INSTALLING: return { label: "INSTALLING…", action: null, disabled: true };
    case UI.INSTALLED: return { label: "PLAY", action: "play", icon: <PlayIcon/>, disabled: busy };
    case UI.RUNNING: return { label: "PLAYING…", action: null, disabled: true };
    case UI.UPDATE_AVAILABLE: return { label: "UPDATE", action: "update", icon: <DownloadIcon/>, disabled: busy };
    case UI.UPDATING: return { label: `UPDATING ${dl?.percent ?? 0}%`, action: "pause", icon: <PauseIcon/>, disabled: busy };
    case UI.ERROR:
      return isDownloadOnly
        ? { label: "DOWNLOAD FAILED", action: null, disabled: true }
        : { label: "RETRY INSTALL", action: "install", icon: <DownloadIcon/>, disabled: busy };
    default: return { label: "INSTALL", action: "install", icon: <DownloadIcon/>, disabled: busy };
  }
}

function GameInfoCard({ game }) {
  const rows = [];
  if (game.studio) rows.push(["Developer", game.studio]);
  if (game.version) rows.push(["Version", game.version]);
  if (game.genres?.length) rows.push(["Genre", game.genres.map(capitalize).join(", ")]);
  if (!game.comingSoon) rows.push(["Download", humanBytes(game.downloadSize) || "—"]);
  const platforms = Array.isArray(game.platform) ? game.platform : [game.platform || "Windows"];
  rows.push(["Platform", platforms.filter(Boolean).join(", ")]);
  if (game.tags?.length) rows.push(["Tags", game.tags.slice(0, 5).join(", ")]);

  return (
    <aside style={{ width: "100%", height: 372, padding: 20, borderRadius: 16, background: T.heroCard, backdropFilter: "blur(18px)", boxSizing:"border-box" }}>
      <h2 style={{ margin: "0 0 20px", font: `700 28px/34px ${T.head}`, color: T.text }}>Game Info</h2>
      <div style={{ padding: "4px 20px", borderRadius: 16, background: "rgba(255,255,255,0.04)" }}>
        {rows.map(([label, value], index) => (
          <div key={label} style={{ display: "grid", gridTemplateColumns: "96px minmax(0,1fr)", gap: 16, alignItems: "center", minHeight: 45, borderBottom: index < rows.length - 1 ? `1px solid ${T.border}` : "none", fontFamily: T.body }}>
            <span style={{ fontSize: 14, color: T.muted }}>{label}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: T.text, textAlign: "right", overflowWrap: "anywhere" }}>{value}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

function ProgressBar({ dl, uiState }) {
  if (![UI.DOWNLOADING, UI.UPDATING, UI.PAUSED, UI.INSTALLING].includes(uiState)) return null;
  const percent = uiState === UI.INSTALLING ? 100 : (dl?.percent ?? 0);
  return <div style={{ width: 260, height: 3, marginTop: 10, borderRadius: 99, background: "rgba(255,255,255,.18)", overflow: "hidden" }}><div style={{ width: `${percent}%`, height: "100%", background: T.text, transition: "width .3s ease" }}/></div>;
}

function GameHero({ game, uiState, dl, subscriptionStatus, demoMode, busy, installedVersion, isFavorite, onToggleFavorite, onInstall, onPlay, onUpdate, onPause, onResume, onCancel, onRefreshAccess, onUninstall, onBack }) {
  const hasAccess = demoMode || Boolean(subscriptionStatus?.hasAccess);
  const cta = ctaConfig(uiState, hasAccess, game, dl, busy);
  const banner = game.banner || game.heroImage || game.coverImage || game.thumbnail || game.coverUrl;
  const [confirmUninstall, setConfirmUninstall] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  function invoke(action) {
    if (!action) return;
    if (action === "subscribe") return window.rload?.openExternal?.("https://rload.be/pricing?source=launcher");
    ({ install:onInstall, play:onPlay, update:onUpdate, pause:onPause, resume:onResume, cancel:onCancel }[action])?.();
  }

  function uninstall() {
    if (confirmUninstall) { clearTimeout(timer.current); setConfirmUninstall(false); onUninstall?.(); return; }
    setConfirmUninstall(true);
    timer.current = setTimeout(() => setConfirmUninstall(false), 3000);
  }

  const genres = (game.genres?.length ? game.genres : game.tags || []).slice(0, 3);
  const size = humanBytes(game.downloadSize);

  return (
    <section style={{ position: "relative", width: "100%", height: 640, display: "flex", alignItems: "flex-end", overflow: "hidden", background: coverGradient(game.gameId || game.title) }}>
      <button onClick={onBack} style={{position:"absolute",zIndex:3,left:24,top:24,height:40,padding:"0 16px",display:"flex",alignItems:"center",gap:8,borderRadius:999,border:"1px solid rgba(255,255,255,.25)",background:"rgba(15,8,29,.48)",backdropFilter:"blur(10px)",color:"#fff",font:`600 13px/1 ${T.body}`,cursor:"pointer"}}>← Back to Games</button>
      {banner && <img src={banner} alt="" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 28%" }} onError={(event) => { event.currentTarget.style.display = "none"; }}/>}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(20,10,34,.08) 20%, rgba(13,5,26,.55) 60%, rgba(13,5,26,.94) 100%)" }}/>
      <div style={{ position: "relative", zIndex: 1, width: "100%", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "clamp(28px, 3.4vw, 48px)", padding: "clamp(32px, 4.45vw, 64px)", boxSizing: "border-box" }}>
        <div style={{ flex: "1 1 680px", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 16 }}>
          {genres.length > 0 && <div style={{ display: "flex", gap: 8 }}>{genres.map((genre) => <span key={genre} style={{ padding: "7px 14px", borderRadius: 999, background: "rgba(255,255,255,.14)", font: `600 13px/16px ${T.body}`, color: T.text }}>{capitalize(genre)}</span>)}</div>}
          <h1 style={{ margin: 0, font: `800 clamp(52px,5vw,72px)/1.05 ${T.head}`, letterSpacing: "-2px", color: T.text, textTransform: "uppercase" }}>{game.title}</h1>
          {game.studio && <div style={{ display: "flex", gap: 6, font: `400 16px/20px ${T.body}` }}><span style={{ color: "rgba(255,255,255,.7)" }}>by</span><span style={{ color: T.text, fontWeight: 700 }}>{game.studio}</span></div>}
          {game.shortDescription && <p style={{ width: 500, maxWidth: "100%", margin: 0, font: `400 17px/1.5 ${T.body}`, color: T.sub }}>{game.shortDescription}</p>}
          <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
            <button disabled={cta.disabled} onClick={() => invoke(cta.action)} style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 45, padding: "0 25px", border: 0, borderRadius: 999, background: T.text, color: "#140f1f", font: `700 14px/1 ${T.body}`, cursor: cta.disabled ? "default" : "pointer", opacity: cta.disabled ? .65 : 1 }}>{cta.icon}{cta.label}</button>
            <button onClick={onToggleFavorite} aria-pressed={isFavorite} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: 0, border: 0, background: "none", color: T.text, font: `700 13px/1 ${T.body}`, cursor: "pointer" }}><span style={{ fontSize: 15 }}>{isFavorite ? "♥" : "☆"}</span>{isFavorite ? "IN FAVORITES" : "ADD TO FAVORITE"}</button>
            {[UI.DOWNLOADING, UI.UPDATING].includes(uiState) && <button onClick={onCancel} style={{ border: 0, background: "none", color: T.muted, cursor: "pointer", fontFamily: T.body }}>Cancel</button>}
            {[UI.INSTALLED, UI.INSTALLED_NO_EXE, UI.UPDATE_AVAILABLE, UI.ERROR].includes(uiState) && !game.comingSoon && <button onClick={uninstall} style={{ border: 0, background: "none", color: confirmUninstall ? T.red : T.muted, cursor: "pointer", fontFamily: T.body }}>{confirmUninstall ? "Confirm uninstall?" : "Uninstall"}</button>}
            {!hasAccess && onRefreshAccess && <button onClick={onRefreshAccess} style={{ border: 0, background: "none", color: T.muted, cursor: "pointer", fontFamily: T.body }}>Refresh access</button>}
          </div>
          <ProgressBar dl={dl} uiState={uiState}/>
          <div style={{ font: `400 13px/16px ${T.body}`, color: T.muted }}>{[size, "Windows Only", installedVersion ? `v${installedVersion} installed` : null].filter(Boolean).join("  ·  ")}</div>
        </div>
      </div>
      <div style={{ position: "absolute", left: "50%", bottom: 18, transform: "translateX(-50%)", color: "rgba(255,255,255,.7)", fontSize: 22 }}>⌄</div>
    </section>
  );
}

function SocialButton({ label, href }) {
  if (!href) return null;
  return <button onClick={() => window.rload?.openExternal?.(href)} title={label} style={{ width: 36, height: 36, borderRadius: 999, border: `1px solid ${T.border}`, background: "rgba(255,255,255,.04)", color: T.muted, cursor: "pointer", font: `600 11px/1 ${T.body}` }}>{label.slice(0, 1)}</button>;
}

function StudioArticle({ game, allGames }) {
  if (!game.studio) return null;
  const studioGames = (allGames || []).filter((item) => item.studio === game.studio);
  const team = Array.isArray(game.studioTeam) ? game.studioTeam : [];
  const facts = [
    game.studioFounded ? `Founded ${game.studioFounded}` : null,
    game.studioCountry || null,
    studioGames.length ? `${studioGames.length} game${studioGames.length > 1 ? "s" : ""} on Rload` : null,
  ].filter(Boolean);
  const links = game.studioLinks || {};
  return (
    <section style={{ padding: "64px", boxSizing: "border-box" }}>
      <div style={{ marginBottom: 24, font: `600 12px/16px ${T.head}`, letterSpacing: ".96px", color: "rgba(255,255,255,.5)" }}>ABOUT THE STUDIO</div>
      <article style={{ padding: "36px 40px", borderRadius: 24, border: `1px solid ${T.border}`, background: T.card }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ width: 64, height: 64, borderRadius: 999, display: "grid", placeItems: "center", overflow: "hidden", background: "linear-gradient(135deg,#7255e5,rgba(114,85,229,.55))", font: `800 26px/1 ${T.head}` }}>{game.studioLogo ? <img src={game.studioLogo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/> : game.studio.charAt(0).toUpperCase()}</div>
            <div><h2 style={{ margin: 0, font: `700 28px/34px ${T.head}`, color: T.text }}>{game.studio}</h2>{game.studioTagline && <div style={{ marginTop: 4, font: `400 14px/20px ${T.body}`, color: T.muted }}>{game.studioTagline}</div>}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}><SocialButton label="Website" href={links.website || game.website}/><SocialButton label="X" href={links.twitter}/><SocialButton label="Discord" href={links.discord}/><SocialButton label="Steam" href={links.steam}/></div>
        </div>
        {facts.length > 0 && <div style={{ display: "flex", gap: 18, marginTop: 22, font: `600 12px/16px ${T.body}`, color: T.sub }}>{facts.map((fact, index) => <React.Fragment key={fact}>{index > 0 && <span style={{ color: T.dim }}>·</span>}<span>{fact}</span></React.Fragment>)}</div>}
        {game.studioDescription && <p style={{ margin: "22px 0 0", font: `400 14px/1.7 ${T.body}`, color: T.sub }}>{game.studioDescription}</p>}
        {team.length > 0 && <div style={{ marginTop: 24 }}><div style={{ marginBottom: 12, font: `700 13px/18px ${T.body}` }}>The Team</div><div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12 }}>{team.slice(0, 4).map((member) => <div key={member.name} style={{ minHeight: 74, padding: 14, borderRadius: 12, background: T.cardStrong }}><div style={{ width: 30, height: 30, display: "grid", placeItems: "center", borderRadius: 999, background: "rgba(114,85,229,.45)", font: `600 10px/1 ${T.body}` }}>{member.initials || member.name?.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div><div style={{ marginTop: 8, font: `600 12px/16px ${T.body}` }}>{member.name}</div>{member.role && <div style={{ font: `400 10px/14px ${T.body}`, color: T.muted }}>{member.role}</div>}</div>)}</div></div>}
      </article>
    </section>
  );
}

function FigmaStudioCard({ game, allGames }) {
  const studioGames=(allGames||[]).filter(item=>item.studio===game.studio);
  if (!game.studio) return <div style={{minHeight:280,borderRadius:16,background:T.heroCard}}/>;
  return <section style={{height:372,padding:20,borderRadius:16,background:T.heroCard,boxSizing:"border-box"}}>
    <h2 style={{margin:"0 0 20px",font:`700 28px/34px ${T.head}`}}>About the Studio</h2>
    <div style={{height:"calc(100% - 54px)",minHeight:226,padding:20,borderRadius:16,background:"rgba(35,13,71,.5)",boxSizing:"border-box",display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:16}}>
        <div style={{display:"flex",alignItems:"center",gap:14,minWidth:0}}>
          <div style={{width:50,height:50,borderRadius:999,display:"grid",placeItems:"center",background:"linear-gradient(135deg,#7255e5,rgba(114,85,229,.55))",font:`800 20px/1 ${T.head}`,flexShrink:0}}>{game.studio.charAt(0).toUpperCase()}</div>
          <div style={{minWidth:0}}><div style={{font:`700 16px/20px ${T.head}`,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{game.studio}</div><div style={{font:`400 12px/17px ${T.body}`,color:T.muted}}>Independent studio on Rload.</div></div>
        </div>
        <button style={{padding:"9px 18px",border:0,borderRadius:999,background:T.violet,color:"#fff",font:`600 12px/1 ${T.body}`}}>+ Follow</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"10px 20px",font:`400 13px/18px ${T.body}`}}>
        <span style={{color:T.muted}}>Games on Rload</span><strong>{studioGames.length}</strong>
        {game.studioCountry&&<><span style={{color:T.muted}}>Location</span><strong>{game.studioCountry}</strong></>}
        {game.studioFounded&&<><span style={{color:T.muted}}>Founded</span><strong>{game.studioFounded}</strong></>}
      </div>
      {game.studioDescription&&<p style={{margin:0,font:`400 12px/18px ${T.body}`,color:T.sub}}>{game.studioDescription}</p>}
    </div>
  </section>;
}

function ScreenshotGallery({ game }) {
  const raw=[...(LOCAL_GAME_SHOTS[game.gameId]||[]),...(Array.isArray(game.screenshots)?game.screenshots:[]),game.banner,game.heroImage,game.thumbnail,game.coverUrl].filter(Boolean);
  const unique=[...new Set(raw.map(item=>typeof item==="string"?item:(item.url||item.src)).filter(Boolean))];
  const images=unique.length?Array.from({length:6},(_,index)=>unique[index%unique.length]):[];
  if (!images.length) return null;
  return <section style={{height:772,padding:"56px 24px 8px",boxSizing:"border-box"}}><h2 style={{margin:"0 0 24px",font:`700 32px/48px ${T.head}`}}>Captures d’écran</h2>
    <div style={{display:"grid",height:636,gridTemplateColumns:"repeat(6,minmax(0,1fr))",gridTemplateRows:"192px 192px 220px",gap:16}}>
      {images.map((src,index)=>{const areas=[{gridColumn:"1 / 4",gridRow:"1 / 3"},{gridColumn:"4 / 7",gridRow:"1"},{gridColumn:"4 / 7",gridRow:"2"},{gridColumn:"1 / 3",gridRow:"3"},{gridColumn:"3 / 5",gridRow:"3"},{gridColumn:"5 / 7",gridRow:"3"}];return <div key={`${src}-${index}`} style={{...areas[index],borderRadius:14,overflow:"hidden",background:T.card,position:"relative"}}><img src={src} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>e.currentTarget.parentElement.style.display="none"}/>{index===0&&<span style={{position:"absolute",left:14,bottom:14,padding:"6px 12px",borderRadius:999,background:"rgba(13,5,26,.82)",font:`700 11px/1 ${T.body}`}}>▶ TRAILER</span>}</div>})}
    </div>
  </section>;
}

function PlayerReviews({ game }) {
  const genre=capitalize(game.genres?.[0]||game.tags?.[0]||"game");
  const authored=[
    {author:"Max R.",stars:5,text:`${game.title} nails the ${genre.toLowerCase()} feel. The first hour was rough, then everything clicked and I couldn't put it down.`},
    {author:"Sofia L.",stars:5,text:`J’adore l’identité de ${game.title}. Les sensations sont précises et la direction artistique lui donne une vraie personnalité.`},
    {author:"Théo B.",stars:4,text:`Eerst was ik niet overtuigd, maar na een paar runs zat ik er helemaal in. Uitdagend, eerlijk en verrassend verslavend.`},
  ];
  const reviews=(Array.isArray(game.reviews)&&game.reviews.length?game.reviews:authored).slice(0,3);
  return <section style={{height:432,padding:"40px 64px 8px",boxSizing:"border-box"}}><h2 style={{margin:"0 0 20px",font:`700 32px/48px ${T.head}`}}>Avis des joueurs</h2>
    <div style={{font:`600 14px/17px ${T.body}`,color:"rgba(255,255,255,.7)",margin:"16px 0 12px"}}>Laisser un avis</div>
    <div style={{height:80,borderRadius:12,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.07)",display:"flex",alignItems:"flex-start",padding:"12px 16px",boxSizing:"border-box",color:T.dim,fontSize:14}}>Partage ton avis sur ce jeu…</div>
    <button style={{marginTop:12,padding:"12px 20px",border:0,borderRadius:999,background:T.violet,color:"#fff",font:`600 14px/17px ${T.body}`}}>Publier</button>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:20,marginTop:20}}>{reviews.map((review,index)=><article key={review.id||index} style={{height:118,padding:20,borderRadius:16,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.07)",boxSizing:"border-box",minWidth:0}}><div style={{display:"flex",alignItems:"center",gap:10}}><span style={{width:36,height:36,borderRadius:999,display:"grid",placeItems:"center",background:"linear-gradient(135deg,#7255e5,#261a40)",font:`700 14px/1 ${T.head}`}}>{(review.author||"P")[0]}</span><div><strong style={{fontSize:13}}>{review.author||"Player"}</strong><div style={{color:"#ffc700",fontSize:11,marginTop:2}}>{"★".repeat(review.stars||5)}{"☆".repeat(Math.max(0,5-(review.stars||5)))}</div></div></div><p style={{margin:"10px 0 0",font:`400 13px/16px ${T.body}`,color:"rgba(255,255,255,.7)",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{review.text||review.content}</p></article>)}</div>
  </section>;
}

function MoreGameCard({ game, onSelect, favorite, onFavorite }) {
  const cover = game.coverImage || game.thumbnail || game.coverUrl || game.banner;
  const genre = game.genres?.[0] || game.tags?.[0];
  return <button onClick={() => onSelect?.(game)} style={{ position: "relative", flex: "1 1 0", minWidth: 0, height: 353, padding: 0, overflow: "hidden", border: `1px solid ${T.border}`, borderRadius: 16, background: coverGradient(game.gameId || game.title), color: T.text, textAlign: "left", cursor: "pointer" }}>
    {cover && <img src={cover} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} onError={(event) => { event.currentTarget.style.display = "none"; }}/>}
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,transparent 42%,rgba(9,5,18,.9) 100%)" }}/>
    <span onClick={(event) => { event.stopPropagation(); onFavorite?.(game.gameId); }} style={{ position: "absolute", top: 14, right: 14, width: 30, height: 30, display: "grid", placeItems: "center", borderRadius: 999, background: "rgba(7,6,14,.48)", backdropFilter: "blur(8px)", fontSize: 16 }}>{favorite ? "♥" : "♡"}</span>
    <div style={{ position: "absolute", left: 16, right: 16, bottom: 16 }}><div style={{ font: `700 clamp(20px,2vw,30px)/32px ${T.head}`, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing:".3px" }}>{game.title}</div><div style={{ display: "flex", alignItems:"center", gap: 10, marginTop: 8 }}>{genre && <span style={{ padding: "5px 14px", borderRadius: 999, background: T.violet, font: `500 12px/16px ${T.body}` }}>{capitalize(genre)}</span>}<span style={{ font: `600 12px/20px ${T.body}`, color: "#ffffa6" }}>★ {game.rating || "4.5"}</span></div></div>
  </button>;
}

function MoreGames({ currentGameId, allGames, onSelectGame, onViewAll, favoriteIds, onToggleGameFavorite }) {
  const games = (allGames || []).filter((item) => item.gameId !== currentGameId).slice(0, 5);
  if (!games.length) return null;
  return <section style={{ height: 543, padding: "64px 24px", boxSizing: "border-box" }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}><h2 style={{ margin: 0, font: `700 32px/38px ${T.head}` }}>More Games</h2><button onClick={onViewAll} style={{ border: 0, background: "none", color: T.violet, cursor: "pointer", font: `600 14px/18px ${T.head}` }}>See all games →</button></div><div style={{ display: "flex", gap: 24 }}>{games.map((game) => <MoreGameCard key={game.gameId} game={game} onSelect={onSelectGame} favorite={favoriteIds?.has(game.gameId)} onFavorite={onToggleGameFavorite}/>)}</div></section>;
}

function GameFooter() {
  return <footer style={{ height: 80, padding: "0 48px", background: "#110523", borderTop: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", boxSizing: "border-box", fontFamily: T.body }}><div style={{ display: "flex", alignItems: "center", gap: 18 }}><strong style={{ font: `700 16px/20px ${T.head}`, letterSpacing: "1.6px" }}>RLOAD</strong><span style={{ fontSize: 11, color: T.muted }}>© 2026 Rload SRL · Belgium</span></div><div style={{ display: "flex", alignItems: "center", gap: 28, fontSize: 11, color: T.muted }}><span>Terms</span><span>Privacy</span><span>Support</span><span>v0.1.0</span></div></footer>;
}

export function GameSinglePage({ game, uiState, dl, installedVersion, subscriptionStatus, demoMode, busy, error, onInstall, onPlay, onUpdate, onPause, onResume, onCancel, onUninstall, allGames, onSelectGame, onRefreshAccess, onViewAllGames, isFavorite, onToggleFavorite, favoriteIds, onToggleGameFavorite }) {
  const effectiveUiState = uiState || UI.IDLE;
  const [uninstallToast, setUninstallToast] = useState(false);
  const previousGame = useRef(game?.gameId);
  const previousState = useRef(effectiveUiState);
  useEffect(() => {
    if (previousGame.current !== game?.gameId) { previousGame.current = game?.gameId; previousState.current = effectiveUiState; return; }
    const before = previousState.current;
    previousState.current = effectiveUiState;
    if ([UI.INSTALLED, UI.INSTALLED_NO_EXE, UI.UPDATE_AVAILABLE, UI.ERROR, UI.RUNNING].includes(before) && effectiveUiState === UI.IDLE) { setUninstallToast(true); const timer = setTimeout(() => setUninstallToast(false), 3500); return () => clearTimeout(timer); }
  }, [effectiveUiState, game?.gameId]);
  if (!game) return <div style={{ flex: 1, display: "grid", placeItems: "center", background: T.page, color: T.muted }}>Game not found.</div>;
  return <div style={{ flex: 1, overflowY: "auto", background: T.page, color: T.text, fontFamily: T.body }}>
    <GameHero game={game} uiState={effectiveUiState} dl={dl} installedVersion={installedVersion} subscriptionStatus={subscriptionStatus} demoMode={demoMode} busy={busy} isFavorite={isFavorite} onToggleFavorite={onToggleFavorite} onInstall={onInstall} onPlay={onPlay} onUpdate={onUpdate} onPause={onPause} onResume={onResume} onCancel={onCancel} onRefreshAccess={onRefreshAccess} onUninstall={onUninstall} onBack={onViewAllGames}/>
    {uninstallToast && <div style={{ margin: "16px 64px 0", padding: "12px 16px", borderRadius: 12, background: "rgba(34,197,94,.1)", border: "1px solid rgba(34,197,94,.28)", color: T.green }}>{game.title} has been uninstalled successfully.</div>}
    {error && <div style={{ margin: "16px 64px 0", padding: "12px 16px", borderRadius: 12, background: "rgba(248,113,113,.1)", border: "1px solid rgba(248,113,113,.28)", color: T.red }}>{error}</div>}
    {effectiveUiState === UI.INSTALLED_NO_EXE && <div style={{ margin: "16px 64px 0", padding: "12px 16px", borderRadius: 12, background: "rgba(251,146,60,.1)", border: "1px solid rgba(251,146,60,.28)", color: T.orange }}>Game is installed but the executable could not be found. Try reinstalling it.</div>}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24,padding:"38px 24px"}}><GameInfoCard game={game}/><FigmaStudioCard game={game} allGames={allGames}/></div>
    <ScreenshotGallery game={game}/>
    <div style={{height:38}}/>
    <PlayerReviews game={game}/>
    <div style={{height:38}}/>
    <MoreGames currentGameId={game.gameId} allGames={allGames} onSelectGame={onSelectGame} onViewAll={onViewAllGames} favoriteIds={favoriteIds} onToggleGameFavorite={onToggleGameFavorite}/>
    <div style={{height:38}}/>
    <GameFooter/>
  </div>;
}
