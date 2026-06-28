(function () {
  "use strict";

  var B = window.BENCH;
  var tools = B.tools;
  var cols  = B.headlineCols;

  function fmt(v, kind) {
    if (v == null || isNaN(v)) return null;
    if (kind === "pct") return (v * 100).toFixed(1) + "%";
    return v.toFixed(2);
  }
  function cell(v, kind) {
    var s = fmt(v, kind);
    return s == null ? '<span class="dash">&mdash;</span>' : '<span class="num">' + s + "</span>";
  }
  var arrow = function (dir) {
    return '<span class="arrow">' + (dir < 0 ? "↓" : "↑") + "</span>";
  };

  function wmean(rows, key) {
    var s = 0, n = 0;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i], v = r[key];
      if (v == null || isNaN(v)) continue;
      s += v * r.n; n += r.n;
    }
    return n ? s / n : null;
  }
  function rowsForTool(toolKey) {
    return B.rowsDir.filter(function (r) { return r.group.split("/")[0] === toolKey; });
  }
  function rowsForToolCorpus(toolKey, corpus) {
    return B.rowsCorpus.filter(function (r) {
      return r.group.split("/")[0] === toolKey && r.corpus === corpus;
    });
  }
  function val(toolKey, key, scope) {
    return wmean(scope === "overall" ? rowsForTool(toolKey) : rowsForToolCorpus(toolKey, scope), key);
  }

  function renderQuality() {
    var best = {};
    cols.forEach(function (c) {
      if (!c.quality) return;
      var bv = null;
      tools.forEach(function (t) {
        var v = val(t.key, c.key, "overall");
        if (v == null || isNaN(v)) return;
        if (bv == null || (c.dir < 0 ? v < bv : v > bv)) bv = v;
      });
      best[c.key] = bv == null ? null : fmt(bv, c.fmt);
    });

    var head = "<thead><tr><th class='tool'>Configuration</th>" +
      cols.map(function (c) {
        return "<th>" + c.label + (c.unit ? " " : " ") + arrow(c.dir) + "</th>";
      }).join("") + "</tr></thead>";

    var body = "<tbody>" + tools.map(function (t) {
      var tds = cols.map(function (c) {
        var v = val(t.key, c.key, "overall");
        var isBest = c.quality && best[c.key] != null && fmt(v, c.fmt) === best[c.key];
        return "<td class='" + (isBest ? "best" : "") + "'>" + cell(v, c.fmt) + "</td>";
      }).join("");
      return "<tr><td class='tool'>" + t.name + "</td>" + tds + "</tr>";
    }).join("") + "</tbody>";

    document.getElementById("quality-table").innerHTML = head + body;
  }

  function renderResources() {
    var head = "<thead><tr><th class='tool'>Configuration</th><th>Availability</th>" +
      "<th>CPU</th><th>Memory</th><th>GPU</th></tr></thead>";
    var body = "<tbody>" + tools.map(function (t) {
      return "<tr><td class='tool'>" + t.name + "</td>" +
        "<td style='text-align:left'>" + t.availability + "</td>" +
        "<td><span class='num'>" + t.cpu + "%</span></td>" +
        "<td><span class='num'>" + t.memMB + " MB</span></td>" +
        "<td><span class='num'>" + t.gpu + "%</span></td></tr>";
    }).join("") + "</tbody>";
    document.getElementById("resource-table").innerHTML = head + body;
  }

  function dirFor(gender, tgt) {
    if (gender === "Female") return tgt === "F" ? "F_to_F" : "F_to_M";
    return tgt === "F" ? "M_to_F" : "M_to_M";
  }
  function player(src) {
    return '<audio controls preload="none" src="' + src + '"></audio>';
  }
  function audioTable(id, tgt) {
    var head = "<thead><tr><th>Source</th>" +
      tools.map(function (t) {
        return "<th class='tool-head'>" + t.name + "<span class='th-type'>" + t.type + "</span></th>";
      }).join("") + "</tr></thead>";

    var body = "<tbody>" + B.samples.map(function (s) {
      var d = dirFor(s.gender, tgt);
      var srcCell = "<td class='src-cell'>" +
        "<div class='src-meta'>" + s.corpusLabel + " &middot; " + s.gender + " &middot; " + s.dur + "s</div>" +
        "<div class='src-text'>&ldquo;" + s.transcript + "&rdquo;</div>" +
        player("audio/source/" + s.id + ".mp3") + "</td>";
      var toolCells = tools.map(function (t) {
        return "<td>" + player("audio/converted/" + t.key + "/" + d + "/" + s.id + ".mp3") + "</td>";
      }).join("");
      return "<tr>" + srcCell + toolCells + "</tr>";
    }).join("") + "</tbody>";

    document.getElementById(id).innerHTML = head + body;
  }

  function renderTargets() {
    document.getElementById("seedvc-targets").innerHTML =
      "<span class='tgt-ref'><span>female &rarr;</span>" + player("audio/target/seedvc_female.mp3") + "</span>" +
      "<span class='tgt-ref'><span>male &rarr;</span>" + player("audio/target/seedvc_male.mp3") + "</span>";
  }

  function wireLinks() {
    var links = document.querySelectorAll("a[data-link]");
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (a.getAttribute("href") === "#") {
        a.title = "Link to be added";
        a.addEventListener("click", function (e) { e.preventDefault(); });
      }
    }
  }

  renderQuality();
  renderResources();
  audioTable("audio-female", "F");
  audioTable("audio-male", "M");
  renderTargets();
  wireLinks();
})();
