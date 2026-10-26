(() => {
  'use strict';
  const app = document.querySelector('#app');
  let isAdmin = false;
  try { isAdmin = (localStorage.getItem('ahrenslabs_email') || '').trim().toLowerCase() === 'calebahrens2011@gmail.com'; }
  catch { isAdmin = false; }
  if (!isAdmin) {
    app.innerHTML = '<section class="panel" style="margin:48px auto;max-width:560px;text-align:center"><h1>Whiteout Station</h1><p>This game is currently in private testing.</p><a class="btn secondary" href="/ahrens-games.html">Back to Ahrens Games</a></section>';
    return;
  }
  const ROLES = [
    {id:'weather',name:'Meteorologist',icon:'🌦️',knows:'Your forecast shows where the next storm will strike.',special:'Forecast: shield a region from this round’s storm.'},
    {id:'engineer',name:'Engineer',icon:'🧰',knows:'You know the hidden condition of the station’s critical systems.',special:'Field repair: fix the radio or generator, or reinforce the station.'},
    {id:'medic',name:'Medic',icon:'🩺',knows:'You can see who is suffering most from cold and exposure.',special:'Treat: protect one crew member from cold and remove an injury.'},
    {id:'researcher',name:'Researcher',icon:'🔬',knows:'You know which research sample is most likely to be useful this round.',special:'Analyze: verify a sample and reveal whether it meets the mission brief.'}
  ];
  const DIFF = {
    easy:{name:'New Team', rounds:6, cold:0, damage:0, supply:10, samples:2, comms:3, hint:'A shorter mission with two samples, generous supplies, and clear clues.'},
    standard:{name:'Standard',rounds:8,cold:1,damage:1,supply:8,samples:3,comms:2,hint:'A balanced mission with three samples and a steady storm.'},
    veteran:{name:'Veteran',rounds:10,cold:2,damage:2,supply:7,samples:4,comms:1,hint:'A longer mission with four samples, tight supplies, and little radio time.'}
  };
  const ACTS = [
    {id:'logs',title:'Check station log',text:'Reveal a public clue about samples or equipment.',type:'info'},
    {id:'supplies',title:'Gather supplies',text:'Bring in food and fuel before the team runs low.',type:'supply'},
    {id:'sample',title:'Collect a sample',text:'Bring a core, wildlife trace, or air reading to the lab.',type:'sample'},
    {id:'radio',title:'Calibrate the radio',text:'Any crew member can work from the station log. The engineer makes faster progress.',type:'radio'},
    {id:'generator',title:'Repair generator',text:'Prevent station damage and keep the heaters running.',type:'repair',role:'engineer'},
    {id:'forecast',title:'Shield a field site',text:'Predict the storm and protect a site from exposure.',type:'shield',role:'weather'},
    {id:'treat',title:'Treat a crewmate',text:'Protect someone from the cold this round.',type:'treat',role:'medic'},
    {id:'analyze',title:'Analyze a sample',text:'Verify a collected sample against the mission brief.',type:'analyze',role:'researcher'},
    {id:'warm',title:'Warm the crew',text:'Use the heater and spare blankets to lower exposure.',type:'warm'},
    {id:'shelter',title:'Reinforce the station',text:'Reduce damage from the coming storm.',type:'shelter'},
    {id:'evacuate',title:'Prepare evacuation',text:'Once radio and samples are ready, move toward the airstrip.',type:'evacuate'}
  ];
  let setup={players:3,diff:'standard'};
  let game=null, pick=null, selectedSignal=null, pidx=0;
  const $=(s,r=document)=>r.querySelector(s), esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp=(v,n)=>Math.max(0,Math.min(n,v));
  const newGame=()=>{
    const d=DIFF[setup.diff], roleSets={2:['engineer','researcher'],3:['weather','engineer','researcher'],4:['weather','engineer','medic','researcher']}, roles=roleSets[setup.players].map(id=>ROLES.find(r=>r.id===id));
    const names=['Alex','Riley','Sam','Jordan'];
    game={diff:setup.diff,round:1,phase:'brief',briefAt:0,planAt:0,roles:roles.map((r,i)=>({...r,player:names[i]})),
      tracks:{cold:d.cold,damage:d.damage,supplies:d.supply,storm:0,radio:0,samples:0,verified:0,evac:0},
      max:{danger:8,storm:d.rounds,samples:d.samples}, reports:[],signals:[],log:['The crew reaches Whiteout Station. The radio is silent, and a storm is building.'],
      missionSamples:d.samples,required:['Ice core','Wildlife trace','Air reading'],shield:null,treated:null,forecast:null,done:false,result:null,
      sampleLead:null,
      found:[],plans:Array(roles.length).fill(null),signalsThisRound:[],stormTarget:['North ridge','East field site','West antenna'][Math.floor(Math.random()*3)]};
    game.sampleLead=['Ice core','Wildlife trace','Air reading'][Math.floor(Math.random()*3)];
    game.reports=roles.map((r,i)=>makeReport(r,i));pidx=0;render();
  };
  function makeReport(r,i){
    const d=DIFF[game.diff], t=game.tracks;
    if(r.id==='weather')return {title:'Forecast',text:`The next storm will hit the ${game.stormTarget.toLowerCase()}. ${game.round>2?'Wind is picking up.':'A brief lull may give the crew time.'}`};
    if(r.id==='engineer')return {title:'Systems check',text:t.radio<2?`Radio diagnostics: ${t.radio===0?'the antenna is down and the relay is untested.':'the relay is repaired; one final calibration should restore the radio.'} The generator ${Math.random()<.5?'is stable for now.':'is running hot.'}`:`Radio is ready. ${t.damage>3?'The station frame is under serious strain.':'Generator readings look steady.'}`};
    if(r.id==='medic')return {title:'Crew health',text:`${game.roles[i].player} is ${t.cold>4?'showing dangerous exposure':'holding up for now'}. ${t.supplies<4?'Medical stores are nearly empty.':'The infirmary has enough supplies for treatment.'}`};
    return {title:'Research briefing',text:`Mission needs ${d.samples} verified samples. Your instruments strongly favor the ${game.sampleLead.toLowerCase()} site this round.`};
  }
  function home(){app.innerHTML=`<section class="hero"><div class="snow"></div><div class="hero-copy"><h1>Whiteout<br>Station</h1><p>A storm is closing in. Your crew has the clues—but no one has the whole picture. Share what you can, plan in secret, then reveal your actions together.</p></div></section><div class="setup-grid"><section class="panel"><h2>Prepare the mission</h2><p class="intro">Cooperative pass-and-play for 2–4 players. Keep the screen private during briefings and planning.</p><div class="field"><label>Crew size</label><div class="choices">${[2,3,4].map(n=>`<button class="choice ${setup.players===n?'on':''}" data-players="${n}">${n} players</button>`).join('')}</div></div><div class="field"><label>Mission length and difficulty</label><div class="choices">${Object.entries(DIFF).map(([k,d])=>`<button class="choice ${setup.diff===k?'on':''}" data-diff="${k}">${d.name}</button>`).join('')}</div><p class="intro" id="diff-hint">${DIFF[setup.diff].hint}</p></div><button class="btn" id="start">Start the mission →</button></section><section class="panel"><h2>How to win</h2><div class="how"><article><b>📻 Restore the radio</b><small>The engineer knows the system, but any crewmate can work from the station log.</small></article><article><b>🧪 Verify the research</b><small>Collect samples, inspect clues, then have the researcher analyze enough valid evidence.</small></article><article><b>🚁 Evacuate together</b><small>Once radio and research are ready, spend actions preparing the airstrip and evacuate.</small></article><article><b>❄️ Survive the station</b><small>Cold, structural damage, supplies, and the storm all demand attention before they max out.</small></article></div></section></div>`;
    app.querySelectorAll('[data-players]').forEach(b=>b.onclick=()=>{setup.players=+b.dataset.players;home()});
    app.querySelectorAll('[data-diff]').forEach(b=>b.onclick=()=>{setup.diff=b.dataset.diff;home()});$('#start').onclick=newGame;
  }
  function shell(content){app.innerHTML=content}
  function veil(title,body,button,label){return `<div class="veil"><div class="veil-card"><div class="role-icon">🔒</div><h2>${title}</h2><p>${body}</p><button class="btn" id="veil-go">${button||'Continue →'}</button></div></div>`}
  function brief(){const role=game.roles[game.briefAt],report=game.reports[game.briefAt];
    shell(`<section class="hero"><div class="snow"></div><div class="hero-copy"><h1>Whiteout<br>Station</h1><p>Mission briefing · Round ${game.round}</p></div></section><section class="panel private-card"><div class="role-icon">${role.icon}</div><div class="role-title">${esc(role.player)} · ${role.name}</div><p class="intro">${role.knows}</p><div class="private-note"><b>${report.title}</b><br>${esc(report.text)}</div><h3>Special action</h3><p>${role.special}</p><p class="intro">Choose one signal to send over the limited radio. It shares a broad warning, not your full private report.</p><div class="comm-list">${[['warning','⚠️ My report matters'],['sample','🧪 I have research news'],['system','🧰 I found a system clue'],['quiet','🤐 Keep my clue private']].map(([v,t])=>`<button class="comm ${selectedSignal===v?'on':''}" data-signal="${v}">${t}</button>`).join('')}</div><div class="footer-actions"><button id="brief-done" class="btn" ${game.signalsThisRound.length>=DIFF[game.diff].comms&&selectedSignal!=='quiet'?'disabled':''}>${game.briefAt+1<game.roles.length?'Hide briefing & pass device':'Finish briefing →'}</button></div><p class="intro">Radio capacity: ${Math.max(0,DIFF[game.diff].comms-game.signalsThisRound.length)} signal${DIFF[game.diff].comms-game.signalsThisRound.length===1?'':'s'} left this round.</p></section>`);
    app.querySelectorAll('[data-signal]').forEach(b=>b.onclick=()=>{selectedSignal=b.dataset.signal;brief()});
    $('#brief-done').onclick=()=>{if(selectedSignal&&selectedSignal!=='quiet'&&game.signalsThisRound.length<DIFF[game.diff].comms)game.signalsThisRound.push(`${role.icon} ${role.player}: ${selectedSignal==='warning'?'my report has a warning':selectedSignal==='sample'?'I have research news':'I found a system clue'}`);selectedSignal=null;game.briefAt++;if(game.briefAt<game.roles.length)handoff('Briefing passed',`${game.roles[game.briefAt].player}, take the device. Keep the screen private while reading your station report.`,'Read my report',brief);else{game.phase='plan';game.planAt=0;planHandoff()}};
  }
  function handoff(title,body,button,fn){shell(`<section class="hero"><div class="snow"></div><div class="hero-copy"><h1>Whiteout<br>Station</h1><p>Mission briefing · Round ${game.round}</p></div></section>${veil(title,body,button)}`);$('#veil-go').onclick=fn}
  function planHandoff(){const r=game.roles[game.planAt];handoff('Private planning',`${r.player}, take the device. Your crew has finished sharing its radio signals. Choose one action in private; all actions will resolve together.`, 'Choose my action',plan)}
  function getTargets(a){if(a==='sample')return ['Ice core','Wildlife trace','Air reading'];if(a==='treat')return game.roles.map(r=>r.player);if(a==='forecast')return ['North ridge','East field site','West antenna'];if(a==='analyze')return game.found.filter(f=>!f.tested).map((f,i)=>`${f.name} · sample ${i+1}`);return ['Radio relay','Generator','Station frame'];}
  function actionsFor(r){return ACTS.filter(a=>!a.role||a.role===r.id).filter(a=>a.id!=='evacuate'||(game.tracks.radio>=2&&game.tracks.verified>=game.missionSamples)).filter(a=>a.id!=='analyze'||game.found.some(f=>!f.tested))}
  function plan(){const r=game.roles[game.planAt];pick=null;
    shell(`<div class="game-head"><div><h1>Whiteout Station</h1><div class="round">Round ${game.round} · ${r.player}, choose one action</div></div></div>${tracks()}<div class="station-layout"><section class="station-scene"><div class="sun"></div><div class="station-building"></div><div class="weather"></div><div class="scene-label">Whiteout Research Station</div></section><div class="side-stack">${mission()}<section class="panel"><h2>Signals received</h2>${game.signalsThisRound.length?`<ul class="log">${game.signalsThisRound.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p class="intro">No signals sent this round.</p>'}</section></div></div><section class="panel phase"><h2>${r.icon} ${esc(r.name)} actions</h2><div class="action-grid">${actionsFor(r).map(a=>`<button class="act" data-act="${a.id}"><b>${a.title}</b><small>${a.text}${a.role?` Specialist action · ${r.name}`:''}</small></button>`).join('')}</div><div id="target-wrap"></div><button class="btn" id="lock" disabled>Lock action</button></section>`);
    app.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>{app.querySelectorAll('[data-act]').forEach(x=>x.classList.remove('on'));b.classList.add('on');pick=ACTS.find(a=>a.id===b.dataset.act);targetPick=null;const targets=getTargets(pick.id);$('#target-wrap').innerHTML=targets.length?`<div class="field"><label>Choose target</label><div class="choices">${targets.map((t,i)=>`<button class="choice ${i===0?'on':''}" data-target="${i}">${esc(t)}</button>`).join('')}</div></div>`:'';targetPick=0;app.querySelectorAll('[data-target]').forEach(x=>x.onclick=()=>{app.querySelectorAll('[data-target]').forEach(y=>y.classList.remove('on'));x.classList.add('on');targetPick=+x.dataset.target});$('#lock').disabled=targets.length===0&&pick.id==='analyze';});
    let targetPick=0;
    $('#lock').onclick=()=>{if(!pick)return;game.plans[game.planAt]={action:pick.id,target:targetPick};game.planAt++;if(game.planAt<game.roles.length)planHandoff();else resolveRound()};
  }
  function tracks(){const t=game.tracks;return `<div class="tracks">${[['Cold',t.cold,8],['Station damage',t.damage,8],['Supplies',t.supplies,12],['Storm',t.storm,game.max.storm]].map(([n,v,m])=>`<div class="track"><div class="track-head"><span>${n}</span><span>${v}/${m}</span></div><div class="meter"><i style="width:${Math.min(100,v/m*100)}%"></i></div></div>`).join('')}</div>`}
  function mission(){const t=game.tracks;return `<section class="panel mission"><h2>Mission checklist</h2><ul><li>${t.radio>=2?'✅':'⬜'} Radio restored (${t.radio}/2)</li><li>${t.verified>=game.missionSamples?'✅':'⬜'} Verify ${game.missionSamples} clean samples (${t.verified}/${game.missionSamples})</li><li>${t.evac>=2?'✅':'⬜'} Prepare evacuation (${t.evac}/2)</li></ul>${game.found.length?`<b>Lab samples</b><ul>${game.found.map(f=>`<li>${f.tested?(f.valid?'✅ Clean':'⚠️ Contaminated'):'🔎 Unanalyzed'} ${esc(f.name)}</li>`).join('')}</ul>`:''}<b>Goal:</b> complete all three, then evacuate. Any danger track reaching its limit ends the mission.</section>`}
  function renderActive(){if(game.done){end();return}shell(`<div class="game-head"><div><h1>Whiteout Station</h1><div class="round">Round ${game.round}</div></div><button class="btn secondary" id="restart">New mission</button></div>${tracks()}<div class="station-layout"><section class="station-scene"><div class="sun"></div><div class="station-building"></div><div class="weather"></div><div class="scene-label">Whiteout Research Station</div><div class="status-row"><span class="pill">📻 Radio ${game.tracks.radio}/2</span><span class="pill">🧪 Verified ${game.tracks.verified}/${game.missionSamples}</span><span class="pill">🚁 Evac ${game.tracks.evac}/2</span></div></section><div class="side-stack">${mission()}<section class="panel"><h2>Mission log</h2><ul class="log">${game.log.slice(-5).reverse().map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section></div></div><section class="panel phase"><h2>Next round</h2><p class="intro">Signals: ${game.signalsThisRound.length?game.signalsThisRound.map(esc).join(' · '):'none'}<br>All crew actions will be selected secretly, then revealed together.</p><button class="btn" id="next">Begin round ${game.round} briefings →</button></section>`);$('#next').onclick=beginRound;$('#restart').onclick=home}
  function beginRound(){game.briefAt=0;game.planAt=0;game.plans=Array(game.roles.length).fill(null);game.signalsThisRound=[];game.shield=null;game.treated=null;game.forecast=null;game.sampleLead=['Ice core','Wildlife trace','Air reading'][Math.floor(Math.random()*3)];game.stormTarget=['North ridge','East field site','West antenna'][Math.floor(Math.random()*3)];game.reports=game.roles.map((r,i)=>makeReport(r,i));selectedSignal=null;brief()}
  function resolveRound(){const t=game.tracks, actions=game.plans;let messages=[];let repairs=0,radio=0,samples=[],verified=0,info=0,supply=0,shelter=0,shield=0,treats=0,evac=0;
    const analyses=[];let matchedForecast=false;actions.forEach((p,i)=>{if(!p)return;switch(p.action){case'logs':info++;break;case'supplies':supply++;break;case'sample':samples.push(['Ice core','Wildlife trace','Air reading'][p.target]);break;case'radio':radio+=game.roles[i].id==='engineer'?2:1;break;case'generator':repairs++;break;case'shelter':shelter++;break;case'forecast':shield++;if(['North ridge','East field site','West antenna'][p.target]===game.stormTarget)matchedForecast=true;break;case'treat':treats++;break;case'analyze':analyses.push(p.target);break;case'warm':treats++;break;case'evacuate':evac++;break;}});
    if(info){const clues=['The logbook says the radio needs two separate calibration passes.','Field notes warn that untreated samples can be contaminated.','The emergency plan says the airstrip is usable only after the radio is restored.','A fuel ledger shows one supply crate is still sealed in the north store.'];messages.push(clues[Math.floor(Math.random()*clues.length)]);}
    if(supply){t.supplies=clamp(t.supplies+supply,12);messages.push(`The crew gathered ${supply} supply${supply>1?' crates':''}.`)}
    if(samples.length){samples.forEach(name=>game.found.push({name,valid:name===game.sampleLead||Math.random()<.55,tested:false}));messages.push(`Collected ${samples.length} research sample${samples.length>1?'s':''}.`)}
    if(analyses.length){const candidates=game.found.filter(x=>!x.tested);for(const n of analyses){const f=candidates[n]||candidates[0];if(!f)continue;f.tested=true;if(f.valid){f.verified=true;t.verified++;messages.push(`Analysis confirms a clean ${f.name.toLowerCase()}.`)}else messages.push(`Analysis found a contaminant in a ${f.name.toLowerCase()}.`);candidates.splice(candidates.indexOf(f),1);} }
    t.radio=clamp(t.radio+radio,2);if(radio)messages.push(`Radio progress: ${t.radio}/2.`);
    t.damage=clamp(t.damage-repairs-shelter,8);if(repairs+shelter)messages.push('The station was reinforced and repaired.');
    if(shield)messages.push(matchedForecast?'The crew protected the storm’s target using the forecast.':'The forecast shield missed the storm’s target.');
    if(treats){t.cold=clamp(t.cold-treats,8);messages.push('The crew used warmth and treatment to ease exposure.')}
    t.evac=clamp(t.evac+evac,2);if(evac)messages.push(`Evacuation preparation: ${t.evac}/2.`);
    // Storm response: one pressure on every system; focused actions can prevent some of it.
    t.storm++;t.supplies=Math.max(0,t.supplies-1);
    if(game.stormTarget==='North ridge'&&!matchedForecast)t.cold++;
    if(game.stormTarget==='West antenna'&&!matchedForecast&&!repairs&&!shelter)t.damage++;
    if(game.stormTarget==='East field site'&&!matchedForecast)t.supplies=Math.max(0,t.supplies-1);
    if(t.storm>=game.max.storm){game.done=true;game.result=false;game.log.push(...messages,'The final whiteout closed in before the crew could leave.');end();return}
    if(t.cold>=8||t.damage>=8||t.supplies<=0){game.done=true;game.result=false;game.log.push(...messages,t.cold>=8?'The crew succumbed to the cold.':t.damage>=8?'The station became uninhabitable.':'The station ran out of supplies.');end();return}
    if(t.radio>=2&&t.verified>=game.missionSamples&&t.evac>=2){game.done=true;game.result=true;game.log.push(...messages,'Rescue arrived through the whiteout. The crew and research made it home!');end();return}
    game.log.push(...messages,`Storm intensity rises to ${t.storm}/${game.max.storm}. One supply was used.`);game.round++;game.phase='active';game.plans=Array(game.roles.length).fill(null);game.signalsThisRound=[];renderActive();
  }
  function end(){shell(`<section class="hero"><div class="snow"></div><div class="hero-copy"><h1>${game.result?'Rescue!':'Whiteout'}</h1><p>Whiteout Research Station · ${DIFF[game.diff].name}</p></div></section><section class="panel phase end"><h2>${game.result?'The crew made it home!':'Mission lost'}</h2><p>${game.result?'The radio, verified research, and airstrip all came together before the storm.':'The crew could not complete the mission before one of the station’s threats overwhelmed it.'}</p><h3>Final report</h3>${tracks()}<ul class="log">${game.log.slice(-9).reverse().map(x=>`<li>${esc(x)}</li>`).join('')}</ul><div class="footer-actions"><button class="btn" id="again">Play again</button><a class="btn secondary" href="/ahrens-games.html">Back to Ahrens Games</a></div></section>`);$('#again').onclick=home}
  function render(){if(!game){home();return}if(game.phase==='brief')brief();else if(game.phase==='plan')plan();else renderActive()}
  home();
})();
