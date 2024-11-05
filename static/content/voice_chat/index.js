var changeRoom = (to) => { }
(async () => {
  var lang = await (await langpromize).json()
  class User {
    username = "AnUnnamedUser";
    mute = false;
    online = false;
    constructor(name) {
      this.username = name;
    }
  }
  class MyUser extends User {
    constructor() {
      super(localStorage.getItem("username") ?? "user#" + Math.floor(Math.random() * 999999));
    }
    set Username(name) {
      localStorage.setItem("username", name);
      this.username = name;
      usernameLabel.html(name);
      emitUserInformation();
    }
    get Username() { return this.username }

    set Mute(m) {
      if (audioContextInput) {
        if (m) { audioContextInput.suspend();}
        else {
          audioContextInput.resume();
        }
      }
      this.mute = m;

      editButtonClass($("#mute_btn"), m);
      emitUserInformation();
    }
    get Mute() { return this.mute }

    set Online(onl) {
      this.online = onl;

      editButtonClass($("#onl_btn"), this.online);
      emitUserInformation();
      if (!onl&&audioContextInput)
      {
        audioContextInput.close()
      }
      if (onl)
        mainFunction();
    }
    get Online() { return this.online }
  }

  var socket = io({
    reconnection: true,
    reconnectionDelay: 1000
  }); //Create connection <--
  const userStatus = new MyUser();
  const settings = JSON.parse(localStorage.getItem("settings")) ?? {
    record_length: 500,
    mic: "",
    speaker: "",
    mic_disconnect_notification: true,
    connect_notification: false,
    disconnect_notification: false,
    height_ping_notification: 100,
    height_ping_notification_bool: false,
    debug: false,
    self_spectogram: false,
    self_spectogramm_type: "Columnar"
  }
  
  var canvas = $("#self-spectogramm").get(0);
  var canvasContext = canvas.getContext("2d");

  /**
   * @type {AudioContext}
   */
  let audioContext;
  /**
   * @type {AudioContext}
   */
  let audioContextInput;

  const usernameInput = $("#settings-username");
  const usernameLabel = $("#username-label");
  const usersDiv = $("#users");
  var ping_p = $("#ping");

  var disconnected_notification = { close: () => { } };
  var mic_disconnected_notification = { close: () => { } };
  var connected_notification = { close: () => { } };
  var height_ping_notification = { close: () => { } };


  if (localStorage.getItem("username") == null) {
    $("#username_startup").val(userStatus.Username)
    new bootstrap.Modal('#startup_select').show()
  }
  if (Notification.permission == 'granted') {
    (new bootstrap.Toast('#notification_toast')).hide()
  }
  var haveSink = "setSinkId" in AudioContext.prototype;
  $("#settings-speaker").prop('disabled', !haveSink)

  usernameInput.val(userStatus.Username);
  userStatus.Username = userStatus.Username;

  socket.on("connect", () => {
    ping_p.removeClass("text-decoration-line-through");
    disconnected_notification.close();
    settings.connect_notification && (connected_notification = new Notification("js.maserplay.ru", { body: lang["Connected"], icon: "/favicon.ico" }));
    socket.emit("userInformation", userStatus);
    $("#onl_btn").attr("disabled", false)
    usersDiv.html("")
  });

  socket.on("disconnect", (reason) => {
    ping_p.addClass("text-decoration-line-through");
    settings.disconnect_notification && (disconnected_notification = new Notification("js.maserplay.ru", { body: lang["Disconected"].format(reason.capitalize()), icon: "/favicon.ico" }));
    connected_notification.close();
    $("#onl_btn").attr("disabled", true)
    usersDiv.html(`<div class='text-center'> <div class='spinner-border' role='status'> <span class='visually-hidden'>${lang["Loading"]}...</span> </div> </div>`)
    $("#groupRooms").html(`<button class='btn btn-outline-secondary' type='button' disabled> <span class='spinner-border spinner-border-sm' role='status' aria-hidden='true'></span> <span class='visually-hidden'>${lang["Loading"]}...</span> </button>`)
  });
  socket.on("ChangeMute", (mute) => { if (mute) { return }; userStatus.Mute = mute; })
  socket.on("ChangeConnection", (conn) => { if (conn) { return }; userStatus.Online = conn; })
  socket.on("ChangeNickname", (nick) => { userStatus.Username = nick; })

  async function getmic() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      MicAvailable(true)
      $('#settings-mic').html("")
      stream.getAudioTracks().forEach((track) => {
        $('#settings-mic').append($('<option>', {
          value: track.id,
          text: track.label,
          disabled: track.muted
        })); track.stop();
      })
    } catch (e) {
      if (e.message == "Requested device not found") { MicAvailable(false) }; console.error(e);
    }
  }
  async function getspe() {
    if ("setSinkId" in AudioContext.prototype) {
      $("#settings-speaker").html("");
      (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind == "audiooutput").forEach((device) => {
        $("#settings-speaker").append($('<option>', {
          value: device.deviceId,
          text: device.label,
        }));
      })

    } else {
      console.error("setSinkId not supported")
    }
  }

  async function mainFunction() {

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      MicAvailable(true)
      if (settings.mic && settings.mic.trim() !== "" && stream.getTrackById(settings.mic)) {
        stream.addTrack(stream.getTrackById(settings.mic))
      }
      audioContextInput = new AudioContext();

      const audioSource = audioContextInput.createMediaStreamSource(stream);

      const dest = audioContextInput.createMediaStreamDestination()
      audioSource.connect(dest)

      if (settings.self_spectogram) {
        const analyser = audioContextInput.createAnalyser();
        audioSource.connect(analyser);
        analyser.minDecibels = -90;
        analyser.maxDecibels = -30;
        analyser.smoothingTimeConstant = 0.85;
        canvas.width = canvas.getBoundingClientRect().width;
        const WIDTH = canvas.width;
        const HEIGHT = canvas.height;
        canvasContext.fillStyle = `rgba(${getComputedStyle(canvas).getPropertyValue("--bs-secondary-rgb")},1)`;
        canvasContext.fillRect(0, canvas.height - 1, canvas.width, 1);
        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        var draw = () => {
          requestAnimationFrame(draw);

          canvasContext.clearRect(0, 0, canvas.width, canvas.height - 1)

          const dataArray = new Uint8Array(bufferLength);
          analyser.getByteFrequencyData(dataArray);

          const barWidth = (WIDTH / bufferLength) * 2.5;
          let x = 0;

          switch (settings.self_spectogramm_type) {
            case "Columnar":
              for (let i = 0; i < bufferLength; i++) {
                const barHeight = dataArray[i];
                canvasContext.fillRect(
                  WIDTH / 2 + x,
                  HEIGHT - barHeight / 2,
                  barWidth / 2,
                  barHeight / 2
                );
                canvasContext.fillRect(
                  WIDTH / 2 - x,
                  HEIGHT - barHeight / 2,
                  barWidth / 2 * -1,
                  barHeight / 2
                );

                x += barWidth / 2;
              }
              break;
            case "Solid":
              canvasContext.beginPath();
              canvasContext.moveTo(WIDTH / 2 + x, HEIGHT);
              for (let i = 0; i < bufferLength; i++) {
                const barHeight = dataArray[i];
                canvasContext.lineTo(
                  WIDTH / 2 + x,
                  HEIGHT - barHeight / 2
                );
                x += barWidth / 2;
              }
              canvasContext.closePath();
              canvasContext.strokeStyle = `rgba(${getComputedStyle(canvas).getPropertyValue("--bs-secondary-rgb")},1)`;
              canvasContext.fill()
              canvasContext.stroke()

              x = 0;

              canvasContext.beginPath();
              canvasContext.moveTo(WIDTH / 2 + x, HEIGHT);
              for (let i = 0; i < bufferLength; i++) {
                const barHeight = dataArray[i];
                canvasContext.lineTo(
                  WIDTH / 2 + x,
                  HEIGHT - barHeight / 2
                );
                x -= barWidth / 2;
              }
              canvasContext.closePath();
              canvasContext.strokeStyle = `rgba(${getComputedStyle(canvas).getPropertyValue("--bs-secondary-rgb")},1)`;
              canvasContext.fill()
              canvasContext.stroke()
              break;

            default:
              break;
          }


        }
        draw()
      }


      const madiaRecorder = new MediaRecorder(dest.stream, { 'type': 'audio/ogg; codecs=opus' });
      madiaRecorder.start();

      var audioChunks = [];

      madiaRecorder.addEventListener("dataavailable", function (event) {
        if (event.data.size == 0){
          return
        }
        // console.log(event.data)
        audioChunks.push(event.data);
      });

      madiaRecorder.addEventListener("stop", function () {
        if (audioChunks.length != 0) {
          var audioBlob = new Blob(audioChunks);

          audioChunks = [];

          var fileReader = new FileReader();
          fileReader.readAsDataURL(audioBlob);
          fileReader.onloadend = function () {
            if (!userStatus.Online) return;

            var base64String = fileReader.result;
            socket.emit("voice", base64String);

          };
        }
        if (audioContextInput.state === "suspended" || audioContextInput.state === "running") { madiaRecorder.start(); }


        // clearTimeout(timeout)
        setTimeout(function () {
          madiaRecorder.stop();
        }, settings.record_length);
      });

      setTimeout(function () {
        madiaRecorder.stop();
      }, settings.record_length);

    } catch (e) {
      if (e.message == "Requested device not found") { MicAvailable(false) }
      console.error(e);
    }
  }

  socket.on("send", async function (data) {
    if (!userStatus.Online) return;
    if (!CheckUrl(data)) {
      console.warn("url isn`t valid")
      return;
    };

    // Grab audio track via fetch() for convolver node
    try {
      const response = await fetch(data);
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength <= 0) {
        console.warn("arrayBuffer.byteLength <= 0")
        return;
      };
      const decodedAudio = await audioContext.decodeAudioData(arrayBuffer);
      source = audioContext.createBufferSource();
      source.buffer = decodedAudio;
      source.connect(audioContext.destination);
      source.start();
    } catch (error) {
      console.error(
        `Unable to fetch the audio file. Error: ${error.message}`
      );
    }
  });

  function CheckUrl(string) {
    let url;
    try {
      url = new URL(string);
    } catch (_) {
      return false;
    }
    return !url.protocol || url.protocol == "data:";
  }

  socket.on("usersUpdate", function (data) {
    usersReset();
    for (const key in data) {
      if (!Object.hasOwnProperty.call(data, key)) continue;
      const element = data[key];

      if (data[key].online) { userVisible(element.username, !element.mute); }
    }
  });
  socket.on("roomsChanged", (rooms) => {
    $("#groupRooms").html("")
    for (key in rooms) {
      const r =rooms[key] 
      $("#groupRooms").append(
        `<button type='button' class='btn ${r.is_we_here?"btn-secondary":"btn-outline-secondary"} w-100 text-break' onclick='changeRoom("${r}")'>${escapeHtml(r.owner==="System"?lang[key]:lang["room_author"].format(r.owner))}</button>`
      )
    }
    $("#groupRooms").append(
      `<button type='button' class='btn btn-outline-secondary w-100 text-break' onclick='changeRoom("+")'>+</button>`
    )
  })

  function TryCreateContext() {
    if (audioContext) { return }
    audioContext = new AudioContext()
    if (haveSink) { audioContext.setSinkId(settings.speaker); }
  }

  function editButtonClass(target, bool) {
    target.removeClass("active");

    if (bool)
      return target.addClass("active");

    target.removeClass("active");
  }

  function emitUserInformation() {
    socket.emit("userInformation", userStatus);
  }



  function userVisible(name, mic, vis = true) {
    if (vis) {
      usersDiv.append(`<div class=\"col-md-3\"><div class=\"card\"><div class=\"card-body\">${escapeHtml(name)}<span class="bi ${mic ? "bi-mic" : "bi-mic-mute"}"></span></div></div></div>`);
    } else {
      $(`#card-${name}`).remove()
    }
  }
  function usersReset() {
    usersDiv.html("")
  }
  function MicAvailable(isavailable) {
    if (settings.mic_disconnect_notification) {
      if (!isavailable) {
        mic_disconnected_notification = new Notification("js.maserplay.ru", { body: lang["Microphone disconnected"], icon: "/favicon.ico" })
      }
      else {
        mic_disconnected_notification.close()
      }

    }
    if (!isavailable) { userStatus.Mute = true; }
    $("#mute_btn").attr("disabled", !isavailable);
  }
  (() => { //load settings
    for(key in settings){
      switch (typeof settings[key]) {
        case 'string':
          $("#settings-"+key).val(settings[key])
          break;      
        case 'boolean':
          $("#settings-"+key).prop('checked',settings[key])
          break;
        case 'number':
          $("#settings-"+key+"-num").val(settings[key]);
          $("#settings-"+key).val(settings[key]);
          break;
        default:
          console.warn("cannot find case to typeof "+typeof settings[key]+"key: "+key)
          break;
      }
    }
    $('#settings-username').val(userStatus.Username);
  })()
  function saveSettings() {
    for(key in settings){
      switch (typeof settings[key]) {
        case 'string':
          if (!!$("#settings"+key).val())
            {
              settings[key]=$("#settings-"+key).val()
            }
          
          break;      
        case 'boolean':
          settings[key]=$("#settings-"+key).prop('checked')
          break;
        case 'number':
          settings[key]=Number($("#settings-"+key).val());
          break;
        default:
          console.warn("cannot find case to typeof "+typeof settings[key])
          break;
      }
    }
    userStatus.Username = $('#settings-username').val();
    localStorage.setItem("settings",JSON.stringify(settings))
  }

  setInterval(() => {
    if (document.visibilityState === "hidden") //dontcheck ping if document non visible
    {
      return
    }

    const start = Date.now();

    socket.emit("ping", () => {
      const duration = Date.now() - start;
      ping_p.html(duration);
      if (settings.height_ping_notification_bool) {
        if (duration >= settings.height_ping_notification) {
          height_ping_notification = new Notification("js.maserplay.ru", { body: lang["Ping too height!"].format(duration), icon: "/favicon.ico" });
        } else {
          height_ping_notification.close();
        }
      }
    });
  }, 1000);
  $("#notification_toast_btn").on('click', function () {
    Notification.requestPermission(g => { 'granted' == g && new bootstrap.Toast('#notification_toast').hide() });
  })
  function clearSettings() {
    localStorage.removeItem('settings'); localStorage.removeItem('username'); location.reload();
  }
  $("#clearAll").on('click', function () {
    clearSettings()
  })
  $("#saveSettings").on('click', function () {
    saveSettings()
    $("#Settings").hide();
    $("#Main").show()
  })
  $("#closeSettings").on('click', function () {
    $("#Settings").hide();
    $("#Main").show()
  })
  $("#onl_btn").on('click', function () {
    TryCreateContext()
    userStatus.Online = !userStatus.Online;
  })
  $("#mute_btn").on('click', function () {
    userStatus.Mute = !userStatus.Mute;
  })
  $("#sett_btn").on('click', function () {
    TryCreateContext()
    $("#Settings").show();
    $("#Main").hide();
    getmic();
    if ("setSinkId" in AudioContext.prototype) {
    getspe();
    }
  })
  $("#AcceptWelcome").on('click', function () {
    TryCreateContext()
    userStatus.Username = $('#username_startup').val()
  })
  $("#settings-speaker").on('focus', function () {
    getspe()
  })
  $("#settings-mic").on('focus', function () {
    getmic()
  })
  changeRoom = (to) => {
    socket.emit("changeRoom", to)
  }
  function escapeHtml(str) {
    return String(str)
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/`/g, '&#x60;');
  }
  
  canvasContext.fillStyle = `rgba(${getComputedStyle(canvas).getPropertyValue("--bs-secondary-rgb")},1)`;
  canvasContext.fillRect(0, canvas.height-1, canvas.width, 1);
  $("#Loading").hide()
  $("#Main").show()
})()