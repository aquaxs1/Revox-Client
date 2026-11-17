/*
 * Revox — games, stats and friends, in one place.
 *
 * The Revox mark in the middle; around it what the launcher keeps for you:
 * games from the library, a playtime chart, a friend who is online. Click or
 * tap and it all comes together for a moment. The names are made up — they
 * are the ones in the illustration of the Play screen further down.
 */
export default function scene(stage) {
  const { THREE, frame } = stage;
  stage.lights({ ambient: 0.6, key: 2.6, rim: 30 });
  stage.environment(0.9);

  const root = new THREE.Group();
  root.scale.setScalar(0.88);
  frame.add(root);
  root.add(stage.halo(stage.accent, 8, 0.24));

  /* --------------------------------------------------------------- mark */

  // The logo's outline, as in favicon.svg. That file counts y downwards from
  // the top of a 100 × 100 box; here it is turned the right way up.
  const up = (y) => 100 - y;
  const outline = new THREE.Shape();
  outline.moveTo(0, up(0));
  outline.lineTo(57, up(0));
  outline.bezierCurveTo(80, up(0), 100, up(12), 100, up(31));
  outline.bezierCurveTo(100, up(48), 85, up(62), 68, up(62));
  outline.lineTo(100, up(100));
  outline.lineTo(0, up(100));
  outline.closePath();
  const diamond = new THREE.Path();
  diamond.moveTo(47, up(14)).lineTo(69, up(32)).lineTo(47, up(50)).lineTo(25, up(32)).closePath();
  const bar = new THREE.Path();
  bar.moveTo(19, up(62)).lineTo(40, up(62)).lineTo(57, up(79)).lineTo(17, up(79)).closePath();
  outline.holes.push(diamond, bar);

  const letter = new THREE.ExtrudeGeometry(outline, { depth: 20, bevelEnabled: true, bevelThickness: 2.5, bevelSize: 2, bevelSegments: 3, curveSegments: 24 });
  letter.translate(-50, -50, -10);
  letter.scale(0.02, 0.02, 0.02);
  const position = letter.attributes.position;

  // The mark's gradient: light blue top left, deep blue bottom right.
  const from = new THREE.Color('#5bc8f5');
  const to = new THREE.Color('#1874ff');
  const colors = new Float32Array(position.count * 3);
  const shade = new THREE.Color();
  for (let i = 0; i < position.count; i += 1) {
    const t = THREE.MathUtils.clamp((position.getX(i) - position.getY(i) + 2) / 4, 0, 1);
    shade.copy(from).lerp(to, t).toArray(colors, i * 3);
  }
  letter.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const markMaterial = stage.mat.solid(0xffffff, { vertexColors: true, roughness: 0.22, metalness: 0.35, emissive: 0x1874ff, emissiveIntensity: 0.12 });
  const mark = new THREE.Mesh(letter, markMaterial);
  root.add(mark);

  /* -------------------------------------------------------------- cards */

  const round = (g, x, y, w, h, r) => {
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, r);
    else g.rect(x, y, w, h);
  };
  const base = (g, w, h) => {
    round(g, 0, 0, w, h, h * 0.16);
    g.fillStyle = 'rgba(11, 14, 19, 0.9)';
    g.fill();
    g.lineWidth = Math.max(2, h * 0.012);
    g.strokeStyle = 'rgba(155, 214, 255, 0.4)';
    g.stroke();
  };

  const game = (name, hue, players) => (g, w, h) => {
    base(g, w, h);
    const cover = g.createLinearGradient(0, 0, w, h * 0.62);
    cover.addColorStop(0, `hsl(${hue} 80% 62%)`);
    cover.addColorStop(1, `hsl(${hue + 40} 75% 34%)`);
    round(g, w * 0.07, w * 0.07, w * 0.86, h * 0.52, h * 0.1);
    g.fillStyle = cover;
    g.fill();
    // A play triangle on the cover.
    g.fillStyle = 'rgba(255, 255, 255, 0.92)';
    g.beginPath();
    g.moveTo(w * 0.43, h * 0.22);
    g.lineTo(w * 0.43, h * 0.44);
    g.lineTo(w * 0.62, h * 0.33);
    g.closePath();
    g.fill();
    g.fillStyle = '#f2f5f2';
    g.font = stage.font.body(Math.round(h * 0.1), 700);
    g.textBaseline = 'middle';
    g.fillText(name, w * 0.08, h * 0.72);
    g.fillStyle = 'rgba(242, 245, 242, 0.6)';
    g.font = stage.font.mono(Math.round(h * 0.075));
    g.fillText(players, w * 0.08, h * 0.87);
  };

  const chart = (g, w, h) => {
    base(g, w, h);
    g.fillStyle = 'rgba(242, 245, 242, 0.6)';
    g.font = stage.font.mono(Math.round(h * 0.085));
    g.textBaseline = 'middle';
    g.fillText('PLAYTIME · 14 DAYS', w * 0.08, h * 0.14);
    const days = [3, 5, 2, 6, 4, 7, 5, 8, 3, 6, 9, 5, 7, 10];
    const step = (w * 0.84) / days.length;
    days.forEach((value, i) => {
      const height = (value / 10) * h * 0.5;
      g.fillStyle = i === days.length - 1 ? '#9bd6ff' : 'rgba(61, 155, 255, 0.75)';
      round(g, w * 0.08 + i * step, h * 0.78 - height, step * 0.66, height, step * 0.2);
      g.fill();
    });
    g.fillStyle = '#f2f5f2';
    g.font = stage.font.body(Math.round(h * 0.1), 700);
    g.fillText('1 h 42 min yesterday', w * 0.08, h * 0.89);
  };

  const friend = (name, doing) => (g, w, h) => {
    base(g, w, h);
    g.fillStyle = 'rgba(61, 155, 255, 0.35)';
    g.beginPath();
    g.arc(h * 0.5, h * 0.5, h * 0.3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#5fe08a';
    g.beginPath();
    g.arc(h * 0.72, h * 0.72, h * 0.09, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#f2f5f2';
    g.font = stage.font.body(Math.round(h * 0.26), 700);
    g.textBaseline = 'middle';
    g.fillText(name, h * 1.02, h * 0.36);
    g.fillStyle = 'rgba(242, 245, 242, 0.6)';
    g.font = stage.font.mono(Math.round(h * 0.19));
    g.fillText(doing, h * 1.02, h * 0.68);
  };

  // Angle on the ring, height above it, size, and what is drawn on it.
  const cards = [
    { at: 0.0, lift: 0.5, size: [1.05, 1.05], paint: game('Tower Run', 205, '2,140 playing') },
    { at: 0.17, lift: -0.55, size: [1.6, 0.5], paint: friend('Mika', 'in Obby Kingdom') },
    { at: 0.34, lift: 0.35, size: [1.05, 1.05], paint: game('City Tycoon', 150, '860 playing') },
    { at: 0.5, lift: -0.25, size: [1.5, 1.0], paint: chart },
    { at: 0.67, lift: 0.6, size: [1.05, 1.05], paint: game('Obby Kingdom', 280, '5,300 playing') },
    { at: 0.84, lift: -0.5, size: [1.6, 0.5], paint: friend('Jonas', 'online') },
  ].map((card) => {
    const mesh = stage.plate(card.size[0], card.size[1], card.paint, { resolution: 320 });
    root.add(mesh);
    return { ...card, mesh };
  });

  // The path they travel on.
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.006, 8, 160), stage.mat.glow(stage.accent, { opacity: 0.4 }));
  ring.rotation.x = Math.PI / 2;
  root.add(ring);

  stage.dust({ count: 180, radius: 6.5, color: stage.accentHi, opacity: 0.5 });

  /* ----------------------------------------------------------- behaviour */

  // On a phone the scene is as wide as the screen: a tighter orbit keeps the cards on it.
  let reach = 2.5;
  const fit = (view) => {
    reach = view.wide ? 2.5 : 1.75;
  };
  stage.onResize(fit);
  fit(stage.view);

  let gather = 0;
  let pull = 0;
  let hold = 0;
  stage.onClick(() => {
    pull = 1;
    hold = 1.1;
  });

  stage.onFrame((time, delta) => {
    root.rotation.x = 0.3 + stage.pitch;
    root.rotation.y = stage.yaw * 0.6;
    root.position.y = 0.1 + Math.sin(time * 0.7) * 0.05;

    if (hold > 0) {
      hold -= delta;
      if (hold <= 0) pull = 0;
    }
    gather += (pull - gather) * Math.min(1, delta * (pull ? 5 : 3));

    mark.rotation.y = Math.sin(time * 0.5) * 0.35 + stage.yaw * 0.8;
    mark.scale.setScalar(1 + gather * 0.14);
    markMaterial.emissiveIntensity = 0.12 + gather * 0.9;

    const radius = reach * (1 - gather * 0.86);
    for (const card of cards) {
      const angle = card.at * Math.PI * 2 + time * 0.22;
      const depth = Math.sin(angle);
      card.mesh.position.set(Math.cos(angle) * radius, (card.lift + Math.sin(time * 0.9 + card.at * 9) * 0.07) * (1 - gather * 0.9), depth * radius);
      // Always facing the visitor; smaller and fainter at the back and when pulled in.
      card.mesh.scale.setScalar((0.74 + (depth + 1) * 0.16) * (1 - gather * 0.72));
      card.mesh.material.opacity = (0.5 + (depth + 1) * 0.25) * (1 - gather * 0.85);
      card.mesh.renderOrder = depth > 0 ? 2 : 0;
    }
    ring.scale.setScalar((reach / 2.5) * (1 - gather * 0.86));
    ring.material.opacity = 0.4 * (1 - gather);
  });
}
