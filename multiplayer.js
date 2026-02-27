// ============================================================
// LET'S FISHING — MULTIPLAYER SYSTEM v2
// Engine: Firebase Realtime Database (free tier)
//
// CARA SETUP (5 menit):
// 1. Buka https://console.firebase.google.com
// 2. "Create project" → nama bebas → Continue
// 3. Klik "Realtime Database" di sidebar → "Create database"
// 4. Pilih lokasi → "Start in test mode" → Enable
// 5. Klik ikon roda gigi → "Project settings"
// 6. Scroll ke "Your apps" → klik </> (web app) → daftarkan
// 7. Copy nilai di firebaseConfig dan paste ke bawah:
// ============================================================

window.FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCuZXPtSt8UykNylQTL3vOZhHJJJGlNmxY",
  authDomain:        "lets-fishing-ed271.firebaseapp.com",
  databaseURL:       "https://lets-fishing-ed271-default-rtdb.firebaseio.com",
  projectId:         "lets-fishing-ed271",
  storageBucket:     "lets-fishing-ed271.firebasestorage.app",
  messagingSenderId: "458916675317",
  appId:             "1:458916675317:web:e913889e2b872c58054fbc"
};

// ============================================================
// JANGAN UBAH DI BAWAH INI
// ============================================================

(function() {
  "use strict";

  // ── Config check ──
  const IS_CONFIGURED = !window.FIREBASE_CONFIG.apiKey.includes("ISI_DISINI");

  // ── State ──
  let db = null;
  let myId = null;
  let myRef = null;
  let playersRef = null;
  let chatRef = null;
  let otherPlayers = {};      // id → { meshes, data, walkAnim }
  let mpActive = false;
  let lastSend = 0;
  let chatOpen = false;
  let roomId = "world_main";

  const SEND_MS    = 80;   // kirim update posisi tiap 80ms
  const STALE_MS   = 12000; // hapus player yang tidak update 12 detik

  // ── Tunggu sampai game scene siap ──
  let sceneReady = false;
  function waitForScene(cb) {
    const check = setInterval(() => {
      if (window.scene && window.player && window.camera) {
        clearInterval(check);
        sceneReady = true;
        cb();
      }
    }, 200);
  }

  // ═══════════════════════════════════════════════
  // BUILD OTHER PLAYER MESH
  // ═══════════════════════════════════════════════
  function buildPlayerMesh(data) {
    const g = new THREE.Group();
    const shirtColor = data.shirtColor || "#3498db";

    // Torso
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 1),
      new THREE.MeshStandardMaterial({ color: shirtColor })
    );
    torso.position.y = 3;
    g.add(torso);

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.75, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xffd6b3, roughness: 0.6 })
    );
    head.scale.y = 1.05;
    head.position.y = 1.9;
    torso.add(head);

    // Face canvas
    const fc = document.createElement("canvas");
    fc.width = 128; fc.height = 128;
    const fx = fc.getContext("2d");
    fx.fillStyle = "#000";
    fx.beginPath(); fx.arc(38,55,8,0,Math.PI*2); fx.arc(90,55,8,0,Math.PI*2); fx.fill();
    fx.beginPath(); fx.arc(64,80,22,0,Math.PI); fx.lineWidth = 5; fx.stroke();
    const faceMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.9),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(fc), transparent: true })
    );
    faceMesh.position.z = 0.73;
    head.add(faceMesh);

    // Arms
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffd6b3 });
    const armGeo  = new THREE.BoxGeometry(1, 2, 1);
    const armL = new THREE.Mesh(armGeo, skinMat); armL.position.set(-1.5, 0, 0); torso.add(armL);
    const armR = new THREE.Mesh(armGeo, skinMat); armR.position.set( 1.5, 0, 0); torso.add(armR);

    // Legs
    const legMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const legGeo  = new THREE.BoxGeometry(1, 2, 1);
    const legL = new THREE.Mesh(legGeo, legMat); legL.position.set(-0.5, -2, 0); torso.add(legL);
    const legR = new THREE.Mesh(legGeo, legMat); legR.position.set( 0.5, -2, 0); torso.add(legR);

    // Rod visual
    const rodMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.06, 2),
      new THREE.MeshStandardMaterial({ color: data.rodColor || 0x8b5a2b })
    );
    rodMesh.visible = false;
    const rodAnchor = new THREE.Object3D();
    rodAnchor.position.set(0, -0.8, 0.5);
    armR.add(rodAnchor);
    rodAnchor.add(rodMesh);

    // Name tag sprite
    const nameCanvas = document.createElement("canvas");
    nameCanvas.width = 300; nameCanvas.height = 72;
    const nc = nameCanvas.getContext("2d");
    nc.fillStyle = "rgba(0,0,0,0.65)";
    nc.beginPath();
    nc.roundRect(0, 0, 300, 72, 10);
    nc.fill();
    nc.fillStyle = "#fff";
    nc.font = "bold 32px Arial";
    nc.textAlign = "center";
    nc.textBaseline = "middle";
    nc.fillText((data.name || "Player").substring(0, 14), 150, 36);
    const nameSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(nameCanvas), transparent: true, depthTest: false })
    );
    nameSprite.scale.set(3.5, 0.85, 1);
    nameSprite.position.y = 6.2;
    g.add(nameSprite);

    // Fishing line
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.65, transparent: true });
    const fishLine = new THREE.Line(lineGeo, lineMat);
    fishLine.visible = false;
    window.scene.add(fishLine);

    g.scale.set(0.8, 0.8, 0.8);
    window.scene.add(g);

    return { group: g, torso, head, armL, armR, legL, legR, rodMesh, nameSprite, fishLine };
  }

  // ═══════════════════════════════════════════════
  // SMOOTH INTERPOLATION FOR OTHER PLAYERS
  // ═══════════════════════════════════════════════
  function updateOtherPlayerVisuals(id, dt) {
    const op = otherPlayers[id];
    if (!op || !op.meshes) return;

    const d = op.latestData;
    const m = op.meshes;

    // Smooth position
    const target = new THREE.Vector3(d.x || 0, d.y || 0, d.z || 0);
    m.group.position.lerp(target, 0.2);

    // Smooth rotation
    let dRot = (d.ry || 0) - m.group.rotation.y;
    dRot = Math.atan2(Math.sin(dRot), Math.cos(dRot));
    m.group.rotation.y += dRot * 0.18;

    // Walk animation
    const isMoving = target.distanceTo(m.group.position) > 0.05;
    if (isMoving && !d.isFishing && !d.isSwimming) {
      op.walkAnim = (op.walkAnim || 0) + 0.18;
    } else {
      op.walkAnim = (op.walkAnim || 0) * 0.88;
    }
    const sw = Math.sin(op.walkAnim);

    if (d.isSwimming) {
      // Freestyle swim animation
      const sc = (op.swimCycle || 0) + dt * 2.5;
      op.swimCycle = sc;
      m.torso.rotation.x = THREE.MathUtils.lerp(m.torso.rotation.x, -0.65, 0.1);
      m.torso.rotation.z = Math.sin(sc * 0.5) * 0.15;
      m.armL.rotation.x = Math.sin(sc) * 1.3;
      m.armL.rotation.z = Math.cos(sc) * 0.4 - 0.3;
      m.armR.rotation.x = Math.sin(sc + Math.PI) * 1.3;
      m.armR.rotation.z = -Math.cos(sc + Math.PI) * 0.4 + 0.3;
      m.legL.rotation.x = Math.sin(sc * 2) * 0.3;
      m.legR.rotation.x = Math.sin(sc * 2 + Math.PI) * 0.3;
    } else if (d.isFishing) {
      m.torso.rotation.x = THREE.MathUtils.lerp(m.torso.rotation.x, 0, 0.1);
      m.torso.rotation.z = THREE.MathUtils.lerp(m.torso.rotation.z, 0, 0.1);
      m.armR.rotation.x = THREE.MathUtils.lerp(m.armR.rotation.x, -0.6, 0.12);
      m.armR.rotation.z = THREE.MathUtils.lerp(m.armR.rotation.z, -0.2, 0.12);
      m.armL.rotation.x = THREE.MathUtils.lerp(m.armL.rotation.x, 0.1, 0.1);
      m.legL.rotation.x = THREE.MathUtils.lerp(m.legL.rotation.x, 0, 0.1);
      m.legR.rotation.x = THREE.MathUtils.lerp(m.legR.rotation.x, 0, 0.1);
      m.rodMesh.visible = true;
      m.rodMesh.rotation.x = Math.PI / 2;
    } else {
      m.torso.rotation.x = THREE.MathUtils.lerp(m.torso.rotation.x, 0, 0.1);
      m.torso.rotation.z = THREE.MathUtils.lerp(m.torso.rotation.z, 0, 0.1);
      m.armL.rotation.x = -sw * 0.5;
      m.armR.rotation.x =  sw * 0.5;
      m.armR.rotation.z = THREE.MathUtils.lerp(m.armR.rotation.z, 0, 0.1);
      m.legL.rotation.x =  sw * 0.8;
      m.legR.rotation.x = -sw * 0.8;
      m.rodMesh.visible = false;
    }

    // Fishing line
    if (d.hookVisible) {
      m.fishLine.visible = true;
      const handW = new THREE.Vector3();
      m.group.getWorldPosition(handW);
      handW.y += 3.5;
      m.fishLine.geometry.setFromPoints([handW, new THREE.Vector3(d.hookX, d.hookY, d.hookZ)]);
    } else {
      m.fishLine.visible = false;
    }

    // Name tag always faces camera
    m.nameSprite.quaternion.copy(window.camera.quaternion);

    // Stale check
    if (Date.now() - (op.latestData.ts || 0) > STALE_MS) {
      removeOtherPlayer(id);
    }
  }

  function removeOtherPlayer(id) {
    if (!otherPlayers[id]) return;
    const m = otherPlayers[id].meshes;
    if (m) {
      window.scene.remove(m.group);
      if (m.fishLine) window.scene.remove(m.fishLine);
    }
    delete otherPlayers[id];
    updatePlayerCountBadge();
  }

  // ═══════════════════════════════════════════════
  // SEND MY STATE TO FIREBASE
  // ═══════════════════════════════════════════════
  function sendState() {
    if (!mpActive || !myRef) return;
    const now = Date.now();
    if (now - lastSend < SEND_MS) return;
    lastSend = now;

    const p = window.player;
    const h = window.hook;
    const hv = h && h.visible;

    // Get equipped rod color
    const rodDb = window.rodDatabase || {};
    const equipped = window.inventory ? window.inventory.equipped : null;
    const rodColor = rodDb[equipped] ? rodDb[equipped].color : 0x8b5a2b;

    myRef.update({
      x: +p.position.x.toFixed(2),
      y: +p.position.y.toFixed(2),
      z: +p.position.z.toFixed(2),
      ry: +p.rotation.y.toFixed(3),
      isFishing:  !!(window.isFishing),
      isSwimming: !!(window.isSwimming),
      onJetski:   !!(window.onJetski),
      hookVisible: hv,
      hookX: hv ? +h.position.x.toFixed(2) : 0,
      hookY: hv ? +h.position.y.toFixed(2) : 0,
      hookZ: hv ? +h.position.z.toFixed(2) : 0,
      rodColor: rodColor,
      shirtColor: localStorage.getItem("playerShirt") || "#2ecc71",
      ts: now
    });
  }

  // ═══════════════════════════════════════════════
  // FIREBASE CONNECTION
  // ═══════════════════════════════════════════════
  function connect() {
    try {
      if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
      db = firebase.database();

      // Generate / recover player ID
      myId = localStorage.getItem("mpId") || ("p_" + Math.random().toString(36).slice(2, 10));
      localStorage.setItem("mpId", myId);

      myRef = db.ref(`rooms/${roomId}/players/${myId}`);
      playersRef = db.ref(`rooms/${roomId}/players`);
      chatRef    = db.ref(`rooms/${roomId}/chat`);

      const myName = localStorage.getItem("playerName") || "Player";
      const shirt  = localStorage.getItem("playerShirt") || "#2ecc71";

      // Register presence
      myRef.set({
        name: myName, shirtColor: shirt,
        x: 0, y: 0, z: -8, ry: 0,
        isFishing: false, isSwimming: false, onJetski: false,
        hookVisible: false, hookX: 0, hookY: 0, hookZ: 0,
        ts: Date.now(), online: true
      });
      myRef.onDisconnect().remove();

      // ── Listen for other players ──
      playersRef.on("child_added", snap => {
        if (snap.key === myId) return;
        const d = snap.val(); if (!d) return;
        const meshes = buildPlayerMesh(d);
        otherPlayers[snap.key] = { meshes, latestData: d, walkAnim: 0, swimCycle: 0 };
        updatePlayerCountBadge();
        addSystemMsg(`🟢 ${d.name || "Player"} bergabung!`);
      });

      playersRef.on("child_changed", snap => {
        if (snap.key === myId) return;
        const d = snap.val(); if (!d) return;
        if (otherPlayers[snap.key]) {
          otherPlayers[snap.key].latestData = d;
        }
      });

      playersRef.on("child_removed", snap => {
        if (snap.key === myId) return;
        const name = otherPlayers[snap.key]?.latestData?.name || "Player";
        removeOtherPlayer(snap.key);
        addSystemMsg(`🔴 ${name} keluar.`);
      });

      // ── Listen for chat ──
      chatRef.limitToLast(1).on("child_added", snap => {
        const msg = snap.val();
        if (!msg || msg.senderId === myId) return;
        appendChatMsg(msg.name, msg.text, false);
        showFloatingBubble(msg.senderId, msg.name, msg.text);
      });

      mpActive = true;
      setStatusBadge(`🟢 Online`, "#2ecc71");
      updatePlayerCountBadge();
      addSystemMsg("✅ Terhubung ke server! Selamat bermain 🎣");

    } catch(e) {
      console.error("[MP]", e);
      setStatusBadge("🔴 Koneksi gagal", "#e74c3c");
    }
  }

  function loadFirebaseSDK(cb) {
    if (window.firebase) { cb(); return; }
    const s1 = document.createElement("script");
    s1.src = "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js";
    s1.onload = () => {
      const s2 = document.createElement("script");
      s2.src = "https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js";
      s2.onload = cb;
      s2.onerror = () => setStatusBadge("🔴 Gagal load SDK", "#e74c3c");
      document.head.appendChild(s2);
    };
    s1.onerror = () => setStatusBadge("🔴 Gagal load SDK", "#e74c3c");
    document.head.appendChild(s1);
  }

  // ═══════════════════════════════════════════════
  // CHAT UI
  // ═══════════════════════════════════════════════
  function buildChatUI() {
    // Chat box
    const box = document.createElement("div");
    box.id = "mpChatBox";
    Object.assign(box.style, {
      position: "fixed", right: "12px", bottom: "70px",
      width: "min(310px,85vw)", height: "210px",
      background: "rgba(5,10,20,0.88)", backdropFilter: "blur(8px)",
      border: "1px solid rgba(255,255,255,0.12)", borderRadius: "14px",
      display: "none", flexDirection: "column", zIndex: "500", overflow: "hidden"
    });

    const msgArea = document.createElement("div");
    msgArea.id = "mpMsgArea";
    Object.assign(msgArea.style, {
      flex: "1", overflowY: "auto", padding: "8px 10px",
      display: "flex", flexDirection: "column", gap: "3px", fontSize: "12px"
    });

    const inputRow = document.createElement("div");
    Object.assign(inputRow.style, {
      display: "flex", gap: "6px", padding: "7px 8px",
      borderTop: "1px solid rgba(255,255,255,0.08)"
    });

    const inp = document.createElement("input");
    inp.id = "mpChatInput";
    inp.placeholder = "Pesan... (Enter kirim)";
    inp.maxLength = 80;
    Object.assign(inp.style, {
      flex: "1", background: "rgba(255,255,255,0.1)", border: "none",
      borderRadius: "8px", color: "#fff", padding: "6px 10px",
      fontSize: "12px", outline: "none"
    });
    inp.addEventListener("keydown", e => {
      e.stopPropagation();
      if (e.key === "Enter") sendChat();
    });
    inp.addEventListener("focus",  () => { if (window.freezeInput !== undefined) window.freezeInput = true; });
    inp.addEventListener("blur",   () => { if (window.freezeInput !== undefined) window.freezeInput = false; });

    const sendBtn = document.createElement("button");
    sendBtn.textContent = "➤";
    Object.assign(sendBtn.style, {
      background: "linear-gradient(135deg,#27ae60,#2ecc71)", border: "none",
      borderRadius: "8px", color: "#fff", padding: "6px 11px",
      cursor: "pointer", fontSize: "13px"
    });
    sendBtn.onclick = sendChat;

    inputRow.appendChild(inp); inputRow.appendChild(sendBtn);
    box.appendChild(msgArea); box.appendChild(inputRow);
    document.body.appendChild(box);

    // Chat toggle button
    const btn = document.createElement("div");
    btn.id = "mpChatBtn";
    Object.assign(btn.style, {
      position: "fixed", right: "12px", bottom: "18px",
      width: "46px", height: "46px",
      background: "rgba(0,0,0,0.7)", border: "2px solid rgba(255,255,255,0.22)",
      borderRadius: "12px", display: "flex", alignItems: "center",
      justifyContent: "center", cursor: "pointer", zIndex: "21",
      fontSize: "20px", userSelect: "none"
    });
    btn.textContent = "💬";
    btn.title = "Chat [T]";
    btn.onclick = toggleChat;
    document.body.appendChild(btn);
  }

  function toggleChat() {
    chatOpen = !chatOpen;
    const box = document.getElementById("mpChatBox");
    box.style.display = chatOpen ? "flex" : "none";
    if (chatOpen) {
      setTimeout(() => document.getElementById("mpChatInput")?.focus(), 80);
    }
  }

  function sendChat() {
    if (!mpActive || !chatRef) {
      addSystemMsg("⚠️ Multiplayer tidak aktif.");
      return;
    }
    const inp = document.getElementById("mpChatInput");
    const text = inp.value.trim();
    if (!text) return;
    inp.value = "";
    const name = localStorage.getItem("playerName") || "Player";
    chatRef.push({ name, text, senderId: myId, ts: Date.now() });
    appendChatMsg(name, text, true);
  }

  function appendChatMsg(name, text, isSelf) {
    const area = document.getElementById("mpMsgArea"); if (!area) return;
    const el = document.createElement("div");
    Object.assign(el.style, {
      background: isSelf ? "rgba(39,174,96,0.2)" : "rgba(255,255,255,0.07)",
      borderRadius: "7px", padding: "4px 8px",
      borderLeft: "2px solid " + (isSelf ? "#2ecc71" : "#3498db")
    });
    el.innerHTML = `<span style="color:${isSelf?"#2ecc71":"#7ecfff"};font-weight:bold;font-size:11px">${name}</span>
                    <span style="color:#ddd"> ${text}</span>`;
    area.appendChild(el);
    area.scrollTop = area.scrollHeight;
    while (area.children.length > 40) area.removeChild(area.firstChild);

    // Badge notification
    if (!chatOpen && !isSelf) {
      const btn = document.getElementById("mpChatBtn");
      if (btn) { btn.textContent = "🔴"; setTimeout(() => { if (!chatOpen) btn.textContent = "💬"; }, 3000); }
    }
  }

  function addSystemMsg(text) {
    const area = document.getElementById("mpMsgArea"); if (!area) return;
    const el = document.createElement("div");
    Object.assign(el.style, { color: "#aaa", fontSize: "10px", textAlign: "center", padding: "2px" });
    el.textContent = text;
    area.appendChild(el);
    area.scrollTop = area.scrollHeight;
  }

  function showFloatingBubble(senderId, name, text) {
    const op = otherPlayers[senderId];
    if (!op || !op.meshes) return;
    const worldPos = op.meshes.group.position.clone(); worldPos.y += 6;
    const v = worldPos.project(window.camera);
    if (Math.abs(v.z) > 1) return; // behind camera

    const el = document.createElement("div");
    el.textContent = text;
    Object.assign(el.style, {
      position: "fixed",
      left: ((v.x * 0.5 + 0.5) * window.innerWidth) + "px",
      top: ((-v.y * 0.5 + 0.5) * window.innerHeight - 60) + "px",
      transform: "translateX(-50%)",
      background: "rgba(0,0,0,0.82)", color: "#fff",
      padding: "5px 12px", borderRadius: "10px",
      fontSize: "12px", zIndex: "1000",
      pointerEvents: "none", maxWidth: "180px",
      border: "1px solid rgba(255,255,255,0.2)",
      textAlign: "center", lineHeight: "1.4"
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  // ═══════════════════════════════════════════════
  // STATUS BADGE + PLAYER COUNT
  // ═══════════════════════════════════════════════
  function buildStatusBadge() {
    const el = document.createElement("div");
    el.id = "mpStatusBadge";
    Object.assign(el.style, {
      position: "fixed", left: "12px", bottom: "18px",
      background: "rgba(0,0,0,0.65)", border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: "9px", padding: "5px 11px",
      color: "#888", fontSize: "11px", zIndex: "20", pointerEvents: "none"
    });
    el.textContent = "⚫ Offline";
    document.body.appendChild(el);
  }

  function setStatusBadge(text, color) {
    const el = document.getElementById("mpStatusBadge");
    if (el) { el.textContent = text; el.style.color = color || "#fff"; }
  }

  function updatePlayerCountBadge() {
    const total = Object.keys(otherPlayers).length + 1;
    setStatusBadge(`🟢 ${total} player online`, "#2ecc71");
  }

  // ═══════════════════════════════════════════════
  // NAME ENTRY SCREEN
  // ═══════════════════════════════════════════════
  function showNameScreen(cb) {
    if (localStorage.getItem("playerName")) { cb(); return; }

    const ov = document.createElement("div");
    Object.assign(ov.style, {
      position: "fixed", inset: "0",
      background: "rgba(0,5,15,0.96)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: "99999", flexDirection: "column"
    });

    ov.innerHTML = `
      <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);
                  border-radius:22px;padding:36px 28px;text-align:center;max-width:340px;width:90%">
        <div style="font-size:52px;margin-bottom:14px">🎣</div>
        <h2 style="color:#7ecfff;margin:0 0 6px;font-size:22px">Let's Fishing!</h2>
        <p style="color:#888;font-size:12px;margin:0 0 22px">Masukkan nama untuk bermain multiplayer</p>

        <input id="mpNameInp" maxlength="14" placeholder="Nama kamu..."
          style="width:100%;padding:12px;border-radius:10px;
                 border:1px solid rgba(255,255,255,0.2);
                 background:rgba(255,255,255,0.1);color:#fff;
                 font-size:15px;outline:none;text-align:center;
                 margin-bottom:12px;box-sizing:border-box">

        <div style="display:flex;gap:8px;margin-bottom:14px">
          <div id="colorPick" style="flex:0 0 44px;height:44px;border-radius:8px;
               background:#2ecc71;cursor:pointer;border:2px solid rgba(255,255,255,0.3);
               display:flex;align-items:center;justify-content:center;font-size:18px"
               title="Pilih warna baju">👕</div>
          <input type="color" id="mpColorPicker" value="#2ecc71"
            style="display:none">
          <input id="mpRoomInp" maxlength="12" placeholder="Nama room (opsional)"
            style="flex:1;padding:12px;border-radius:10px;
                   border:1px solid rgba(255,255,255,0.15);
                   background:rgba(255,255,255,0.08);color:#aaa;
                   font-size:13px;outline:none;box-sizing:border-box">
        </div>

        <button id="mpStartBtn"
          style="width:100%;padding:13px;
                 background:linear-gradient(135deg,#27ae60,#2ecc71);
                 border:none;border-radius:11px;color:#fff;
                 font-size:15px;font-weight:bold;cursor:pointer;
                 box-shadow:0 4px 14px rgba(39,174,96,0.4)">
          Mulai Bermain ▶
        </button>

        <p style="color:#555;font-size:10px;margin:12px 0 0">
          Room yang sama = bisa bermain bareng teman
        </p>
      </div>`;

    document.body.appendChild(ov);

    let chosenColor = "#2ecc71";
    const colorPick   = document.getElementById("colorPick");
    const colorPicker = document.getElementById("mpColorPicker");
    colorPick.onclick = () => colorPicker.click();
    colorPicker.oninput = e => {
      chosenColor = e.target.value;
      colorPick.style.background = chosenColor;
    };

    const nameInp = document.getElementById("mpNameInp");
    const roomInp = document.getElementById("mpRoomInp");
    const startBtn = document.getElementById("mpStartBtn");

    [nameInp, roomInp].forEach(el => el.addEventListener("keydown", e => e.stopPropagation()));

    startBtn.onclick = () => {
      const n = nameInp.value.trim();
      if (!n) { nameInp.style.borderColor = "#e74c3c"; return; }
      const r = (roomInp.value.trim() || "world_main").replace(/\s+/g, "_");
      localStorage.setItem("playerName", n);
      localStorage.setItem("playerShirt", chosenColor);
      roomId = r;
      ov.remove();
      cb();
    };

    setTimeout(() => nameInp.focus(), 150);
  }

  // ═══════════════════════════════════════════════
  // MAIN EXPOSED API (called by script.js)
  // ═══════════════════════════════════════════════
  window.MP = {
    // Called every frame from animate()
    update(dt) {
      if (!mpActive) return;
      sendState();
      for (const id in otherPlayers) updateOtherPlayerVisuals(id, dt);
    },

    // Send a custom event (catch fish, etc.)
    sendEvent(type, data) {
      if (!mpActive || !db) return;
      db.ref(`rooms/${roomId}/events`).push({ type, data, senderId: myId, ts: Date.now() });
    },

    isActive() { return mpActive; },

    // Toggle chat from keyboard
    toggleChat,

    // Change room at runtime
    changeRoom(newRoom) {
      if (myRef) myRef.remove();
      if (playersRef) playersRef.off();
      if (chatRef) chatRef.off();
      for (const id in otherPlayers) removeOtherPlayer(id);
      roomId = newRoom;
      connect();
    }
  };

  // ═══════════════════════════════════════════════
  // KEYBOARD SHORTCUT [T] for chat
  // ═══════════════════════════════════════════════
  window.addEventListener("keydown", e => {
    if (e.key.toLowerCase() === "t" && !chatOpen) {
      e.preventDefault();
      toggleChat();
    } else if (e.key === "Escape" && chatOpen) {
      toggleChat();
    }
  });

  // ═══════════════════════════════════════════════
  // BOOT
  // ═══════════════════════════════════════════════
  buildStatusBadge();
  buildChatUI();

  if (!IS_CONFIGURED) {
    setStatusBadge("⚫ Set Firebase config dulu", "#f39c12");
    addSystemMsg("⚠️ Isi FIREBASE_CONFIG di multiplayer.js untuk aktifkan multiplayer.");
    // Still show name screen so game runs fine
    window.addEventListener("load", () => {
      setTimeout(() => {
        showNameScreen(() => {}); // just set name & color
      }, 2200);
    });
    return; // stop here, no connection attempt
  }

  // IS_CONFIGURED = true → full boot
  window.addEventListener("load", () => {
    setTimeout(() => {
      waitForScene(() => {
        showNameScreen(() => {
          setStatusBadge("🔄 Menghubungkan...", "#f39c12");
          loadFirebaseSDK(connect);
        });
      });
    }, 2000);
  });

})();
