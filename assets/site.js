/* Revox website — language toggle + dynamic download links */

(function () {
  var stored = null;
  try { stored = localStorage.getItem("revox-lang"); } catch (e) {}
  var lang = stored || ((navigator.language || "en").toLowerCase().indexOf("de") === 0 ? "de" : "en");
  setLang(lang);

  function setLang(next) {
    document.documentElement.setAttribute("data-lang", next);
    document.documentElement.lang = next;
    try { localStorage.setItem("revox-lang", next); } catch (e) {}
    document.querySelectorAll(".lang-toggle button").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-set-lang") === next);
    });
  }

  document.addEventListener("click", function (ev) {
    var btn = ev.target.closest("[data-set-lang]");
    if (btn) setLang(btn.getAttribute("data-set-lang"));
  });

  /* ---- Download page ---- */

  var panel = document.querySelector("[data-download]");
  if (!panel) return;

  var REPO = "aquaxs1/Revox-Client";
  var RELEASES_URL = "https://github.com/" + REPO + "/releases";
  var select = panel.querySelector(".version-select");
  var button = panel.querySelector("[data-dl-button]");
  var portable = panel.querySelector("[data-dl-portable]");
  var status = panel.querySelector(".dl-status");
  var releases = [];

  function isSetup(name) { return /set-?up|installer|\.msi$/i.test(name); }
  function fmtSize(bytes) {
    if (!bytes) return "";
    var mb = bytes / (1024 * 1024);
    return " (" + (mb >= 10 ? Math.round(mb) : mb.toFixed(1)) + " MB)";
  }

  function assetsFor(release) {
    var exes = (release.assets || []).filter(function (a) { return /\.(exe|msi)$/i.test(a.name); });
    return {
      setup: exes.filter(function (a) { return isSetup(a.name); })[0] || exes[0] || null,
      portable: exes.filter(function (a) { return !isSetup(a.name); })[0] || null
    };
  }

  function apply(release) {
    var found = assetsFor(release);
    if (found.setup) {
      button.href = found.setup.browser_download_url;
      button.removeAttribute("aria-disabled");
      status.innerHTML =
        '<span class="de">Version <span class="mono">' + release.tag_name + "</span> · " +
        found.setup.name + fmtSize(found.setup.size) + "</span>" +
        '<span class="en">Version <span class="mono">' + release.tag_name + "</span> · " +
        found.setup.name + fmtSize(found.setup.size) + "</span>";
    } else {
      button.href = release.html_url || RELEASES_URL;
      status.innerHTML =
        '<span class="de">Für <span class="mono">' + release.tag_name + '</span> liegt noch keine Installer-Datei bereit — der Button führt zur Release-Seite auf GitHub.</span>' +
        '<span class="en">No installer file is attached to <span class="mono">' + release.tag_name + "</span> yet — the button opens the release page on GitHub.</span>";
    }
    if (found.portable) {
      portable.href = found.portable.browser_download_url;
      portable.style.display = "";
      portable.querySelector("[data-portable-name]").textContent = found.portable.name + fmtSize(found.portable.size);
    } else {
      portable.style.display = "none";
    }
  }

  function fallback() {
    button.href = RELEASES_URL;
    portable.style.display = "none";
    status.innerHTML =
      '<span class="de">Das erste öffentliche Release ist noch nicht veröffentlicht. Der Button führt zur <a href="' + RELEASES_URL + '">Release-Seite auf GitHub</a> — sobald dort eine Version liegt, lädt diese Seite sie automatisch.</span>' +
      '<span class="en">The first public release has not been published yet. The button opens the <a href="' + RELEASES_URL + '">releases page on GitHub</a> — once a version is up there, this page will pick it up automatically.</span>';
  }

  fetch("https://api.github.com/repos/" + REPO + "/releases")
    .then(function (res) { return res.ok ? res.json() : Promise.reject(res.status); })
    .then(function (list) {
      releases = (list || []).filter(function (r) { return !r.draft; });
      if (!releases.length) return fallback();
      select.innerHTML = "";
      releases.forEach(function (r, i) {
        var opt = document.createElement("option");
        opt.value = String(i);
        opt.textContent = (r.name || r.tag_name) + (r.prerelease ? " (pre-release)" : "");
        select.appendChild(opt);
      });
      apply(releases[0]);
    })
    .catch(fallback);

  select.addEventListener("change", function () {
    var release = releases[Number(select.value)];
    if (release) apply(release);
  });
})();
