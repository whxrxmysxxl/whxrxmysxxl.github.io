/* Original procedural UI sounds for Roman Sarvadi's portfolio. No sampled assets. */
(function () {
  'use strict';
  var context, master, noise, room, enabled = true, last = {}, voices = 0, phrase = 0;
  try { enabled = localStorage.getItem('portfolio.sound') !== 'off'; } catch (_) {}
  function label() {
    var button = document.getElementById('sound');
    if (!button) return;
    var ready = enabled && context && context.state === 'running';
    var pending = enabled && !ready, english = document.documentElement.lang === 'en';
    button.textContent = pending ? (english ? '▶ Sound' : '▶ Звук') : ready ? '♫' : '♪';
    button.setAttribute('data-audio', pending ? 'pending' : ready ? 'on' : 'off');
    button.setAttribute('aria-pressed', String(!!ready));
    button.setAttribute('aria-label', ready ? 'Вимкнути звук / Mute sound' : 'Увімкнути звук / Enable sound');
    button.title = pending ? 'Браузер очікує клік для запуску звуку / Click to start sound' : ready ? 'Звук увімкнено · M' : 'Увімкнути звук · M';
  }
  function unlock() {
    if (!enabled) return;
    try {
      if (!context) {
        var Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return;
        context = new Audio();
        context.onstatechange = label;
        master = context.createGain(); master.gain.value = 0.55;
        var limiter = context.createDynamicsCompressor();
        var warmth = context.createBiquadFilter(); warmth.type = 'lowpass'; warmth.frequency.value = 3400;
        master.connect(warmth); warmth.connect(limiter); limiter.connect(context.destination);
        // Small, original diffuse room: long enough to soften attacks, quiet enough for text.
        room = context.createConvolver();
        var impulse = context.createBuffer(2, Math.ceil(context.sampleRate * 0.85), context.sampleRate);
        for (var channel = 0; channel < 2; channel++) {
          var tail = impulse.getChannelData(channel);
          for (var j = 0; j < tail.length; j++) tail[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / tail.length, 3.5) * 0.12;
        }
        room.buffer = impulse;
        var wet = context.createGain(); wet.gain.value = 0.18;
        room.connect(wet); wet.connect(master);
        noise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.08), context.sampleRate);
        var samples = noise.getChannelData(0);
        for (var i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      }
      if (context.state === 'suspended' || context.state === 'interrupted') {
        return context.resume().then(function () { label(); if (enabled && context.state === 'running') play('start'); }).catch(function () { label(); });
      }
      label();
    } catch (_) { enabled = false; label(); }
  }
  function stereo(envelope, pan, reverberant) {
    var node = context.createStereoPanner ? context.createStereoPanner() : null;
    if (node) { node.pan.value = pan; envelope.connect(node); node.connect(master); if (reverberant) node.connect(room); }
    else { envelope.connect(master); if (reverberant) envelope.connect(room); }
    return node;
  }
  function felt(freq, delay, volume, pan, length) {
    // A quiet, decaying struck voice. All events share one pentatonic palette.
    var partials = [1, 2.006, 4.015], weights = [1, 0.18, 0.035];
    partials.forEach(function (ratio, i) {
      if (voices >= 24) return;
      var at = context.currentTime + delay, envelope = context.createGain();
      var source = context.createOscillator(), duration = length / (1 + i * 0.8);
      source.type = 'sine'; source.frequency.value = freq * ratio;
      envelope.gain.setValueAtTime(0, at);
      envelope.gain.linearRampToValueAtTime(volume * weights[i], at + 0.018);
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      source.connect(envelope); var panNode = stereo(envelope, pan, true); voices++;
      source.onended = function () { voices--; source.disconnect(); envelope.disconnect(); if (panNode) panNode.disconnect(); };
      source.start(at); source.stop(at + duration + 0.03);
    });
  }
  function paper(freq, duration, volume, pan) {
    if (voices >= 24) return;
    var source = context.createBufferSource(), filter = context.createBiquadFilter(), envelope = context.createGain(), at = context.currentTime;
    source.buffer = noise; filter.type = 'bandpass'; filter.frequency.value = freq; filter.Q.value = 0.55;
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(volume, at + 0.004);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter); filter.connect(envelope); var panNode = stereo(envelope, pan, false); voices++;
    source.onended = function () { voices--; source.disconnect(); filter.disconnect(); envelope.disconnect(); if (panNode) panNode.disconnect(); };
    source.start(); source.stop(at + duration + 0.01);
  }
  var keys = [261.63, 293.66, 329.63, 392, 440, 523.25], melody = [0, 2, 1, 3, 4, 2, 5, 3];
  function play(action, x) {
    if (!enabled || !context || context.state !== 'running' || document.hidden) return;
    var now = performance.now(), gap = action === 'type' ? 65 : action === 'draw' ? 300 : 180;
    if (last[action] && now - last[action] < gap) return;
    last[action] = now;
    var pan = Math.max(-0.65, Math.min(0.65, (((typeof x === 'number' ? x : innerWidth / 2) / innerWidth) - 0.5) * 1.3));
    if (action === 'type') {
      paper(900 + Math.random() * 700, 0.018 + Math.random() * 0.012, 0.045, pan);
    } else if (action === 'snap') {
      paper(650, 0.035, 0.075, pan);
    } else if (action === 'done') {
      [0, 2, 3, 5].forEach(function (key, i) { felt(keys[key], i * 0.13, 0.09, (i - 1.5) * 0.2, 2.2); });
    } else {
      var index = melody[phrase++ % melody.length];
      paper(action === 'copy' ? 1200 : 800, action === 'copy' ? 0.065 : 0.025, 0.035, pan);
      felt(keys[index], 0, action === 'copy' ? 0.065 : 0.08, pan, 1.5);
      if (action === 'image') felt(keys[(index + 2) % keys.length], 0.09, 0.035, -pan, 1.8);
    }
  }
  function toggle() {
    if (enabled && (!context || context.state !== 'running')) { unlock(); return; }
    enabled = !enabled;
    try { localStorage.setItem('portfolio.sound', enabled ? 'on' : 'off'); } catch (_) {}
    if (master && context) master.gain.setTargetAtTime(enabled ? 0.55 : 0, context.currentTime, 0.025);
    unlock(); label();
    if (enabled) play('snap');
  }
  window.PortfolioSound = { play: play, unlock: unlock, toggle: toggle };
  document.addEventListener('pointerdown', function (e) { if (!e.target.closest('#sound')) unlock(); }, { passive: true });
  document.addEventListener('keydown', function (e) {
    if (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.target.closest('input,textarea,[contenteditable]')) { if (!e.repeat) toggle(); return; }
    if (!e.target.closest('#sound')) unlock();
  });
  var button = document.getElementById('sound');
  if (button) button.addEventListener('click', toggle);
  new MutationObserver(label).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  unlock();
  label();
  if (enabled && context && context.state === 'running') play('start');
})();
