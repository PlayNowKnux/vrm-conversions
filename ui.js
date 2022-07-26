function removeExtension(fn) {
  let strs = fn.split(".");
  strs.pop();
  return strs.join(".");
}

var fileText = "";
var fileName = "";

function convert() {
  let intext = fileText;
  console.log(intext);
  let restext = "";
  try {

    //Conversion (conversion algorithm located in conversions.js)

    switch (document.getElementById("gameName").value) {
      case "osu!mania":
        restext = osumania(intext);
        break;
      case "Quaver":
        restext = quaver(intext);
        break;
    }

    // Download link

    var blob = new Blob([restext], {'type': 'text/plain'});
    var a = document.getElementById("downloadLink")
    a.download = removeExtension(fileName) + ".vib";
    a.href = (window.webkitURL || window.URL).createObjectURL(blob);
    a.dataset.downloadurl = ['text/plain', a.download, a.href].join(':');
    a.innerText = "Download"

    document.getElementById("downloadDesc").innerText = "You can right click the link and click \"Save link as\" to save it to somewhere besides your downloads folder."


  } catch (e) {
    console.log(e)
  }
}

document.getElementById("file").addEventListener("change", function(e) {
  let file = document.getElementById("file").files[0];

  (async () => {
    const fileContent = await file.text();
    fileName = file.name;
    if (file.name.endswith(".osu")) {
      document.getElementById("gameName").value = "osu!mania";
    } else if (file.name.endswith(".qua")) {
      document.getElementById("gameName").value = "Quaver";
    }
    console.log(fileContent);

    fileText = fileContent;
  })();


})


document.getElementById("file").value = ''
