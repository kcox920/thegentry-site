/* Contact form: loads a CAPTCHA challenge, validates, and sends the message through The Gentry's database.
   No email address appears anywhere on the site; messages are forwarded privately. Works with keyboard and screen reader;
   the picture check has a text-question alternative. */
(function () {
  'use strict';
  var form = document.getElementById('contact-form');
  if (!form) return;
  var API = 'https://buwakjjhnhymziqxbjql.supabase.co/rest/v1/rpc/';
  var KEY = 'sb_publishable_2M9gsHIbAoQ5eH65ymlUFA_M1rS_9_0'; // the public key the app ships with
  var $ = function (id) { return document.getElementById(id); };
  var img = $('captcha-img'), qEl = $('captcha-q'), ans = $('f-captcha'), send = $('send'), status = $('form-status');
  var token = '', mode = 'image', busy = false;

  var MSG = {
    captcha_wrong: 'That answer was not right. Here is a new challenge.',
    captcha_invalid: 'That challenge was already used or is not valid. Here is a new one.',
    captcha_expired: 'That challenge expired. Here is a new one; your message is still here.',
    too_fast: 'That was very quick. Please check your message and send again in a moment.',
    message_too_short: 'Please write a message of at least a few words.',
    message_too_long: 'That message is too long. The limit is 2000 characters.',
    bad_email: 'That reply email does not look right. Fix it or leave it blank.',
    rate_limited: 'Too many messages from this connection. Please try again later.',
    forbidden: 'This page is not allowed to send messages. Please use thegentry.app.'
  };
  var RELOAD = { captcha_wrong: 1, captcha_invalid: 1, captcha_expired: 1 };

  function rpc(name, body) {
    return fetch(API + name, {
      method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: 'Bearer ' + KEY },
      body: JSON.stringify(body)
    }).then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); });
  }
  function show(el, text) { el.textContent = text; el.hidden = !text; }
  function clearErrors() {
    ['e-email', 'e-message', 'e-captcha'].forEach(function (id) { show($(id), ''); });
    ['f-email', 'f-message', 'f-captcha'].forEach(function (id) { $(id).removeAttribute('aria-invalid'); });
    status.textContent = ''; status.className = 'form-status';
  }
  function fieldError(inputId, errId, text) { show($(errId), text); $(inputId).setAttribute('aria-invalid', 'true'); }
  function banner(text, kind) { status.textContent = text; status.className = 'form-status ' + kind; }
  function setBusy(b) { busy = b; send.disabled = b || !token; send.textContent = b ? 'Sending...' : 'Send message'; }

  function loadChallenge() {
    token = ''; send.disabled = true; ans.value = '';
    img.hidden = true; qEl.hidden = true;
    return rpc('contact_challenge', { p_mode: mode })
      .then(function (c) {
        if (!c || !c.token) throw new Error('bad');
        token = c.token;
        if (c.kind === 'text') { qEl.textContent = c.question; qEl.hidden = false; }
        else { img.src = c.image; img.hidden = false; }
        send.disabled = busy;
      })
      .catch(function () { banner('We could not load the check. Press "New challenge" or try again in a minute.', 'bad'); });
  }

  // Links from other pages can choose the topic and say what the message is about (e.g. a waiver line).
  (function prefill() {
    var q = new URLSearchParams(location.search), t = q.get('topic'), about = q.get('about'), msg = q.get('message');
    if (t && Array.prototype.some.call($('f-topic').options, function (o) { return o.value === t; })) $('f-topic').value = t;
    if (about) { $('f-about').value = about.slice(0, 300); $('about-field').hidden = false; }
    if (msg) $('f-message').value = msg.slice(0, 2000);
  })();

  $('captcha-new').addEventListener('click', function () { show($('e-captcha'), ''); loadChallenge(); ans.focus(); });
  $('captcha-mode').addEventListener('click', function () {
    mode = mode === 'image' ? 'text' : 'image';
    this.setAttribute('aria-pressed', String(mode === 'text'));
    this.textContent = mode === 'text' ? 'Use the picture instead' : 'Use a text question instead';
    loadChallenge().then(function () { ans.focus(); });
  });

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (busy) return;
    clearErrors();
    var msg = $('f-message').value.trim(), email = $('f-email').value.trim(), a = ans.value.trim(), bad = null;
    if (msg.length < 5) { fieldError('f-message', 'e-message', MSG.message_too_short); bad = bad || 'f-message'; }
    if (email && !/^[^@\s<>",;]+@[^@\s<>",;]+\.[A-Za-z]{2,}$/.test(email)) { fieldError('f-email', 'e-email', MSG.bad_email); bad = bad || 'f-email'; }
    if (!a) { fieldError('f-captcha', 'e-captcha', 'Please answer the check.'); bad = bad || 'f-captcha'; }
    if (!token) { banner('The check has not loaded. Press "New challenge".', 'bad'); bad = bad || 'captcha-new'; }
    if (bad) { $(bad).focus(); return; }
    setBusy(true);
    rpc('contact_send', {
      p_token: token, p_answer: a, p_topic: $('f-topic').value, p_name: $('f-name').value.trim(),
      p_email: email, p_message: msg, p_about: $('f-about').value, p_website: $('f-website').value
    }).then(function (j) {
      if (j && j.ok) {
        form.reset(); token = '';
        Array.prototype.forEach.call(form.querySelectorAll('.field, .btn, button'), function (n) { n.hidden = true; });
        banner('Thank you. Your message is on its way to a person. If you left a reply email, we will use it only to answer you.', 'ok');
        status.focus(); busy = false; return;
      }
      var code = j && j.error, text = MSG[code] || 'Something went wrong on our side. Your message was not sent. Please try again in a minute.';
      if (code === 'message_too_short' || code === 'message_too_long') fieldError('f-message', 'e-message', text);
      else if (code === 'bad_email') fieldError('f-email', 'e-email', text);
      else if (code === 'captcha_wrong') fieldError('f-captcha', 'e-captcha', text);
      banner(text, 'bad');
      setBusy(false);
      if (RELOAD[code] || !MSG[code]) loadChallenge();
      if (code === 'captcha_wrong') ans.focus(); else status.focus();
    }).catch(function () {
      banner('We could not reach the server. Your message was not sent; check your connection and try again.', 'bad');
      setBusy(false); loadChallenge(); status.focus();
    });
  });

  loadChallenge();
})();
