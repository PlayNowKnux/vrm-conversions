const clamp = (num, min, max) => Math.min(Math.max(num, min), max);
const float = (num) => parseFloat(num);
const int = (num) => parseInt(num);

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

  function from_osumania(txt) {

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

  function to_vib() {
    let vib_str = `m ${this.time} `;
    let tp = '';

    if (!self.special) {
      for (const [idx, v] of this.hits) {
        if tp.length == 2 {
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
      if (ho.success) {
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

  // add bpm scroll speed sync here

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
