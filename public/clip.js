(function () {
  "use strict";
  var THREADS = [
    ["agentic-commerce", "Agentic commerce"],
    ["retrievability", "Retrievability"],
    ["friction-as-currency", "Friction as currency"],
    ["marketplace-power", "Marketplace power"],
    ["cross-border", "Cross border"],
    ["ai-labour", "AI and labour"],
    ["consolidation", "Consolidation"],
    ["operator-reality", "Operator reality"],
    ["retail-media", "Retail media"],
    ["returns", "Returns"],
    ["platform-tax", "Platform tax"],
    ["community", "Events and community"]
  ];
  var USES = [
    ["digest", "Digest"], ["substack", "Substack"], ["ostrich", "Ostrich"],
    ["nearly", "Nearly News"], ["watson", "Watson"], ["reference", "Reference only"]
  ];
  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);
  var clip = {
    url: params.get("u") || "",
    title: params.get("t") || "",
    quote: params.get("s") || "",
    use: "reference",
    thread: ""
  };
  $("title").textContent = clip.title || "Untitled";
  try {
    $("host").textContent = new URL(clip.url).hostname.replace(/^www\./, "");
  } catch (e) {
    $("host").textContent = clip.url ? clip.url.slice(0, 60) : "no address supplied";
  }
  if (clip.quote) { $("quote").textContent = clip.quote; $("quote").hidden = false; }
  document.title = "Clip · " + (clip.title || "Cockpit");

  function buildChips(host, pairs, selected, onPick) {
    pairs.forEach(function (p) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = p[1];
      b.setAttribute("aria-pressed", String(p[0] === selected));
      b.addEventListener("click", function () {
        Array.prototype.forEach.call(host.children, function (c) {
          c.setAttribute("aria-pressed", "false");
        });
        b.setAttribute("aria-pressed", "true");
        onPick(p[0]);
      });
      host.appendChild(b);
    });
  }
  buildChips($("uses"), USES, clip.use, function (v) { clip.use = v; });
  buildChips($("threads"), THREADS.concat([["__new", "New thread"]]), "", function (v) {
    if (v === "__new") {
      $("newThread").hidden = false;
      $("newThread").focus();
      clip.thread = $("newThread").value.trim();
    } else {
      $("newThread").hidden = true;
      clip.thread = v;
    }
  });
  $("newThread").addEventListener("input", function () {
    clip.thread = $("newThread").value.trim();
  });
  $("why").addEventListener("input", function () {
    $("count").textContent = String($("why").value.length);
  });

  function showError(msg) { $("error").textContent = msg; $("error").hidden = false; }

  function save() {
    $("error").hidden = true;
    clip.why = $("why").value.trim();
    if (!clip.url) return showError("No address came through. Clip from the article page.");
    if (clip.why.length < 3) {
      showError("Give it a reason. One line on what it argues, or what it breaks.");
      $("why").focus();
      return;
    }
    $("save").disabled = true;
    $("save").textContent = "Saving";
    fetch("/api/clip", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(clip)
    })
      .then(function (r) {
        if (r.status === 401) {
          $("form").hidden = true;
          $("signin").hidden = false;
          return null;
        }
        return r.json().then(function (data) {
          if (!r.ok) throw new Error(data.error || "The Cockpit refused it.");
          return data;
        });
      })
      .then(function (data) {
        if (!data) return;
        $("form").hidden = true;
        $("done").hidden = false;
        $("echo").textContent = data.clip.why;
        setTimeout(function () { window.close(); }, 1400);
      })
      .catch(function (err) { showError(err.message || "Could not reach the Cockpit."); })
      .finally(function () { $("save").disabled = false; $("save").textContent = "Clip it"; });
  }

  $("form").addEventListener("submit", function (e) { e.preventDefault(); save(); });
  $("retry").addEventListener("click", function () {
    $("signin").hidden = true; $("form").hidden = false; save();
  });
  $("close").addEventListener("click", function () { window.close(); });
  document.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); save(); }
    if (e.key === "Escape") window.close();
  });
})();
