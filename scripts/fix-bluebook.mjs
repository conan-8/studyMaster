#!/usr/bin/env node
// fix-bluebook.mjs — applies UI/accessibility fixes to the bundled template
// inside "Bluebook Exam.html" (a self-unpacking bundle whose real UI is a
// JSON string inside <script type="__bundler/template">).
//
// Phases: A markup edits, B class-code edits, C role/tabindex regex,
// D re-encode + write, then a verification pass.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'Bluebook Exam.html');
const BAK = FILE + '.bak';
const OPEN = '<script type="__bundler/template">';

// ── 1. read + backup ────────────────────────────────────────────────────────
const html = fs.readFileSync(FILE, 'utf8');
fs.copyFileSync(FILE, BAK);
console.log('backup written:', BAK);

// ── 2. locate template region ───────────────────────────────────────────────
const openIdx = html.indexOf(OPEN);
if (openIdx === -1) throw new Error('template open tag not found');
const openEnd = openIdx + OPEN.length;
// safe: inside the JSON every </ is escaped as <\/ or <\u002F
const closeIdx = html.indexOf('</script>', openEnd);
if (closeIdx === -1) throw new Error('template close tag not found');
const region = html.slice(openEnd, closeIdx);

// ── 3. decode ───────────────────────────────────────────────────────────────
let template = JSON.parse(region);

// ── 4. edit helpers ─────────────────────────────────────────────────────────
let edits = 0;
function rep(find, replace, count = 1) {
  const found = template.split(find).length - 1;
  if (found !== count) {
    throw new Error(`rep: expected ${count} occurrence(s), found ${found} — ${JSON.stringify(find.slice(0, 90))}`);
  }
  template = template.split(find).join(replace); // split/join keeps $ literal
  edits += count;
}
function repLine(prefix) { // remove one full line (incl. newline) by unique prefix
  const start = template.indexOf(prefix);
  if (start === -1) throw new Error(`repLine: not found — ${prefix}`);
  if (template.indexOf(prefix, start + 1) !== -1) throw new Error(`repLine: not unique — ${prefix}`);
  let end = template.indexOf('\n', start);
  end = end === -1 ? template.length : end + 1;
  template = template.slice(0, start) + template.slice(end);
  edits += 1;
}

// ══ PHASE A — markup edits ═══════════════════════════════════════════════════

// A1a — remove body zoom (A1b CSS insertion runs after Phase C, see note there)
rep('\n  body{zoom:0.85;}', '');

// A2 — battery fills bound to state
rep('<rect x="3" y="3" width="20" height="9" rx="1" fill="#0b1020"></rect>',
    '<rect x="3" y="3" width="{{ battFill }}" height="9" rx="1" fill="#0b1020"></rect>', 2);
rep('<rect x="3" y="3" width="16" height="7" rx="1" fill="#fff"></rect>',
    '<rect x="3" y="3" width="{{ battFillSm }}" height="7" rx="1" fill="#fff"></rect>');

// A3 — figure expand toggle
rep('<span style="cursor:pointer;font-size:15px;">⤢</span>',
    '<span sc-camel-on-click="{{ toggleFigExpand }}" aria-label="Toggle figure zoom" style="cursor:pointer;font-size:15px;">⤢</span>');

// A4 — reference wide toggle
rep('<span style="cursor:pointer;font-size:18px;">⤢</span>',
    '<span sc-camel-on-click="{{ toggleRefWide }}" aria-label="Expand reference panel" style="cursor:pointer;font-size:18px;">⤢</span>');
rep('width:640px;max-width:46%;border-left:1px solid #d3dae8;',
    'width:{{ refWidth }};max-width:{{ refMaxWidth }};border-left:1px solid #d3dae8;');

// A5 — FRQ textarea: id + on-input (live updates)
rep('<textarea value="{{ frqAns }}" sc-camel-on-change="{{ onFrqInput }}"',
    '<textarea id="frq-textarea" value="{{ frqAns }}" sc-camel-on-input="{{ onFrqInput }}"');

// A6 — FRQ toolbar glyphs become real buttons
rep('<span style="width:30px;height:26px;display:flex;align-items:center;justify-content:center;font-weight:800;border-radius:4px;">B</span>',
    '<span sc-camel-on-click="{{ frqBold }}" aria-label="Bold" style="cursor:pointer;width:30px;height:26px;display:flex;align-items:center;justify-content:center;font-weight:800;border-radius:4px;">B</span>');
rep('<span style="width:30px;height:26px;display:flex;align-items:center;justify-content:center;font-style:italic;font-weight:700;border-radius:4px;">I</span>',
    '<span sc-camel-on-click="{{ frqItalic }}" aria-label="Italic" style="cursor:pointer;width:30px;height:26px;display:flex;align-items:center;justify-content:center;font-style:italic;font-weight:700;border-radius:4px;">I</span>');
rep('<span style="width:30px;height:26px;display:flex;align-items:center;justify-content:center;text-decoration:underline;font-weight:700;border-radius:4px;">U</span>',
    '<span sc-camel-on-click="{{ frqUnderline }}" aria-label="Underline" style="cursor:pointer;width:30px;height:26px;display:flex;align-items:center;justify-content:center;text-decoration:underline;font-weight:700;border-radius:4px;">U</span>');
rep('<span style="width:30px;height:26px;display:flex;align-items:center;justify-content:center;border-radius:4px;">•≡</span>',
    '<span sc-camel-on-click="{{ frqBullet }}" aria-label="Bullet list" style="cursor:pointer;width:30px;height:26px;display:flex;align-items:center;justify-content:center;border-radius:4px;">•≡</span>');
rep('<span style="width:30px;height:26px;display:flex;align-items:center;justify-content:center;border-radius:4px;">x²</span>',
    '<span sc-camel-on-click="{{ frqSuperscript }}" aria-label="Superscript" style="cursor:pointer;width:30px;height:26px;display:flex;align-items:center;justify-content:center;border-radius:4px;">x²</span>');

// A7 — stimulus panel: highlight-on-mouseup (exam panel only; FRQ uses 30px 40px)
rep('<div style="flex:0 0 auto;width:{{ leftBasis }};overflow:auto;padding:34px 40px;font-family:\'Source Serif 4\',Georgia,serif;" class="bb-scroll">',
    '<div sc-camel-on-mouse-up="{{ onStimMouseUp }}" style="flex:0 0 auto;width:{{ leftBasis }};overflow:auto;padding:34px 40px;font-family:\'Source Serif 4\',Georgia,serif;" class="bb-scroll">');

// A8 — aria-labels right after handler attributes
const ariaSimple = [
  ['{{ startExam }}', 'Start AP Physics 1 practice test', 1],
  ['{{ zoomIn }}', 'Zoom in', 1],
  ['{{ zoomOut }}', 'Zoom out', 1],
  ['{{ resetZoom }}', 'Reset zoom', 1],
  ['{{ toggleMark }}', 'Mark for review', 1],
  ['{{ toggleElimMode }}', 'Toggle eliminate mode', 1],
  ['{{ choice.onSelect }}', 'Answer choice {{ choice.letter }}', 1],
  ['{{ choice.onElim }}', 'Eliminate choice {{ choice.letter }}', 1],
  ['{{ choice.onUndo }}', 'Undo elimination', 1],
  ['{{ cell.onClick }}', 'Go to question {{ cell.n }}', 2],
  ['{{ back }}', 'Previous question', 1],
  ['{{ next }}', 'Next question', 1],
  ['{{ reviewBack }}', 'Back to last question', 1],
  ['{{ reviewNext }}', 'Continue', 1],
  ['{{ frqBack }}', 'Previous question', 1],
  ['{{ frqNext }}', 'Next question', 1],
  ['{{ returnHome }}', 'Return to home', 1],
  ['{{ resumeBreak }}', 'Resume testing', 1],
  ['{{ toggleTimer }}', 'Hide or show timer', 2],
];
for (const [handler, label, count] of ariaSimple) {
  rep(`sc-camel-on-click="${handler}"`, `sc-camel-on-click="${handler}" aria-label="${label}"`, count);
}
// ambiguous ×-closers, anchored on full original tags
rep('<span sc-camel-on-click="{{ toggleRef }}" style="cursor:pointer;font-size:26px;line-height:1;">×</span>',
    '<span sc-camel-on-click="{{ toggleRef }}" aria-label="Close reference" style="cursor:pointer;font-size:26px;line-height:1;">×</span>');
rep('<span sc-camel-on-click="{{ toggleNav }}" style="position:absolute;right:0;top:0;cursor:pointer;font-size:24px;color:#374151;">×</span>',
    '<span sc-camel-on-click="{{ toggleNav }}" aria-label="Close question navigator" style="position:absolute;right:0;top:0;cursor:pointer;font-size:24px;color:#374151;">×</span>');
rep('<div sc-camel-on-click="{{ toggleCalc }}" style="cursor:pointer;font-size:24px;color:#374151;line-height:1;">×</div>',
    '<div sc-camel-on-click="{{ toggleCalc }}" aria-label="Close calculator" style="cursor:pointer;font-size:24px;color:#374151;line-height:1;">×</div>');

// A9 — keep HIGHLIGHTS TOAST, add LINE READER + HELP/SHORTCUTS/AT modals after it
const TOAST = `    <!-- HIGHLIGHTS TOAST -->
    <sc-if value="{{ highlightsOpen }}">
      <div style="position:absolute;top:100px;right:200px;z-index:60;background:#1f2430;color:#fff;padding:14px 20px;border-radius:10px;font-family:'Helvetica Neue',sans-serif;font-size:15px;max-width:300px;">
        Select text in a passage to highlight it and add a note. <span sc-camel-on-click="{{ toggleHighlights }}" style="cursor:pointer;text-decoration:underline;">Dismiss</span>
      </div>
    </sc-if>`;

const LINE_READER = `    <!-- LINE READER -->
    <sc-if value="{{ lineReaderOn }}">
      <div sc-camel-on-mouse-down="{{ startLineReaderDrag }}" aria-label="Line reader — drag to move" style="position:absolute;left:0;right:0;top:{{ lineReaderY }}px;height:48px;z-index:70;cursor:ns-resize;">
        <div style="background:rgba(255,219,0,.16);border-top:2px solid rgba(255,219,0,.55);border-bottom:2px solid rgba(255,219,0,.55);height:100%;display:flex;align-items:center;justify-content:center;">
          <div style="width:44px;height:6px;border-radius:3px;background:rgba(255,219,0,.8);"></div>
        </div>
      </div>
    </sc-if>`;

const MODAL_STYLE = `position:absolute;inset:0;z-index:80;background:rgba(15,31,102,.45);display:flex;align-items:center;justify-content:center;`;
const DIALOG_STYLE = `width:600px;max-width:92%;max-height:82%;overflow:auto;background:#fff;border-radius:14px;box-shadow:0 24px 60px rgba(15,31,102,.3);padding:34px 40px;font-family:'Helvetica Neue',sans-serif;color:#111;`;
// NOTE: explicit role/tabIndex go BEFORE the handler so the Phase C regex skips
// these elements (same rule the plan states for the backdrop/dialog roles).
const closePill = (handler) => `<span role="button" sc-camel-tab-index="0" sc-camel-on-click="{{ ${handler} }}" aria-label="Close" style="cursor:pointer;background:#ffdb00;color:#0b1020;font-weight:700;padding:11px 34px;border-radius:999px;display:inline-block;">Close</span>`;
const scRow = (keys, desc) => `            <div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #eef1f8;font-size:16px;"><span>${keys}</span><span>${desc}</span></div>`;

const HELP_MODAL = `    <!-- HELP MODAL -->
    <sc-if value="{{ helpOpen }}">
      <div role="presentation" sc-camel-on-click="{{ closeHelp }}" style="${MODAL_STYLE}">
        <div role="dialog" sc-camel-on-click="{{ stopProp }}" style="${DIALOG_STYLE}">
          <div style="font-size:26px;font-weight:800;margin-bottom:16px;">Help</div>
          <ul style="margin:0 0 26px;padding-left:22px;display:flex;flex-direction:column;gap:12px;font-size:16px;line-height:1.5;">
            <li><b>Calculator</b> — open a graphing or scientific calculator from the Calculator button in the header.</li>
            <li><b>Reference</b> — open the equations reference panel from the Reference button in the header.</li>
            <li><b>Highlights &amp; Notes</b> — select passage text to highlight it; click a highlight to remove it.</li>
            <li><b>Mark for Review</b> — flag a question so you can return to it later.</li>
            <li><b>Question navigator</b> — jump to any question from the Question button in the footer.</li>
          </ul>
          ${closePill('closeHelp')}
        </div>
      </div>
    </sc-if>`;

const SHORTCUTS_MODAL = `    <!-- SHORTCUTS MODAL -->
    <sc-if value="{{ shortcutsOpen }}">
      <div role="presentation" sc-camel-on-click="{{ closeShortcuts }}" style="${MODAL_STYLE}">
        <div role="dialog" sc-camel-on-click="{{ stopProp }}" style="${DIALOG_STYLE}">
          <div style="font-size:26px;font-weight:800;margin-bottom:16px;">Keyboard Shortcuts</div>
          <div style="display:flex;flex-direction:column;margin-bottom:26px;">
${scRow('→ / ←', 'Next / previous question')}
${scRow('A–D or 1–4', 'Select answer')}
${scRow('M', 'Mark for review')}
${scRow('T', 'Hide/show timer')}
${scRow('C', 'Calculator')}
${scRow('R', 'Reference')}
${scRow('N', 'Question navigator')}
${scRow('H', 'Highlights &amp; Notes')}
${scRow('Esc', 'Close popups/menus')}
${scRow('Enter / Space', 'Activate focused button')}
          </div>
          ${closePill('closeShortcuts')}
        </div>
      </div>
    </sc-if>`;

const AT_MODAL = `    <!-- ASSISTIVE TECHNOLOGY MODAL -->
    <sc-if value="{{ atOpen }}">
      <div role="presentation" sc-camel-on-click="{{ closeAt }}" style="${MODAL_STYLE}">
        <div role="dialog" sc-camel-on-click="{{ stopProp }}" style="${DIALOG_STYLE}">
          <div style="font-size:26px;font-weight:800;margin-bottom:16px;">Assistive Technology</div>
          <ul style="margin:0 0 26px;padding-left:22px;display:flex;flex-direction:column;gap:12px;font-size:16px;line-height:1.5;">
            <li>Full keyboard navigation — move between controls with Tab and activate them with Enter or Space.</li>
            <li>Keyboard shortcuts — see Shortcuts in the More menu for the full list.</li>
            <li>Line Reader — a draggable translucent band that helps you track your place while reading.</li>
            <li>Figure zoom and reference expand — enlarge figures and widen the reference panel.</li>
            <li>Hideable timer — hide or show the timer at any time.</li>
            <li>Text highlighting — select passage text to highlight it; click a highlight to remove it.</li>
          </ul>
          ${closePill('closeAt')}
        </div>
      </div>
    </sc-if>`;

rep(TOAST, TOAST + '\n\n' + LINE_READER + '\n\n' + HELP_MODAL + '\n\n' + SHORTCUTS_MODAL + '\n\n' + AT_MODAL);

console.log('Phase A markup edits applied:', edits);

// ══ PHASE B — class-code edits ═══════════════════════════════════════════════

// B1 — new state fields
rep(`    frqIndex:0, frqAnswers:{}, calcLarge:false, calcWidth:640,\n  };`,
    `    frqIndex:0, frqAnswers:{}, calcLarge:false, calcWidth:640,\n    battPct:100, refWide:false, helpOpen:false, shortcutsOpen:false, atOpen:false, lineReaderOn:false, lineReaderY:300,\n  };`);

// B2 — componentDidMount: battery API + global keydown; line-reader drag in _onMove/_onUp
rep(`    this._checkKatex();\n`,
    `    this._checkKatex();\n    if(navigator.getBattery){ navigator.getBattery().then((b)=>{ const upd=()=>this.setState({battPct:Math.round(b.level*100)}); upd(); b.addEventListener('levelchange',upd); b.addEventListener('chargingchange',upd); this._batt=b; this._battUpd=upd; }).catch(()=>{}); }\n    this._onKey=(e)=>this._handleKey(e); document.addEventListener('keydown',this._onKey);\n`);
rep(`      if(this._calcResizing){ e.preventDefault(); const w=Math.min(window.innerWidth-40,Math.max(420,e.clientX)); this.setState({calcWidth:w}); }\n    };`,
    `      if(this._calcResizing){ e.preventDefault(); const w=Math.min(window.innerWidth-40,Math.max(420,e.clientX)); this.setState({calcWidth:w}); }\n      if(this._lrDrag){ e.preventDefault(); this.setState({lineReaderY:Math.min(window.innerHeight-60,Math.max(70,e.clientY))}); }\n    };`);
rep(`if(this._calcResizing){this._calcResizing=false; document.body.style.userSelect='';} };`,
    `if(this._calcResizing){this._calcResizing=false; document.body.style.userSelect='';} if(this._lrDrag){this._lrDrag=false; document.body.style.userSelect='';} };`);

// B3 — componentWillUnmount cleanup
rep(`window.removeEventListener('mouseup',this._onUp); }`,
    `window.removeEventListener('mouseup',this._onUp); document.removeEventListener('keydown',this._onKey); if(this._batt&&this._battUpd){ this._batt.removeEventListener('levelchange',this._battUpd); this._batt.removeEventListener('chargingchange',this._battUpd); } }`);

// B4 — new methods between exitExam() and renderVals()
const NEW_METHODS = `  toggleFigExpand(){ this.setState((s)=>{ if(s.figScale>=2){ return {figScale:this._figPrev||1}; } this._figPrev=s.figScale; return {figScale:2}; }); }
  toggleRefWide(){ this.setState((s)=>({refWide:!s.refWide})); }
  _frqTA(){ return document.getElementById('frq-textarea'); }
  frqWrapSel(pre,post){ const el=this._frqTA(); if(!el) return; const ss=el.selectionStart, se=el.selectionEnd, v=el.value; const sel=v.slice(ss,se); this.setFrqAns(v.slice(0,ss)+pre+sel+post+v.slice(se)); const ns=ss+pre.length, ne=ns+sel.length; requestAnimationFrame(()=>{ const e2=this._frqTA(); if(e2){ e2.focus(); e2.setSelectionRange(ns,ne); } }); }
  frqBulletLines(){ const el=this._frqTA(); if(!el) return; const ss=el.selectionStart, se=el.selectionEnd, v=el.value; const ls=v.lastIndexOf('\\n',ss-1)+1; let le=v.indexOf('\\n',se); if(le===-1) le=v.length; const lines=v.slice(ls,le).split('\\n').map((l)=>'• '+l).join('\\n'); this.setFrqAns(v.slice(0,ls)+lines+v.slice(le)); requestAnimationFrame(()=>{ const e2=this._frqTA(); if(e2){ e2.focus(); e2.setSelectionRange(ls,ls+lines.length); } }); }
  frqSup(){ const el=this._frqTA(); if(!el) return; const ss=el.selectionStart, se=el.selectionEnd, v=el.value; const sel=v.slice(ss,se); if(sel){ this.setFrqAns(v.slice(0,ss)+'^('+sel+')'+v.slice(se)); requestAnimationFrame(()=>{ const e2=this._frqTA(); if(e2){ e2.focus(); e2.setSelectionRange(ss+2,ss+2+sel.length); } }); } else { this.setFrqAns(v.slice(0,ss)+'²'+v.slice(se)); requestAnimationFrame(()=>{ const e2=this._frqTA(); if(e2){ e2.focus(); e2.setSelectionRange(ss+1,ss+1); } }); } }
  applyHighlight(e){ if(!this.state.highlightsOpen) return; const sel=window.getSelection(); if(!sel||sel.isCollapsed||!sel.rangeCount) return; const range=sel.getRangeAt(0); if(!range.toString().trim()) return; const panel=e&&e.currentTarget; if(panel&&!panel.contains(range.commonAncestorContainer)) return; const span=document.createElement('span'); span.className='bb-hl'; span.title='Click to remove highlight'; span.addEventListener('click',()=>{ const p=span.parentNode; if(!p) return; while(span.firstChild) p.insertBefore(span.firstChild,span); p.removeChild(span); }); try{ range.surroundContents(span); }catch(err){ try{ const frag=range.extractContents(); span.appendChild(frag); range.insertNode(span); }catch(e2){ return; } } sel.removeAllRanges(); }
  startLineReaderDrag(){ this._lrDrag=true; document.body.style.userSelect='none'; }
  _handleKey(e){ const t=e.target; const inField=t&&(t.tagName==='TEXTAREA'||t.tagName==='INPUT'||t.isContentEditable); if(!inField&&(e.key==='Enter'||e.key===' '||e.key==='Spacebar')&&t&&t.getAttribute&&t.getAttribute('role')==='button'){ e.preventDefault(); t.click(); return; } if(inField) return; if(e.ctrlKey||e.metaKey||e.altKey) return; const s=this.state, k=e.key, kl=k.length===1?k.toLowerCase():k; if(k==='Escape'){ this.setState({helpOpen:false,shortcutsOpen:false,atOpen:false,moreOpen:false,navOpen:false,calcOpen:false,refOpen:false,directionsOpen:false,highlightsOpen:false}); return; } if(s.helpOpen||s.shortcutsOpen||s.atOpen) return; if(s.view==='exam'){ if(k==='ArrowRight'){ this.go(1); return; } if(k==='ArrowLeft'){ this.go(-1); return; } const lm={'a':0,'b':1,'c':2,'d':3,'1':0,'2':1,'3':2,'4':3}; if(lm[kl]!==undefined){ const q=this.questions[s.qIndex]||{}; if(q.choices&&q.choices[lm[kl]]){ const letter='ABCD'[lm[kl]]; if(!(new Set(s.elim[s.qIndex]||[])).has(letter)) this.select(letter); } return; } if(kl==='m'){ this.toggleMark(); return; } if(kl==='t'){ this.setState((st)=>({timerHidden:!st.timerHidden})); return; } if(kl==='c'){ this.toggle('calcOpen'); return; } if(kl==='r'){ this.toggle('refOpen'); return; } if(kl==='n'){ this.setState((st)=>({navOpen:!st.navOpen,moreOpen:false})); return; } if(kl==='h'){ this.toggle('highlightsOpen'); return; } } else if(s.view==='frq'){ if(k==='ArrowRight'){ this.frqGo(1); return; } if(k==='ArrowLeft'){ this.frqGo(-1); return; } if(kl==='t'){ this.setState((st)=>({timerHidden:!st.timerHidden})); return; } if(kl==='c'){ this.toggle('calcOpen'); return; } if(kl==='r'){ this.toggle('refOpen'); return; } } }`;
rep(`  exitExam(){ this.setState({view:'home',moreOpen:false}); }\n\n  renderVals(){`,
    `  exitExam(){ this.setState({view:'home',moreOpen:false}); }\n` + NEW_METHODS + `\n  renderVals(){`);

// B5 — moreItems now open the new panels
rep(`    const moreItems=[
      {icon:'?',label:'Help',onClick:()=>this.setState({moreOpen:false})},
      {icon:'⌨',label:'Shortcuts',onClick:()=>this.setState({moreOpen:false})},
      {icon:'♿',label:'Assistive Technology',onClick:()=>this.setState({moreOpen:false})},
      {icon:'≡',label:'Line Reader',onClick:()=>this.setState({moreOpen:false})},
      {icon:'⏱',label:'Unscheduled Break',onClick:()=>this.startBreak()},
      {icon:'⚠',label:'Exit the Exam',onClick:()=>this.exitExam()},
    ];`,
    `    const moreItems=[
      {icon:'?',label:'Help',onClick:()=>this.setState({moreOpen:false,helpOpen:true})},
      {icon:'⌨',label:'Shortcuts',onClick:()=>this.setState({moreOpen:false,shortcutsOpen:true})},
      {icon:'♿',label:'Assistive Technology',onClick:()=>this.setState({moreOpen:false,atOpen:true})},
      {icon:'≡',label:'Line Reader',onClick:()=>this.setState((st)=>({moreOpen:false,lineReaderOn:!st.lineReaderOn,lineReaderY:st.lineReaderY||Math.round(window.innerHeight*0.4)}))},
      {icon:'⏱',label:'Unscheduled Break',onClick:()=>this.startBreak()},
      {icon:'⚠',label:'Exit the Exam',onClick:()=>this.exitExam()},
    ];`);

// B6 — renderVals: live battery + new vals
rep(`      studentName:name, battPct:100,`,
    `      studentName:name, battPct:s.battPct, battFill:Math.round(20*s.battPct/100), battFillSm:Math.round(16*s.battPct/100),`);
const RENDER_INSERT = `      refWidth:s.refWide?'860px':'640px', refMaxWidth:s.refWide?'60%':'46%', toggleRefWide:()=>this.toggleRefWide(), toggleFigExpand:()=>this.toggleFigExpand(),
      onStimMouseUp:(e)=>this.applyHighlight(e),
      frqBold:()=>this.frqWrapSel('**','**'), frqItalic:()=>this.frqWrapSel('*','*'), frqUnderline:()=>this.frqWrapSel('__','__'), frqBullet:()=>this.frqBulletLines(), frqSuperscript:()=>this.frqSup(),
      helpOpen:s.helpOpen, shortcutsOpen:s.shortcutsOpen, atOpen:s.atOpen, closeHelp:()=>this.setState({helpOpen:false}), closeShortcuts:()=>this.setState({shortcutsOpen:false}), closeAt:()=>this.setState({atOpen:false}), stopProp:(e)=>e.stopPropagation(),
      lineReaderOn:s.lineReaderOn, lineReaderY:s.lineReaderY, toggleLineReader:()=>this.setState((st)=>({lineReaderOn:!st.lineReaderOn,lineReaderY:st.lineReaderY||Math.round(window.innerHeight*0.4)})), startLineReaderDrag:()=>this.startLineReaderDrag(),
`;
rep(`      gotoReview:()=>this.gotoReview(),\n    };`,
    `      gotoReview:()=>this.gotoReview(),\n` + RENDER_INSERT + `    };`);

// B7 — dead code removal
repLine(`  tPanel(k){`);
repLine(`    const keyLabels=`);
repLine(`    const calcKeys=`);
rep(`\n\n  calcGridEl(){\n    const R=React.createElement, e=[]; const W=660,H=400,cx=W/2,cy=H/2,step=44;\n    for(let x=cx%step;x<W;x+=step) e.push(R('line',{key:'x'+x,x1:x,y1:0,x2:x,y2:H,stroke:'#e6e9ef',strokeWidth:1}));\n    for(let y=cy%step;y<H;y+=step) e.push(R('line',{key:'y'+y,x1:0,y1:y,x2:W,y2:y,stroke:'#e6e9ef',strokeWidth:1}));\n    e.push(R('line',{key:'ax',x1:0,y1:cy,x2:W,y2:cy,stroke:'#9aa0aa',strokeWidth:1.4}));\n    e.push(R('line',{key:'ay',x1:cx,y1:0,x2:cx,y2:H,stroke:'#9aa0aa',strokeWidth:1.4}));\n    return R('svg',{width:'100%',height:'100%',viewBox:'0 0 '+W+' '+H,preserveAspectRatio:'none',style:{display:'block'}},e);\n  }\n}`,
    `\n}`);

console.log('Phase B class-code edits applied. total edits:', edits);

// ══ PHASE C — role/tabindex on every click handler ═══════════════════════════
// NOTE: runs after all on-click additions but BEFORE the A1b CSS insertion,
// because the CSS selector [role="button"] would otherwise be counted by the
// invariant check below (it is not an element attribute).
const clicksBefore = (template.match(/sc-camel-on-click=/g) || []).length;
template = template.replace(/<([a-zA-Z][\w-]*)(\s)([^>]*?sc-camel-on-click="[^"]*")/g, (m, tag, sp, rest) =>
  /\brole="/.test(rest) ? m : `<${tag}${sp}role="button" sc-camel-tab-index="0" ${rest}`);
const roles = (template.match(/role="button"/g) || []).length;
const skipped = (template.match(/role="(presentation|dialog)"/g) || []).length;
if (roles + skipped !== clicksBefore) throw new Error(`role count ${roles}+${skipped} != clicks ${clicksBefore}`);
console.log(`Phase C: ${clicksBefore} on-click handlers — ${roles} role="button", ${skipped} presentation/dialog (invariant holds)`);

// A1b — highlight/focus CSS (inserted after Phase C, see note above)
rep('  .katex{font-size:1.05em;}\n</style>',
    '  .katex{font-size:1.05em;}\n  .bb-hl{background:#fff59d;cursor:pointer;border-radius:2px;}\n  [role="button"]:focus-visible{outline:2px solid #1a56db;outline-offset:2px;}\n</style>');

// ══ PHASE D — encode + write ═════════════════════════════════════════════════
const encoded = JSON.stringify(template).replace(/<\//g, '<\\/'); // </ escape is mandatory
const qStart = region.indexOf('"');
const qEnd = region.lastIndexOf('"');
const out = html.slice(0, openEnd) + region.slice(0, qStart) + encoded + region.slice(qEnd + 1) + html.slice(closeIdx);
fs.writeFileSync(FILE, out);
console.log('Phase D: file written —', FILE);

// ══ VERIFICATION ═════════════════════════════════════════════════════════════
const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${extra ? ` (${extra})` : ''}`);
}

const html2 = fs.readFileSync(FILE, 'utf8');

// 1 — region re-extracts and parses
const i2 = html2.indexOf(OPEN);
const j2 = html2.indexOf('</script>', i2 + OPEN.length);
const region2 = html2.slice(i2 + OPEN.length, j2);
let t2 = null;
try { t2 = JSON.parse(region2); check('1. template region JSON.parse succeeds', true); }
catch (e) { check('1. template region JSON.parse succeeds', false, e.message); }

// 2 — no literal </script> inside the region (must be <\/script>)
check('2. no literal </script> in region; <\\/script> present',
  !region2.includes('</script>') && region2.includes('<\\/script>'));

// 3 — class code is syntactically valid
const DC_OPEN = '<script type="text/x-dc"';
const di = t2.indexOf(DC_OPEN);
const dStart = t2.indexOf('>', di) + 1;
const dEnd = t2.indexOf('</script>', dStart);
const classCode = t2.slice(dStart, dEnd);
try { new Function('DCLogic', 'React', classCode); check('3. class code passes new Function()', true); }
catch (e) { check('3. class code passes new Function()', false, e.message); }

// 4 — presence/absence checks on the decoded template
check('4a. body{zoom:0.85} removed', !t2.includes('body{zoom:0.85}'));
check('4b. FRQ textarea: on-input + id',
  t2.includes('sc-camel-on-input="{{ onFrqInput }}"') && t2.includes('id="frq-textarea"'));
check('4c. battery: battFill/battFillSm/getBattery/battPct:s.battPct',
  t2.includes('{{ battFill }}') && t2.includes('{{ battFillSm }}') &&
  t2.includes('navigator.getBattery') && t2.includes('battPct:s.battPct'));
check('4d. toggleFigExpand/toggleRefWide + {{ refWidth }}',
  t2.includes('toggleFigExpand') && t2.includes('toggleRefWide') && t2.includes('{{ refWidth }}'));
check('4e. new flags in state',
  t2.includes('battPct:100, refWide:false, helpOpen:false, shortcutsOpen:false, atOpen:false, lineReaderOn:false, lineReaderY:300,'));
check('4f. new flags in renderVals',
  t2.includes('helpOpen:s.helpOpen, shortcutsOpen:s.shortcutsOpen, atOpen:s.atOpen,') &&
  t2.includes('lineReaderOn:s.lineReaderOn, lineReaderY:s.lineReaderY,'));
check('4g. new <sc-if> blocks',
  t2.includes('<sc-if value="{{ helpOpen }}">') && t2.includes('<sc-if value="{{ shortcutsOpen }}">') &&
  t2.includes('<sc-if value="{{ atOpen }}">') && t2.includes('<sc-if value="{{ lineReaderOn }}">'));
check('4h. moreItems updated',
  t2.includes('moreOpen:false,helpOpen:true') && t2.includes('moreOpen:false,shortcutsOpen:true') &&
  t2.includes('moreOpen:false,atOpen:true') && t2.includes('lineReaderOn:!st.lineReaderOn'));
check('4i. highlighting: applyHighlight + onStimMouseUp + .bb-hl',
  t2.includes('applyHighlight') && t2.includes('sc-camel-on-mouse-up="{{ onStimMouseUp }}"') && t2.includes('.bb-hl'));
check('4j. FRQ toolbar: frqWrapSel/frqBulletLines/frqSup + handlers',
  t2.includes('frqWrapSel') && t2.includes('frqBulletLines') && t2.includes('frqSup') &&
  t2.includes('{{ frqBold }}') && t2.includes('{{ frqItalic }}') && t2.includes('{{ frqUnderline }}') &&
  t2.includes('{{ frqBullet }}') && t2.includes('{{ frqSuperscript }}'));
check('4k. keyboard: _handleKey + keydown listener',
  t2.includes('_handleKey') && t2.includes(`document.addEventListener('keydown'`));
// role count — <style> blocks stripped so the [role="button"] CSS selector is
// not miscounted as an element attribute
const noStyle = t2.replace(/<style>[\s\S]*?<\/style>/g, '');
const clicks4 = (noStyle.match(/sc-camel-on-click=/g) || []).length;
const roles4 = (noStyle.match(/role="button"/g) || []).length;
const pd4 = (noStyle.match(/role="(presentation|dialog)"/g) || []).length;
check('4l. role="button" count == on-click count minus presentation/dialog',
  roles4 === clicks4 - pd4, `roles=${roles4} clicks=${clicks4} pres/dialog=${pd4}`);
check('4m. dead code absent: keyLabels/calcKeys/calcGridEl/tPanel(',
  !t2.includes('keyLabels') && !t2.includes('calcKeys') && !t2.includes('calcGridEl') && !t2.includes('tPanel('));

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`\n${failed.length} verification check(s) FAILED`);
  process.exit(1);
}
console.log(`\nAll ${results.length} verification checks passed.`);
