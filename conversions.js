// These functions are for easier porting from Python

const clamp = (num, min, max) => Math.min(Math.max(num, min), max);
const float = (num) => parseFloat(num);
const int = (num) => parseInt(num);
const round = Math.round;

Object.prototype.get = function(key, fallback = null) {
  if (key in this) {
    return this[key];
  } else {
    return fallback;
  }
}

String.prototype.startswith = function(val) {
  return this.substring(0, val.length) == val;
}

Array.prototype.from_last = function (idx) {
  return this[this.length - idx];
};

///////////////////////////////////////////////////////////////

function calc_scroll_speed(bpm, kwargs = {}) {
  let precedent = kwargs.get("default_bpm", 120) * kwargs.get("default_scroll", 2000)
  return Math.round(precedent / bpm)
}

function enumerate(l) {
  r = [[],[]];
  for (let i = 0; i < l.length; i++) {
    r[0].push(i);
    r[1].push(l[i]);
  }
  return r;
}

function TimeSection() {
  this.bpm = 120;
  this.offset = 0;
  this.success = 0;

  this.from_osumania = function(txt) {
    try {

      let data = txt.split(",");
      this.offset = Math.round(parseFloat(data[0]));

      // if uninherited
      if (parseInt(data[6])) {
        this.bpm = Math.round(60000 / float(data[1]), 3);
        this.success = 1;
      } else {
        this.success = 0;
      }

    }
    catch (e) {
      console.log(e);
    }

  }

  this.from_quaver = function(o) {
    try {
      this.offset = o.get("StartTime", 0);
      this.bpm = o["Bpm"];
      this.success = 1;
    } catch (e) {
      console.log(e);
    }
  }

  this.to_vib = function() {
    return `\noff fb ${this.offset}:\nbpm ${this.bpm}\n#\n`;
  }
}


function Note() {

  this.hits = [0,0,0,0]
  this.time = 0;
  this.success = 0;
  this.special = "";
  this.value = 0;

  this.from_osumania = function(txt) {

    try {

      let data = txt.split(",");
      // Calculate which key is active based on x position
      let x = clamp(Math.floor(parseInt(data[0]) * 4 / 512), 0, 3);
      this.hits[x] = 1;
      this.time = int(data[2]);
      this.success = 1;


    } catch (e) {
      console.log(e);
    }

  }

  this.from_quaver = function(o) {
    try {
      this.time = o["StartTime"];
      this.hits[o["Lane"] - 1] = 1;

      this.success = 1;
    } catch (e) {
      console.log(e);
    }
  }

  this.to_vib = function() {
    let vib_str = `m ${this.time} `;
    let tp = '';

    if (!this.special) {
      for (let en = 0; en < this.hits.length; en++) {
        // idx, v
        let idx = en
        let v = this.hits[en];
        if (tp.length == 2) {
          break;
        }
        if (v) {
          tp += "BPLW"[idx];
        }
      }
    } else {
      tp += this.special + " ";
      switch (this.special) {
        case "scroll":
          tp += `&speed=${this.value}`;
          break;
      }
    }

    return vib_str + tp + "\n";
  }

}

function osumania(input, kwargs = {}) {
  let data = input.split("\n");

  let outstr = "";
  let timing_points = [];
  let notes = [];
  let shadow = kwargs.get("shadow", 0);
  let bpm_scroll_speed = kwargs.get("bpm_scroll_speed", 1);
  let state = ""

  for (let inst of data) {
    if (inst.startswith("[")) {
        state = inst;
    }
    else if (state == "[TimingPoints]") {
        let tp = new TimeSection();
        tp.from_osumania(inst);
        if (tp.success) {
            timing_points.push(tp);
          }
    }
    else if (state == "[HitObjects]") {
      let ho = new Note();
      ho.from_osumania(inst);

      if (isNaN(ho.time)) {
        ho.success = 0;
      }

      if (ho.success) {
        // accessing an array value that doesn't exist doesn't throw an error
        // in Javascript, so we have to do it a different way
        if (notes.from_last(1) != undefined) {
          if (ho.time == notes.from_last(1).time) {
            let nn = notes.from_last(1);
            nn.from_osumania(inst);
            notes[notes.length-1] = nn;
          } else {
            notes.push(ho)
          }
        } else {
          notes.push(ho);
        }
      }
    }

  }

  let headers = "meta FileFormat VibRibbonMinus";

  if (shadow) {
    // Only allow note in a certain amount of time
    let next_shadow_time = 0;
    let ok_notes = [];
    for (let note of notes) {
      if (note.time >= next_shadow_time) {
        ok_notes.push(note);
        next_shadow_time = note.time + shadow;
      }
    notes = ok_notes;
    }
  }

  if (bpm_scroll_speed) {
    for (let i of timing_points) {
      let n = new Note();
      n.time = i.offset;
      n.special = "scroll";
      n.value = calc_scroll_speed(i.bpm);
      notes.push(n);
    }
    notes.sort((a, b) => (a.time > b.time) ? 1 : -1)
    headers += `\nmeta ScrollSpeed ${calc_scroll_speed(timing_points[0].bpm)}`
  }

  outstr += headers;
  for (let i of timing_points) {
    outstr += i.to_vib();
  }

  outstr += "\nstart\n"

  for (let i of notes) {
    outstr += i.to_vib();
  }

  return outstr;
}

function quaver(input, kwargs = {}) {
  let data = jsyaml.load(input);

  let outstr = "";
  let timing_points = [];
  let notes = [];
  let shadow = kwargs.get("shadow", 0);
  let bpm_scroll_speed = kwargs.get("bpm_scroll_speed", 1);

  if (data["Mode"] != 'Keys4') {
    console.log(data["Mode"])
    alert("This map is not a 4-key map");
    return;
  }

  for (let i of data["TimingPoints"]) {
    let tp = new TimeSection();
    tp.from_quaver(i);
    timing_points.push(tp);
  }

  console.log(data["HitObjects"])
  for (let i of data["HitObjects"]) {

    h = new Note();
    let append = false;

    try {

      if (notes.from_last(1).time == i["StartTime"]) {
        h = notes.from_last(1);
      } else {
        throw new Error();
      }

    } catch (e) {

      append = true;

    } finally {

      h.from_quaver(i);
      if (append) {
        notes.push(h);
      }

    }


  }

    let headers = "meta FileFormat VibRibbonMinus";

    if (shadow) {
      // Only allow note in a certain amount of time
      let next_shadow_time = 0;
      let ok_notes = [];
      for (let note of notes) {
        if (note.time >= next_shadow_time) {
          ok_notes.push(note);
          next_shadow_time = note.time + shadow;
        }
      notes = ok_notes;
      }
    }

    if (bpm_scroll_speed) {
      for (let i of timing_points) {
        let n = new Note();
        n.time = i.offset;
        n.special = "scroll";
        n.value = calc_scroll_speed(i.bpm);
        notes.push(n);
      }
      notes.sort((a, b) => (a.time > b.time) ? 1 : -1)
      headers += `\nmeta ScrollSpeed ${calc_scroll_speed(timing_points[0].bpm)}`
    }

    outstr += headers;
    for (let i of timing_points) {
      outstr += i.to_vib();
    }

    outstr += "\nstart\n"

    for (let i of notes) {
      outstr += i.to_vib();
    }

    return outstr;

}
